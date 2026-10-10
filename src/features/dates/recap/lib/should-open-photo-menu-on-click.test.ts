import { describe, expect, it } from "vitest";

import {
  shouldOpenRecapPhotoMenuOnClick,
} from "./should-open-photo-menu-on-click";

describe("Recap photo menu interaction", () => {
  it("opens with a desktop mouse click", () => {
    expect(
      shouldOpenRecapPhotoMenuOnClick(1, "mouse"),
    ).toBe(true);
  });

  it("opens with keyboard activation", () => {
    expect(
      shouldOpenRecapPhotoMenuOnClick(0, null),
    ).toBe(true);
  });

  it("does not open on a short touch tap", () => {
    expect(
      shouldOpenRecapPhotoMenuOnClick(1, "touch"),
    ).toBe(false);
  });

  it("does not open on a short pen tap", () => {
    expect(
      shouldOpenRecapPhotoMenuOnClick(1, "pen"),
    ).toBe(false);
  });
});
