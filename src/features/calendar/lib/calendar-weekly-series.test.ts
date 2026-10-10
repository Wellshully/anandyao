import { describe, expect, it } from "vitest";

import {
  buildCalendarWeeklyRule,
  describeCalendarWeeklyRule,
  parseCalendarWeeklyRule,
} from "./calendar-weekly-series";

describe("Calendar weekly series", () => {
  it("parses an existing weekly recurrence", () => {
    expect(
      parseCalendarWeeklyRule("FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,FR"),
    ).toEqual({
      interval: 1,
      days: ["TU", "FR"],
    });
  });

  it("builds a canonical weekly recurrence", () => {
    expect(
      buildCalendarWeeklyRule({
        interval: 2,
        days: ["FR", "MO"],
      }),
    ).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR");
  });

  it("rejects unsupported recurrence rules", () => {
    expect(
      parseCalendarWeeklyRule("FREQ=MONTHLY;BYMONTHDAY=1"),
    ).toBeNull();
  });

  it("rejects duplicate weekdays", () => {
    expect(
      parseCalendarWeeklyRule("FREQ=WEEKLY;BYDAY=MO,MO"),
    ).toBeNull();
  });

  it("creates a human-readable expression", () => {
    expect(
      describeCalendarWeeklyRule(
        { interval: 1, days: ["TU", "FR"] },
        "exact",
        "19:30",
      ),
    ).toBe("每週週二、週五 19:30");
  });
});
