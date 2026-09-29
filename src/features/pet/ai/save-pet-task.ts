import "server-only";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

import type { PetTaskCandidate } from "@/features/pet/ai/pet-reply";

import { resolvePetTaskDueAt } from "@/features/pet/ai/resolve-pet-task-due-at";

import { getPet } from "@/features/pet/lib/get-pet";

function normalizeTaskTitle(
  title: string,
) {
  let normalized =
    title
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(
        /[\s\p{P}\p{S}]+/gu,
        "",
      );

  /*
   * LLM wording variation:
   *
   * 去看電影 / 看電影
   * 去剪頭髮 / 剪頭髮
   *
   * These describe the same task.
   */
  normalized =
    normalized.replace(
      /^(?:我要去|我要|我想去|我想要|記得要|要去|準備去|去)/u,
      "",
    );

  return normalized;
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

  /*
   * Important:
   *
   * timeExpression is now the primary
   * temporal source.
   *
   * Gemini dueAt is only a fallback.
   */
  const dueAt =
    resolvePetTaskDueAt(task);

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
    .eq(
      "pet_id",
      pet.id,
    )
    .eq(
      "user_id",
      user.id,
    )
    .eq(
      "status",
      "pending",
    )
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
    normalizeTaskTitle(
      title,
    );

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
          /*
           * Use the newest wording too.
           *
           * "去看電影" may later become
           * the cleaner "看電影".
           */
          title,

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
      .from("pet_tasks")
      .insert({
        pet_id:
          pet.id,

        user_id:
          user.id,

        title,
        note,

        due_at:
          dueAt,

        due_has_time:
          dueHasTime,

        temporal_kind:
          task.temporalKind,

        time_precision:
          task.timePrecision,

        status:
          "pending",

        created_from:
          "chat",
      });

  if (error) {
    throw new Error(
      error.message,
    );
  }
}
