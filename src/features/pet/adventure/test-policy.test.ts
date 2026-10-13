import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  resolvePetAdventureTestPolicy,
} from "./test-policy";

const now = new Date("2026-10-13T08:00:00.000Z");

describe("Pet Adventure V5 test policy", () => {
  it("disables overrides when no configuration exists", () => {
    const policy = resolvePetAdventureTestPolicy(null, now);

    expect(policy.unlimitedQuests).toBe(false);
    expect(policy.unlimitedImages).toBe(false);
    expect(policy.expiresAt).toBeNull();
  });

  it("enables both overrides before expiration", () => {
    const policy = resolvePetAdventureTestPolicy({
      unlimited_quests: true,
      unlimited_images: true,
      expires_at: "2026-10-15T08:00:00.000Z",
    }, now);

    expect(policy.unlimitedQuests).toBe(true);
    expect(policy.unlimitedImages).toBe(true);
  });

  it("keeps quest and image overrides independent", () => {
    const policy = resolvePetAdventureTestPolicy({
      unlimited_quests: true,
      unlimited_images: false,
      expires_at: "2026-10-15T08:00:00.000Z",
    }, now);

    expect(policy.unlimitedQuests).toBe(true);
    expect(policy.unlimitedImages).toBe(false);
  });

  it("disables expired overrides", () => {
    const policy = resolvePetAdventureTestPolicy({
      unlimited_quests: true,
      unlimited_images: true,
      expires_at: "2026-10-12T08:00:00.000Z",
    }, now);

    expect(policy.unlimitedQuests).toBe(false);
    expect(policy.unlimitedImages).toBe(false);
  });

  it("disables overrides at the exact expiration time", () => {
    const policy = resolvePetAdventureTestPolicy({
      unlimited_quests: true,
      unlimited_images: true,
      expires_at: now.toISOString(),
    }, now);

    expect(policy.unlimitedQuests).toBe(false);
    expect(policy.unlimitedImages).toBe(false);
  });

  it("rejects an invalid expiration timestamp", () => {
    const policy = resolvePetAdventureTestPolicy({
      unlimited_quests: true,
      unlimited_images: true,
      expires_at: "invalid-date",
    }, now);

    expect(policy.unlimitedQuests).toBe(false);
    expect(policy.unlimitedImages).toBe(false);
  });
});
