import { describe, expect, it } from "vitest";

import {
  canRevealReward,
  isRewardDesignResolved,
} from "./reward-reveal-policy";

const availableAt = "2026-10-13T10:01:00.000Z";
const afterReveal = Date.parse(
  "2026-10-13T10:02:00.000Z",
);

describe("V5 reward reveal policy", () => {
  it("preserves legacy V4 gifts", () => {
    expect(canRevealReward({
      designStatus: "legacy",
      availableAt,
      now: afterReveal,
    })).toBe(true);
  });

  it("reveals a completed AI design after the wait", () => {
    for (const status of ["ready", "fallback"]) {
      expect(canRevealReward({
        designStatus: status,
        availableAt,
        now: afterReveal,
      })).toBe(true);
    }
  });

  it("never reveals unresolved designs", () => {
    for (const status of [
      "pending",
      "generating",
      "failed",
      null,
    ]) {
      expect(canRevealReward({
        designStatus: status,
        availableAt,
        now: afterReveal,
      })).toBe(false);
    }
  });

  it("retains the minimum reveal wait", () => {
    expect(canRevealReward({
      designStatus: "ready",
      availableAt,
      now: Date.parse("2026-10-13T10:00:59.000Z"),
    })).toBe(false);
  });

  it("rejects invalid timestamps and statuses", () => {
    expect(canRevealReward({
      designStatus: "ready",
      availableAt: "invalid",
      now: afterReveal,
    })).toBe(false);

    expect(isRewardDesignResolved("unknown")).toBe(false);
  });
});
