import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueJob } from "@/lib/jobs/enqueue-job";

import {
  generateAdventureRewardSpec,
} from "../generate-reward-spec";

import type {
  RecentRewardSummary,
} from "../reward-diversity";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STALE_MS = 20 * 60 * 1000;

type DesignStatus =
  | "legacy"
  | "pending"
  | "generating"
  | "ready"
  | "fallback"
  | "failed";

type RewardRecord = {
  id: string;
  pet_id: string;
  quest_id: string;
  reward_type: "decor" | "room";
  design_status: DesignStatus;
  design_requested_at: string | null;
  created_at: string;
  choice: "accepted" | "discarded" | null;
};

function assertOk(
  error: { message: string } | null,
  label: string,
): void {
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

/**
 * Images may only be queued after reward design
 * is ready, or after a safe fallback.
 *
 * The image job retains its own atomic claim.
 */
async function enqueueImageAfterDesign(
  db: SupabaseClient,
  petId: string,
  rewardId: string,
): Promise<void> {
  if (
    process.env.PET_ADVENTURE_AUTO_IMAGES !== "1" ||
    !process.env.GEMINI_API_KEY
  ) {
    return;
  }

  try {
    const { data, error } = await db
      .from("pet_adventure_rewards")
      .select("design_status,image_status,choice")
      .eq("id", rewardId)
      .eq("pet_id", petId)
      .single();

    assertOk(error, "Failed to read image queue state");

    if (!data) return;

    if (
      data.design_status !== "ready" &&
      data.design_status !== "fallback" &&
      data.design_status !== "legacy"
    ) {
      return;
    }

    if (
      data.image_status !== "none" ||
      data.choice === "discarded"
    ) {
      return;
    }

    await enqueueJob({
      jobType: "pet.adventure.reward-image",
      payload: {
        petId,
        rewardId,
      },
      idempotencyKey:
        `pet-adventure-image:${rewardId}`,
      maxAttempts: 1,
    });
  } catch (cause) {
    // Never repeat paid reward design just because
    // image scheduling failed.
    console.error(
      "[pet-adventure] Reward image enqueue failed",
      {
        rewardId,
        error: cause instanceof Error
          ? cause.name
          : "unknown",
      },
    );
  }
}

/**
 * Finalize an unusable design without another
 * paid Gemini request.
 */
async function markDesignFallback(
  db: SupabaseClient,
  petId: string,
  rewardId: string,
  expectedStatus: "pending" | "generating",
): Promise<void> {
  const { data, error } = await db
    .from("pet_adventure_rewards")
    .update({
      design_status: "fallback",
    })
    .eq("id", rewardId)
    .eq("pet_id", petId)
    .eq("design_status", expectedStatus)
    .select("id")
    .maybeSingle();

  assertOk(error, "Failed to save reward fallback");

  if (data) {
    await enqueueImageAfterDesign(
      db,
      petId,
      rewardId,
    );
  }
}

export async function processPetAdventureRewardDesignJob(
  petId: string,
  rewardId: string,
): Promise<void> {
  if (
    !UUID_RE.test(petId) ||
    !UUID_RE.test(rewardId)
  ) {
    throw new Error("Invalid reward design job payload");
  }

  const db = createAdminClient() as unknown as SupabaseClient;

  const { data, error } = await db
    .from("pet_adventure_rewards")
    .select(
      "id,pet_id,quest_id,reward_type,design_status,design_requested_at,created_at,choice",
    )
    .eq("id", rewardId)
    .eq("pet_id", petId)
    .single();

  assertOk(error, "Failed to read reward design job");

  if (!data) {
    throw new Error("Reward design job has no reward");
  }

  const reward = data as RewardRecord;

  if (
    reward.reward_type !== "decor" &&
    reward.reward_type !== "room"
  ) {
    throw new Error("Invalid reward kind");
  }

  // A discarded gift does not need another paid request.
  if (reward.choice === "discarded") {
    if (reward.design_status === "pending") {
      await markDesignFallback(
        db, petId, rewardId, "pending",
      );
    }
    return;
  }

  // Already finalized. Do not generate another design.
  if (
    reward.design_status === "ready" ||
    reward.design_status === "fallback" ||
    reward.design_status === "legacy"
  ) {
    await enqueueImageAfterDesign(
      db,
      petId,
      rewardId,
    );
    return;
  }

  if (reward.design_status === "failed") {
    return;
  }

  // A previously claimed paid request must never
  // be claimed again, including after a Worker crash.
  if (reward.design_status === "generating") {
    const startedAt = Date.parse(
      reward.design_requested_at ??
      reward.created_at,
    );

    if (
      Number.isFinite(startedAt) &&
      Date.now() - startedAt >= STALE_MS
    ) {
      const staleBefore = new Date(
        Date.now() - STALE_MS,
      ).toISOString();

      let query = db
        .from("pet_adventure_rewards")
        .update({ design_status: "fallback" })
        .eq("id", rewardId)
        .eq("pet_id", petId)
        .eq("design_status", "generating");

      query = reward.design_requested_at
        ? query.lt(
            "design_requested_at",
            staleBefore,
          )
        : query
            .is("design_requested_at", null)
            .lt("created_at", staleBefore);

      const recovered = await query
        .select("id")
        .maybeSingle();

      assertOk(
        recovered.error,
        "Failed to recover stale reward design",
      );

      if (recovered.data) {
        await enqueueImageAfterDesign(
          db,
          petId,
          rewardId,
        );
      }
    }

    return;
  }

  if (reward.design_status !== "pending") {
    throw new Error("Unknown reward design status");
  }

  // A pending reward with an existing paid claim
  // must not make another request.
  if (reward.design_requested_at !== null) {
    await markDesignFallback(
      db, petId, rewardId, "pending",
    );
    return;
  }

  // Disabled AI design uses the saved V4 fallback.
  if (
    process.env.PET_ADVENTURE_AI_REWARDS !== "1" ||
    !process.env.GEMINI_API_KEY
  ) {
    await markDesignFallback(
      db, petId, rewardId, "pending",
    );
    return;
  }

  // Compare-and-set: only one Worker can acquire
  // permission to make the paid text request.
  const claimed = await db
    .from("pet_adventure_rewards")
    .update({
      design_status: "generating",
      design_requested_at: new Date().toISOString(),
    })
    .eq("id", rewardId)
    .eq("pet_id", petId)
    .eq("design_status", "pending")
    .is("design_requested_at", null)
    .select("id")
    .maybeSingle();

  assertOk(claimed.error, "Failed to claim reward design");

  if (!claimed.data) {
    return;
  }

  try {
    // The reward may only use its own completed quest.
    const questResult = await db
      .from("pet_adventure_quests")
      .select(
        "title,story,quest_mode,action_type,goal,completed_at",
      )
      .eq("id", reward.quest_id)
      .eq("pet_id", petId)
      .single();

    assertOk(
      questResult.error,
      "Failed to read reward quest",
    );

    const quest = questResult.data;

    if (!quest || !quest.completed_at) {
      throw new Error("Reward quest is not completed");
    }

    // Read only this pet's recent reward history.
    // Do not filter out discarded or unclaimed gifts.
    const historyResult = await db
      .from("pet_adventure_rewards")
      .select(
        "reward_type,title,story,appearance_prompt,theme_tags,created_at",
      )
      .eq("pet_id", petId)
      .neq("id", rewardId)
      .order("created_at", { ascending: false })
      .limit(20);

    assertOk(
      historyResult.error,
      "Failed to read reward history",
    );

    const history: RecentRewardSummary[] =
      (historyResult.data ?? []).map((item) => ({
        rewardType: item.reward_type as "decor" | "room",
        title: item.title,
        story: item.story,
        appearancePrompt: item.appearance_prompt,
        themeTags: item.theme_tags ?? [],
        createdAt: item.created_at,
      }));

    // A room is eligible only when the server's
    // ~25% reward allocation picked a room placeholder.
    // Gemini can downgrade that slot to decor.
    const allowedRewardTypes:
      Array<"decor" | "room"> =
        reward.reward_type === "room"
          ? ["decor", "room"]
          : ["decor"];

    const spec = await generateAdventureRewardSpec({
      quest: {
        title: quest.title,
        story: quest.story,
        questMode: quest.quest_mode,
        actionType: quest.action_type,
        goal: quest.goal,
      },
      recentRewards: history,
      allowedRewardTypes,
    });

    // Save exactly the validated design.
    // The existing fallback variant is preserved.
    const saved = await db
      .from("pet_adventure_rewards")
      .update({
        reward_type: spec.rewardType,
        title: spec.title,
        story: spec.story,
        appearance_prompt: spec.appearancePrompt,
        theme_tags: spec.themeTags,
        design_prompt_version:
          spec.designPromptVersion,
        design_status: "ready",
      })
      .eq("id", rewardId)
      .eq("pet_id", petId)
      .eq("design_status", "generating")
      .or("choice.is.null,choice.eq.accepted")
      .select("id")
      .maybeSingle();

    assertOk(saved.error, "Failed to save AI reward design");

    if (!saved.data) {
      // The reward changed while Gemini was working.
      // Never overwrite a finalized or discarded gift.
      await markDesignFallback(
        db, petId, rewardId, "generating",
      );
      return;
    }

    await enqueueImageAfterDesign(
      db,
      petId,
      rewardId,
    );

    console.info(
      "[pet-adventure] Reward design ready",
      { rewardId },
    );
  } catch (cause) {
    // No automatic Gemini retry.
    // Preserve the existing legitimate placeholder.
    console.error(
      "[pet-adventure] Reward design failed",
      {
        rewardId,
        error: cause instanceof Error
          ? cause.name
          : "unknown",
      },
    );

    await markDesignFallback(
      db,
      petId,
      rewardId,
      "generating",
    );
  }
}
