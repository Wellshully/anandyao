import {
  describe,
  expect,
  it,
} from "vitest";

import {
  getNotificationDispatchBucket,
  getNotificationDispatchKey,
} from "./notification-dispatch-policy";

describe("Notification dispatch scheduling policy", () => {
  it("floors to a UTC five-minute bucket", () => {
    expect(
      getNotificationDispatchBucket(
        new Date("2026-10-10T12:04:59Z"),
      ),
    ).toBe("2026-10-10T12:00:00.000Z");
  });

  it("advances at the bucket boundary", () => {
    expect(
      getNotificationDispatchBucket(
        new Date("2026-10-10T12:05:00Z"),
      ),
    ).toBe("2026-10-10T12:05:00.000Z");
  });

  it("deduplicates the same user within a bucket", () => {
    expect(
      getNotificationDispatchKey(
        "user-a",
        new Date("2026-10-10T12:01:00Z"),
      ),
    ).toBe(
      getNotificationDispatchKey(
        "user-a",
        new Date("2026-10-10T12:04:00Z"),
      ),
    );
  });

  it("distinguishes different users", () => {
    const now = new Date("2026-10-10T12:01:00Z");

    expect(
      getNotificationDispatchKey("user-a", now),
    ).not.toBe(
      getNotificationDispatchKey("user-b", now),
    );
  });

  it("distinguishes different buckets", () => {
    expect(
      getNotificationDispatchKey(
        "user-a",
        new Date("2026-10-10T12:04:00Z"),
      ),
    ).not.toBe(
      getNotificationDispatchKey(
        "user-a",
        new Date("2026-10-10T12:05:00Z"),
      ),
    );
  });

  it("normalizes user ID whitespace", () => {
    const now = new Date("2026-10-10T12:01:00Z");

    expect(
      getNotificationDispatchKey(" user-a ", now),
    ).toBe(
      getNotificationDispatchKey("user-a", now),
    );
  });

  it("rejects invalid input", () => {
    expect(() =>
      getNotificationDispatchKey(
        " ",
        new Date(),
      ),
    ).toThrow();

    expect(() =>
      getNotificationDispatchBucket(
        new Date("invalid"),
      ),
    ).toThrow();
  });
});
