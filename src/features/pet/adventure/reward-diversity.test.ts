import { describe, expect, it } from "vitest";

import {
  isRewardTooSimilar,
  type RecentRewardSummary,
} from "./reward-diversity";

const previous: RecentRewardSummary = {
  rewardType: "decor",
  title: "星月玻璃音樂盒",
  story: "萌蛋收藏了今天的星光。",
  appearancePrompt: "A delicate celestial music box.",
  themeTags: ["moon", "glass", "music"],
  createdAt: "2026-10-13T08:00:00.000Z",
};

describe("V5 reward diversity", () => {
  it("rejects an identical title", () => {
    expect(isRewardTooSimilar({
      title: "星月玻璃音樂盒",
      themeTags: ["moon"],
    }, [previous])).toBe(true);
  });

  it("ignores punctuation differences", () => {
    expect(isRewardTooSimilar({
      title: "星月・玻璃音樂盒！",
      themeTags: ["music"],
    }, [previous])).toBe(true);
  });

  it("rejects repeated main themes", () => {
    expect(isRewardTooSimilar({
      title: "森林裡的秘密寶箱",
      themeTags: ["moon", "glass"],
    }, [previous])).toBe(true);
  });

  it("allows a distinct reward", () => {
    expect(isRewardTooSimilar({
      title: "森林蘑菇小郵筒",
      themeTags: ["forest", "mushroom", "mailbox"],
    }, [previous])).toBe(false);
  });

  it("does not reject a single common tag", () => {
    expect(isRewardTooSimilar({
      title: "海底珊瑚小燈塔",
      themeTags: ["glass", "ocean", "coral"],
    }, [previous])).toBe(false);
  });

  it("allows a first reward with no history", () => {
    expect(isRewardTooSimilar({
      title: "雲朵彩虹小書架",
      themeTags: ["rainbow", "bookshelf"],
    }, [])).toBe(false);
  });
});
