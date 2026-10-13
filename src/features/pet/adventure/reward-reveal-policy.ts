export type RewardDesignStatus =
  | "legacy"
  | "pending"
  | "generating"
  | "ready"
  | "fallback"
  | "failed";

export function isRewardDesignResolved(
  status: string | null | undefined,
): boolean {
  return status === "legacy" ||
    status === "ready" ||
    status === "fallback";
}

export function canRevealReward(input: {
  designStatus: string | null | undefined;
  availableAt: string;
  now: number;
}): boolean {
  const availableAt = Date.parse(input.availableAt);

  return (
    isRewardDesignResolved(input.designStatus) &&
    Number.isFinite(availableAt) &&
    Number.isFinite(input.now) &&
    input.now >= availableAt
  );
}
