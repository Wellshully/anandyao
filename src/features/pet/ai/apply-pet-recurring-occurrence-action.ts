import "server-only";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/features/pet/lib/get-pet";

import {
  petRecurringOccurrenceActionSchema,
  type PetRecurringOccurrenceAction,
} from "@/features/pet/ai/pet-reply";

import {
  expandPetRecurringSchedule,
} from "@/features/calendar/lib/expand-pet-recurring-schedule";

import {
  mergePetRecurringOccurrenceOverride,
} from "@/features/pet/ai/merge-pet-recurring-occurrence-override";

export async function applyPetRecurringOccurrenceAction(
  input: PetRecurringOccurrenceAction,
) {
  const action = petRecurringOccurrenceActionSchema.parse(input);

  const [user, supabase, pet] = await Promise.all([
    requireUser(),
    createClient(),
    getPet(),
  ]);

  /*
   * Verify that the recurring schedule is active
   * and belongs to the current authenticated user.
   */
  const { data: schedule, error: scheduleError } =
    await supabase
      .from("pet_recurring_schedules")
      .select(`
        id,
        title,
        recurrence_rule,
        recurrence_start_date,
        recurrence_end_date,
        time_precision,
        start_time,
        status
      `)
      .eq("id", action.scheduleId)
      .eq("user_id", user.id)
      .eq("pet_id", pet.id)
      .eq("status", "active")
      .maybeSingle();

  if (scheduleError) {
    throw new Error(scheduleError.message);
  }

  if (!schedule) {
    throw new Error(
      "Recurring schedule not found or no longer active.",
    );
  }

  /*
   * An exception can only target an actual occurrence.
   * Reuse the same recurrence expansion logic as Calendar.
   */
  const occurrences = expandPetRecurringSchedule(
    schedule,
    action.occurrenceDate,
    action.occurrenceDate,
  );

  if (
    occurrences.length !== 1 ||
    occurrences[0].date !== action.occurrenceDate
  ) {
    throw new Error(
      "The selected date is not part of this recurring schedule.",
    );
  }

  /*
   * Restore means removing the exception and allowing
   * the original recurring definition to take effect.
   */
  if (action.action === "restore") {
    const { error } = await supabase
      .from("pet_recurring_schedule_exceptions")
      .delete()
      .eq("schedule_id", action.scheduleId)
      .eq("occurrence_date", action.occurrenceDate);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  /*
   * Upsert allows replacing an existing exception,
   * including cancelled -> override and vice versa.
   */
  const isOverride = action.action === "override";

  const { data: existingException, error: lookupError } =
    await supabase
      .from("pet_recurring_schedule_exceptions")
      .select(`
        kind,
        title_override,
        note_override,
        time_precision_override,
        start_time_override
      `)
      .eq("schedule_id", action.scheduleId)
      .eq("occurrence_date", action.occurrenceDate)
      .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  const overrides = isOverride
    ? mergePetRecurringOccurrenceOverride(
        action,
        existingException,
      )
    : {
        title_override: null,
        note_override: null,
        time_precision_override: null,
        start_time_override: null,
      };

  const { error } = await supabase
    .from("pet_recurring_schedule_exceptions")
    .upsert(
      {
        schedule_id: action.scheduleId,
        occurrence_date: action.occurrenceDate,
        kind: isOverride ? "override" : "cancelled",
        ...overrides,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "schedule_id,occurrence_date",
      },
    );

  if (error) {
    throw new Error(error.message);
  }
}
