import { describe, expect, it } from "vitest";

import {
  petRecurringOccurrenceActionSchema,
} from "./pet-reply";

const base = {
  action: "override",
  scheduleId: "550e8400-e29b-41d4-a716-446655440000",
  occurrenceDate: "2026-10-09",
  titleOverride: "北車家教",
  noteOverride: null,
  timePrecisionOverride: null,
  startTimeOverride: null,
};

describe("petRecurringOccurrenceActionSchema", () => {
  it("accepts a title override", () => {
    expect(
      petRecurringOccurrenceActionSchema.safeParse(base).success,
    ).toBe(true);
  });

  it("accepts an exact time override", () => {
    expect(
      petRecurringOccurrenceActionSchema.safeParse({
        ...base,
        timePrecisionOverride: "exact",
        startTimeOverride: "19:00",
      }).success,
    ).toBe(true);
  });

  it("accepts cancellation without overrides", () => {
    expect(
      petRecurringOccurrenceActionSchema.safeParse({
        ...base,
        action: "cancel",
        titleOverride: null,
      }).success,
    ).toBe(true);
  });

  it("accepts restoration without overrides", () => {
    expect(
      petRecurringOccurrenceActionSchema.safeParse({
        ...base,
        action: "restore",
        titleOverride: null,
      }).success,
    ).toBe(true);
  });

  it("rejects an impossible date", () => {
    expect(
      petRecurringOccurrenceActionSchema.safeParse({
        ...base,
        occurrenceDate: "2026-02-30",
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid time", () => {
    expect(
      petRecurringOccurrenceActionSchema.safeParse({
        ...base,
        timePrecisionOverride: "exact",
        startTimeOverride: "25:90",
      }).success,
    ).toBe(false);
  });

  it("rejects cancellation containing overrides", () => {
    expect(
      petRecurringOccurrenceActionSchema.safeParse({
        ...base,
        action: "cancel",
      }).success,
    ).toBe(false);
  });

  it("rejects exact precision without time", () => {
    expect(
      petRecurringOccurrenceActionSchema.safeParse({
        ...base,
        timePrecisionOverride: "exact",
      }).success,
    ).toBe(false);
  });
});
