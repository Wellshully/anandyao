import { describe, expect, it } from "vitest";
import {
  DECORATIONS, QUESTS, ROOMS, pickQuest, rewardAppearance,
  taipeiDateKey, REWARD_WAIT_MS,
} from "./catalog";

describe("Pet Adventure V1 rules", () => {
  it("has valid quests and playable goals", () => {
    expect(QUESTS.length).toBeGreaterThanOrEqual(3);
    for (const quest of QUESTS) {
      expect(["feed", "pet", "play"]).toContain(quest.action);
      expect(quest.goal).toBeGreaterThan(0);
      expect(quest.goal).toBeLessThanOrEqual(5);
    }
  });
  it("supports daily quests and safe random indexes", () => {
    expect(pickQuest(-1)).toEqual(QUESTS.at(-1));
    expect(pickQuest(QUESTS.length)).toEqual(QUESTS[0]);
  });
  it("supports both homes and objects", () => {
    expect(rewardAppearance("decor", DECORATIONS.length)).toEqual(DECORATIONS[0]);
    expect(rewardAppearance("room", ROOMS.length)).toEqual(ROOMS[0]);
  });
  it("uses the Taiwan date boundary", () => {
    expect(taipeiDateKey(new Date("2026-10-11T15:59:59.000Z"))).toBe("2026-10-11");
    expect(taipeiDateKey(new Date("2026-10-11T16:00:00.000Z"))).toBe("2026-10-12");
  });
  it("requires three minutes before opening", () => {
    expect(REWARD_WAIT_MS).toBe(180000);
  });
});
