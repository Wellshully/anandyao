"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

import { getPet } from "@/features/pet/lib/get-pet";
import { applyPetAction } from "@/features/pet/lib/apply-pet-action";

import type { PetAction, PetViewState } from "@/features/pet/types";

type PetActionResult =
  | {
      success: true;
      state: PetViewState;
    }
  | {
      success: false;
      error: string;
    };

const VALID_ACTIONS = new Set<PetAction>(["feed", "pet", "play"]);

const MAX_UPDATE_ATTEMPTS = 3;

export async function performPetAction(
  action: PetAction,
): Promise<PetActionResult> {
  try {
    if (!VALID_ACTIONS.has(action)) {
      return {
        success: false,
        error: "Unknown pet action.",
      };
    }

    const user = await requireUser();
    const supabase = await createClient();

    /*
     * getPet() also takes care of creating
     * the shared pet the first time /pet
     * is used.
     */
    const pet = await getPet();

    /*
     * Optimistic retry:
     *
     * An and Yao may interact with the pet
     * at almost exactly the same time.
     *
     * state_calculated_at acts as our
     * lightweight version marker so one
     * update does not silently overwrite
     * the other.
     */
    for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt += 1) {
      const { data: currentPet, error: loadError } = await supabase
        .from("pets")
        .select(
          `
            id,
            hunger,
            happiness,
            energy,
            xp,
            state_calculated_at
          `,
        )
        .eq("id", pet.id)
        .maybeSingle();

      if (loadError) {
        throw new Error(loadError.message);
      }

      if (!currentPet) {
        return {
          success: false,
          error: "Pet not found.",
        };
      }

      const now = new Date();

      const nextState = applyPetAction(
        {
          hunger: currentPet.hunger,

          happiness: currentPet.happiness,

          energy: currentPet.energy,

          xp: currentPet.xp,

          /*
           * calculatePetState() derives
           * the real level from XP.
           */
          level: 1,

          calculatedAt: currentPet.state_calculated_at,
        },
        action,
        now,
      );

      const { data: updatedPet, error: updateError } = await supabase
        .from("pets")
        .update({
          hunger: nextState.hunger,

          happiness: nextState.happiness,

          energy: nextState.energy,

          xp: nextState.xp,

          state_calculated_at: nextState.calculatedAt,

          updated_at: nextState.calculatedAt,
        })
        .eq("id", currentPet.id)
        .eq("state_calculated_at", currentPet.state_calculated_at)
        .select("id")
        .maybeSingle();

      if (updateError) {
        throw new Error(updateError.message);
      }

      /*
       * Another interaction changed the
       * pet between SELECT and UPDATE.
       *
       * Load the newest state and retry.
       */
      if (!updatedPet) {
        continue;
      }

      const effect = {
        hunger: nextState.hunger - currentPet.hunger,

        happiness: nextState.happiness - currentPet.happiness,

        energy: nextState.energy - currentPet.energy,

        xp: nextState.xp - currentPet.xp,
      };

      const { error: eventError } = await supabase.from("pet_events").insert({
        pet_id: currentPet.id,

        user_id: user.id,

        event_type: action,

        metadata: {
          hungerDelta: effect.hunger,

          happinessDelta: effect.happiness,

          energyDelta: effect.energy,

          xpDelta: effect.xp,
        },
      });

      /*
       * The interaction itself already
       * succeeded. Do not make the user
       * repeat it just because telemetry /
       * history logging failed.
       */
      if (eventError) {
        console.warn("Failed to record pet event:", eventError.message);
      }

      revalidatePath("/pet");

      return {
        success: true,
        state: nextState,
      };
    }

    return {
      success: false,
      error: "Pet was updated at the same time. Please try again.",
    };
  } catch (cause) {
    unstable_rethrow(cause);

    console.error(
      "Pet interaction failed:",
      cause instanceof Error ? cause.message : cause,
    );

    return {
      success: false,
      error: cause instanceof Error ? cause.message : "Pet interaction failed.",
    };
  }
}
