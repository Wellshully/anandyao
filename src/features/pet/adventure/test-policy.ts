import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type PetAdventureTestPolicy = {
  unlimitedQuests: boolean;
  unlimitedImages: boolean;
  expiresAt: string | null;
};

type TestSettingRow = {
  unlimited_quests: boolean;
  unlimited_images: boolean;
  expires_at: string;
};

const NORMAL_POLICY: PetAdventureTestPolicy = {
  unlimitedQuests: false,
  unlimitedImages: false,
  expiresAt: null,
};

export function resolvePetAdventureTestPolicy(
  row: TestSettingRow | null,
  now: Date = new Date(),
): PetAdventureTestPolicy {
  if (!row) {
    return { ...NORMAL_POLICY };
  }

  const expiresAt = Date.parse(row.expires_at);

  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= now.getTime()
  ) {
    return { ...NORMAL_POLICY };
  }

  return {
    unlimitedQuests: row.unlimited_quests === true,
    unlimitedImages: row.unlimited_images === true,
    expiresAt: row.expires_at,
  };
}

export async function getPetAdventureTestPolicy(
  db: SupabaseClient,
  petId: string,
): Promise<PetAdventureTestPolicy> {
  const { data, error } = await db
    .from("pet_adventure_test_settings")
    .select("unlimited_quests,unlimited_images,expires_at")
    .eq("pet_id", petId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to read Pet Adventure test policy: ${error.message}`,
    );
  }

  return resolvePetAdventureTestPolicy(data, new Date());
}
