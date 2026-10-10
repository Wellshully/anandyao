import { describe, expect, it } from "vitest";

import {
  buildCalendarOccurrenceCancellation,
  buildCalendarSeriesCancellation,
} from "./calendar-recurring-cancel";

const scheduleId =
  "00000000-0000-4000-8000-000000000001";

describe("Calendar recurring cancellation", () => {
  it("cancels only the selected occurrence", () => {
    const action = buildCalendarOccurrenceCancellation({
      scheduleId,
      occurrenceDate: "2026-10-16",
    });

    expect(action).toEqual({
      action: "cancel",
      scheduleId,
      occurrenceDate: "2026-10-16",
      titleOverride: null,
      noteOverride: null,
      timePrecisionOverride: null,
      startTimeOverride: null,
    });
  });

  it("rejects a nonexistent occurrence date", () => {
    expect(
      buildCalendarOccurrenceCancellation({
        scheduleId,
        occurrenceDate: "2026-02-30",
      }),
    ).toBeNull();
  });

  it("rejects unexpected occurrence fields", () => {
    expect(
      buildCalendarOccurrenceCancellation({
        scheduleId,
        occurrenceDate: "2026-10-16",
        deleteEntireSeries: true,
      }),
    ).toBeNull();
  });

  it("builds a whole-series cancellation", () => {
    expect(
      buildCalendarSeriesCancellation({
        scheduleId,
      }),
    ).toEqual({
      action: "cancel",
      scheduleId,
      schedule: null,
    });
  });

  it("rejects invalid series targets", () => {
    expect(
      buildCalendarSeriesCancellation({
        scheduleId: "invalid-id",
      }),
    ).toBeNull();

    expect(
      buildCalendarSeriesCancellation({
        scheduleId,
        occurrenceDate: "2026-10-16",
      }),
    ).toBeNull();
  });
});
