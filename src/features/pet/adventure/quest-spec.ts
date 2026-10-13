import { z } from "zod";

import { ACTION_LABELS } from "./catalog";
import type { AdventureQuestMode } from "./quest-mode";

export const QUEST_GOAL_TEMPLATES = {
  pet_feed_1: { questMode: "pet_actions", actionType: "feed", goal: 1 },
  pet_feed_2: { questMode: "pet_actions", actionType: "feed", goal: 2 },
  pet_feed_3: { questMode: "pet_actions", actionType: "feed", goal: 3 },

  pet_pet_1: { questMode: "pet_actions", actionType: "pet", goal: 1 },
  pet_pet_2: { questMode: "pet_actions", actionType: "pet", goal: 2 },
  pet_pet_3: { questMode: "pet_actions", actionType: "pet", goal: 3 },

  pet_play_1: { questMode: "pet_actions", actionType: "play", goal: 1 },
  pet_play_2: { questMode: "pet_actions", actionType: "play", goal: 2 },
  pet_play_3: { questMode: "pet_actions", actionType: "play", goal: 3 },

  couple_confirm: { questMode: "couple", actionType: "play", goal: 2 },
} as const;

export const QUEST_GOAL_TEMPLATE_IDS = Object.keys(
  QUEST_GOAL_TEMPLATES,
);

export const questSpecSchema = z.strictObject({
  title: z.string().trim().min(4).max(28),
  story: z.string().trim().min(20).max(200),

  questMode: z.enum(["pet_actions", "couple"]),
  actionType: z.enum(["feed", "pet", "play"]),

  goal: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),

  goalTemplateId: z.string().min(1).max(64),
}).superRefine((spec, ctx) => {
  const template = QUEST_GOAL_TEMPLATES[
    spec.goalTemplateId as keyof typeof QUEST_GOAL_TEMPLATES
  ];

  if (
    !template ||
    template.questMode !== spec.questMode ||
    template.actionType !== spec.actionType ||
    template.goal !== spec.goal
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["goalTemplateId"],
      message: "Invalid or inconsistent quest completion template",
    });
  }

  const text = `${spec.title}\n${spec.story}`;

  if (!/[\u3400-\u9fff]/u.test(spec.title) ||
      !/[\u3400-\u9fff]/u.test(spec.story)) {
    ctx.addIssue({
      code: "custom",
      path: ["story"],
      message: "Quest must contain Chinese text",
    });
  }

  if (
    /密碼|驗證碼|銀行帳號|身分證字號|匯款|付款|裸照|上傳照片|提供個資|跳過確認|直接領取獎勵/u.test(text)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["story"],
      message: "Quest contains a prohibited instruction",
    });
  }
});

export type QuestSpec = z.infer<typeof questSpecSchema>;

export function parseQuestSpec(
  input: unknown,
  expectedMode: AdventureQuestMode,
): QuestSpec {
  const spec = questSpecSchema.parse(input);

  if (spec.questMode !== expectedMode) {
    throw new Error("AI quest mode does not match server-selected mode");
  }

  const instruction = spec.questMode === "couple"
    ? "完成互動後，請兩位玩家各自按下確認。"
    : `請到萌蛋頁面按「${ACTION_LABELS[spec.actionType]}」${spec.goal} 次。`;

  return {
    ...spec,
    // Keep the existing V4 literal-newline display behavior.
    story: `${spec.story}\\n${instruction}`,
  };
}
