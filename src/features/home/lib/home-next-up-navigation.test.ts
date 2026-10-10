import { describe, expect, it } from "vitest";

import {
  getHomeNextUpHref,
  getHomeNextUpActionLabel,
} from "./home-next-up-navigation";

describe("Home next-up navigation", () => {
  it("opens the selected Date", () => {
    expect(getHomeNextUpHref({
      kind: "date",
      href: "/dates/date-123",
    })).toBe("/dates/date-123");
  });

  it("opens the Study assignment", () => {
    expect(getHomeNextUpHref({
      kind: "study",
      href: "/study/assignments/task-123",
    })).toBe("/study/assignments/task-123");

    expect(getHomeNextUpActionLabel({
      kind: "study",
      href: "/study",
    })).toBe("打開 Study →");
  });

  it("keeps Pet and Google events in Calendar", () => {
    for (const kind of [
      "pet_task",
      "pet_recurring_schedule",
      "google_calendar",
    ]) {
      expect(getHomeNextUpHref({
        kind,
        href: null,
      })).toBe("/calendar");
    }
  });
});
