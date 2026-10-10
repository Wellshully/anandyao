import { describe, expect, it } from "vitest";

import {
  getStudyMailSyncBucket,
  getStudyMailSyncIdempotencyKey,
} from "./mail-sync-job-policy";

describe("Study Mail background job", () => {
  const first = new Date("2026-10-10T09:12:01.000Z");
  const sameMinute = new Date("2026-10-10T09:12:59.000Z");
  const nextMinute = new Date("2026-10-10T09:13:00.000Z");

  it("uses one scheduling bucket per minute", () => {
    expect(getStudyMailSyncBucket(first)).toBe(
      getStudyMailSyncBucket(sameMinute),
    );
  });

  it("changes the bucket at the next minute", () => {
    expect(getStudyMailSyncBucket(first)).not.toBe(
      getStudyMailSyncBucket(nextMinute),
    );
  });

  it("deduplicates one account in the same minute", () => {
    expect(
      getStudyMailSyncIdempotencyKey("user-a", first),
    ).toBe(
      getStudyMailSyncIdempotencyKey(
        "user-a",
        sameMinute,
      ),
    );
  });

  it("keeps different accounts independent", () => {
    expect(
      getStudyMailSyncIdempotencyKey("user-a", first),
    ).not.toBe(
      getStudyMailSyncIdempotencyKey("user-b", first),
    );
  });

  it("permits a new job in the next minute", () => {
    expect(
      getStudyMailSyncIdempotencyKey("user-a", first),
    ).not.toBe(
      getStudyMailSyncIdempotencyKey(
        "user-a",
        nextMinute,
      ),
    );
  });

  it("rejects an empty user ID", () => {
    expect(() =>
      getStudyMailSyncIdempotencyKey("   ", first),
    ).toThrow("Study Mail sync requires a user ID.");
  });

  it("rejects invalid scheduling dates", () => {
    expect(() =>
      getStudyMailSyncBucket(new Date("invalid")),
    ).toThrow("Invalid Study Mail sync time.");
  });
});
