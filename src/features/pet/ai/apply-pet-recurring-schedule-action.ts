import "server-only";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

import { getPet } from "@/features/pet/lib/get-pet";
import { savePetRecurringSchedule } from "@/features/pet/ai/save-pet-recurring-schedule";

import type {
  PetRecurringScheduleAction,
} from "@/features/pet/ai/pet-reply";

export async function applyPetRecurringScheduleAction(
  action: PetRecurringScheduleAction,
) {
  if (
    action.action === "create"
  ) {
    if (!action.schedule) {
      return;
    }

    await savePetRecurringSchedule(
      action.schedule,
    );

    return;
  }

  if (
    action.action === "cancel"
  ) {
    if (!action.scheduleId) {
      throw new Error(
        "Recurring schedule cancel action requires scheduleId.",
      );
    }

    const [
      user,
      supabase,
      pet,
    ] = await Promise.all([
      requireUser(),
      createClient(),
      getPet(),
    ]);

    const {
      data,
      error,
    } =
      await supabase
        .from(
          "pet_recurring_schedules",
        )
        .update({
          status:
            "cancelled",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          action.scheduleId,
        )
        .eq(
          "user_id",
          user.id,
        )
        .eq(
          "pet_id",
          pet.id,
        )
        .eq(
          "status",
          "active",
        )
        .select("id")
        .maybeSingle();

    if (error) {
      throw new Error(
        error.message,
      );
    }

    if (!data) {
      throw new Error(
        `Recurring schedule not found or no longer active: ${action.scheduleId}`,
      );
    }
  }
}
