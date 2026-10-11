import {
  describe,
  expect,
  it,
} from "vitest";

import {
  filterDeliveredNotificationCandidates,
  getNotificationDispatchKey,
  matchesNotificationDispatchKey,
  buildScheduledNotificationKey,
  getLegacyNotificationKey,
  getNotificationDispatchCategory,
  legacyDeliveryCoversSchedule,
  shouldRunNotificationCategory,
  uniqueNotificationCandidates,
  type ReminderCandidate,
} from "./notification-dispatch-policy";

function candidate(
  userId: string,
  notificationKey: string,
): ReminderCandidate {
  return {
    userId,
    notificationKey,
    notificationType: "personal_10m",
    sourceId: "source-1",
  };
}

describe("Notification event dispatch policy", () => {
  it("generates a stable key for the same reminder", () => {
    const item = candidate(
      "user-a",
      "personal:plan-1:10m",
    );

    expect(
      getNotificationDispatchKey(item),
    ).toBe(
      getNotificationDispatchKey(item),
    );
  });

  it("distinguishes two reminders for one user", () => {
    expect(
      getNotificationDispatchKey(
        candidate("user-a", "personal:plan-1:10m"),
      ),
    ).not.toBe(
      getNotificationDispatchKey(
        candidate("user-a", "personal:plan-2:10m"),
      ),
    );
  });

  it("distinguishes the same reminder for two users", () => {
    expect(
      getNotificationDispatchKey(
        candidate("user-a", "assignment:1:24h"),
      ),
    ).not.toBe(
      getNotificationDispatchKey(
        candidate("user-b", "assignment:1:24h"),
      ),
    );
  });

  it("does not depend on scan time", () => {
    const item = candidate(
      "user-a",
      "date:date-1:day-1:1h",
    );

    const first =
      getNotificationDispatchKey(item);

    const second =
      getNotificationDispatchKey(item);

    expect(first).toBe(second);
  });

  it("normalizes whitespace", () => {
    expect(
      getNotificationDispatchKey(
        candidate(" user-a ", " personal:1:10m "),
      ),
    ).toBe(
      getNotificationDispatchKey(
        candidate("user-a", "personal:1:10m"),
      ),
    );
  });

  it("cannot confuse delimiter-containing identifiers", () => {
    expect(
      getNotificationDispatchKey(
        candidate("a:b", "c"),
      ),
    ).not.toBe(
      getNotificationDispatchKey(
        candidate("a", "b:c"),
      ),
    );
  });

  it("deduplicates repeated discovery results", () => {
    const items = uniqueNotificationCandidates([
      candidate("user-a", "personal:1:10m"),
      candidate("user-a", "personal:1:10m"),
      candidate("user-a", "personal:2:10m"),
    ]);

    expect(items).toHaveLength(2);
  });

  it("filters delivered events but keeps other reminders", () => {
    const first = candidate(
      "user-a",
      "personal:1:10m",
    );

    const second = candidate(
      "user-a",
      "personal:2:10m",
    );

    const delivered = new Set([
      getNotificationDispatchKey(first),
    ]);

    expect(
      filterDeliveredNotificationCandidates(
        [first, second],
        delivered,
      ),
    ).toEqual([second]);
  });

  it("rejects empty identifiers", () => {
    expect(() =>
      getNotificationDispatchKey(
        candidate(" ", "personal:1:10m"),
      ),
    ).toThrow();

    expect(() =>
      getNotificationDispatchKey(
        candidate("user-a", " "),
      ),
    ).toThrow();
  });

  it("matches only the targeted event when dispatching", () => {
    expect(
      matchesNotificationDispatchKey(
        "personal:a:10m",
        "personal:a:10m",
      ),
    ).toBe(true);

    expect(
      matchesNotificationDispatchKey(
        "personal:b:10m",
        "personal:a:10m",
      ),
    ).toBe(false);
  });

  it("allows all events when no target is specified", () => {
    expect(
      matchesNotificationDispatchKey(
        "assignment:a:24h",
      ),
    ).toBe(true);
  });

  it("routes supported notification keys to their categories", () => {
    expect(
      getNotificationDispatchCategory(
        "personal:plan-1:10m",
      ),
    ).toBe("personal");

    expect(
      getNotificationDispatchCategory(
        "assignment:task-1:24h",
      ),
    ).toBe("assignments");

    expect(
      getNotificationDispatchCategory(
        "date:date-1:day-1:1h",
      ),
    ).toBe("dates");
  });

  it("only scans the targeted reminder category", () => {
    const key = "personal:plan-1:10m";

    expect(
      shouldRunNotificationCategory("personal", key),
    ).toBe(true);

    expect(
      shouldRunNotificationCategory("assignments", key),
    ).toBe(false);

    expect(
      shouldRunNotificationCategory("dates", key),
    ).toBe(false);
  });

  it("still scans all categories for untargeted discovery", () => {
    expect(
      shouldRunNotificationCategory("personal"),
    ).toBe(true);

    expect(
      shouldRunNotificationCategory("assignments"),
    ).toBe(true);

    expect(
      shouldRunNotificationCategory("dates"),
    ).toBe(true);
  });

  it("rejects malformed or unknown notification keys", () => {
    for (const key of [
      "unexpected:abc",
      "personal::10m",
      "assignment:task-1:10m",
      "date:date-1:1h",
      "",
    ]) {
      expect(() =>
        getNotificationDispatchCategory(key),
      ).toThrow();
    }
  });

  it("versions a reminder by its scheduled time", () => {
    const baseKey = "personal:plan-1:10m";

    const first = buildScheduledNotificationKey(
      baseKey,
      Date.parse("2026-10-12T12:00:00Z"),
    );

    const second = buildScheduledNotificationKey(
      baseKey,
      Date.parse("2026-10-13T12:00:00Z"),
    );

    expect(first).not.toBe(second);

    expect(
      getNotificationDispatchCategory(first),
    ).toBe("personal");

    expect(
      getLegacyNotificationKey(first),
    ).toBe(baseKey);
  });

  it("supports versioned assignment and date keys", () => {
    const scheduledAt = Date.parse(
      "2026-10-12T12:00:00Z",
    );

    expect(
      getNotificationDispatchCategory(
        buildScheduledNotificationKey(
          "assignment:task-1:24h",
          scheduledAt,
        ),
      ),
    ).toBe("assignments");

    expect(
      getNotificationDispatchCategory(
        buildScheduledNotificationKey(
          "date:date-1:day-1:1h",
          scheduledAt,
        ),
      ),
    ).toBe("dates");
  });

  it("recognizes an old delivery inside the same schedule window", () => {
    const key = buildScheduledNotificationKey(
      "personal:plan-1:10m",
      Date.parse("2026-10-12T12:00:00Z"),
    );

    expect(
      legacyDeliveryCoversSchedule(
        key,
        "2026-10-12T11:55:00Z",
      ),
    ).toBe(true);
  });

  it("does not suppress a rescheduled reminder using an old delivery", () => {
    const key = buildScheduledNotificationKey(
      "personal:plan-1:10m",
      Date.parse("2026-10-13T12:00:00Z"),
    );

    expect(
      legacyDeliveryCoversSchedule(
        key,
        "2026-10-12T11:55:00Z",
      ),
    ).toBe(false);
  });

  it("rejects malformed schedule versions", () => {
    expect(() =>
      buildScheduledNotificationKey(
        "personal:plan-1:10m",
        Number.NaN,
      ),
    ).toThrow();

    expect(() =>
      buildScheduledNotificationKey(
        "unknown:key",
        Date.now(),
      ),
    ).toThrow();

    expect(
      getLegacyNotificationKey(
        "personal:plan-1:10m",
      ),
    ).toBeNull();
  });
});
