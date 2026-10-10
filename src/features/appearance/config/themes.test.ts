import { describe, expect, it } from "vitest";

import {
  THEME_IDS,
  THEMES,
  isThemeId,
  getThemeBrowserColor,
} from "./themes";

describe("Crystal Glass theme", () => {
  it("is registered as a valid Theme ID", () => {
    expect(THEME_IDS).toContain("crystal-glass");
    expect(isThemeId("crystal-glass")).toBe(true);
  });

  it("has a complete theme definition", () => {
    const theme = THEMES.find(
      (item) => item.id === "crystal-glass",
    );

    expect(theme).toBeDefined();
    expect(theme?.name).toBe("Crystal Glass");
    expect(theme?.colors.length).toBeGreaterThanOrEqual(3);
  });

  it("provides the correct browser theme color", () => {
    expect(
      getThemeBrowserColor("crystal-glass", false),
    ).toBe("#0d1020");

    expect(
      getThemeBrowserColor("crystal-glass", true),
    ).toBe("#0d1020");
  });
});
