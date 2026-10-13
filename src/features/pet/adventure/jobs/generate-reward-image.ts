import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePetRewardImage } from "../reward-image";
import { assertCutoutReady } from "../image-cutout-client";
import { isRewardDesignResolved } from "../reward-reveal-policy";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function processPetAdventureRewardImageJob(
  petId: string,
  rewardId: string,
): Promise<void> {
  if (!UUID_RE.test(petId) || !UUID_RE.test(rewardId)) {
    throw new Error("Invalid Pet Adventure image payload");
  }

  if (
    process.env.PET_ADVENTURE_AUTO_IMAGES !== "1" ||
    !process.env.GEMINI_API_KEY
  ) {
    throw new Error("Automatic image generation is disabled");
  }

  const db = createAdminClient() as unknown as SupabaseClient;

  // Check ISNet before atomically claiming a decor image quota. An unavailable
  // cutout service must not charge the daily quota or call paid Gemini.
  const imageKind = await db.from("pet_adventure_rewards")
    .select("reward_type,design_status,choice")
    .eq("id", rewardId)
    .eq("pet_id", petId)
    .single();

  if (imageKind.error || !imageKind.data) {
    throw new Error(
      imageKind.error?.message ??
      "Reward missing before cutout preflight",
    );
  }

  // Never claim the paid image quota before reward design
  // has reached a final usable state.
  if (
    imageKind.data.design_status !== "ready" &&
    imageKind.data.design_status !== "fallback" &&
    imageKind.data.design_status !== "legacy"
  ) {
    console.info(
      "[pet-adventure] Image skipped: design not ready",
      { rewardId },
    );
    return;
  }

  if (imageKind.data.choice === "discarded") {
    return;
  }

  if (imageKind.data.reward_type === "decor") {
    const readyStartedAt = Date.now();

    try {
      await assertCutoutReady();

      console.info(
        "[pet-adventure] ISNet preflight succeeded",
        {
          rewardId,
          elapsedMs: Date.now() - readyStartedAt,
        },
      );
    } catch (cause) {
      console.error(
        "[pet-adventure] ISNet preflight failed before image claim",
        {
          rewardId,
          elapsedMs: Date.now() - readyStartedAt,
          error: cause instanceof Error
            ? cause.message
            : String(cause),
        },
      );

      throw cause;
    }
  }

  // 原子性領取，並執行資料庫端每日次數限制。
  const claim = await db.rpc(
    "claim_pet_adventure_reward_image",
    {
      p_pet_id: petId,
      p_reward_id: rewardId,
    },
  );

  if (claim.error) {
    throw new Error(
      `Image claim failed: ${claim.error.message}`,
    );
  }

  if (claim.data !== "CLAIMED") {
    console.info("[pet-adventure] Image skipped", {
      rewardId,
      reason: claim.data,
    });
    return;
  }

  let uploadedPath: string | null = null;

  try {
    const result = await db
      .from("pet_adventure_rewards")
      .select("reward_type,title,story,choice,design_status,appearance_prompt")
      .eq("id", rewardId)
      .eq("pet_id", petId)
      .single();

    if (result.error || !result.data) {
      throw new Error(
        result.error?.message ?? "Reward missing",
      );
    }

    const item = result.data;

    if (!isRewardDesignResolved(item.design_status)) {
      throw new Error("Reward design is not finalized");
    }

    if (
      item.reward_type !== "room" &&
      item.reward_type !== "decor"
    ) {
      throw new Error("Invalid reward type");
    }

    if (item.choice === "discarded") {
      await db.from("pet_adventure_rewards")
        .update({ image_status: "failed" })
        .eq("id", rewardId)
        .eq("pet_id", petId)
        .eq("image_status", "generating");
      return;
    }

    // V3.5: furniture uses remote ISNet cutout; room keeps full-size image.
    const generated = await generatePetRewardImage({
      kind: item.reward_type,
      title: item.title,
      story: item.story,
      appearancePrompt: item.design_status === "ready"
        ? item.appearance_prompt
        : null,
    });

    const path =
      `${petId}/${rewardId}.${generated.extension}`;

    const upload = await db.storage
      .from("pet-adventure-assets")
      .upload(path, generated.bytes, {
        contentType: generated.mimeType,
        cacheControl: "3600",
        upsert: false,
      });

    if (upload.error) {
      throw new Error(upload.error.message);
    }

    uploadedPath = path;

    // 尚未開箱的 choice=null 也可以儲存圖片。
    // 已丟棄的禮物不能重新獲得圖片。
    const saved = await db
      .from("pet_adventure_rewards")
      .update({
        image_status: "ready",
        image_path: path,
      })
      .eq("id", rewardId)
      .eq("pet_id", petId)
      .eq("image_status", "generating")
      .or("choice.is.null,choice.eq.accepted")
      .select("id")
      .maybeSingle();

    if (saved.error) {
      throw new Error(saved.error.message);
    }

    if (!saved.data) {
      const cleanup = await db.storage
        .from("pet-adventure-assets")
        .remove([path]);

      if (cleanup.error) {
        console.warn("Image cleanup failed", cleanup.error);
      }

      await db.from("pet_adventure_rewards")
        .update({ image_status: "failed" })
        .eq("id", rewardId)
        .eq("pet_id", petId)
        .eq("image_status", "generating");

      return;
    }

    console.info(
      "[pet-adventure] AI image saved",
      { rewardId },
    );
  } catch (cause) {
    // 不進行自動重試，避免再次呼叫付費模型。
    const failed = await db
      .from("pet_adventure_rewards")
      .update({ image_status: "failed" })
      .eq("id", rewardId)
      .eq("pet_id", petId)
      .eq("image_status", "generating");

    if (failed.error) {
      console.error(
        "Failed to record image generation failure",
        failed.error,
      );
    }

    if (uploadedPath) {
      const check = await db
        .from("pet_adventure_rewards")
        .select("image_path")
        .eq("id", rewardId)
        .single();

      if (
        !check.error &&
        check.data?.image_path !== uploadedPath
      ) {
        const cleanup = await db.storage
          .from("pet-adventure-assets")
          .remove([uploadedPath]);

        if (cleanup.error) {
          console.warn(
            "Image cleanup failed",
            cleanup.error,
          );
        }
      }
    }

    throw cause;
  }
}
