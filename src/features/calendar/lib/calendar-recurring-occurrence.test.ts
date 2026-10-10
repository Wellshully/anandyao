import { describe, expect, it } from "vitest";

import {
  getCalendarRecurringOccurrenceDate,
} from "./calendar-recurring-occurrence";

describe("Calendar recurring occurrence identity", () => {
  it("extracts the occurrence date, not the series ID", () => {
    expect(
      getCalendarRecurringOccurrenceDate({
        source: "pet_recurring_schedule",
        sourceId: "series-123",
        id: "pet_recurring_schedule:series-123:2026-10-16",
      }),
    ).toBe("2026-10-16");
  });

  it("rejects a mismatched series ID", () => {
    expect(
      getCalendarRecurringOccurrenceDate({
        source: "pet_recurring_schedule",
        sourceId: "series-A",
        id: "pet_recurring_schedule:series-B:2026-10-16",
      }),
    ).toBeNull();
  });

  it("rejects invalid dates and non-recurring events", () => {
    expect(
      getCalendarRecurringOccurrenceDate({
        source: "pet_recurring_schedule",
        sourceId: "series-A",
        id: "pet_recurring_schedule:series-A:2026-02-30",
      }),
    ).toBeNull();

    expect(
      getCalendarRecurringOccurrenceDate({
        source: "pet_task",
        sourceId: "task-A",
        id: "pet_task:task-A",
      }),
    ).toBeNull();
  });
});
