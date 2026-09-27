import "server-only";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

import type { PetTaskCandidate } from "@/features/pet/ai/pet-reply";
import { getPet } from "@/features/pet/lib/get-pet";

function normalizeTaskTitle(title: string) {
  return title
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function normalizeDueAt(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  /*
   * Gemini should normally return a full ISO timestamp.
   *
   * As a fallback, if only YYYY-MM-DD is returned,
   * interpret it as the end of that day in Taipei.
   */
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

  const candidate = dateOnlyPattern.test(trimmed)
    ? `${trimmed}T23:59:59+08:00`
    : trimmed;

  const timestamp = Date.parse(candidate);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

export async function savePetTask(task: PetTaskCandidate) {
  const [user, supabase, pet] = await Promise.all([
    requireUser(),
    createClient(),
    getPet(),
  ]);

  const title = task.title.trim();

  if (!title) {
    return;
  }

  const note = task.note?.trim() || null;

  const dueAt = normalizeDueAt(task.dueAt);

  /*
   * Prevent obvious duplicate tasks.
   *
   * Only compare the current user's pending
   * tasks for this pet.
   */
  const { data: existingTasks, error: existingError } = await supabase
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
    .order("created_at", {
      ascending: false,
    })
    .limit(50);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const normalizedTitle = normalizeTaskTitle(title);

  const duplicate = (existingTasks ?? []).find(
    (item) => normalizeTaskTitle(item.title) === normalizedTitle,
  );

  const now = new Date().toISOString();

  /*
   * If the same pending task already exists,
   * update useful details instead of adding a
   * second copy.
   */
  if (duplicate) {
    const { error } = await supabase
      .from("pet_tasks")
      .update({
        note: note ?? duplicate.note,
        due_at: dueAt ?? duplicate.due_at,
        updated_at: now,
      })
      .eq("id", duplicate.id)
      .eq("user_id", user.id);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const { error } = await supabase.from("pet_tasks").insert({
    pet_id: pet.id,
    user_id: user.id,
    title,
    note,
    due_at: dueAt,
    status: "pending",
    created_from: "chat",
  });

  if (error) {
    throw new Error(error.message);
  }
}
