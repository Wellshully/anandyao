import { describe, expect, it } from "vitest";

import {
  getDuePetReportSlot,
  getPetReportJobKey,
  getPetReportLocalDateTime,
  getPetReportNoDeviceRetry,
  isPetReportJobDateCurrent,
  normalizePetReportTime,
} from "./pet-daily-report-job-policy";

describe("Pet Daily Report Queue scheduling", () => {
  const before = new Date(
    "2026-10-10T08:29:00.000Z",
  );

  const atTime = new Date(
    "2026-10-10T08:30:00.000Z",
  );

  const later = new Date(
    "2026-10-10T09:00:00.000Z",
  );

  it("does not enqueue before scheduled time", () => {
    expect(
      getDuePetReportSlot(
        before,
        "Asia/Taipei",
        "16:30:00",
      ),
    ).toBeNull();
  });

  it("enqueues at scheduled time", () => {
    expect(
      getDuePetReportSlot(
        atTime,
        "Asia/Taipei",
        "16:30:00",
      ),
    ).toEqual({
      reportDate: "2026-10-10",
      reportTime: "16:30",
      timeZone: "Asia/Taipei",
    });
  });

  it("remains eligible later that day", () => {
    expect(
      getDuePetReportSlot(
        later,
        "Asia/Taipei",
        "16:30",
      ),
    ).not.toBeNull();
  });

  it("respects the configured time zone", () => {
    expect(
      getPetReportLocalDateTime(
        atTime,
        "America/New_York",
      ).time,
    ).toBe("04:30");
  });

  it("normalizes PostgreSQL TIME values", () => {
    expect(
      normalizePetReportTime("08:05:00"),
    ).toBe("08:05");
  });

  it("uses the same key for repeated triggers", () => {
    const slot = getDuePetReportSlot(
      atTime,
      "Asia/Taipei",
      "16:30",
    )!;

    expect(
      getPetReportJobKey("user-a", slot),
    ).toBe(
      getPetReportJobKey("user-a", slot),
    );
  });

  it("separates different users", () => {
    const slot = getDuePetReportSlot(
      atTime,
      "Asia/Taipei",
      "16:30",
    )!;

    expect(
      getPetReportJobKey("user-a", slot),
    ).not.toBe(
      getPetReportJobKey("user-b", slot),
    );
  });

  it("separates different report times", () => {
    const early = getDuePetReportSlot(
      atTime,
      "Asia/Taipei",
      "16:00",
    )!;

    const late = getDuePetReportSlot(
      atTime,
      "Asia/Taipei",
      "16:30",
    )!;

    expect(
      getPetReportJobKey("user-a", early),
    ).not.toBe(
      getPetReportJobKey("user-a", late),
    );
  });

  it("rejects invalid settings", () => {
    expect(() =>
      normalizePetReportTime("25:99"),
    ).toThrow();

    expect(() =>
      getPetReportJobKey(" ", {
        reportDate: "2026-10-10",
        reportTime: "16:30",
        timeZone: "Asia/Taipei",
      }),
    ).toThrow();
  });

  it("accepts a delayed job on the same local day", () => {
    expect(
      isPetReportJobDateCurrent(
        "2026-10-10",
        "Asia/Taipei",
        new Date("2026-10-10T12:00:00Z"),
      ),
    ).toBe(true);
  });

  it("rejects a job from the previous local day", () => {
    expect(
      isPetReportJobDateCurrent(
        "2026-10-10",
        "Asia/Taipei",
        new Date("2026-10-10T16:05:00Z"),
      ),
    ).toBe(false);
  });

  it("schedules a no-device retry without immediate execution", () => {
    const retry = getPetReportNoDeviceRetry(
      new Date("2026-10-10T08:05:00Z"),
      "user-a",
      "2026-10-10",
      "Asia/Taipei",
    );

    expect(
      retry?.runAt.toISOString(),
    ).toBe("2026-10-10T09:00:00.000Z");
  });

  it("deduplicates no-device retries in the same slot", () => {
    const first = getPetReportNoDeviceRetry(
      new Date("2026-10-10T08:05:00Z"),
      "user-a",
      "2026-10-10",
      "Asia/Taipei",
    );

    const second = getPetReportNoDeviceRetry(
      new Date("2026-10-10T08:20:00Z"),
      "user-a",
      "2026-10-10",
      "Asia/Taipei",
    );

    expect(first?.idempotencyKey).toBe(
      second?.idempotencyKey,
    );
  });

  it("creates a new key for a later retry slot", () => {
    const first = getPetReportNoDeviceRetry(
      new Date("2026-10-10T08:05:00Z"),
      "user-a",
      "2026-10-10",
      "Asia/Taipei",
    );

    const later = getPetReportNoDeviceRetry(
      new Date("2026-10-10T08:40:00Z"),
      "user-a",
      "2026-10-10",
      "Asia/Taipei",
    );

    expect(first?.idempotencyKey).not.toBe(
      later?.idempotencyKey,
    );
  });

  it("does not schedule no-device retries into tomorrow", () => {
    expect(
      getPetReportNoDeviceRetry(
        new Date("2026-10-10T15:20:00Z"),
        "user-a",
        "2026-10-10",
        "Asia/Taipei",
      ),
    ).toBeNull();
  });
});
