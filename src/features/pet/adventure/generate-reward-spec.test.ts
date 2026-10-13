import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: mocks.generateContent,
    };
  },
}));

import {
  generateAdventureRewardSpec,
} from "./generate-reward-spec";

const sample = {
  rewardType: "decor",
  title: "星月玻璃音樂盒",
  story: "萌蛋把今天冒險時收集的星光藏進音樂盒，希望每次轉動時都能想起這段溫暖的回憶。",
  appearancePrompt:
    "A delicate celestial glass music box with golden moon ornaments, translucent blue crystal panels, tiny floating stars, engraved brass details, and a complete centered silhouette.",
  themeTags: ["moon", "glass", "music"],
};

const input = {
  quest: {
    title: "萌蛋的星光冒險",
    story: "萌蛋今天和你一起收集了好多星星。",
    questMode: "pet_actions" as const,
    actionType: "play" as const,
    goal: 2,
  },
  recentRewards: [],
  allowedRewardTypes: ["decor" as const],
};

describe("V5 Gemini Reward Spec generation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("GEMINI_API_KEY", "mock-test-key");

    mocks.generateContent.mockResolvedValue({
      text: JSON.stringify(sample),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("generates and validates a reward in one AI call", async () => {
    const result = await generateAdventureRewardSpec(input);

    expect(result.rewardType).toBe("decor");
    expect(result.title).toBe(sample.title);
    expect(result.designPromptVersion).toBe(
      "pet-adventure-v5-reward-1",
    );

    expect(mocks.generateContent).toHaveBeenCalledTimes(1);
  });

  it("rejects a forbidden room reward", async () => {
    mocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        ...sample,
        rewardType: "room",
      }),
    });

    await expect(
      generateAdventureRewardSpec(input),
    ).rejects.toThrow();

    expect(mocks.generateContent).toHaveBeenCalledTimes(1);
  });

  it("rejects a reward matching recent history", async () => {
    await expect(
      generateAdventureRewardSpec({
        ...input,
        recentRewards: [{
          rewardType: "decor",
          title: sample.title,
          story: sample.story,
          appearancePrompt: sample.appearancePrompt,
          themeTags: sample.themeTags,
          createdAt: "2026-10-13T08:00:00.000Z",
        }],
      }),
    ).rejects.toThrow("too similar");

    expect(mocks.generateContent).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed AI output without retrying", async () => {
    mocks.generateContent.mockResolvedValue({
      text: "{ invalid json",
    });

    await expect(
      generateAdventureRewardSpec(input),
    ).rejects.toThrow();

    expect(mocks.generateContent).toHaveBeenCalledTimes(1);
  });

  it("does not retry an AI request failure", async () => {
    mocks.generateContent.mockRejectedValue(
      new Error("Simulated Gemini failure"),
    );

    await expect(
      generateAdventureRewardSpec(input),
    ).rejects.toThrow("Simulated Gemini failure");

    expect(mocks.generateContent).toHaveBeenCalledTimes(1);
  });
});
