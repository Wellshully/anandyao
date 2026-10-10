import { describe, expect, it } from "vitest";

import {
  isHomeAttentionDeadline,
  getHomePetTaskDeadline,
} from "./home-attention-deadline";

const now = Date.parse("2026-10-10T16:00:00+08:00");
const hour = 60 * 60 * 1000;
const day = 24 * hour;

describe("Home Attention deadlines", () => {
  it("shows deadlines within the next 72 hours", () => {
    expect(isHomeAttentionDeadline(now + hour, now)).toBe(true);
    expect(isHomeAttentionDeadline(now + day, now)).toBe(true);
    expect(isHomeAttentionDeadline(now + 2 * day, now)).toBe(true);
  });

  it("includes the exact 72-hour boundary", () => {
    expect(isHomeAttentionDeadline(now + 3 * day, now)).toBe(true);
  });

  it("excludes anything later than 72 hours", () => {
    expect(isHomeAttentionDeadline(now + 3 * day + 1, now)).toBe(false);
  });

  it("excludes overdue deadlines", () => {
    expect(isHomeAttentionDeadline(now - 1, now)).toBe(false);
  });

  it("excludes completed items", () => {
    expect(isHomeAttentionDeadline(now + hour, now, true)).toBe(false);
  });

  it("excludes missing or invalid deadlines", () => {
    expect(isHomeAttentionDeadline(null, now)).toBe(false);
    expect(isHomeAttentionDeadline(NaN, now)).toBe(false);
  });

  it("preserves precise Pet Task deadlines", () => {
    expect(
      getHomePetTaskDeadline(
        "2026-10-11T09:00:00+08:00",
        true,
      ),
    ).toBe(
      Date.parse("2026-10-11T09:00:00+08:00"),
    );
  });

  it("treats all-day Pet Tasks as due at the end of their day", () => {
    expect(
      getHomePetTaskDeadline(
        "2026-10-11T00:00:00+08:00",
        false,
      ),
    ).toBe(
      Date.parse("2026-10-11T23:59:59.999+08:00"),
    );
  });
});
