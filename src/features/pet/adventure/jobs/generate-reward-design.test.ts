import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  enqueueJob: vi.fn(),
  generateAdventureRewardSpec: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/jobs/enqueue-job", () => ({
  enqueueJob: mocks.enqueueJob,
}));

vi.mock("../generate-reward-spec", () => ({
  generateAdventureRewardSpec:
    mocks.generateAdventureRewardSpec,
}));

import {
  processPetAdventureRewardDesignJob,
} from "./generate-reward-design";

const PET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REWARD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const QUEST_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type DesignStatus =
  | "legacy"
  | "pending"
  | "generating"
  | "ready"
  | "fallback"
  | "failed";

type Gift = {
  id: string;
  pet_id: string;
  quest_id: string;
  reward_type: "decor" | "room";
  design_status: DesignStatus;
  design_requested_at: string | null;
  created_at: string;
  image_status: "none" | "generating" | "ready" | "failed";
  choice: "accepted" | "discarded" | null;
};

function fakeDatabase(overrides: Partial<Gift> = {}) {
  const gift: Gift = {
    id: REWARD_ID,
    pet_id: PET_ID,
    quest_id: QUEST_ID,
    reward_type: "decor",
    design_status: "pending",
    design_requested_at: null,
    created_at: new Date().toISOString(),
    image_status: "none",
    choice: null,
    ...overrides,
  };

  const quest = {
    title: "萌蛋的星光冒險",
    story: "一起尋找藏在夜空中的小星星。",
    quest_mode: "pet_actions",
    action_type: "play",
    goal: 2,
    completed_at: new Date().toISOString(),
  };

  const client = {
    from(table: string) {
      let changes: Record<string, unknown> | null = null;
      const equals: Array<[string, unknown]> = [];
      const nullFields: string[] = [];
      const earlierThan: Array<[string, string]> = [];
      let choiceGuard = false;

      function matches(): boolean {
        const row = gift as unknown as Record<string, unknown>;

        for (const [field, value] of equals) {
          if (row[field] !== value) return false;
        }

        for (const field of nullFields) {
          if (row[field] !== null) return false;
        }

        for (const [field, value] of earlierThan) {
          const actual = row[field];
          if (
            typeof actual !== "string" ||
            actual >= value
          ) {
            return false;
          }
        }

        if (
          choiceGuard &&
          gift.choice !== null &&
          gift.choice !== "accepted"
        ) {
          return false;
        }

        return true;
      }

      const query = {
        select(_fields: string) {
          void _fields;
          return query;
        },

        update(values: Record<string, unknown>) {
          changes = values;
          return query;
        },

        eq(field: string, value: unknown) {
          equals.push([field, value]);
          return query;
        },

        // History queries exclude the current reward.
        // This fake database has no history rows to return.
        neq(_field: string, _value: unknown) {
          void _field;
          void _value;
          return query;
        },

        is(field: string, value: null) {
          if (value === null) {
            nullFields.push(field);
          }
          return query;
        },

        lt(field: string, value: string) {
          earlierThan.push([field, value]);
          return query;
        },

        or(condition: string) {
          if (condition === "choice.is.null,choice.eq.accepted") {
            choiceGuard = true;
          }
          return query;
        },

        order(_field: string, _options?: object) {
          void _field;
          void _options;
          return query;
        },

        limit(_count: number) {
          void _count;
          // No historical rewards in these tests.
          return Promise.resolve({
            data: [],
            error: null,
          });
        },

        single() {
          if (table === "pet_adventure_quests") {
            return Promise.resolve({
              data: { ...quest },
              error: null,
            });
          }

          return Promise.resolve({
            data: matches() ? { ...gift } : null,
            error: null,
          });
        },

        maybeSingle() {
          if (
            table !== "pet_adventure_rewards" ||
            changes === null
          ) {
            throw new Error("Unexpected fake database mutation");
          }

          if (!matches()) {
            return Promise.resolve({
              data: null,
              error: null,
            });
          }

          // Synchronous conditional update simulates one
          // winner for the database compare-and-set.
          Object.assign(gift, changes);

          return Promise.resolve({
            data: { id: gift.id },
            error: null,
          });
        },
      };

      return query;
    },
  };

  return { gift, client };
}

const generatedSpec = {
  rewardType: "decor",
  title: "星月玻璃音樂盒",
  story: "萌蛋把今天收集的星光放進音樂盒，希望每次聆聽時都能想起這趟冒險。",
  appearancePrompt:
    "A delicate glass music box with golden crescent ornaments, translucent crystal panels, engraved brass details, softly glowing stars, and a clearly visible complete silhouette.",
  themeTags: ["moon", "glass", "music"],
  designPromptVersion: "pet-adventure-v5-reward-1",
};

describe("V5 Reward Design Worker", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.stubEnv("PET_ADVENTURE_AI_REWARDS", "1");
    vi.stubEnv("PET_ADVENTURE_AUTO_IMAGES", "1");
    vi.stubEnv("GEMINI_API_KEY", "mock-key");

    mocks.generateAdventureRewardSpec.mockResolvedValue(
      generatedSpec,
    );

    mocks.enqueueJob.mockResolvedValue({
      created: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("allows only one design generation under concurrent workers", async () => {
    const db = fakeDatabase();
    mocks.createAdminClient.mockReturnValue(db.client);

    await Promise.all([
      processPetAdventureRewardDesignJob(PET_ID, REWARD_ID),
      processPetAdventureRewardDesignJob(PET_ID, REWARD_ID),
    ]);

    expect(
      mocks.generateAdventureRewardSpec,
    ).toHaveBeenCalledTimes(1);

    expect(db.gift.design_status).toBe("ready");

    expect(mocks.enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: "pet.adventure.reward-image",
        idempotencyKey: `pet-adventure-image:${REWARD_ID}`,
        maxAttempts: 1,
      }),
    );
  });

  it("uses fallback after Gemini failure without a second paid request", async () => {
    const db = fakeDatabase();
    mocks.createAdminClient.mockReturnValue(db.client);

    mocks.generateAdventureRewardSpec.mockRejectedValue(
      new Error("Simulated Gemini failure"),
    );

    vi.spyOn(console, "error").mockImplementation(() => {});

    await processPetAdventureRewardDesignJob(
      PET_ID,
      REWARD_ID,
    );

    expect(db.gift.design_status).toBe("fallback");
    expect(db.gift.design_requested_at).not.toBeNull();

    // Simulate duplicate job delivery.
    await processPetAdventureRewardDesignJob(
      PET_ID,
      REWARD_ID,
    );

    expect(
      mocks.generateAdventureRewardSpec,
    ).toHaveBeenCalledTimes(1);
  });

  it("recovers a stale paid design without calling Gemini again", async () => {
    const db = fakeDatabase({
      design_status: "generating",
      design_requested_at: new Date(
        Date.now() - 25 * 60 * 1000,
      ).toISOString(),
    });

    mocks.createAdminClient.mockReturnValue(db.client);

    await processPetAdventureRewardDesignJob(
      PET_ID,
      REWARD_ID,
    );

    expect(db.gift.design_status).toBe("fallback");

    expect(
      mocks.generateAdventureRewardSpec,
    ).not.toHaveBeenCalled();
  });

  it("does not redesign an already completed reward", async () => {
    const db = fakeDatabase({
      design_status: "ready",
    });

    mocks.createAdminClient.mockReturnValue(db.client);

    await processPetAdventureRewardDesignJob(
      PET_ID,
      REWARD_ID,
    );

    expect(
      mocks.generateAdventureRewardSpec,
    ).not.toHaveBeenCalled();

    expect(mocks.enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: "pet.adventure.reward-image",
      }),
    );
  });

  it("uses the existing placeholder when AI design is disabled", async () => {
    const db = fakeDatabase();
    mocks.createAdminClient.mockReturnValue(db.client);

    vi.stubEnv("PET_ADVENTURE_AI_REWARDS", "0");

    await processPetAdventureRewardDesignJob(
      PET_ID,
      REWARD_ID,
    );

    expect(db.gift.design_status).toBe("fallback");

    expect(
      mocks.generateAdventureRewardSpec,
    ).not.toHaveBeenCalled();

    expect(db.gift.design_requested_at).toBeNull();
  });

  it("does not generate or queue images for discarded rewards", async () => {
    const db = fakeDatabase({
      choice: "discarded",
    });

    mocks.createAdminClient.mockReturnValue(db.client);

    await processPetAdventureRewardDesignJob(
      PET_ID,
      REWARD_ID,
    );

    expect(
      mocks.generateAdventureRewardSpec,
    ).not.toHaveBeenCalled();

    expect(mocks.enqueueJob).not.toHaveBeenCalled();
  });

  it("rejects invalid job identifiers before database access", async () => {
    await expect(
      processPetAdventureRewardDesignJob(
        "invalid-pet",
        REWARD_ID,
      ),
    ).rejects.toThrow("Invalid reward design job payload");

    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
