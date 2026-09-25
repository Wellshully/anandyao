"use server";

import { createClient } from "@/lib/supabase/server";

import { requireUser } from "@/lib/auth/require-user";

import {
  getWebPushStatusCode,
  sendWebPush,
} from "@/features/notifications/lib/send-web-push";

type SavePushSubscriptionInput = {
  endpoint: string;

  p256dh: string;

  auth: string;

  userAgent?: string;
};

type ActionResult =
  | {
      success: true;

      sent?: number;
    }
  | {
      success: false;

      error: string;
    };

export async function savePushSubscriptionAction(
  input: SavePushSubscriptionInput,
): Promise<ActionResult> {
  try {
    const [supabase, user] = await Promise.all([createClient(), requireUser()]);

    const endpoint = input.endpoint.trim();

    const p256dh = input.p256dh.trim();

    const auth = input.auth.trim();

    if (!endpoint || !p256dh || !auth) {
      return {
        success: false,

        error: "Push subscription 資料不完整。",
      };
    }

    const now = new Date().toISOString();

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,

        endpoint,

        p256dh,

        auth_key: auth,

        user_agent: input.userAgent?.trim() || null,

        updated_at: now,
      },
      {
        onConflict: "user_id,endpoint",
      },
    );

    if (error) {
      console.error("Failed to save push subscription:", error);

      return {
        success: false,

        error: "無法儲存通知裝置。",
      };
    }

    return {
      success: true,
    };
  } catch (cause) {
    console.error("savePushSubscriptionAction:", cause);

    return {
      success: false,

      error: "無法儲存通知裝置。",
    };
  }
}

export async function sendTestPushAction(): Promise<ActionResult> {
  try {
    const [supabase, user] = await Promise.all([createClient(), requireUser()]);

    const {
      data: subscriptions,

      error,
    } = await supabase
      .from("push_subscriptions")
      .select(
        `
            id,
            endpoint,
            p256dh,
            auth_key
          `,
      )
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to load push subscriptions:", error);

      return {
        success: false,

        error: "無法讀取通知裝置。",
      };
    }

    if (!subscriptions || subscriptions.length === 0) {
      return {
        success: false,

        error: "目前沒有已啟用 Push 的裝置。",
      };
    }

    let sent = 0;

    for (const subscription of subscriptions) {
      try {
        await sendWebPush(
          {
            endpoint: subscription.endpoint,

            p256dh: subscription.p256dh,

            authKey: subscription.auth_key,
          },
          {
            title: "An & Yao",

            body: "Server Push 測試成功。",

            url: "/",
          },
        );

        sent += 1;
      } catch (cause) {
        const statusCode = getWebPushStatusCode(cause);

        /*
         * 404 / 410 means the browser push
         * subscription no longer exists.
         *
         * Remove stale rows automatically.
         */
        if (statusCode === 404 || statusCode === 410) {
          const { error: deleteError } = await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", subscription.id)
            .eq("user_id", user.id);

          if (deleteError) {
            console.warn(
              "Failed to remove stale push subscription:",
              deleteError.message,
            );
          }

          continue;
        }

        console.error("Test push failed:", cause);
      }
    }

    if (sent === 0) {
      return {
        success: false,

        error: "測試通知沒有成功送到任何裝置。",
      };
    }

    return {
      success: true,

      sent,
    };
  } catch (cause) {
    console.error("sendTestPushAction:", cause);

    return {
      success: false,

      error: "無法發送測試通知。",
    };
  }
}
