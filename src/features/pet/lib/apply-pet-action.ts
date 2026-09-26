import {
  clampPetStat,
  getPetLevel,
  getPetMood,
  PET_RULES,
} from "@/features/pet/lib/pet-rules";

import { calculatePetState } from "@/features/pet/lib/calculate-pet-state";

import type { PetAction, PetState, PetViewState } from "@/features/pet/types";

export function applyPetAction(
  state: PetState,
  action: PetAction,
  now = new Date(),
): PetViewState {
  /*
   * Always calculate natural decay
   * before applying an interaction.
   */
  const current = calculatePetState(state, now);

  const effect = PET_RULES.actions[action];

  const hunger = clampPetStat(current.hunger + effect.hunger);

  const happiness = clampPetStat(current.happiness + effect.happiness);

  const energy = clampPetStat(current.energy + effect.energy);

  const xp = current.xp + effect.xp;

  const nextState = {
    hunger,
    happiness,
    energy,

    xp,

    level: getPetLevel(xp),

    calculatedAt: now.toISOString(),
  };

  return {
    ...nextState,

    mood: getPetMood(nextState),
  };
}
