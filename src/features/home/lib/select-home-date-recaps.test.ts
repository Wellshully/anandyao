import { describe, expect, it } from "vitest";

import {
  selectHomePendingDateRecaps,
} from "./select-home-date-recaps";

const candidate = {
  id: "date-1",
  title: "測試約會",
  endDate: "2026-10-09",
  status: "accepted",
  participantStatus: "accepted",
};

describe("Home pending Date recaps", () => {
  it("shows an available unfinished recap", () => {
    expect(
      selectHomePendingDateRecaps(
        [candidate],
        {},
        "2026-10-10",
      ),
    ).toEqual([{
      id: "date-1",
      title: "測試約會",
      endDate: "2026-10-09",
      deadline: "2026-10-16",
    }]);
  });

  it("does not show a future or expired recap", () => {
    expect(
      selectHomePendingDateRecaps(
        [candidate],
        {},
        "2026-10-09",
      ),
    ).toEqual([]);

    expect(
      selectHomePendingDateRecaps(
        [candidate],
        {},
        "2026-10-17",
      ),
    ).toEqual([]);
  });

  it("does not show a completed recap", () => {
    expect(
      selectHomePendingDateRecaps(
        [candidate],
        { "date-1": "completed" },
        "2026-10-10",
      ),
    ).toEqual([]);
  });

  it("requires an accepted participant", () => {
    expect(
      selectHomePendingDateRecaps(
        [{
          ...candidate,
          participantStatus: "pending",
        }],
        {},
        "2026-10-10",
      ),
    ).toEqual([]);
  });
});
