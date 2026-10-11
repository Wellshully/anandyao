import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getConfiguredStudyUserIds: vi.fn(),
  enqueueJob: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock(
  "@/features/study/lib/get-study-credentials",
  () => ({
    getConfiguredStudyUserIds:
      mocks.getConfiguredStudyUserIds,
  }),
);

vi.mock("@/lib/jobs/enqueue-job", () => ({
  enqueueJob: mocks.enqueueJob,
}));

import {
  enqueueConfiguredStudyMailSyncJobs,
} from "./enqueue-study-mail-sync";

type LookupResult = {
  data: Array<{ id: string }> | null;
  error: { message: string } | null;
};

function mockJobLookup(
  lookup: (userId: string) => LookupResult,
) {
  const contains = vi.fn(
    (
      _column: string,
      payload: { userId: string },
    ) => ({
      limit: vi.fn(async () =>
        lookup(payload.userId),
      ),
    }),
  );

  const inStatus = vi.fn(() => ({
    contains,
  }));

  const eq = vi.fn(() => ({
    in: inStatus,
  }));

  const select = vi.fn(() => ({
    eq,
  }));

  const from = vi.fn(() => ({
    select,
  }));

  mocks.createAdminClient.mockReturnValue({
    from,
  });

  return {
    from,
    select,
    eq,
    inStatus,
    contains,
  };
}

const now = new Date(
  "2026-10-11T07:30:00.000Z",
);

describe("Study Mail sync job producer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getConfiguredStudyUserIds.mockReturnValue([
      "user-a",
      "user-b",
    ]);

    mocks.enqueueJob.mockResolvedValue({
      created: true,
      job: {
        id: "mock-job",
        status: "pending",
      },
    });
  });

  it("does not enqueue if both users have active jobs", async () => {
    const query = mockJobLookup(() => ({
      data: [{ id: "existing-job" }],
      error: null,
    }));

    const result =
      await enqueueConfiguredStudyMailSyncJobs(now);

    expect(result.configuredCount).toBe(2);
    expect(result.skippedCount).toBe(2);
    expect(result.jobs).toEqual([]);

    expect(mocks.enqueueJob).not.toHaveBeenCalled();

    expect(query.from).toHaveBeenCalledWith(
      "background_jobs",
    );

    expect(query.contains).toHaveBeenCalledTimes(2);
  });

  it("only enqueues the idle user with one attempt", async () => {
    mockJobLookup((userId) => ({
      data:
        userId === "user-a"
          ? [{ id: "existing-job" }]
          : [],
      error: null,
    }));

    const result =
      await enqueueConfiguredStudyMailSyncJobs(now);

    expect(result.configuredCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(result.jobs).toHaveLength(1);

    expect(mocks.enqueueJob).toHaveBeenCalledTimes(1);

    expect(mocks.enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: "study.mail-sync",
        payload: {
          userId: "user-b",
        },
        maxAttempts: 1,
      }),
    );
  });

  it("fails closed when the active-job lookup fails", async () => {
    mockJobLookup(() => ({
      data: null,
      error: {
        message: "Database temporarily unavailable",
      },
    }));

    await expect(
      enqueueConfiguredStudyMailSyncJobs(now),
    ).rejects.toThrow(
      "Failed to inspect pending Mail sync jobs",
    );

    expect(mocks.enqueueJob).not.toHaveBeenCalled();
  });
});
