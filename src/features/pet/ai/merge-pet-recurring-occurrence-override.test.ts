import { describe, expect, it } from "vitest";

import {
  mergePetRecurringOccurrenceOverride,
} from "./merge-pet-recurring-occurrence-override";

const unchanged = {
  titleOverride: null,
  noteOverride: null,
  timePrecisionOverride: null,
  startTimeOverride: null,
};

const existing = {
  kind: "override",
  title_override: "北車家教",
  note_override: "記得帶教材",
  time_precision_override: "exact",
  start_time_override: "18:00:00",
};

describe("merge recurring occurrence override", () => {
  it("preserves title and note when changing time", () => {
    const result = mergePetRecurringOccurrenceOverride(
      {
        ...unchanged,
        timePrecisionOverride: "exact",
        startTimeOverride: "19:00",
      },
      existing,
    );

    expect(result.title_override).toBe("北車家教");
    expect(result.note_override).toBe("記得帶教材");
    expect(result.start_time_override).toBe("19:00");
  });

  it("preserves time when changing title", () => {
    const result = mergePetRecurringOccurrenceOverride(
      {
        ...unchanged,
        titleOverride: "新的家教名稱",
      },
      existing,
    );

    expect(result.title_override).toBe("新的家教名稱");
    expect(result.time_precision_override).toBe("exact");
    expect(result.start_time_override).toBe("18:00:00");
  });

  it("clears exact time when switching to daypart", () => {
    const result = mergePetRecurringOccurrenceOverride(
      {
        ...unchanged,
        timePrecisionOverride: "daypart",
      },
      existing,
    );

    expect(result.time_precision_override).toBe("daypart");
    expect(result.start_time_override).toBeNull();
  });

  it("does not inherit fields from cancelled exceptions", () => {
    const result = mergePetRecurringOccurrenceOverride(
      {
        ...unchanged,
        titleOverride: "恢復家教",
      },
      {
        kind: "cancelled",
        title_override: null,
        note_override: null,
        time_precision_override: null,
        start_time_override: null,
      },
    );

    expect(result.title_override).toBe("恢復家教");
    expect(result.start_time_override).toBeNull();
  });

  it("supports a new override without existing data", () => {
    const result = mergePetRecurringOccurrenceOverride(
      {
        ...unchanged,
        titleOverride: "北車家教",
      },
      null,
    );

    expect(result.title_override).toBe("北車家教");
    expect(result.note_override).toBeNull();
    expect(result.time_precision_override).toBeNull();
  });
});
