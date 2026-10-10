import { describe, expect, it } from "vitest";

import {
  resolveCalendarPetTaskTime,
} from "./calendar-pet-task-time";

describe("Calendar Pet Task time", () => {
  it("stores date-only tasks at the end of Taipei day", () => {
    expect(
      resolveCalendarPetTaskTime("2026-10-10", ""),
    ).toEqual({
      dueAt: "2026-10-10T15:59:59.000Z",
      timePrecision: "date",
      dueHasTime: false,
    });
  });

  it("converts exact Taipei time to UTC", () => {
    expect(
      resolveCalendarPetTaskTime("2026-10-10", "19:30"),
    ).toEqual({
      dueAt: "2026-10-10T11:30:00.000Z",
      timePrecision: "exact",
      dueHasTime: true,
    });
  });

  it("rejects nonexistent dates", () => {
    expect(() =>
      resolveCalendarPetTaskTime("2026-02-30", ""),
    ).toThrow();
  });

  it("rejects invalid times", () => {
    expect(() =>
      resolveCalendarPetTaskTime("2026-10-10", "25:30"),
    ).toThrow();
  });
});
