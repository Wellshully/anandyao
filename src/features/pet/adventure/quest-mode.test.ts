import { describe, expect, it } from "vitest";
import { selectQuestMode } from "./quest-mode";

describe("selectQuestMode", () => {
  it("supports both quest modes equally", () => {
    expect(selectQuestMode(0)).toBe("pet_actions");
    expect(selectQuestMode(1)).toBe("couple");
  });

  it("rejects invalid random values", () => {
    expect(() => selectQuestMode(-1)).toThrow();
    expect(() => selectQuestMode(2)).toThrow();
    expect(() => selectQuestMode(0.5)).toThrow();
  });
});
