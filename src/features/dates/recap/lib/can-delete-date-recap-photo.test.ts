import { describe, expect, it } from "vitest";

import {
  canDeleteDateRecapPhoto,
} from "./can-delete-date-recap-photo";

const allowed = {
  recapStatus: "draft",
  dateStatus: "accepted",
  participantStatus: "accepted",
  windowState: "available",
};

describe("Date Recap photo deletion eligibility", () => {
  it("allows deleting from an editable draft", () => {
    expect(canDeleteDateRecapPhoto(allowed)).toBe(true);
  });

  it("rejects completed recaps", () => {
    expect(canDeleteDateRecapPhoto({
      ...allowed,
      recapStatus: "completed",
    })).toBe(false);
  });

  it("rejects non-accepted dates", () => {
    expect(canDeleteDateRecapPhoto({
      ...allowed,
      dateStatus: "cancelled",
    })).toBe(false);
  });

  it("rejects participants without acceptance", () => {
    expect(canDeleteDateRecapPhoto({
      ...allowed,
      participantStatus: "pending",
    })).toBe(false);
  });

  it("rejects expired and future recap windows", () => {
    for (const windowState of ["expired", "not_ready"]) {
      expect(canDeleteDateRecapPhoto({
        ...allowed,
        windowState,
      })).toBe(false);
    }
  });
});
