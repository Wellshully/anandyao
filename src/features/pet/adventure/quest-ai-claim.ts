export type QuestAiClaimDecision =
  | "generate"
  | "fallback"
  | "skip";

export function resolveQuestAiClaim(
  status: unknown,
): QuestAiClaimDecision {
  switch (status) {
    case "CLAIMED":
      return "generate";

    case "DAILY_LIMIT":
      return "fallback";

    case "NOT_ELIGIBLE":
      return "skip";

    default:
      throw new Error("Unexpected Pet Adventure AI claim result");
  }
}

export function isQuestAiStale(
  input: {
    aiRequestedAt: string | null;
    createdAt: string;
  },
  now: Date = new Date(),
): boolean {
  const startedAt = Date.parse(
    input.aiRequestedAt ?? input.createdAt,
  );

  if (!Number.isFinite(startedAt)) {
    return false;
  }

  return now.getTime() - startedAt >= 20 * 60 * 1000;
}
