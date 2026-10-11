import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  discoverNotificationReminderCandidates: vi.fn(),
  enqueueJob: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/jobs/enqueue-job", () => ({
  enqueueJob: mocks.enqueueJob,
}));

vi.mock(
  "@/features/notifications/lib/run-notification-reminders",
  () => ({
    discoverNotificationReminderCandidates:
      mocks.discoverNotificationReminderCandidates,
  }),
);

import {
  enqueueDueNotificationDispatchJobs,
} from "./enqueue-notification-dispatch";

import {
  buildScheduledNotificationKey,
} from "./notification-dispatch-policy";

type DeliveryRow = {
  user_id: string;
  notification_key: string;
  status: string;
  sent_at: string | null;
};

const database = {
  deliveries: [] as DeliveryRow[],
  subscribedUsers: new Set<string>(),
  failingTable: null as string | null,
};

const persistedJobs = new Map<
  string,
  { id: string; status: string }
>();

const from = vi.fn((tableName: string) => {
  const filters: Record<string, string> = {};

  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
  };

  query.select.mockReturnValue(query);

  query.eq.mockImplementation(
    (column: string, value: string) => {
      filters[column] = value;
      return query;
    },
  );

  query.in.mockImplementation(
    async (column: string, values: string[]) => {
      if (database.failingTable === tableName) {
        return {
          data: null,
          error: {
            message: "Simulated database failure",
          },
        };
      }

      if (tableName === "notification_deliveries") {
        if (column !== "notification_key") {
          throw new Error("Unexpected delivery filter");
        }

        return {
          data: database.deliveries
            .filter(
              (delivery) =>
                delivery.user_id === filters.user_id &&
                delivery.status === filters.status &&
                values.includes(
                  delivery.notification_key,
                ),
            )
            .map((delivery) => ({
              notification_key:
                delivery.notification_key,
              sent_at: delivery.sent_at,
            })),
          error: null,
        };
      }

      if (tableName === "push_subscriptions") {
        if (column !== "user_id") {
          throw new Error("Unexpected subscription filter");
        }

        return {
          data: values
            .filter((id) =>
              database.subscribedUsers.has(id),
            )
            .map((user_id) => ({ user_id })),
          error: null,
        };
      }

      throw new Error(
        `Unexpected table: ${tableName}`,
      );
    },
  );

  return query;
});

function candidate(
  userId: string,
  sourceId: string,
  scheduledAt = Date.parse(
    "2026-10-12T12:00:00.000Z",
  ),
) {
  return {
    userId,
    notificationKey: buildScheduledNotificationKey(
      `personal:${sourceId}:10m`,
      scheduledAt,
    ),
    notificationType: "personal_10m",
    sourceId,
  };
}

describe("Notification dispatch Producer integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    database.deliveries = [];
    database.subscribedUsers.clear();
    database.failingTable = null;
    persistedJobs.clear();

    mocks.createAdminClient.mockReturnValue({
      from,
    });

    mocks.discoverNotificationReminderCandidates
      .mockResolvedValue([]);

    mocks.enqueueJob.mockImplementation(
      async (input: {
        idempotencyKey?: string;
      }) => {
        const key = input.idempotencyKey;

        if (!key) {
          throw new Error(
            "Missing notification idempotency key",
          );
        }

        const existing = persistedJobs.get(key);

        if (existing) {
          return {
            job: existing,
            created: false,
          };
        }

        const job = {
          id: `job-${persistedJobs.size + 1}`,
          status: "pending",
        };

        persistedJobs.set(key, job);

        return {
          job,
          created: true,
        };
      },
    );
  });

  it("creates one high-priority job per unique event", async () => {
    const first = candidate("user-a", "plan-a");
    const second = candidate("user-a", "plan-b");

    database.subscribedUsers.add("user-a");

    mocks.discoverNotificationReminderCandidates
      .mockResolvedValue([
        first,
        first,
        second,
      ]);

    const result =
      await enqueueDueNotificationDispatchJobs();

    expect(result.discovered).toBe(2);
    expect(result.eligible).toBe(2);
    expect(result.created).toBe(2);

    expect(mocks.enqueueJob).toHaveBeenCalledTimes(2);

    for (const call of mocks.enqueueJob.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          jobType: "notification.dispatch",
          priority: 1000,
          maxAttempts: 5,
        }),
      );
    }

    expect(
      mocks.enqueueJob.mock.calls[0][0].idempotencyKey,
    ).not.toBe(
      mocks.enqueueJob.mock.calls[1][0].idempotencyKey,
    );
  });

  it("reuses the same job during repeated scans", async () => {
    database.subscribedUsers.add("user-a");

    mocks.discoverNotificationReminderCandidates
      .mockResolvedValue([
        candidate("user-a", "plan-a"),
      ]);

    const first =
      await enqueueDueNotificationDispatchJobs();

    const second =
      await enqueueDueNotificationDispatchJobs();

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.jobs).toHaveLength(1);
    expect(second.jobs[0].created).toBe(false);
    expect(persistedJobs.size).toBe(1);
  });

  it("skips an already delivered scheduled event", async () => {
    const first = candidate("user-a", "plan-a");
    const second = candidate("user-a", "plan-b");

    database.subscribedUsers.add("user-a");

    database.deliveries.push({
      user_id: "user-a",
      notification_key: first.notificationKey,
      status: "delivered",
      sent_at: "2026-10-12T11:55:00Z",
    });

    mocks.discoverNotificationReminderCandidates
      .mockResolvedValue([
        first,
        second,
      ]);

    const result =
      await enqueueDueNotificationDispatchJobs();

    expect(result.alreadyDelivered).toBe(1);
    expect(result.created).toBe(1);

    expect(mocks.enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          notificationKey: second.notificationKey,
        }),
      }),
    );
  });

  it("recognizes a legacy receipt for the same schedule", async () => {
    const item = candidate("user-a", "plan-a");

    database.subscribedUsers.add("user-a");

    database.deliveries.push({
      user_id: "user-a",
      notification_key: "personal:plan-a:10m",
      status: "delivered",
      sent_at: "2026-10-12T11:55:00Z",
    });

    mocks.discoverNotificationReminderCandidates
      .mockResolvedValue([item]);

    const result =
      await enqueueDueNotificationDispatchJobs();

    expect(result.alreadyDelivered).toBe(1);
    expect(result.created).toBe(0);
    expect(mocks.enqueueJob).not.toHaveBeenCalled();
  });

  it("allows a rescheduled event after an old legacy receipt", async () => {
    const item = candidate(
      "user-a",
      "plan-a",
      Date.parse("2026-10-13T12:00:00Z"),
    );

    database.subscribedUsers.add("user-a");

    database.deliveries.push({
      user_id: "user-a",
      notification_key: "personal:plan-a:10m",
      status: "delivered",
      sent_at: "2026-10-12T11:55:00Z",
    });

    mocks.discoverNotificationReminderCandidates
      .mockResolvedValue([item]);

    const result =
      await enqueueDueNotificationDispatchJobs();

    expect(result.alreadyDelivered).toBe(0);
    expect(result.created).toBe(1);
  });

  it("does not enqueue users without push subscriptions", async () => {
    mocks.discoverNotificationReminderCandidates
      .mockResolvedValue([
        candidate("user-a", "plan-a"),
        candidate("user-b", "plan-b"),
      ]);

    database.subscribedUsers.add("user-a");

    const result =
      await enqueueDueNotificationDispatchJobs();

    expect(result.withoutSubscription).toBe(1);
    expect(result.eligible).toBe(1);
    expect(result.created).toBe(1);

    expect(mocks.enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          userId: "user-a",
        }),
      }),
    );
  });

  it("fails before enqueueing when delivery lookup fails", async () => {
    database.failingTable = "notification_deliveries";

    mocks.discoverNotificationReminderCandidates
      .mockResolvedValue([
        candidate("user-a", "plan-a"),
      ]);

    await expect(
      enqueueDueNotificationDispatchJobs(),
    ).rejects.toThrow(
      "Failed to check delivered notifications",
    );

    expect(mocks.enqueueJob).not.toHaveBeenCalled();
  });

  it("fails before enqueueing when subscription lookup fails", async () => {
    database.failingTable = "push_subscriptions";

    mocks.discoverNotificationReminderCandidates
      .mockResolvedValue([
        candidate("user-a", "plan-a"),
      ]);

    await expect(
      enqueueDueNotificationDispatchJobs(),
    ).rejects.toThrow(
      "Failed to check push subscriptions",
    );

    expect(mocks.enqueueJob).not.toHaveBeenCalled();
  });

  it("returns an empty result without database queries", async () => {
    const result =
      await enqueueDueNotificationDispatchJobs();

    expect(result).toEqual({
      discovered: 0,
      alreadyDelivered: 0,
      withoutSubscription: 0,
      eligible: 0,
      created: 0,
      jobs: [],
    });

    expect(from).not.toHaveBeenCalled();
    expect(mocks.enqueueJob).not.toHaveBeenCalled();
  });
});
