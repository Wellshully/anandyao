import { describe, expect, it } from "vitest";
import { assertRecurringCancellationScope } from "./assert-recurring-cancellation-scope";

const seriesCancel = [{
  action: "cancel" as const,
  scheduleId: "550e8400-e29b-41d4-a716-446655440000",
  schedule: null,
}];

describe("recurring cancellation scope", () => {
  it("allows explicit future series cancellation", () => {
    expect(() =>
      assertRecurringCancellationScope(
        "以後都不用家教了",
        seriesCancel,
        [],
      ),
    ).not.toThrow();
  });

  it("allows explicit weekly series cancellation", () => {
    expect(() =>
      assertRecurringCancellationScope(
        "取消每週五的家教",
        seriesCancel,
        [],
      ),
    ).not.toThrow();
  });

  it("blocks cancellation of this Friday", () => {
    expect(() =>
      assertRecurringCancellationScope(
        "取消這週五的家教",
        seriesCancel,
        [],
      ),
    ).toThrow();
  });

  it("blocks cancellation of an explicit date", () => {
    expect(() =>
      assertRecurringCancellationScope(
        "取消10/9的家教",
        seriesCancel,
        [],
      ),
    ).toThrow();
  });

  it("blocks ambiguous cancellation", () => {
    expect(() =>
      assertRecurringCancellationScope(
        "取消家教",
        seriesCancel,
        [],
      ),
    ).toThrow();
  });

  it("does not interfere with occurrence-only actions", () => {
    expect(() =>
      assertRecurringCancellationScope(
        "取消這週五的家教",
        [],
        [],
      ),
    ).not.toThrow();
  });
});
