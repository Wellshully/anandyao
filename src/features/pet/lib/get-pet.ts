import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";

import { calculatePetState } from "@/features/pet/lib/calculate-pet-state";

import type { PetViewState } from "@/features/pet/types";

export type PetData = {
  id: string;
  spaceId: string;
  name: string;
  state: PetViewState;
};

export async function getPet(): Promise<PetData> {
  const user = await requireUser();
  const supabase = await createClient();

  /*
   * First try to load an existing pet.
   *
   * RLS guarantees that this user can only
   * see pets belonging to their own space.
   */
  const { data: existingPet, error: existingPetError } = await supabase
    .from("pets")
    .select(
      `
        id,
        space_id,
        name,
        hunger,
        happiness,
        energy,
        xp,
        state_calculated_at
      `,
    )
    .limit(1)
    .maybeSingle();

  if (existingPetError) {
    throw new Error(existingPetError.message);
  }

  if (existingPet) {
    return {
      id: existingPet.id,

      spaceId: existingPet.space_id,

      name: existingPet.name,

      state: calculatePetState({
        hunger: existingPet.hunger,

        happiness: existingPet.happiness,

        energy: existingPet.energy,

        xp: existingPet.xp,

        level: 1,

        calculatedAt: existingPet.state_calculated_at,
      }),
    };
  }

  /*
   * No pet exists yet.
   *
   * Find the user's shared space so that
   * we can create the first pet there.
   */
  const { data: membership, error: membershipError } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership) {
    throw new Error("No shared space found.");
  }

  /*
   * Both users could theoretically open
   * /pet for the first time simultaneously.
   *
   * space_id is unique, so upsert prevents
   * duplicate pets from being created.
   */
  const { error: createError } = await supabase.from("pets").upsert(
    {
      space_id: membership.space_id,

      name: "萌蛋",
    },
    {
      onConflict: "space_id",

      ignoreDuplicates: true,
    },
  );

  if (createError) {
    throw new Error(createError.message);
  }

  /*
   * Load the row again instead of relying
   * on the insert result, because another
   * user may have won the creation race.
   */
  const { data: createdPet, error: createdPetError } = await supabase
    .from("pets")
    .select(
      `
        id,
        space_id,
        name,
        hunger,
        happiness,
        energy,
        xp,
        state_calculated_at
      `,
    )
    .eq("space_id", membership.space_id)
    .single();

  if (createdPetError || !createdPet) {
    throw new Error(createdPetError?.message ?? "Failed to create pet.");
  }

  return {
    id: createdPet.id,

    spaceId: createdPet.space_id,

    name: createdPet.name,

    state: calculatePetState({
      hunger: createdPet.hunger,

      happiness: createdPet.happiness,

      energy: createdPet.energy,

      xp: createdPet.xp,

      level: 1,

      calculatedAt: createdPet.state_calculated_at,
    }),
  };
}
