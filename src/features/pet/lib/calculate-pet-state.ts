import {
  clampPetStat,
  getPetLevel,
  getPetMood,
  PET_RULES,
} from "@/features/pet/lib/pet-rules";

import type { PetState, PetViewState } from "@/features/pet/types";

const HOUR_MS = 60 * 60 * 1000;

export function calculatePetState(
  state: PetState,
  now = new Date(),
): PetViewState {
  const calculatedAt = new Date(state.calculatedAt);

  const elapsedMs = Math.max(0, now.getTime() - calculatedAt.getTime());

  const elapsedHours = elapsedMs / HOUR_MS;

  /*
   * Satiety slowly decreases.
   */
  const hunger = clampPetStat(
    state.hunger - elapsedHours * PET_RULES.decayPerHour.hunger,
  );

  /*
   * Happiness also decreases,
   * but much more slowly.
   */
  const happiness = clampPetStat(
    state.happiness - elapsedHours * PET_RULES.decayPerHour.happiness,
  );

  /*
   * Energy naturally recovers.
   *
   * This prevents the pet from
   * becoming permanently sleepy
   * after playing too much.
   */
  const energy = clampPetStat(
    state.energy + elapsedHours * PET_RULES.recoveryPerHour.energy,
  );

  const calculatedState = {
    hunger,
    happiness,
    energy,

    xp: state.xp,

    level: getPetLevel(state.xp),

    calculatedAt: now.toISOString(),
  };

  return {
    ...calculatedState,

    mood: getPetMood(calculatedState),
  };
}
