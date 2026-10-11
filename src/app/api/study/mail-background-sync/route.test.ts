import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  enqueueConfiguredStudyMailSyncJobs: vi.fn(),
}));

vi.mock(
  "@/features/study/jobs/enqueue-study-mail-sync",
  () => ({
    enqueueConfiguredStudyMailSyncJobs:
      mocks.enqueueConfiguredStudyMailSyncJobs,
  }),
);

import { POST } from "./route";

const previousCronSecret = process.env.CRON_SECRET;

function makeRequest(
  authorization = "Bearer test-cron-secret",
) {
  return new NextRequest(
    "http://localhost/api/study/mail-background-sync",
    {
      method: "POST",
      headers: {
        authorization,
      },
    },
  );
}

describe("Study Mail background sync API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    if (previousCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousCronSecret;
    }
  });

  it("returns 200 when all accounts are already queued", async () => {
    mocks.enqueueConfiguredStudyMailSyncJobs
      .mockResolvedValue({
        bucket: "test-bucket",
        configuredCount: 2,
        skippedCount: 2,
        jobs: [],
      });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);

    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        queued: 0,
        configuredCount: 2,
        skippedCount: 2,
        jobs: [],
      }),
    );
  });

  it("returns 500 when no accounts are configured", async () => {
    mocks.enqueueConfiguredStudyMailSyncJobs
      .mockResolvedValue({
        bucket: "test-bucket",
        configuredCount: 0,
        skippedCount: 0,
        jobs: [],
      });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe(
      "No Study Mail accounts are configured.",
    );
  });

  it("returns 202 when a new Mail job is created", async () => {
    mocks.enqueueConfiguredStudyMailSyncJobs
      .mockResolvedValue({
        bucket: "test-bucket",
        configuredCount: 2,
        skippedCount: 1,
        jobs: [
          {
            userId: "user-a",
            jobId: "new-job",
            status: "pending",
            created: true,
          },
        ],
      });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.success).toBe(true);
    expect(body.queued).toBe(1);
    expect(body.skippedCount).toBe(1);
  });

  it("preserves Cron authentication", async () => {
    const response = await POST(
      makeRequest("Bearer wrong-secret"),
    );

    expect(response.status).toBe(401);

    expect(
      mocks.enqueueConfiguredStudyMailSyncJobs,
    ).not.toHaveBeenCalled();
  });
});
