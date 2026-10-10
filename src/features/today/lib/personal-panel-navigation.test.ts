import { describe, expect, it } from "vitest";

import {
  getPersonalPlanIdFromHomeItem,
} from "./personal-panel-navigation";

describe("Personal Panel navigation", () => {
  it("extracts the original Personal Plan ID", () => {
    expect(
      getPersonalPlanIdFromHomeItem(
        "personal",
        "today:personal:plan-123",
      ),
    ).toBe("plan-123");
  });

  it("ignores Study items", () => {
    expect(
      getPersonalPlanIdFromHomeItem(
        "study",
        "today:personal:plan-123",
      ),
    ).toBeNull();
  });

  it("rejects unrelated IDs", () => {
    expect(
      getPersonalPlanIdFromHomeItem(
        "personal",
        "calendar:event-123",
      ),
    ).toBeNull();
  });

  it("rejects empty Personal Plan IDs", () => {
    expect(
      getPersonalPlanIdFromHomeItem(
        "personal",
        "today:personal:",
      ),
    ).toBeNull();
  });
});
