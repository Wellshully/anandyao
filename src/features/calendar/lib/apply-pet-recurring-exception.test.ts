import {
  describe,
  expect,
  it,
} from "vitest";

import {
  applyPetRecurringException,
  type CalendarRecurringException,
} from "./apply-pet-recurring-exception";

import type {
  CalendarRecurringSchedule,
  RecurringOccurrence,
} from "./expand-pet-recurring-schedule";

const schedule: CalendarRecurringSchedule = {
  id: "schedule-1",
  title: "家教",
  recurrence_rule: "FREQ=WEEKLY;BYDAY=TU,FR",
  recurrence_start_date: "2026-10-06",
  recurrence_end_date: null,
  time_precision: "none",
  start_time: null,
  status: "active",
};

const occurrence: RecurringOccurrence = {
  date: "2026-10-09",
  startAt: null,
  allDay: true,
};

const baseException: CalendarRecurringException = {
  schedule_id: schedule.id,
  occurrence_date: occurrence.date,
  kind: "override",
  title_override: null,
  time_precision_override: null,
  start_time_override: null,
};

describe("applyPetRecurringException", () => {
  it("preserves an occurrence without an exception", () => {
    const result = applyPetRecurringException(
      schedule,
      occurrence,
      null,
    );

    expect(result).toEqual({
      ...occurrence,
      title: "家教",
    });
  });

  it("overrides only the occurrence title", () => {
    const result = applyPetRecurringException(
      schedule,
      occurrence,
      {
        ...baseException,
        title_override: "北車家教",
      },
    );

    expect(result).toEqual({
      ...occurrence,
      title: "北車家教",
    });

    expect(schedule.title).toBe("家教");
  });

  it("cancels one occurrence", () => {
    const result = applyPetRecurringException(
      schedule,
      occurrence,
      {
        ...baseException,
        kind: "cancelled",
      },
    );

    expect(result).toBeNull();
  });

  it("overrides the exact start time", () => {
    const result = applyPetRecurringException(
      schedule,
      occurrence,
      {
        ...baseException,
        time_precision_override: "exact",
        start_time_override: "19:00:00",
      },
    );

    expect(result).toEqual({
      date: "2026-10-09",
      title: "家教",
      startAt: "2026-10-09T11:00:00.000Z",
      allDay: false,
    });
  });

  it("rejects an exception for another date", () => {
    expect(() =>
      applyPetRecurringException(
        schedule,
        occurrence,
        {
          ...baseException,
          occurrence_date: "2026-10-13",
        },
      ),
    ).toThrow(
      "Recurring exception does not match occurrence.",
    );
  });
});
