import "server-only";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

import type { PetTaskCandidate } from "@/features/pet/ai/pet-reply";
import { getPet } from "@/features/pet/lib/get-pet";

function stripLeadingDatePhrase(title: string) {
  return title
    .trim()
    /*
     * Relative dates must never become permanent
     * parts of a task title.
     *
     * Example:
     *   明天早上回診
     * becomes:
     *   早上回診
     */
    .replace(
      /^(?:今天|今日|明天|明日|後天|后天)\s*(?:要|得|需要)?\s*/u,
      "",
    )
    /*
     * Also remove simple absolute date prefixes.
     *
     * 10/4 練團 -> 練團
     * 10月4日 練團 -> 練團
     */
    .replace(
      /^\d{1,2}(?:\/|月)\d{1,2}(?:日|號)?[\s，,、:：-]*/u,
      "",
    )
    /*
     * Weekday prefixes.
     *
     * 下週三交報告 -> 交報告
     */
    .replace(
      /^(?:(?:這|本|下)?(?:週|周|星期)[一二三四五六日天])\s*(?:要|得|需要)?\s*/u,
      "",
    )
    .trim();
}

function normalizeTaskTitle(title: string) {
  return title
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

type NormalizedDue = {
  dueAt: string | null;
  dueHasTime: boolean;
};

function normalizeDueAt(
  value: string | null,
): NormalizedDue {
  if (!value) {
    return {
      dueAt: null,
      dueHasTime: false,
    };
  }

  const trimmed = value.trim();

  /*
   * Important contract with talk-to-pet:
   *
   * YYYY-MM-DD
   * = user gave a date but NO exact clock time.
   *
   * Full ISO timestamp
   * = user gave an exact clock time.
   */
  const dateOnlyPattern =
    /^\d{4}-\d{2}-\d{2}$/;

  const isDateOnly =
    dateOnlyPattern.test(trimmed);

  const candidate = isDateOnly
    ? `${trimmed}T23:59:59+08:00`
    : trimmed;

  const timestamp =
    Date.parse(candidate);

  if (Number.isNaN(timestamp)) {
    return {
      dueAt: null,
      dueHasTime: false,
    };
  }

  return {
    dueAt:
      new Date(timestamp).toISOString(),

    dueHasTime:
      !isDateOnly,
  };
}

export async function savePetTask(
  task: PetTaskCandidate,
) {
  const [user, supabase, pet] =
    await Promise.all([
      requireUser(),
      createClient(),
      getPet(),
    ]);

  const rawTitle =
    task.title.trim();

  if (!rawTitle) {
    return;
  }

  const cleanedTitle =
    stripLeadingDatePhrase(rawTitle);

  const title =
    cleanedTitle || rawTitle;

  const note =
    task.note?.trim() || null;

  const normalizedDue =
    normalizeDueAt(task.dueAt);

  const {
    dueAt,
    dueHasTime,
  } = normalizedDue;

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
        due_has_time,
        note
      `,
    )
    .eq("pet_id", pet.id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", {
      ascending: false,
    })
    .limit(50);

  if (existingError) {
    throw new Error(
      existingError.message,
    );
  }

  const normalizedTitle =
    normalizeTaskTitle(title);

  const duplicate =
    (existingTasks ?? []).find(
      (item) =>
        normalizeTaskTitle(
          item.title,
        ) === normalizedTitle,
    );

  const now =
    new Date().toISOString();

  if (duplicate) {
    const hasNewDue =
      dueAt !== null;

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
            hasNewDue
              ? dueHasTime
              : duplicate.due_has_time,

          updated_at: now,
        })
        .eq("id", duplicate.id)
        .eq("user_id", user.id);

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
        due_has_time: dueHasTime,

        status: "pending",
        created_from: "chat",
      });

  if (error) {
    throw new Error(
      error.message,
    );
  }
}
