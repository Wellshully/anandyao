/** Special one-day second quest, evaluated exclusively by the Taipei date. */
export const SECOND_ADVENTURE_DATE = "2026-10-13";

export function adventureRoundsAllowed(today: string): number {
  return today === SECOND_ADVENTURE_DATE ? 2 : 1;
}

export function canStartSecondAdventureRound(input: {
  today: string;
  round: number;
  completedAt: string | null;
  rewardChoice: "accepted" | "discarded" | null;
}): boolean {
  return input.today === SECOND_ADVENTURE_DATE &&
    input.round === 0 &&
    input.completedAt !== null &&
    input.rewardChoice !== null;
}
