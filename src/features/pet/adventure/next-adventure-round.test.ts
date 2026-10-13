import { describe, expect, it } from "vitest";
import { canStartNextAdventureRound } from "./next-adventure-round";

const base = {
  today: "2026-10-14",
  round: 0,
  completedAt: "2026-10-14T04:00:00.000Z",
  rewardChoice: "accepted" as const,
  unlimitedQuests: false,
};

describe("V5 next adventure round", () => {
  it("keeps normal dates limited to one round", () => {
    expect(canStartNextAdventureRound(base)).toBe(false);
  });

  it("preserves the October 13 second-round exception", () => {
    expect(canStartNextAdventureRound({
      ...base,
      today: "2026-10-13",
    })).toBe(true);

    expect(canStartNextAdventureRound({
      ...base,
      today: "2026-10-13",
      round: 1,
    })).toBe(false);
  });

  it("allows multiple rounds for an enabled test pet", () => {
    for (const round of [0, 1, 2, 10, 100]) {
      expect(canStartNextAdventureRound({
        ...base,
        round,
        unlimitedQuests: true,
      })).toBe(true);
    }
  });

  it("requires the current quest to be completed", () => {
    expect(canStartNextAdventureRound({
      ...base,
      unlimitedQuests: true,
      completedAt: null,
    })).toBe(false);
  });

  it("requires an accepted or discarded reward", () => {
    expect(canStartNextAdventureRound({
      ...base,
      unlimitedQuests: true,
      rewardChoice: null,
    })).toBe(false);

    expect(canStartNextAdventureRound({
      ...base,
      unlimitedQuests: true,
      rewardChoice: "discarded",
    })).toBe(true);
  });

  it("rejects invalid and overflowing rounds", () => {
    for (const round of [-1, 1.5, 2147483647]) {
      expect(canStartNextAdventureRound({
        ...base,
        unlimitedQuests: true,
        round,
      })).toBe(false);
    }
  });
});
