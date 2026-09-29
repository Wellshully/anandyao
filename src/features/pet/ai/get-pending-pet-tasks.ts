import "server-only";

import {
  getPetTaskTemporalState,
  getTaipeiTodayStartIso,
  type PetTaskTemporalKind,
  type PetTaskTemporalState,
  type PetTaskTimePrecision,
} from "@/features/pet/ai/pet-task-temporal";

import { getPet } from "@/features/pet/lib/get-pet";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export type PendingPetTask = {
  id: string;
  title: string;
  note: string | null;

  dueAt: string | null;
  dueHasTime: boolean;

  temporalKind:
    PetTaskTemporalKind;

  timePrecision:
    PetTaskTimePrecision;

  temporalState:
    PetTaskTemporalState;

  createdAt: string;
};

export async function getPendingPetTasks(): Promise<
  PendingPetTask[]
> {
  const [
    user,
    supabase,
    pet,
  ] = await Promise.all([
    requireUser(),
    createClient(),
    getPet(),
  ]);

  /*
   * scheduled = an event expected to happen
   * at a certain time.
   *
   * Once its calendar day is already over,
   * it should no longer live in pending tasks.
   *
   * Important:
   * deadlines are NOT deleted here.
   * An overdue deadline is still actionable.
   */
  const todayStartIso =
    getTaipeiTodayStartIso();

  const {
    error: cleanupError,
  } = await supabase
    .from("pet_tasks")
    .delete()
    .eq("pet_id", pet.id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .eq(
      "temporal_kind",
      "scheduled",
    )
    .not("due_at", "is", null)
    .lt(
      "due_at",
      todayStartIso,
    );

  if (cleanupError) {
    throw new Error(
      cleanupError.message,
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("pet_tasks")
    .select(
      `
        id,
        title,
        note,
        due_at,
        due_has_time,
        temporal_kind,
        time_precision,
        created_at
      `,
    )
    .eq("pet_id", pet.id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order(
      "created_at",
      {
        ascending: false,
      },
    )
    .limit(30);

  if (error) {
    throw new Error(
      error.message,
    );
  }

  const now = new Date();

  return (data ?? [])
    .map((item) => {
      const temporalKind =
        item.temporal_kind as
          PetTaskTemporalKind;

      const timePrecision =
        item.time_precision as
          PetTaskTimePrecision;

      return {
        id: item.id,
        title: item.title,
        note: item.note,

        dueAt: item.due_at,

        dueHasTime:
          item.due_has_time,

        temporalKind,

        timePrecision,

        temporalState:
          getPetTaskTemporalState(
            {
              dueAt:
                item.due_at,

              temporalKind,

              timePrecision,
            },
            now,
          ),

        createdAt:
          item.created_at,
      };
    })
    .sort((a, b) => {
      if (
        a.dueAt &&
        b.dueAt
      ) {
        return (
          new Date(
            a.dueAt,
          ).getTime() -
          new Date(
            b.dueAt,
          ).getTime()
        );
      }

      if (a.dueAt) {
        return -1;
      }

      if (b.dueAt) {
        return 1;
      }

      return (
        new Date(
          b.createdAt,
        ).getTime() -
        new Date(
          a.createdAt,
        ).getTime()
      );
    })
    .slice(0, 12);
}
