import { describe, expect, it } from "vitest";

import {
  isQuestAiStale,
  resolveQuestAiClaim,
} from "./quest-ai-claim";

describe("V5 AI quest claim policy", () => {
  it("allows generation only after a successful claim", () => {
    expect(resolveQuestAiClaim("CLAIMED")).toBe("generate");
  });

  it("falls back when the daily quota is exhausted", () => {
    expect(resolveQuestAiClaim("DAILY_LIMIT")).toBe("fallback");
  });

  it("skips quests that are no longer eligible", () => {
    expect(resolveQuestAiClaim("NOT_ELIGIBLE")).toBe("skip");
  });

  it("rejects unknown and unavailable responses", () => {
    expect(() => resolveQuestAiClaim("UNAVAILABLE")).toThrow();
    expect(() => resolveQuestAiClaim(null)).toThrow();
    expect(() => resolveQuestAiClaim("ERROR")).toThrow();
  });

  it("detects a stale AI request", () => {
    expect(isQuestAiStale({
      aiRequestedAt: "2026-10-13T08:00:00.000Z",
      createdAt: "2026-10-13T07:00:00.000Z",
    }, new Date("2026-10-13T08:21:00.000Z"))).toBe(true);
  });

  it("preserves an active AI request", () => {
    expect(isQuestAiStale({
      aiRequestedAt: "2026-10-13T08:10:00.000Z",
      createdAt: "2026-10-13T07:00:00.000Z",
    }, new Date("2026-10-13T08:15:00.000Z"))).toBe(false);
  });

  it("recovers an old generating quest without a timestamp", () => {
    expect(isQuestAiStale({
      aiRequestedAt: null,
      createdAt: "2026-10-13T07:00:00.000Z",
    }, new Date("2026-10-13T08:00:00.000Z"))).toBe(true);
  });

  it("does not recover invalid timestamps automatically", () => {
    expect(isQuestAiStale({
      aiRequestedAt: null,
      createdAt: "invalid",
    })).toBe(false);
  });
});
