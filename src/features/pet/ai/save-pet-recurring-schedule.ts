import "server-only";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

import { getPet } from "@/features/pet/lib/get-pet";

import {
  resolvePetRecurringSchedule,
} from "@/features/pet/ai/resolve-pet-recurring-schedule";

import type {
  PetRecurringScheduleCandidate,
} from "@/features/pet/ai/pet-reply";

function normalizeTitle(
  value: string,
) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(
      /[\s\p{P}\p{S}]+/gu,
      "",
    )
    .replace(
      /^(?:我要去|我要|我想去|我想要|記得要|要去|準備去|去)/,
      "",
    );
}

export async function savePetRecurringSchedule(
  schedule:
    PetRecurringScheduleCandidate,
) {
  const [
    user,
    supabase,
    pet,
  ] = await Promise.all([
    requireUser(),
    createClient(),
    getPet(),
  ]);

  const title =
    schedule.title.trim();

  if (!title) {
    return;
  }

  const recurrenceExpression =
    schedule
      .recurrenceExpression
      .trim();

  const resolved =
    resolvePetRecurringSchedule(
      recurrenceExpression,
    );

  if (!resolved) {
    /*
     * Never store a recurrence that
     * deterministic code could not parse.
     */
    return;
  }

  const note =
    schedule.note?.trim() ||
    null;

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from(
      "pet_recurring_schedules",
    )
    .select(
      `
        id,
        title,
        recurrence_rule
      `,
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
    .limit(50);

  if (existingError) {
    throw new Error(
      existingError.message,
    );
  }

  const normalizedTitle =
    normalizeTitle(
      title,
    );

  const duplicate =
    (
      existing ??
      []
    ).find(
      (item) =>
        normalizeTitle(
          item.title,
        ) ===
          normalizedTitle &&
        item.recurrence_rule ===
          resolved.recurrenceRule,
    );

  const now =
    new Date().toISOString();

  if (duplicate) {
    const { error } =
      await supabase
        .from(
          "pet_recurring_schedules",
        )
        .update({
          note,

          recurrence_expression:
            recurrenceExpression,

          recurrence_start_date:
            resolved
              .recurrenceStartDate,

          recurrence_end_date:
            resolved
              .recurrenceEndDate,

          time_precision:
            resolved
              .timePrecision,

          start_time:
            resolved
              .startTime,

          updated_at:
            now,
        })
        .eq(
          "id",
          duplicate.id,
        )
        .eq(
          "user_id",
          user.id,
        );

    if (error) {
      throw new Error(
        error.message,
      );
    }

    return;
  }

  const { error } =
    await supabase
      .from(
        "pet_recurring_schedules",
      )
      .insert({
        pet_id:
          pet.id,

        user_id:
          user.id,

        title,

        note,

        recurrence_rule:
          resolved
            .recurrenceRule,

        recurrence_start_date:
          resolved
            .recurrenceStartDate,

        recurrence_end_date:
          resolved
            .recurrenceEndDate,

        time_precision:
          resolved
            .timePrecision,

        start_time:
          resolved
            .startTime,

        recurrence_expression:
          recurrenceExpression,

        status:
          "active",

        created_from:
          "chat",
      });

  if (error) {
    throw new Error(
      error.message,
    );
  }
}
