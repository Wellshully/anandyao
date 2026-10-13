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
import { COUPLE_QUESTS, pickCoupleQuest, generateCoupleQuest } from "./couple-quests";
import { generatePetActionQuest } from "./pet-action-quests";
import { selectQuestMode } from "./quest-mode";

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
  image_path: string | null;
  created_at: string;
};

export type PetAdventureState = {
  debugEnabled: boolean;
  imageTestEnabled: boolean;
  today: string;
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

// Claim once before calling Gemini: two browsers must not pay for the same quest.
async function maybeGenerateAdventureQuest(db: SupabaseClient, quest: QuestRow): Promise<QuestRow> {
  if (quest.ai_status !== "pending") return quest;
  const enabled = process.env.PET_ADVENTURE_AI_TASKS === "1" && !!process.env.GEMINI_API_KEY;
  let canCall = enabled;
  if (canCall) {
    const { count, error } = await db.from("pet_adventure_quests")
      .select("id", { count: "exact", head: true })
      .eq("pet_id", quest.pet_id)
      .eq("quest_date", quest.quest_date)
      .in("ai_status", ["generating", "gemini", "failed"]);
    ensureOk(error, "Failed to check daily AI quota");
    canCall = (count ?? 0) < 5;
  }
  if (!canCall) {
    const { error } = await db.from("pet_adventure_quests")
      .update({ ai_status: "fallback" })
      .eq("id", quest.id).eq("ai_status", "pending");
    ensureOk(error, "Failed to finalize fallback quest");
  } else {
    const claimed = await db.from("pet_adventure_quests")
      .update({ ai_status: "generating" })
      .eq("id", quest.id).eq("ai_status", "pending")
      .select("id").maybeSingle();
    ensureOk(claimed.error, "Failed to claim AI generation");
    if (claimed.data) {
      try {
        const result = quest.quest_mode === "couple"
          ? await generateCoupleQuest(
              quest.title,
              quest.story,
              quest.test_round,
            )
          : await generatePetActionQuest(
              quest.title,
              quest.story,
              quest.test_round,
              quest.action_type,
              quest.goal,
            );
        const { error } = await db.from("pet_adventure_quests")
          .update({ title: result.title, story: result.story, ai_status: "gemini" })
          .eq("id", quest.id).eq("ai_status", "generating");
        ensureOk(error, "Failed to save AI quest");
      } catch (error) {
        console.error("[pet-adventure] Gemini task generation failed; using fallback", error);
        const { error: saveError } = await db.from("pet_adventure_quests")
          .update({ ai_status: "failed" })
          .eq("id", quest.id).eq("ai_status", "generating");
        ensureOk(saveError, "Failed to mark AI fallback");
      }
    }
  }
  const { data, error } = await db.from("pet_adventure_quests")
    .select("*").eq("id", quest.id).single();
  ensureOk(error, "Failed to reload AI quest");
  return data as QuestRow;
}

async function ensureReward(db: SupabaseClient, quest: QuestRow) {
  if (!quest.completed_at) return;
  // ~25% of quests can award a new home background.
  const kind: RewardKind = randomInt(4) === 0 ? "room" : "decor";
  const variant = randomInt(kind === "room" ? ROOMS.length : DECORATIONS.length);
  const appearance = rewardAppearance(kind, variant);
  const waitMs = testToolsEnabled() ? 0 : REWARD_WAIT_MS;
  const availableAt = new Date(Date.parse(quest.completed_at) + waitMs);
  const { error } = await db.from("pet_adventure_rewards").upsert(
    {
      pet_id: quest.pet_id,
      quest_id: quest.id,
      reward_type: kind,
      variant,
      title: appearance.title,
      story: appearance.story,
      available_at: availableAt.toISOString(),
    },
    { onConflict: "quest_id", ignoreDuplicates: true },
  );
  ensureOk(error, "Failed to create mystery gift");

  // 圖片為可選獎勵，排程失敗不能阻止任務完成。
  // 使用固定 idempotencyKey，避免重複排程與付費。
  if (
    process.env.PET_ADVENTURE_AUTO_IMAGES === "1" &&
    process.env.GEMINI_API_KEY
  ) {
    try {
      const reward = await db
        .from("pet_adventure_rewards")
        .select("id,image_status")
        .eq("quest_id", quest.id)
        .single();

      ensureOk(reward.error, "Failed to locate image reward");

      if (reward.data?.image_status === "none") {
        await enqueueJob({
          jobType: "pet.adventure.reward-image",
          payload: {
            petId: quest.pet_id,
            rewardId: reward.data.id,
          },
          idempotencyKey:
            `pet-adventure-image:${reward.data.id}`,
          maxAttempts: 1,
        });
      }
    } catch (cause) {
      console.error(
        "[pet-adventure] Image queue unavailable",
        cause,
      );
    }
  }
}

export async function getPetAdventureStateAction(): Promise<PetAdventureState> {
  const { pet, db } = await context();
  const user = await requireUser();
  const today = taipeiDateKey(new Date());
  let quest = await ensureQuest(db, pet.id, today);
  quest = await maybeGenerateAdventureQuest(db, quest);

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

  const { data: allRewards, error: rewardsError } = await db.from("pet_adventure_rewards")
    .select("*")
    .eq("pet_id", pet.id)
    .or(`choice.eq.accepted,quest_id.eq.${quest.id}`)
    .order("created_at", { ascending: false })
    .limit(100);
  ensureOk(rewardsError, "Failed to read pet rewards");

  const serverNow = Date.now();
  const rewards = await Promise.all(((allRewards ?? []) as RewardRow[])
    // Keep today's discarded reward so the UI can show its final state.
    .filter((item) => item.choice !== "discarded" || item.quest_id === quest.id)
    .map(async (item) => {
      // The mystery must not be revealed through Server Action network responses.
      const hidden = item.choice === null && Date.parse(item.available_at) > serverNow;
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
    },
    rewards,
  };
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
