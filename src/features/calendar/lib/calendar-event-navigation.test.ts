import { describe, expect, it } from "vitest";

import {
  getCalendarViewHref,
} from "./calendar-event-navigation";

describe("Calendar event navigation", () => {
  it("preserves the selected month and date", () => {
    const href = getCalendarViewHref({
      month: "2026-10",
      view: "month",
      date: "2026-10-09",
      eventId: "pet_recurring_schedule:abc:2026-10-09",
    });

    const url = new URL(href, "https://example.test");

    expect(url.searchParams.get("month")).toBe("2026-10");
    expect(url.searchParams.get("date")).toBe("2026-10-09");
    expect(url.searchParams.get("event")).toBe(
      "pet_recurring_schedule:abc:2026-10-09",
    );
  });

  it("encodes special event IDs", () => {
    const href = getCalendarViewHref({
      month: "2026-10",
      view: "day",
      date: "2026-10-09",
      eventId: "google:calendar/foo?bar=1&x=2",
    });

    const url = new URL(href, "https://example.test");

    expect(url.searchParams.get("event")).toBe(
      "google:calendar/foo?bar=1&x=2",
    );
  });

  it("removes the event parameter on close", () => {
    const href = getCalendarViewHref({
      month: "2026-10",
      view: "day",
      date: "2026-10-09",
    });

    const url = new URL(href, "https://example.test");

    expect(url.searchParams.has("event")).toBe(false);
    expect(url.searchParams.get("date")).toBe("2026-10-09");
  });
});
