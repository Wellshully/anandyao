"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPet } from "@/features/pet/lib/get-pet";
import { generatePetRewardImage } from "./reward-image";
import { enqueueJob } from "@/lib/jobs/enqueue-job";
import {
  DECORATIONS, QUESTS, REWARD_WAIT_MS, ROOMS,
  pickQuest, rewardAppearance, taipeiDateKey,
  type QuestAction, type RewardKind,
} from "./catalog";
import { COUPLE_QUESTS, pickCoupleQuest } from "./couple-quests";
import {
  generateAdventureQuestSpec,
  QUEST_PROMPT_VERSION,
} from "./generate-quest-spec";
import {
  isQuestAiStale,
  resolveQuestAiClaim,
} from "./quest-ai-claim";
import { selectQuestMode } from "./quest-mode";
import {
  adventureRoundsAllowed,
} from "./second-adventure-round";
import {
  canStartNextAdventureRound,
} from "./next-adventure-round";
import {
  getPetAdventureTestPolicy,
  type PetAdventureTestPolicy,
} from "./test-policy";
import {
  canRevealReward,
  type RewardDesignStatus,
} from "./reward-reveal-policy";

// These tables are introduced by the V1 migration and have not yet been
// incorporated into the project's generated Database type. Use a scoped
// untyped client until `supabase gen types typescript` is run.
function adventureDb(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

type QuestRow = {
  id: string;
  pet_id: string;
  quest_date: string;
  test_round: number;
  quest_mode: "pet_actions" | "couple";
  ai_status: "legacy" | "pending" | "generating" | "gemini" | "failed" | "fallback";
  ai_requested_at: string | null;
  goal_template_id: string | null;
  quest_prompt_version: string | null;
  action_type: QuestAction;
  goal: number;
  title: string;
  story: string;
  created_at: string;
  completed_at: string | null;
};

type RewardRow = {
  id: string;
  pet_id: string;
  quest_id: string;
  reward_type: RewardKind;
  variant: number;
  title: string;
  story: string;
  available_at: string;
  choice: "accepted" | "discarded" | null;
  equipped: boolean;
  position_x: number;
  position_y: number;
  size_scale: number;
  image_status: "none" | "generating" | "ready" | "failed";
  design_status: RewardDesignStatus;
  image_path: string | null;
  created_at: string;
};

export type PetAdventureState = {
  debugEnabled: boolean;
  imageTestEnabled: boolean;
  today: string;
  testPolicy: PetAdventureTestPolicy;
  quest: {
    id: string;
    title: string;
    story: string;
    action: QuestAction;
    actionLabel: string;
    mode: "pet_actions" | "couple";
    myConfirmed: boolean;
    pairReady: boolean;
    goal: number;
    progress: number;
    completedAt: string | null;
    round: number;
    maxRounds: number | null;
    canStartNextRound: boolean;
  };
  rewards: Array<{
    id: string;
    kind: RewardKind;
    variant: number;
    title: string;
    story: string;
    availableAt: string;
    choice: "accepted" | "discarded" | null;
    equipped: boolean;
    positionX: number;
    positionY: number;
    sizeScale: number;
    imageStatus: "none" | "generating" | "ready" | "failed";
    designStatus: RewardDesignStatus;
    imageUrl: string | null;
    createdAt: string;
    isToday: boolean;
  }>;
};

function testToolsEnabled() {
  return process.env.NODE_ENV === "development" &&
    process.env.PET_ADVENTURE_TEST_MODE === "1";
}

function ensureOk(error: { message: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function context() {
  await requireUser();
  const pet = await getPet(); // RLS verifies that this user belongs to this pet's space.
  return { pet, db: adventureDb() };
}

async function ensureQuest(db: SupabaseClient, petId: string, today: string) {
  const query = () => db.from("pet_adventure_quests")
    .select("*")
    .eq("pet_id", petId)
    .eq("quest_date", today)
    .order("test_round", { ascending: false })
    .limit(1);

  const current = await query().maybeSingle();
  ensureOk(current.error, "Failed to read current quest");

  if (current.data) return current.data as QuestRow;

  const mode = selectQuestMode(randomInt(2));
  const petCandidate = pickQuest(randomInt(QUESTS.length));
  const coupleCandidate = pickCoupleQuest(
    randomInt(COUPLE_QUESTS.length),
  );

  const chosen = mode === "couple"
    ? coupleCandidate
    : petCandidate;

  const action = mode === "couple"
    ? "play"
    : petCandidate.action;

  const goal = mode === "couple"
    ? 2
    : petCandidate.goal;

  const { error: insertError } = await db.from("pet_adventure_quests").upsert(
    {
      pet_id: petId,
      quest_date: today,
      test_round: 0,
      quest_mode: mode,
      ai_status: "pending",
      action_type: action,
      goal,
      title: chosen.title,
      story: chosen.story,
    },
    {
      onConflict: "pet_id,quest_date,test_round",
      ignoreDuplicates: true,
    },
  );

  ensureOk(insertError, "Failed to prepare daily quest");

  const latest = await query().single();
  ensureOk(latest.error, "Failed to reload daily quest");

  if (!latest.data) throw new Error("Daily quest was not found");

  return latest.data as QuestRow;
}

// Only the atomic database claim may authorize a paid Gemini request.
async function maybeGenerateAdventureQuest(
  db: SupabaseClient,
  quest: QuestRow,
): Promise<QuestRow> {
  async function reload(): Promise<QuestRow> {
    const { data, error } = await db
      .from("pet_adventure_quests")
      .select("*")
      .eq("id", quest.id)
      .eq("pet_id", quest.pet_id)
      .single();

    ensureOk(error, "Failed to reload AI quest");

    return data as QuestRow;
  }

  if (quest.ai_status === "generating") {
    if (isQuestAiStale({
      aiRequestedAt: quest.ai_requested_at,
      createdAt: quest.created_at,
    })) {
      const staleBefore = new Date(
        Date.now() - 20 * 60 * 1000,
      ).toISOString();

      let recovery = db
        .from("pet_adventure_quests")
        .update({ ai_status: "fallback" })
        .eq("id", quest.id)
        .eq("pet_id", quest.pet_id)
        .eq("ai_status", "generating");

      // A legacy generating row may have no claim timestamp.
      // Never reserve a second paid request during recovery.
      recovery = quest.ai_requested_at
        ? recovery.lt("ai_requested_at", staleBefore)
        : recovery
            .is("ai_requested_at", null)
            .lt("created_at", staleBefore);

      const recovered = await recovery;

      ensureOk(
        recovered.error,
        "Failed to recover stale AI quest",
      );
    }

    return reload();
  }

  if (quest.ai_status !== "pending") {
    return quest;
  }

  const enabled =
    process.env.PET_ADVENTURE_AI_TASKS === "1" &&
    !!process.env.GEMINI_API_KEY;

  if (!enabled) {
    const fallback = await db
      .from("pet_adventure_quests")
      .update({ ai_status: "fallback" })
      .eq("id", quest.id)
      .eq("pet_id", quest.pet_id)
      .eq("ai_status", "pending");

    ensureOk(
      fallback.error,
      "Failed to finalize disabled AI quest",
    );

    return reload();
  }

  // The RPC locks the pet and checks the daily quota atomically.
  // It reads the per-pet test override itself.
  const claim = await db.rpc(
    "claim_pet_adventure_quest_ai",
    {
      p_pet_id: quest.pet_id,
      p_quest_id: quest.id,
    },
  );

  ensureOk(claim.error, "Failed to claim AI quest");

  const decision = resolveQuestAiClaim(claim.data);

  if (decision === "fallback") {
    const fallback = await db
      .from("pet_adventure_quests")
      .update({ ai_status: "fallback" })
      .eq("id", quest.id)
      .eq("pet_id", quest.pet_id)
      .eq("ai_status", "pending");

    ensureOk(fallback.error, "Failed to save quota fallback");
    return reload();
  }

  if (decision === "skip") {
    return reload();
  }

  // Only CLAIMED reaches this point.
  // Every failure below keeps the claim timestamp.
  try {
    const current = await db
      .from("pet_adventure_quests")
      .select("completed_at")
      .eq("id", quest.id)
      .eq("pet_id", quest.pet_id)
      .single();

    ensureOk(
      current.error,
      "Failed to check quest completion",
    );

    if (current.data?.completed_at) {
      const fallback = await db
        .from("pet_adventure_quests")
        .update({ ai_status: "fallback" })
        .eq("id", quest.id)
        .eq("ai_status", "generating");

      ensureOk(
        fallback.error,
        "Failed to preserve completed quest",
      );
    } else {
      const recent = await db
        .from("pet_adventure_quests")
        .select("title,story")
        .eq("pet_id", quest.pet_id)
        .neq("id", quest.id)
        .order("created_at", { ascending: false })
        .limit(10);

      ensureOk(
        recent.error,
        "Failed to read recent quests",
      );

      const result = await generateAdventureQuestSpec({
        questMode: quest.quest_mode,
        testRound: quest.test_round,
        fallbackTitle: quest.title,
        fallbackStory: quest.story,
        recentQuests: recent.data ?? [],
      });

      const saved = await db
        .from("pet_adventure_quests")
        .update({
          title: result.title,
          story: result.story,
          quest_mode: result.questMode,
          action_type: result.actionType,
          goal: result.goal,
          goal_template_id: result.goalTemplateId,
          quest_prompt_version: QUEST_PROMPT_VERSION,
          ai_status: "gemini",
        })
        .eq("id", quest.id)
        .eq("pet_id", quest.pet_id)
        .eq("ai_status", "generating")
        .is("completed_at", null)
        .select("id")
        .maybeSingle();

      ensureOk(saved.error, "Failed to save AI quest");

      if (!saved.data) {
        // The quest changed while Gemini was working.
        // Never overwrite a completed quest.
        const fallback = await db
          .from("pet_adventure_quests")
          .update({ ai_status: "fallback" })
          .eq("id", quest.id)
          .eq("ai_status", "generating");

        ensureOk(
          fallback.error,
          "Failed to finalize unchanged quest",
        );
      }
    }
  } catch (cause) {
    console.error(
      "[pet-adventure] AI quest generation failed",
      cause instanceof Error ? cause.name : "unknown",
    );

    const failed = await db
      .from("pet_adventure_quests")
      .update({ ai_status: "failed" })
      .eq("id", quest.id)
      .eq("pet_id", quest.pet_id)
      .eq("ai_status", "generating");

    ensureOk(
      failed.error,
      "Failed to mark AI quest failure",
    );
  }

  return reload();
}

async function ensureReward(db: SupabaseClient, quest: QuestRow) {
  if (!quest.completed_at) return;

  // Preserve the V4 reward allocation and fallback appearance.
  // About 25% of reward slots are rooms.
  const kind: RewardKind = randomInt(4) === 0 ? "room" : "decor";
  const variant = randomInt(
    kind === "room" ? ROOMS.length : DECORATIONS.length,
  );
  const appearance = rewardAppearance(kind, variant);

  const waitMs = testToolsEnabled() ? 0 : REWARD_WAIT_MS;
  const availableAt = new Date(
    Date.parse(quest.completed_at) + waitMs,
  );

  const designEnabled =
    process.env.PET_ADVENTURE_AI_REWARDS === "1" &&
    !!process.env.GEMINI_API_KEY;

  // Existing rewards are never overwritten by the placeholder.
  const { error } = await db
    .from("pet_adventure_rewards")
    .upsert(
      {
        pet_id: quest.pet_id,
        quest_id: quest.id,
        reward_type: kind,
        variant,
        title: appearance.title,
        story: appearance.story,
        available_at: availableAt.toISOString(),
        design_status: designEnabled ? "pending" : "fallback",
      },
      {
        onConflict: "quest_id",
        ignoreDuplicates: true,
      },
    );

  ensureOk(error, "Failed to create mystery gift");

  // Queue failures must not prevent quest completion.
  // Refreshing the state may safely retry enqueueing:
  // the durable idempotency key prevents duplicate jobs.
  try {
    const result = await db
      .from("pet_adventure_rewards")
      .select("id,design_status,image_status,choice")
      .eq("quest_id", quest.id)
      .eq("pet_id", quest.pet_id)
      .single();

    ensureOk(result.error, "Failed to locate reward");

    const reward = result.data;
    if (!reward || reward.choice === "discarded") return;

    if (reward.design_status === "pending") {
      await enqueueJob({
        jobType: "pet.adventure.reward-design",
        payload: {
          petId: quest.pet_id,
          rewardId: reward.id,
        },
        idempotencyKey: `pet-adventure-design:${reward.id}`,
        maxAttempts: 1,
      });

      return;
    }

    // Images can start only after design resolution.
    if (
      (reward.design_status === "ready" ||
        reward.design_status === "fallback" ||
        reward.design_status === "legacy") &&
      reward.image_status === "none" &&
      process.env.PET_ADVENTURE_AUTO_IMAGES === "1" &&
      process.env.GEMINI_API_KEY
    ) {
      await enqueueJob({
        jobType: "pet.adventure.reward-image",
        payload: {
          petId: quest.pet_id,
          rewardId: reward.id,
        },
        idempotencyKey: `pet-adventure-image:${reward.id}`,
        maxAttempts: 1,
      });
    }
  } catch (cause) {
    console.error(
      "[pet-adventure] Reward job enqueue failed",
      cause,
    );
  }
}

export async function getPetAdventureStateAction(): Promise<PetAdventureState> {
  const { pet, db } = await context();
  const user = await requireUser();
  const today = taipeiDateKey(new Date());
  const testPolicy = await getPetAdventureTestPolicy(db, pet.id);
  let quest = await ensureQuest(db, pet.id, today);
  quest = await maybeGenerateAdventureQuest(
    db,
    quest,
  );

  let progress = 0;
  let myConfirmed = false;
  let pairReady = false;
  if (quest.quest_mode === "couple") {
    const confirmations = await db.from("pet_adventure_quest_confirmations")
      .select("user_id").eq("quest_id", quest.id);
    ensureOk(confirmations.error, "Failed to read couple confirmations");
    const ids = new Set((confirmations.data ?? []).map((row) => row.user_id as string));
    progress = Math.min(2, ids.size);
    myConfirmed = ids.has(user.id);

    const members = await db.from("space_members")
      .select("user_id", { head: true, count: "exact" })
      .eq("space_id", pet.spaceId);
    ensureOk(members.error, "Failed to read couple membership");
    pairReady = members.count === 2;
  } else {
    const { count, error: countError } = await db.from("pet_events")
      .select("id", { head: true, count: "exact" })
      .eq("pet_id", pet.id)
      .eq("event_type", quest.action_type)
      .gte("created_at", quest.created_at);
    ensureOk(countError, "Failed to read pet interactions");

    progress = Math.min(quest.goal, count ?? 0);
    if (progress >= quest.goal && !quest.completed_at) {
      // Only the first completion writes the timestamp; both users then reuse it.
      const { error } = await db.from("pet_adventure_quests")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", quest.id)
        .is("completed_at", null);
      ensureOk(error, "Failed to complete daily quest");
      const reread = await db.from("pet_adventure_quests")
        .select("*")
        .eq("id", quest.id)
        .single();
      ensureOk(reread.error, "Failed to reload completed quest");
      quest = reread.data as QuestRow;
    }
  }

  await ensureReward(db, quest);

  // Restore abandoned image generation states.
  // Do not retry the paid Gemini request.
  const staleBefore = new Date(
    Date.now() - 20 * 60 * 1000,
  ).toISOString();

  const staleImages = await db
    .from("pet_adventure_rewards")
    .update({ image_status: "failed" })
    .eq("pet_id", pet.id)
    .eq("image_status", "generating")
    .lt("image_requested_at", staleBefore);

  ensureOk(
    staleImages.error,
    "Failed to recover stale image state",
  );

  // Recover abandoned reward designs on state refresh.
  // Never retry the paid Gemini design request.
  // All transitions are guarded by their current database status.
  const staleDesignResults = await Promise.all([
    db.from("pet_adventure_rewards")
      .update({ design_status: "fallback" })
      .eq("pet_id", pet.id)
      .eq("design_status", "pending")
      .lt("created_at", staleBefore)
      .select("id,image_status,choice"),

    db.from("pet_adventure_rewards")
      .update({ design_status: "fallback" })
      .eq("pet_id", pet.id)
      .eq("design_status", "generating")
      .lt("design_requested_at", staleBefore)
      .select("id,image_status,choice"),

    db.from("pet_adventure_rewards")
      .update({ design_status: "fallback" })
      .eq("pet_id", pet.id)
      .eq("design_status", "generating")
      .is("design_requested_at", null)
      .lt("created_at", staleBefore)
      .select("id,image_status,choice"),

    db.from("pet_adventure_rewards")
      .update({ design_status: "fallback" })
      .eq("pet_id", pet.id)
      .eq("design_status", "failed")
      .select("id,image_status,choice"),
  ]);

  for (const result of staleDesignResults) {
    ensureOk(
      result.error,
      "Failed to recover stale reward designs",
    );

    if (
      process.env.PET_ADVENTURE_AUTO_IMAGES !== "1" ||
      !process.env.GEMINI_API_KEY
    ) {
      continue;
    }

    for (const recovered of result.data ?? []) {
      if (
        recovered.choice === "discarded" ||
        recovered.image_status !== "none"
      ) {
        continue;
      }

      try {
        await enqueueJob({
          jobType: "pet.adventure.reward-image",
          payload: {
            petId: pet.id,
            rewardId: recovered.id,
          },
          idempotencyKey:
            `pet-adventure-image:${recovered.id}`,
          maxAttempts: 1,
        });
      } catch (cause) {
        console.error(
          "[pet-adventure] Recovered reward image enqueue failed",
          cause,
        );
      }
    }
  }

  const { data: allRewards, error: rewardsError } = await db.from("pet_adventure_rewards")
    .select("*")
    .eq("pet_id", pet.id)
    .or(`choice.eq.accepted,quest_id.eq.${quest.id}`)
    .order("created_at", { ascending: false })
    .limit(100);
  ensureOk(rewardsError, "Failed to read pet rewards");

  const currentRewardChoice = ((allRewards ?? []) as RewardRow[])
    .find((item) => item.quest_id === quest.id)?.choice ?? null;
  const canStartNextRound = canStartNextAdventureRound({
    today,
    round: quest.test_round,
    completedAt: quest.completed_at,
    rewardChoice: currentRewardChoice,
    unlimitedQuests: testPolicy.unlimitedQuests,
  });

  const serverNow = Date.now();
  const rewards = await Promise.all(((allRewards ?? []) as RewardRow[])
    // Keep today's discarded reward so the UI can show its final state.
    .filter((item) => item.choice !== "discarded" || item.quest_id === quest.id)
    .map(async (item) => {
      // The mystery must not be revealed through Server Action network responses.
      const hidden = item.choice === null &&
        !canRevealReward({
          designStatus: item.design_status,
          availableAt: item.available_at,
          now: serverNow,
        });
      let imageUrl: string | null = null;

      if (
        !hidden &&
        item.choice !== "discarded" &&
        item.image_status === "ready" &&
        item.image_path
      ) {
        const { data: signed, error: signedError } =
          await db.storage
            .from("pet-adventure-assets")
            .createSignedUrl(item.image_path, 3600);

        if (signedError) {
          console.error(
            "[pet-adventure] Image URL signing failed",
            signedError,
          );
        } else {
          imageUrl = signed?.signedUrl ?? null;
        }
      }

      return {
        id: item.id,
        kind: hidden ? "decor" as const : item.reward_type,
        variant: hidden ? 0 : item.variant,
        title: hidden ? "神祕禮物" : item.title,
        story: hidden ? "萌蛋正在準備驚喜。" : item.story,
        availableAt: item.available_at,
        choice: item.choice,
        equipped: item.equipped,
        positionX: item.position_x,
        positionY: item.position_y,
        sizeScale: Number(item.size_scale ?? 1),
        imageStatus: item.image_status ?? "none",
        designStatus: item.design_status,
        imageUrl,
        createdAt: item.created_at,
        isToday: item.quest_id === quest.id,
      };
    }));

  return {
    debugEnabled: testToolsEnabled(),
    imageTestEnabled: process.env.NODE_ENV === "development" &&
      process.env.PET_ADVENTURE_AI_IMAGES === "1",
    today,
    testPolicy,
    quest: {
      id: quest.id,
      title: quest.title,
      story: quest.story,
      action: quest.action_type,
      actionLabel: quest.quest_mode === "couple"
        ? "雙方確認"
        : { feed: "餵食", pet: "摸摸", play: "玩耍" }[quest.action_type],
      mode: quest.quest_mode,
      myConfirmed,
      pairReady,
      goal: quest.goal,
      progress,
      completedAt: quest.completed_at,
      round: quest.test_round + 1,
      maxRounds: testPolicy.unlimitedQuests
        ? null
        : adventureRoundsAllowed(today),
      canStartNextRound,
    },
    rewards,
  };
}


/**
 * Start the next round through the atomic database RPC.
 * The current user must be authorized for the shared pet.
 */
export async function startPetAdventureNextQuestAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { pet, db } = await context();
    const today = taipeiDateKey(new Date());
    const current = await ensureQuest(db, pet.id, today);

    if (!current.completed_at) {
      return {
        success: false,
        error: "請先完成目前的冒險任務。",
      };
    }

    await ensureReward(db, current);

    const gift = await db
      .from("pet_adventure_rewards")
      .select("choice")
      .eq("pet_id", pet.id)
      .eq("quest_id", current.id)
      .single();

    ensureOk(gift.error, "Failed to check current reward");

    const testPolicy = await getPetAdventureTestPolicy(
      db,
      pet.id,
    );

    const canStart = canStartNextAdventureRound({
      today,
      round: current.test_round,
      completedAt: current.completed_at,
      rewardChoice: gift.data?.choice ?? null,
      unlimitedQuests: testPolicy.unlimitedQuests,
    });

    if (!canStart) {
      return {
        success: false,
        error: gift.data?.choice === null
          ? "請先開箱並決定收下或放棄目前的禮物。"
          : "今天已達冒險輪數上限。",
      };
    }

    const mode = selectQuestMode(randomInt(2));

    const petCandidate = pickQuest(
      randomInt(QUESTS.length),
    );

    const coupleCandidate = pickCoupleQuest(
      randomInt(COUPLE_QUESTS.length),
    );

    const chosen = mode === "couple"
      ? coupleCandidate
      : petCandidate;

    if (taipeiDateKey(new Date()) !== today) {
      return {
        success: false,
        error: "日期已切換，請重新整理今日冒險。",
      };
    }

    const { data, error } = await db.rpc(
      "start_pet_adventure_next_round",
      {
        p_pet_id: pet.id,
        p_quest_mode: mode,
        p_action_type: mode === "couple"
          ? "play"
          : petCandidate.action,
        p_goal: mode === "couple"
          ? 2
          : petCandidate.goal,
        p_title: chosen.title,
        p_story: chosen.story,
      },
    );

    ensureOk(error, "Failed to start next adventure round");

    if (data !== "CREATED") {
      const messages: Record<string, string> = {
        DAILY_LIMIT: "今天已達冒險輪數上限。",
        NOT_COMPLETED: "目前任務尚未完成，或另一個裝置已開始新任務。",
        REWARD_UNDECIDED: "請先處理目前的禮物。",
        NO_QUEST: "找不到今日任務，請重新整理。",
        DAY_CHANGED: "日期已切換，請重新整理。",
        ROUND_OVERFLOW: "冒險輪數已達資料庫限制。",
      };

      return {
        success: false,
        error: messages[String(data)] ??
          "無法建立下一輪任務，請重新整理。",
      };
    }

    revalidatePath("/pet");
    revalidatePath("/pet/adventure");

    return { success: true };
  } catch (cause) {
    console.error(
      "Pet Adventure next round failed",
      cause,
    );

    return {
      success: false,
      error: "下一輪任務建立失敗，請重新整理後再試。",
    };
  }
}

export async function rerollPetAdventureTestQuestAction() {
  if (!testToolsEnabled()) {
    return { success: false, error: "測試工具僅限本機開發模式。" };
  }

  try {
    const { pet, db } = await context();
    const today = taipeiDateKey(new Date());
    const current = await ensureQuest(db, pet.id, today);

    if (current.test_round >= 99) {
      return { success: false, error: "今日測試次數已達上限。" };
    }

    const mode = selectQuestMode(randomInt(2));

    const petCandidate = pickQuest(
      randomInt(QUESTS.length),
    );

    const coupleCandidate = pickCoupleQuest(
      current.test_round + 1 +
      randomInt(COUPLE_QUESTS.length),
    );

    const chosen = mode === "couple"
      ? coupleCandidate
      : petCandidate;

    const action = mode === "couple"
      ? "play"
      : petCandidate.action;

    const goal = mode === "couple"
      ? 2
      : petCandidate.goal;

    const { error } = await db.from("pet_adventure_quests").insert({
      pet_id: pet.id,
      quest_date: today,
      test_round: current.test_round + 1,
      quest_mode: mode,
      ai_status: "pending",
      action_type: action,
      goal,
      title: chosen.title,
      story: chosen.story,
    });

    ensureOk(error, "Failed to reroll test quest");

    revalidatePath("/pet");
    revalidatePath("/pet/adventure");

    return { success: true };
  } catch (cause) {
    console.error("Pet test quest reroll failed:", cause);
    return {
      success: false,
      error: "重抽任務失敗，請重新整理後再試。",
    };
  }
}

export async function unlockPetAdventureTestRewardAction() {
  if (!testToolsEnabled()) {
    return { success: false, error: "測試工具僅限本機開發模式。" };
  }

  try {
    const { pet, db } = await context();

    const quest = await ensureQuest(
      db,
      pet.id,
      taipeiDateKey(new Date()),
    );

    if (!quest.completed_at) {
      return { success: false, error: "請先完成目前任務。" };
    }

    await ensureReward(db, quest);

    const { data, error } = await db
      .from("pet_adventure_rewards")
      .update({ available_at: new Date().toISOString() })
      .eq("pet_id", pet.id)
      .eq("quest_id", quest.id)
      .is("choice", null)
      .select("id")
      .maybeSingle();

    ensureOk(error, "Failed to unlock test reward");

    if (!data) {
      return {
        success: false,
        error: "找不到尚未領取的禮物。",
      };
    }

    revalidatePath("/pet");
    revalidatePath("/pet/adventure");

    return { success: true };
  } catch (cause) {
    console.error("Pet test gift unlock failed:", cause);
    return {
      success: false,
      error: "立即開箱失敗，請重新整理後再試。",
    };
  }
}

async function mutateReward(
  rewardId: string,
  operation: "accept" | "decline" | "equip" | "unequip" | "discard",
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(rewardId)) {
      return { success: false, error: "Invalid gift ID" };
    }
    const { pet, db } = await context();

    if (operation === "accept" || operation === "decline") {
      const gift = await db
        .from("pet_adventure_rewards")
        .select("design_status,available_at")
        .eq("id", rewardId)
        .eq("pet_id", pet.id)
        .maybeSingle();

      ensureOk(gift.error, "Failed to check reward reveal");

      if (!gift.data || !canRevealReward({
        designStatus: gift.data.design_status,
        availableAt: gift.data.available_at,
        now: Date.now(),
      })) {
        return {
          success: false,
          error: "禮物尚在準備中，請完成設計與倒數後再開箱。",
        };
      }
    }

    let response: { data: unknown; error: { message: string } | null };
    if (operation === "accept" || operation === "decline") {
      response = await db.rpc("choose_pet_adventure_reward", {
        p_pet_id: pet.id,
        p_reward_id: rewardId,
        p_choice: operation === "accept" ? "accepted" : "discarded",
      });
    } else if (operation === "discard") {
      response = await db.rpc("discard_pet_adventure_reward", {
        p_pet_id: pet.id,
        p_reward_id: rewardId,
      });
    } else {
      response = await db.rpc("equip_pet_adventure_reward", {
        p_pet_id: pet.id,
        p_reward_id: rewardId,
        p_enabled: operation === "equip",
      });
    }
    ensureOk(response.error, "Failed to update gift");
    if (response.data !== true) {
      return { success: false, error: "狀態已改變，請重新整理後再試。" };
    }
    revalidatePath("/pet");
    revalidatePath("/pet/adventure");
    return { success: true };
  } catch (cause) {
    console.error("Pet Adventure mutation failed:", cause);
    const message = cause instanceof Error ? cause.message : "";
    if (message.includes("ROOM_FULL")) {
      return {
        success: false,
        error: "房間最多擺放 10 件家具，請先收起一件。",
      };
    }
    if (message.includes("STORAGE_FULL")) {
      return {
        success: false,
        error: "倉庫已滿（50 件），請先騰出空間。",
      };
    }
    return { success: false, error: "操作失敗，請稍後再試。" };
  }
}

export async function choosePetAdventureRewardAction(
  rewardId: string,
  choice: "accept" | "decline",
) {
  if (choice !== "accept" && choice !== "decline") {
    return { success: false, error: "Invalid choice" };
  }
  return mutateReward(rewardId, choice);
}

export async function equipPetAdventureRewardAction(rewardId: string, equip: boolean) {
  if (typeof equip !== "boolean") return { success: false, error: "Invalid equip flag" };
  return mutateReward(rewardId, equip ? "equip" : "unequip");
}

export async function discardPetAdventureRewardAction(rewardId: string) {
  return mutateReward(rewardId, "discard");
}

export async function movePetAdventureDecorationAction(
  rewardId: string,
  x: number,
  y: number,
): Promise<{ success: boolean; error?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(rewardId)) {
    return { success: false, error: "無效的擺飾 ID。" };
  }

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0.08 || x > 0.92 ||
    y < 0.10 || y > 0.90
  ) {
    return { success: false, error: "擺飾位置超出範圍。" };
  }

  try {
    const { pet, db } = await context();

    const { data, error } = await db.rpc(
      "move_pet_adventure_decoration",
      {
        p_pet_id: pet.id,
        p_reward_id: rewardId,
        p_x: x,
        p_y: y,
      },
    );

    ensureOk(error, "Failed to move decoration");

    if (data !== true) {
      return {
        success: false,
        error: "擺飾已被收起或更換，請重新整理。",
      };
    }

    revalidatePath("/pet/adventure");

    return { success: true };
  } catch (error) {
    console.error("Decoration position save failed:", error);

    return {
      success: false,
      error: "位置儲存失敗。",
    };
  }
}

export async function resizePetAdventureDecorationAction(
  rewardId: string,
  scale: number,
): Promise<{ success: boolean; error?: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(rewardId)) {
    return { success: false, error: "無效的家具 ID。" };
  }

  if (
    !Number.isFinite(scale) ||
    scale < 0.5 ||
    scale > 2 ||
    !Number.isInteger(scale * 4)
  ) {
    return {
      success: false,
      error: "家具倍率必須介於 0.5～2.0，每次調整 0.25。",
    };
  }

  try {
    const { pet, db } = await context();

    const { data, error } = await db.rpc(
      "resize_pet_adventure_decoration",
      {
        p_pet_id: pet.id,
        p_reward_id: rewardId,
        p_scale: scale,
      },
    );

    ensureOk(error, "Failed to resize decoration");

    if (data !== true) {
      return {
        success: false,
        error: "家具已被收起或更換，請重新整理。",
      };
    }

    revalidatePath("/pet/adventure");
    return { success: true };
  } catch (cause) {
    console.error("Pet furniture resize failed:", cause);

    return {
      success: false,
      error: "家具大小儲存失敗，請確認 Migration 已執行。",
    };
  }
}

export async function confirmPetAdventureCoupleQuestAction(
  questId: string,
  confirmed: boolean,
): Promise<{ success: boolean; error?: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(questId) || typeof confirmed !== "boolean") {
    return { success: false, error: "無效的任務操作。" };
  }
  try {
    const user = await requireUser();
    const { pet, db } = await context();
    const { data, error } = await db.rpc("set_pet_adventure_quest_confirmation", {
      p_pet_id: pet.id,
      p_quest_id: questId,
      p_user_id: user.id,
      p_confirm: confirmed,
    });
    ensureOk(error, "Failed to confirm couple quest");
    if (data !== true) {
      return { success: false, error: "無法確認：請檢查雙人空間或重新整理任務。" };
    }
    revalidatePath("/pet");
    revalidatePath("/pet/adventure");
    return { success: true };
  } catch (cause) {
    console.error("Pet couple quest confirmation failed", cause);
    return { success: false, error: "確認失敗，請重新整理後再試。" };
  }
}

// Manual opt-in image generation: one attempt per accepted gift.
export async function generatePetAdventureRewardImageAction(
  rewardId: string,
): Promise<{ success: boolean; error?: string }> {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.PET_ADVENTURE_AI_IMAGES !== "1"
  ) {
    return {
      success: false,
      error: "請先在本機啟用 AI 圖片測試模式。",
    };
  }

  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(rewardId)) {
    return { success: false, error: "無效的禮物 ID。" };
  }

  const { pet, db } = await context();

  if (!process.env.GEMINI_API_KEY) {
    return {
      success: false,
      error: "尚未設定 GEMINI_API_KEY。",
    };
  }

  const claim = await db.rpc("claim_pet_adventure_reward_image", {
    p_pet_id: pet.id,
    p_reward_id: rewardId,
  });

  if (claim.error) {
    console.error("[pet-adventure] Image claim failed", claim.error);
    return {
      success: false,
      error: "無法建立圖片工作，請確認已套用 V3 Migration。",
    };
  }

  if (claim.data !== "CLAIMED") {
    return {
      success: false,
      error: claim.data === "DAILY_LIMIT"
        ? "今天已達 AI 圖片上限（每隻萌蛋 2 次）。"
        : "只能為已開箱、已收下且尚未生成圖片的禮物製作圖片。",
    };
  }

  try {
    const lookup = await db
      .from("pet_adventure_rewards")
      .select("reward_type,title,story")
      .eq("pet_id", pet.id)
      .eq("id", rewardId)
      .single();

    ensureOk(lookup.error, "Failed to read image gift");

    if (
      !lookup.data ||
      (
        lookup.data.reward_type !== "decor" &&
        lookup.data.reward_type !== "room"
      )
    ) {
      throw new Error("Invalid reward metadata");
    }

    const result = await generatePetRewardImage({
      kind: lookup.data.reward_type,
      title: lookup.data.title,
      story: lookup.data.story,
    });

    const path = `${pet.id}/${rewardId}.${result.extension}`;

    const uploaded = await db.storage
      .from("pet-adventure-assets")
      .upload(path, result.bytes, {
        contentType: result.mimeType,
        upsert: false,
        cacheControl: "3600",
      });

    ensureOk(uploaded.error, "Failed to upload image");

    const saved = await db
      .from("pet_adventure_rewards")
      .update({
        image_status: "ready",
        image_path: path,
      })
      .eq("id", rewardId)
      .eq("pet_id", pet.id)
      .eq("image_status", "generating")
      .select("id")
      .maybeSingle();

    ensureOk(saved.error, "Failed to save image path");

    if (!saved.data) {
      throw new Error("Image claim disappeared");
    }

    revalidatePath("/pet/adventure");

    return { success: true };
  } catch (error) {
    console.error(
      "[pet-adventure] Gemini image generation failed",
      error,
    );

    const failed = await db
      .from("pet_adventure_rewards")
      .update({ image_status: "failed" })
      .eq("id", rewardId)
      .eq("pet_id", pet.id)
      .eq("image_status", "generating");

    if (failed.error) {
      console.error(
        "[pet-adventure] Failed to record image error",
        failed.error,
      );
    }

    return {
      success: false,
      error: "圖片生成失敗，原本的獎勵不受影響，本次不會自動重試。",
    };
  }
}
