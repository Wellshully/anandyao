"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireSpace } from "@/lib/space/require-space";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

import { sendPushToUser } from "@/features/notifications/lib/send-push-to-user";

const DEFAULT_ACTION_NAME = "戳一下";

const MAX_ACTION_NAME_LENGTH = 12;
const INTERACTION_COOLDOWN_SECONDS = 15;

export type UpdateInteractionNameResult =
  | {
      success: true;
      actionName: string;
    }
  | {
      success: false;
      error: string;
    };
export type SendInteractionResult =
  | {
      success: true;
      actionName: string;
      sent: number;
      cooldownSeconds: number;
    }
  | {
      success: false;
      error: string;
      retryAfterSeconds?: number;
    };
function normalizeActionName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function validateActionName(value: string) {
  const actionName = normalizeActionName(value);

  if (!actionName) {
    throw new Error("動作名稱不能是空白。");
  }

  /*
   * Array.from() handles Unicode characters
   * better than value.length for names
   * containing emoji / CJK characters.
   */
  if (Array.from(actionName).length > MAX_ACTION_NAME_LENGTH) {
    throw new Error(`動作名稱最多 ${MAX_ACTION_NAME_LENGTH} 個字。`);
  }

  return actionName;
}

export async function updateInteractionNameAction(
  value: string,
): Promise<UpdateInteractionNameResult> {
  try {
    const [supabase, user] = await Promise.all([createClient(), requireUser()]);

    const actionName = validateActionName(value);

    const { error } = await supabase.from("interaction_settings").upsert(
      {
        user_id: user.id,

        action_name: actionName,

        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    );

    if (error) {
      throw new Error(`Failed to update interaction name: ${error.message}`);
    }

    revalidatePath("/");

    return {
      success: true,
      actionName,
    };
  } catch (cause) {
    /*
     * Preserve redirect(), notFound(), etc.
     */
    unstable_rethrow(cause);

    console.error("updateInteractionNameAction error:", cause);

    return {
      success: false,

      error: cause instanceof Error ? cause.message : "更新動作名稱失敗。",
    };
  }
}
export async function sendInteractionAction(): Promise<SendInteractionResult> {
  try {
    const [supabase, user, space] = await Promise.all([
      createClient(),
      requireUser(),
      requireSpace(),
    ]);

    /*
     * Make sure every user has a settings row,
     * even if they never customised the action name.
     */
    const { error: ensureSettingError } = await supabase
      .from("interaction_settings")
      .upsert(
        {
          user_id: user.id,
          action_name: DEFAULT_ACTION_NAME,
        },
        {
          onConflict: "user_id",
          ignoreDuplicates: true,
        },
      );

    if (ensureSettingError) {
      throw new Error(
        `Failed to prepare interaction settings: ${ensureSettingError.message}`,
      );
    }

    /*
     * Atomically claim the one-minute send window.
     *
     * Using one UPDATE statement means rapid double-clicks
     * cannot both successfully claim the cooldown.
     */
    const now = new Date();

    const cooldownCutoff = new Date(
      now.getTime() - INTERACTION_COOLDOWN_SECONDS * 1000,
    ).toISOString();

    const { data: claimedSetting, error: claimError } = await supabase
      .from("interaction_settings")
      .update({
        last_sent_at: now.toISOString(),
      })
      .eq("user_id", user.id)
      .or(`last_sent_at.is.null,last_sent_at.lt.${cooldownCutoff}`)
      .select(
        `
          action_name,
          last_sent_at
        `,
      )
      .maybeSingle();

    if (claimError) {
      throw new Error(
        `Failed to check interaction cooldown: ${claimError.message}`,
      );
    }

    /*
     * No row returned means the UPDATE did not match,
     * so this user is still inside the cooldown.
     */
    if (!claimedSetting) {
      const { data: currentSetting, error: currentSettingError } =
        await supabase
          .from("interaction_settings")
          .select("last_sent_at")
          .eq("user_id", user.id)
          .maybeSingle();

      if (currentSettingError) {
        throw new Error(
          `Failed to read interaction cooldown: ${currentSettingError.message}`,
        );
      }

      let retryAfterSeconds = INTERACTION_COOLDOWN_SECONDS;

      if (currentSetting?.last_sent_at) {
        const elapsed =
          Date.now() - new Date(currentSetting.last_sent_at).getTime();

        retryAfterSeconds = Math.max(
          1,
          Math.ceil((INTERACTION_COOLDOWN_SECONDS * 1000 - elapsed) / 1000),
        );
      }

      return {
        success: false,

        error: `再等 ${retryAfterSeconds} 秒就可以了。`,

        retryAfterSeconds,
      };
    }

    const [profileResult, memberResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle(),

      supabase
        .from("space_members")
        .select("user_id")
        .eq("space_id", space.id)
        .neq("user_id", user.id)
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      throw new Error(
        `Failed to load sender profile: ${profileResult.error.message}`,
      );
    }

    if (memberResult.error) {
      throw new Error(
        `Failed to find interaction recipient: ${memberResult.error.message}`,
      );
    }

    if (!memberResult.data) {
      throw new Error("找不到另一位 An & Yao 成員。");
    }

    const actionName =
      claimedSetting.action_name?.trim() || DEFAULT_ACTION_NAME;

    const senderName = profileResult.data?.display_name?.trim() || "對方";

    const pushResult = await sendPushToUser(memberResult.data.user_id, {
      title: "An & Yao",

      body: `${senderName}：${actionName}`,

      url: "/",
    });

    if (pushResult.sent === 0) {
      return {
        success: false,

        error: "對方目前沒有可用的通知裝置。",

        retryAfterSeconds: INTERACTION_COOLDOWN_SECONDS,
      };
    }

    return {
      success: true,

      actionName,

      sent: pushResult.sent,

      cooldownSeconds: INTERACTION_COOLDOWN_SECONDS,
    };
  } catch (cause) {
    unstable_rethrow(cause);

    console.error("sendInteractionAction error:", cause);

    return {
      success: false,

      error: cause instanceof Error ? cause.message : "傳送失敗。",
    };
  }
}
