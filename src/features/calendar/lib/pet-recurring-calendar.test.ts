import {
  describe,
  expect,
  it,
} from "vitest";

import {
  expandPetRecurringSchedule,
  type CalendarRecurringSchedule,
} from "./expand-pet-recurring-schedule";

import {
  applyPetRecurringException,
  type CalendarRecurringException,
} from "./apply-pet-recurring-exception";

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

const exceptions: CalendarRecurringException[] = [
  {
    schedule_id: "schedule-1",
    occurrence_date: "2026-10-09",
    kind: "override",
    title_override: "北車家教",
    time_precision_override: null,
    start_time_override: null,
  },
  {
    schedule_id: "schedule-1",
    occurrence_date: "2026-10-20",
    kind: "cancelled",
    title_override: null,
    time_precision_override: null,
    start_time_override: null,
  },
];

describe("Pet recurring Calendar integration", () => {
  it("applies exceptions without affecting other occurrences", () => {
    const exceptionMap = new Map(
      exceptions.map((item) => [
        `${item.schedule_id}:${item.occurrence_date}`,
        item,
      ]),
    );

    const occurrences = expandPetRecurringSchedule(
      schedule,
      "2026-10-06",
      "2026-10-23",
    );

    const results = occurrences.flatMap((occurrence) => {
      const key = `${schedule.id}:${occurrence.date}`;

      const resolved = applyPetRecurringException(
        schedule,
        occurrence,
        exceptionMap.get(key) ?? null,
      );

      return resolved
        ? [{
            date: resolved.date,
            title: resolved.title,
          }]
        : [];
    });

    expect(results).toEqual([
      { date: "2026-10-06", title: "家教" },
      { date: "2026-10-09", title: "北車家教" },
      { date: "2026-10-13", title: "家教" },
      { date: "2026-10-16", title: "家教" },
      { date: "2026-10-23", title: "家教" },
    ]);

    // The recurring definition remains unchanged.
    expect(schedule.title).toBe("家教");
    expect(schedule.recurrence_rule).toBe(
      "FREQ=WEEKLY;BYDAY=TU,FR",
    );

    // The cancelled occurrence is absent.
    expect(
      results.some(
        (item) => item.date === "2026-10-20",
      ),
    ).toBe(false);
  });

  it("preserves stable occurrence dates", () => {
    const occurrences = expandPetRecurringSchedule(
      schedule,
      "2026-10-06",
      "2026-10-23",
    );

    expect(
      occurrences.map((item) => item.date),
    ).toEqual([
      "2026-10-06",
      "2026-10-09",
      "2026-10-13",
      "2026-10-16",
      "2026-10-20",
      "2026-10-23",
    ]);
  });
});
