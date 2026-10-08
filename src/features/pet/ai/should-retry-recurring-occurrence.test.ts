import { describe, expect, it } from "vitest";

import {
  shouldRetryRecurringOccurrence,
} from "./should-retry-recurring-occurrence";

function check(
  message: string,
  hasRecurringContext = true,
  actionCount = 0,
) {
  return shouldRetryRecurringOccurrence({
    message,
    hasRecurringContext,
    actionCount,
  });
}

describe("recurring occurrence retry", () => {
  it("retries a specific Friday time change", () => {
    expect(
      check("把這週五的測試家教改成晚上七點"),
    ).toBe(true);
  });

  it("retries a specific occurrence cancellation", () => {
    expect(check("取消下週五的家教")).toBe(true);
  });

  it("retries an explicit date change", () => {
    expect(check("10/9家教改成七點")).toBe(true);
  });

  it("does not retry whole-series changes", () => {
    expect(
      check("以後每週五家教都改成七點"),
    ).toBe(false);
  });

  it("does not retry when context is missing", () => {
    expect(
      check("把這週五的家教改成七點", false),
    ).toBe(false);
  });

  it("does not retry when an action exists", () => {
    expect(
      check("把這週五的家教改成七點", true, 1),
    ).toBe(false);
  });
});
