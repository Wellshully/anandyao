import { describe, expect, it } from "vitest";
import { parseQuestSpec } from "./quest-spec";

const sample = {
  title: "萌蛋的星光收集計畫",
  story: "萌蛋發現窗邊有一張會發光的小地圖，想邀請你一起收集幾顆象徵勇氣的小星星。",
  questMode: "pet_actions",
  actionType: "feed",
  goal: 2,
  goalTemplateId: "pet_feed_2",
} as const;

describe("V5 AI quest schema", () => {
  it("accepts a valid action and derives its completion instruction", () => {
    const result = parseQuestSpec(sample, "pet_actions");

    expect(result.actionType).toBe("feed");
    expect(result.goal).toBe(2);
    expect(result.story).toContain("請到萌蛋頁面按「餵食」2 次。");
  });

  it("allows AI to select another whitelisted action", () => {
    const result = parseQuestSpec({
      ...sample,
      actionType: "play",
      goal: 3,
      goalTemplateId: "pet_play_3",
    }, "pet_actions");

    expect(result.actionType).toBe("play");
    expect(result.goal).toBe(3);
  });

  it("rejects an unsupported action or excessive goal", () => {
    expect(() => parseQuestSpec({
      ...sample,
      actionType: "sleep",
    }, "pet_actions")).toThrow();

    expect(() => parseQuestSpec({
      ...sample,
      goal: 10,
    }, "pet_actions")).toThrow();
  });

  it("rejects mismatched completion templates", () => {
    expect(() => parseQuestSpec({
      ...sample,
      goalTemplateId: "pet_feed_3",
    }, "pet_actions")).toThrow();

    expect(() => parseQuestSpec({
      ...sample,
      goalTemplateId: "unknown_action",
    }, "pet_actions")).toThrow();
  });

  it("rejects the wrong quest mode", () => {
    expect(() => parseQuestSpec(
      sample,
      "couple",
    )).toThrow();

    expect(() => parseQuestSpec({
      ...sample,
      questMode: "couple",
    }, "couple")).toThrow();
  });

  it("requires the exact couple completion rule", () => {
    const couple = {
      ...sample,
      questMode: "couple",
      actionType: "play",
      goal: 2,
      goalTemplateId: "couple_confirm",
    };

    const result = parseQuestSpec(couple, "couple");

    expect(result.story).toContain("兩位玩家各自按下確認");

    expect(() => parseQuestSpec({
      ...couple,
      goal: 1,
    }, "couple")).toThrow();

    expect(() => parseQuestSpec({
      ...couple,
      actionType: "feed",
    }, "couple")).toThrow();
  });

  it("rejects unsafe instructions", () => {
    expect(() => parseQuestSpec({
      ...sample,
      story: "萌蛋今天想進行特殊任務，請提供銀行帳號並匯款，才可以完成這次的星光冒險。",
    }, "pet_actions")).toThrow();
  });

  it("rejects text without Chinese characters", () => {
    expect(() => parseQuestSpec({
      ...sample,
      title: "Magic Adventure",
      story: "Let's collect magical stars together and enjoy a wonderful adventure today.",
    }, "pet_actions")).toThrow();
  });
});
