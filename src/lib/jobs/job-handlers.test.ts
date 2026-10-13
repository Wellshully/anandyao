import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  BackgroundJob,
} from "@/lib/jobs/types";

const mocks = vi.hoisted(() => ({
  runNotificationReminders: vi.fn(),
  processPetAdventureRewardDesignJob: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock(
  "@/features/notifications/lib/run-notification-reminders",
  () => ({
    runNotificationReminders:
      mocks.runNotificationReminders,
  }),
);

vi.mock("@/features/study/lib/sync-ntu-cool", () => ({
  syncNtuCoolForUser: vi.fn(),
}));

vi.mock("@/features/study/mail/sync-ntu-mail", () => ({
  syncNtuMailForUser: vi.fn(),
}));

vi.mock("@/features/pet/report/run-daily-reports", () => ({
  runPetDailyReports: vi.fn(),
}));

vi.mock(
  "@/features/pet/jobs/pet-daily-report-job-policy",
  () => ({
    getPetReportNoDeviceRetry: vi.fn(),
    isPetReportJobDateCurrent: vi.fn(),
  }),
);

vi.mock("@/lib/jobs/enqueue-job", () => ({
  enqueueJob: vi.fn(),
}));

vi.mock(
  "@/features/pet/adventure/jobs/generate-reward-design",
  () => ({
    processPetAdventureRewardDesignJob:
      mocks.processPetAdventureRewardDesignJob,
  }),
);

import {
  getJobHandler,
} from "./job-handlers";

function makeJob(payload: unknown): BackgroundJob {
  return {
    id: "notification-job-1",
    job_type: "notification.dispatch",
    attempts: 1,
    payload,
  } as unknown as BackgroundJob;
}

describe("Notification dispatch Worker handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.runNotificationReminders.mockResolvedValue({
      personal: 1,
      assignments: 0,
      dates: 0,
    });
  });

  it("dispatches only the requested user's reminder", async () => {
    const handler =
      getJobHandler("notification.dispatch");

    const notificationKey =
      "personal:plan-1:10m:1791806400000";

    await handler(makeJob({
      userId: "user-a",
      notificationKey,
    }));

    expect(
      mocks.runNotificationReminders,
    ).toHaveBeenCalledExactlyOnceWith({
      userId: "user-a",
      onlyNotificationKey: notificationKey,
      strict: true,
      strictDelivery: true,
    });
  });

  it("normalizes payload whitespace", async () => {
    const handler =
      getJobHandler("notification.dispatch");

    await handler(makeJob({
      userId: " user-a ",
      notificationKey:
        " personal:plan-1:10m:1791806400000 ",
    }));

    expect(
      mocks.runNotificationReminders,
    ).toHaveBeenCalledWith({
      userId: "user-a",
      onlyNotificationKey:
        "personal:plan-1:10m:1791806400000",
      strict: true,
      strictDelivery: true,
    });
  });

  it("rejects jobs without a userId", async () => {
    const handler =
      getJobHandler("notification.dispatch");

    await expect(
      handler(makeJob({
        notificationKey:
          "personal:plan-1:10m:1791806400000",
      })),
    ).rejects.toThrow("payload.userId");

    expect(
      mocks.runNotificationReminders,
    ).not.toHaveBeenCalled();
  });

  it("rejects jobs without a notificationKey", async () => {
    const handler =
      getJobHandler("notification.dispatch");

    await expect(
      handler(makeJob({
        userId: "user-a",
        notificationKey: " ",
      })),
    ).rejects.toThrow("payload.notificationKey");

    expect(
      mocks.runNotificationReminders,
    ).not.toHaveBeenCalled();
  });

  it("propagates notification delivery failures", async () => {
    const handler =
      getJobHandler("notification.dispatch");

    mocks.runNotificationReminders.mockRejectedValue(
      new Error("Simulated push delivery failure"),
    );

    await expect(
      handler(makeJob({
        userId: "user-a",
        notificationKey:
          "assignment:task-1:24h:1791806400000",
      })),
    ).rejects.toThrow(
      "Simulated push delivery failure",
    );
  });
});


describe("Pet Adventure Reward Design handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.processPetAdventureRewardDesignJob
      .mockResolvedValue(undefined);
  });

  it("registers and dispatches reward design jobs", async () => {
    const handler = getJobHandler(
      "pet.adventure.reward-design",
    );

    await handler(makeJob({
      petId: "pet-123",
      rewardId: "reward-456",
    }));

    expect(
      mocks.processPetAdventureRewardDesignJob,
    ).toHaveBeenCalledExactlyOnceWith(
      "pet-123",
      "reward-456",
    );
  });

  it("rejects missing reward IDs", async () => {
    const handler = getJobHandler(
      "pet.adventure.reward-design",
    );

    await expect(
      handler(makeJob({
        petId: "pet-123",
      })),
    ).rejects.toThrow("payload.rewardId");

    expect(
      mocks.processPetAdventureRewardDesignJob,
    ).not.toHaveBeenCalled();
  });
});
