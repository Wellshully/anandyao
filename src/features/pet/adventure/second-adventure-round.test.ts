import { describe, expect, it } from "vitest";
import {
  adventureRoundsAllowed,
  canStartSecondAdventureRound,
} from "./second-adventure-round";

const completed = {
  today: "2026-10-13",
  round: 0,
  completedAt: "2026-10-13T04:00:00.000Z",
  rewardChoice: "accepted" as const,
};

describe("one-day second adventure quest", () => {
  it("allows two quests only on October 13 Taipei time", () => {
    expect(adventureRoundsAllowed("2026-10-13")).toBe(2);
    expect(adventureRoundsAllowed("2026-10-12")).toBe(1);
    expect(adventureRoundsAllowed("2026-10-14")).toBe(1);
  });
  it("requires first round completion and a decided gift", () => {
    expect(canStartSecondAdventureRound(completed)).toBe(true);
    expect(canStartSecondAdventureRound({ ...completed, rewardChoice: "discarded" })).toBe(true);
    expect(canStartSecondAdventureRound({ ...completed, completedAt: null })).toBe(false);
    expect(canStartSecondAdventureRound({ ...completed, rewardChoice: null })).toBe(false);
    expect(canStartSecondAdventureRound({ ...completed, round: 1 })).toBe(false);
  });
  it("never enables the special round on later dates", () => {
    expect(canStartSecondAdventureRound({ ...completed, today: "2026-10-14" })).toBe(false);
  });
});
