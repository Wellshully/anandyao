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
  claimNotificationDelivery: vi.fn(),
  completeNotificationDelivery: vi.fn(),
  releaseNotificationDeliveryClaim: vi.fn(),
  sendPushToUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/features/notifications/lib/notification-delivery-lease", () => ({
  claimNotificationDelivery:
    mocks.claimNotificationDelivery,
  completeNotificationDelivery:
    mocks.completeNotificationDelivery,
  releaseNotificationDeliveryClaim:
    mocks.releaseNotificationDeliveryClaim,
}));

vi.mock("@/features/notifications/lib/send-push-to-user", () => ({
  sendPushToUser: mocks.sendPushToUser,
}));

/*
 * The application imports the policy through
 * its @/ path. Forward that import to the real
 * implementation, not a simulated policy.
 */
vi.mock(
  "@/features/notifications/jobs/notification-dispatch-policy",
  async () => import("../jobs/notification-dispatch-policy"),
);

import {
  runNotificationReminders,
} from "./run-notification-reminders";

import {
  buildScheduledNotificationKey,
} from "../jobs/notification-dispatch-policy";

const scheduledAt =
  Date.parse("2026-10-12T12:00:00Z");

const normalNow =
  Date.parse("2026-10-12T11:55:00Z");

const notificationKey =
  buildScheduledNotificationKey(
    "personal:plan-1:10m",
    scheduledAt,
  );

type PersonalPlan = {
  id: string;
  user_id: string;
  title: string;
  plan_date: string;
  start_time: string | null;
  completed_at: string | null;
};

type Delivery = {
  notification_key: string;
  status: "processing" | "delivered";
  sent_at: string | null;
};

const state = {
  plans: [] as PersonalPlan[],
  deliveries: [] as Delivery[],
};

function makePlan(
  overrides: Partial<PersonalPlan> = {},
): PersonalPlan {
  return {
    id: "plan-1",
    user_id: "user-a",
    title: "Test Reminder",
    plan_date: "2026-10-12",
    start_time: "20:00:00",
    completed_at: null,
    ...overrides,
  };
}

const from = vi.fn((table: string) => {
  if (table === "personal_plans") {
    let selectedUser: string | null = null;

    const query = {
      select: vi.fn(),
      in: vi.fn(),
      is: vi.fn(),
      not: vi.fn(),
      eq: vi.fn(),

      then: (
        resolve: (value: {
          data: PersonalPlan[];
          error: null;
        }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) =>
        Promise.resolve({
          data: state.plans.filter(
            (plan) =>
              plan.completed_at === null &&
              plan.start_time !== null &&
              (
                selectedUser === null ||
                plan.user_id === selectedUser
              ),
          ),
          error: null,
        }).then(resolve, reject),
    };

    query.select.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.not.mockReturnValue(query);

    query.eq.mockImplementation(
      (column: string, value: string) => {
        if (column === "user_id") {
          selectedUser = value;
        }

        return query;
      },
    );

    return query;
  }

  if (table === "notification_deliveries") {
    let selectedKey: string | null = null;

    const query = {
      select: vi.fn(),
      eq: vi.fn(),

      maybeSingle: vi.fn(async () => {
        const delivery = state.deliveries.find(
          (item) =>
            item.notification_key === selectedKey,
        );

        return {
          data: delivery
            ? {
                status: delivery.status,
                sent_at: delivery.sent_at,
              }
            : null,
          error: null,
        };
      }),
    };

    query.select.mockReturnValue(query);

    query.eq.mockImplementation(
      (column: string, value: string) => {
        if (column === "notification_key") {
          selectedKey = value;
        }

        return query;
      },
    );

    return query;
  }

  throw new Error(`Unexpected table: ${table}`);
});

function executeReminder(
  now = normalNow,
  onlyNotificationKey = notificationKey,
) {
  return runNotificationReminders({
    userId: "user-a",
    onlyNotificationKey,
    strict: true,
    strictDelivery: true,
    now,
  });
}

describe("Notification delivery lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    state.plans = [makePlan()];
    state.deliveries = [];

    mocks.createAdminClient.mockReturnValue({
      from,
    });

    mocks.claimNotificationDelivery
      .mockResolvedValue("claim-token");

    mocks.completeNotificationDelivery
      .mockResolvedValue(true);

    mocks.releaseNotificationDeliveryClaim
      .mockResolvedValue(true);

    mocks.sendPushToUser.mockResolvedValue({
      sent: 1,
      removed: 0,
      failed: 0,
    });

    vi.spyOn(console, "error")
      .mockImplementation(() => {});

    vi.spyOn(console, "warn")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a valid reminder and completes its receipt", async () => {
    const result = await executeReminder();

    expect(result).toEqual({
      personal: 1,
      assignments: 0,
      dates: 0,
    });

    expect(
      mocks.claimNotificationDelivery,
    ).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        userId: "user-a",
        notificationKey,
      }),
    );

    expect(
      mocks.sendPushToUser,
    ).toHaveBeenCalledExactlyOnceWith(
      "user-a",
      expect.objectContaining({
        title: "An & Yao",
        body: "「Test Reminder」快要開始了",
      }),
    );

    expect(
      mocks.completeNotificationDelivery,
    ).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        notificationKey,
        claimToken: "claim-token",
      }),
    );

    expect(
      mocks.releaseNotificationDeliveryClaim,
    ).not.toHaveBeenCalled();
  });

  it("does not dispatch a completed plan", async () => {
    state.plans = [
      makePlan({
        completed_at: "2026-10-12T11:50:00Z",
      }),
    ];

    const result = await executeReminder();

    expect(result.personal).toBe(0);

    expect(
      mocks.claimNotificationDelivery,
    ).not.toHaveBeenCalled();

    expect(
      mocks.sendPushToUser,
    ).not.toHaveBeenCalled();
  });

  it("does not dispatch an old key after rescheduling", async () => {
    state.plans = [
      makePlan({
        start_time: "20:03:00",
      }),
    ];

    const result = await executeReminder();

    expect(result.personal).toBe(0);

    expect(
      mocks.sendPushToUser,
    ).not.toHaveBeenCalled();
  });

  it("does not send after the planned start time", async () => {
    const result = await executeReminder(
      Date.parse("2026-10-12T12:01:00Z"),
    );

    expect(result.personal).toBe(0);

    expect(
      mocks.sendPushToUser,
    ).not.toHaveBeenCalled();
  });

  it("releases a claim and fails when no device accepted Push", async () => {
    mocks.sendPushToUser.mockResolvedValue({
      sent: 0,
      removed: 0,
      failed: 1,
    });

    await expect(
      executeReminder(),
    ).rejects.toThrow("No device received notification");

    expect(
      mocks.releaseNotificationDeliveryClaim,
    ).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        notificationKey,
        claimToken: "claim-token",
      }),
    );

    expect(
      mocks.completeNotificationDelivery,
    ).not.toHaveBeenCalled();
  });

  it("releases a claim when the Push sender throws", async () => {
    mocks.sendPushToUser.mockRejectedValue(
      new Error("Simulated Push transport error"),
    );

    await expect(
      executeReminder(),
    ).rejects.toThrow("Simulated Push transport error");

    expect(
      mocks.releaseNotificationDeliveryClaim,
    ).toHaveBeenCalledOnce();
  });

  it("rejects a reminder while another lease is active", async () => {
    mocks.claimNotificationDelivery.mockResolvedValue(null);

    state.deliveries = [{
      notification_key: notificationKey,
      status: "processing",
      sent_at: null,
    }];

    await expect(
      executeReminder(),
    ).rejects.toThrow(
      "Notification delivery is still claimed",
    );

    expect(
      mocks.sendPushToUser,
    ).not.toHaveBeenCalled();
  });

  it("does not resend an already delivered reminder", async () => {
    mocks.claimNotificationDelivery.mockResolvedValue(null);

    state.deliveries = [{
      notification_key: notificationKey,
      status: "delivered",
      sent_at: "2026-10-12T11:54:00Z",
    }];

    const result = await executeReminder();

    expect(result.personal).toBe(0);

    expect(
      mocks.sendPushToUser,
    ).not.toHaveBeenCalled();
  });

  it("honors an existing legacy receipt", async () => {
    state.deliveries = [{
      notification_key: "personal:plan-1:10m",
      status: "delivered",
      sent_at: "2026-10-12T11:55:00Z",
    }];

    const result = await executeReminder();

    expect(result.personal).toBe(0);

    expect(
      mocks.claimNotificationDelivery,
    ).not.toHaveBeenCalled();

    expect(
      mocks.sendPushToUser,
    ).not.toHaveBeenCalled();
  });

  it("does not release the lease after Push succeeds but receipt write throws", async () => {
    mocks.completeNotificationDelivery
      .mockRejectedValue(
        new Error("Simulated receipt write failure"),
      );

    const result = await executeReminder();

    expect(result.personal).toBe(1);

    expect(
      mocks.sendPushToUser,
    ).toHaveBeenCalledOnce();

    expect(
      mocks.releaseNotificationDeliveryClaim,
    ).not.toHaveBeenCalled();
  });

  it("does not release the lease when completion returns false", async () => {
    mocks.completeNotificationDelivery
      .mockResolvedValue(false);

    const result = await executeReminder();

    expect(result.personal).toBe(1);

    expect(
      mocks.releaseNotificationDeliveryClaim,
    ).not.toHaveBeenCalled();
  });
});
