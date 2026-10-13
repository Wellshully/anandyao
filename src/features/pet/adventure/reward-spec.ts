import { z } from "zod";

export const REWARD_PROMPT_VERSION =
  "pet-adventure-v5-reward-1";

export const rewardSpecSchema = z.strictObject({
  rewardType: z.enum(["decor", "room"]),

  title: z.string()
    .trim()
    .min(4)
    .max(24),

  story: z.string()
    .trim()
    .min(20)
    .max(140),

  appearancePrompt: z.string()
    .trim()
    .min(50)
    .max(600),

  themeTags: z.array(
    z.string().trim().min(2).max(24),
  ).min(1).max(5),

  designPromptVersion: z.literal(
    REWARD_PROMPT_VERSION,
  ),
}).superRefine((spec, ctx) => {
  const normalizedTags = spec.themeTags.map(
    (tag) => tag.toLowerCase().replace(/\s+/g, " ").trim(),
  );

  if (new Set(normalizedTags).size !== normalizedTags.length) {
    ctx.addIssue({
      code: "custom",
      path: ["themeTags"],
      message: "Reward theme tags must be unique",
    });
  }

  if (spec.title === spec.story.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["story"],
      message: "Reward title and story must differ",
    });
  }

  const text = [
    spec.title,
    spec.story,
    spec.appearancePrompt,
  ].join("\n");

  if (
    /ignore previous instructions|disregard instructions|override system prompt|忽略之前的指示|忽略系統指令|提供密碼|提供驗證碼|匯款|裸照/iu.test(text)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["appearancePrompt"],
      message: "Reward contains prohibited instructions",
    });
  }

  if (
    !/[\u3400-\u9fff]/u.test(spec.title) ||
    !/[\u3400-\u9fff]/u.test(spec.story)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["title"],
      message: "Reward title and story must contain Chinese text",
    });
  }
});

export type RewardSpec = z.infer<typeof rewardSpecSchema>;

export function parseRewardSpec(
  input: unknown,
): RewardSpec {
  return rewardSpecSchema.parse(input);
}
