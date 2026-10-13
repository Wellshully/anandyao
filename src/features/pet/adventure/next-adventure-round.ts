import {
  canStartSecondAdventureRound,
} from "./second-adventure-round";

export type NextAdventureRoundInput = {
  today: string;
  round: number;
  completedAt: string | null;
  rewardChoice: "accepted" | "discarded" | null;
  unlimitedQuests: boolean;
};

export function canStartNextAdventureRound(
  input: NextAdventureRoundInput,
): boolean {
  if (
    !Number.isInteger(input.round) ||
    input.round < 0 ||
    input.round >= 2147483647
  ) {
    return false;
  }

  if (
    input.completedAt === null ||
    !["accepted", "discarded"].includes(
      input.rewardChoice ?? "",
    )
  ) {
    return false;
  }

  if (input.unlimitedQuests) {
    return true;
  }

  return canStartSecondAdventureRound(input);
}
