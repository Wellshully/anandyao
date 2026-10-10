"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import {
  applyPetRecurringOccurrenceAction,
} from "@/features/pet/ai/apply-pet-recurring-occurrence-action";

import {
  applyPetRecurringScheduleAction,
} from "@/features/pet/ai/apply-pet-recurring-schedule-action";

import {
  buildCalendarOccurrenceCancellation,
  buildCalendarSeriesCancellation,
} from "@/features/calendar/lib/calendar-recurring-cancel";

type Result =
  | { success: true }
  | { success: false; error: string };

export async function cancelCalendarRecurringOccurrence(
  input: unknown,
): Promise<Result> {
  const action = buildCalendarOccurrenceCancellation(input);

  if (!action) {
    return {
      success: false,
      error: "指定的固定行程或日期不正確。",
    };
  }

  try {
    // Existing implementation verifies:
    // - authenticated user
    // - ownership of the shared Pet
    // - active series
    // - actual occurrence date
    await applyPetRecurringOccurrenceAction(action);

    revalidatePath("/calendar");
    revalidatePath("/pet");

    return { success: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[Calendar occurrence cancel]", error);

    return {
      success: false,
      error: "取消單次行程失敗，請重新整理後再試。",
    };
  }
}

export async function cancelCalendarRecurringSeries(
  input: unknown,
): Promise<Result> {
  const action = buildCalendarSeriesCancellation(input);

  if (!action) {
    return {
      success: false,
      error: "固定系列識別資料不正確。",
    };
  }

  try {
    // Existing implementation performs an
    // owner-scoped soft cancellation.
    await applyPetRecurringScheduleAction(action);

    revalidatePath("/calendar");
    revalidatePath("/pet");

    return { success: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[Calendar series cancel]", error);

    return {
      success: false,
      error: "取消整個固定系列失敗，請重新整理後再試。",
    };
  }
}
