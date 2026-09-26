import type { PetAction, PetState } from "@/features/pet/types";

export const PET_MIN_STAT = 0;
export const PET_MAX_STAT = 100;

export const PET_RULES = {
  /*
   * Long-term passive changes.
   *
   * hunger 在 UI 上其實代表「飽足度」，
   * 所以會隨時間下降。
   */
  decayPerHour: {
    hunger: 0.75,
    happiness: 0.25,
  },

  /*
   * Energy is different:
   * it naturally recovers with time.
   */
  recoveryPerHour: {
    energy: 20,
  },

  actions: {
    feed: {
      hunger: 20,
      happiness: 2,
      energy: 0,
      xp: 3,
    },

    pet: {
      hunger: 0,
      happiness: 12,
      energy: 0,
      xp: 2,
    },

    play: {
      hunger: -3,
      happiness: 8,
      energy: -5,
      xp: 5,
    },
  } satisfies Record<
    PetAction,
    {
      hunger: number;
      happiness: number;
      energy: number;
      xp: number;
    }
  >,

  xpPerLevel: 100,
} as const;

export function clampPetStat(value: number) {
  return Math.min(PET_MAX_STAT, Math.max(PET_MIN_STAT, value));
}

export function getPetLevel(xp: number) {
  return Math.floor(xp / PET_RULES.xpPerLevel) + 1;
}

export function getPetMood(
  state: Pick<PetState, "hunger" | "happiness" | "energy">,
) {
  /*
   * Severe hunger still takes
   * highest priority.
   */
  if (state.hunger <= 15) {
    return "hungry" as const;
  }

  /*
   * Only become sleepy when
   * energy is really low.
   */
  if (state.energy <= 10) {
    return "sleepy" as const;
  }

  if (state.happiness <= 30) {
    return "sad" as const;
  }

  if (state.happiness >= 80) {
    return "happy" as const;
  }

  return "normal" as const;
}
