import "server-only";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

import type { PetTaskCandidate } from "@/features/pet/ai/pet-reply";
import { getPet } from "@/features/pet/lib/get-pet";

function normalizeTaskTitle(
  title: string,
) {
  return title
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(
      /[\s\p{P}\p{S}]+/gu,
      "",
    );
}

function normalizeDueAt(
  value: string | null,
  precision:
    PetTaskCandidate["timePrecision"],
) {
  if (!value) {
    return null;
  }

  const trimmed =
    value.trim();

  /*
   * date precision:
   *
   * The date itself is meaningful,
   * not whatever time Gemini happened
   * to attach.
   */
  if (
    precision === "date"
  ) {
    const match =
      trimmed.match(
        /^(\d{4}-\d{2}-\d{2})/,
      );

    if (!match) {
      return null;
    }

    return new Date(
      `${match[1]}T23:59:59+08:00`,
    ).toISOString();
  }

  const dateOnlyPattern =
    /^\d{4}-\d{2}-\d{2}$/;

  if (
    dateOnlyPattern.test(
      trimmed,
    )
  ) {
    return new Date(
      `${trimmed}T23:59:59+08:00`,
    ).toISOString();
  }

  /*
   * If Gemini returns:
   *
   * 2026-10-01T09:00:00
   *
   * with no timezone,
   * interpret it as Taipei,
   * never as server-local / UTC.
   */
  const hasTimezone =
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(
      trimmed,
    );

  const candidate =
    hasTimezone
      ? trimmed
      : `${trimmed}+08:00`;

  const timestamp =
    Date.parse(candidate);

  if (
    Number.isNaN(timestamp)
  ) {
    return null;
  }

  return new Date(
    timestamp,
  ).toISOString();
}

export async function savePetTask(
  task: PetTaskCandidate,
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
    task.title.trim();

  if (!title) {
    return;
  }

  const note =
    task.note?.trim() ||
    null;

  const dueAt =
    normalizeDueAt(
      task.dueAt,
      task.timePrecision,
    );

  const dueHasTime =
    task.timePrecision ===
      "daypart" ||
    task.timePrecision ===
      "exact";

  const {
    data: existingTasks,
    error: existingError,
  } = await supabase
    .from("pet_tasks")
    .select(
      `
        id,
        title,
        due_at,
        note
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
    .limit(50);

  if (existingError) {
    throw new Error(
      existingError.message,
    );
  }

  const normalizedTitle =
    normalizeTaskTitle(title);

  const duplicate =
    (existingTasks ?? [])
      .find(
        (item) =>
          normalizeTaskTitle(
            item.title,
          ) ===
          normalizedTitle,
      );

  const now =
    new Date().toISOString();

  if (duplicate) {
    const { error } =
      await supabase
        .from("pet_tasks")
        .update({
          note:
            note ??
            duplicate.note,

          due_at:
            dueAt ??
            duplicate.due_at,

          due_has_time:
            dueHasTime,

          temporal_kind:
            task.temporalKind,

          time_precision:
            task.timePrecision,

          updated_at: now,
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
      .from("pet_tasks")
      .insert({
        pet_id: pet.id,
        user_id: user.id,

        title,
        note,

        due_at: dueAt,
        due_has_time:
          dueHasTime,

        temporal_kind:
          task.temporalKind,

        time_precision:
          task.timePrecision,

        status: "pending",
        created_from: "chat",
      });

  if (error) {
    throw new Error(
      error.message,
    );
  }
}
