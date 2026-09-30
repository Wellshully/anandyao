import "server-only";

import {
  revalidatePath,
} from "next/cache";

import {
  requireUser,
} from "@/lib/auth/require-user";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  getPet,
} from "@/features/pet/lib/get-pet";

import {
  savePetTask,
} from "@/features/pet/ai/save-pet-task";

import type {
  PetTaskActionCandidate,
} from "@/features/pet/ai/pet-reply";

type TimePrecision =
  | "none"
  | "date"
  | "daypart"
  | "exact";

function normalizeTaskTitle(
  value: string,
) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(
      /[\s\p{P}\p{S}]+/gu,
      "",
    );
}

function normalizeTaskDueAt(
  value: string | null,
  precision: TimePrecision,
) {
  if (
    precision === "none" ||
    !value
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  /*
   * Date-only tasks use the end of
   * the Taipei calendar day.
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

  /*
   * Defensive fallback if the model
   * returns only YYYY-MM-DD.
   */
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      trimmed,
    )
  ) {
    return new Date(
      `${trimmed}T23:59:59+08:00`,
    ).toISOString();
  }

  /*
   * Timestamp without timezone
   * means Taipei local time.
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
    Date.parse(
      candidate,
    );

  if (
    Number.isNaN(
      timestamp,
    )
  ) {
    return null;
  }

  return new Date(
    timestamp,
  ).toISOString();
}

function revalidateTaskViews() {
  revalidatePath("/pet");
  revalidatePath("/calendar");
}

/*
 * Gemini should normally copy taskId
 * from the structured pending-task context.
 *
 * But taskId is an implementation detail,
 * so we must not make the mutation depend
 * entirely on the model remembering it.
 *
 * If update has no taskId:
 *
 * 1. exact normalized title match
 * 2. unique partial title match
 * 3. otherwise refuse to guess
 */
async function resolveUpdateTaskId({
  supabase,
  userId,
  petId,
  title,
}: {
  supabase:
    Awaited<
      ReturnType<
        typeof createClient
      >
    >;

  userId:
    string;

  petId:
    string;

  title:
    string;
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from("pet_tasks")
      .select(
        `
          id,
          title,
          due_at
        `,
      )
      .eq(
        "pet_id",
        petId,
      )
      .eq(
        "user_id",
        userId,
      )
      .eq(
        "status",
        "pending",
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      )
      .limit(50);

  if (error) {
    throw new Error(
      `Failed to resolve Pet task: ${error.message}`,
    );
  }

  const target =
    normalizeTaskTitle(
      title,
    );

  if (!target) {
    throw new Error(
      "無法判斷要修改哪一筆待辦。",
    );
  }

  /*
   * First choice:
   * exact semantic title match.
   */
  const exactMatches =
    (data ?? []).filter(
      (item) =>
        normalizeTaskTitle(
          item.title,
        ) === target,
    );

  if (
    exactMatches.length === 1
  ) {
    return exactMatches[0].id;
  }

  if (
    exactMatches.length > 1
  ) {
    throw new Error(
      `找到多筆「${title}」待辦，無法安全判斷要修改哪一筆。`,
    );
  }

  /*
   * Second choice:
   *
   * "動物園"
   * can match
   * "去動物園"
   *
   * but only if exactly one task matches.
   */
  const partialMatches =
    (data ?? []).filter(
      (item) => {
        const existing =
          normalizeTaskTitle(
            item.title,
          );

        return (
          existing.includes(
            target,
          ) ||
          target.includes(
            existing,
          )
        );
      },
    );

  if (
    partialMatches.length === 1
  ) {
    return partialMatches[0].id;
  }

  if (
    partialMatches.length > 1
  ) {
    throw new Error(
      `找到多筆可能符合「${title}」的待辦，請說得更明確一點。`,
    );
  }

  throw new Error(
    `找不到可以修改的待辦「${title}」。`,
  );
}

export async function applyPetTaskAction(
  action: PetTaskActionCandidate,
) {
  /*
   * ================================
   * CREATE
   * ================================
   */
  if (
    action.action ===
    "create"
  ) {
    if (!action.task) {
      throw new Error(
        "Create task action has no task data.",
      );
    }

    await savePetTask(
      action.task,
    );

    revalidateTaskViews();

    return;
  }

  const [
    user,
    supabase,
    pet,
  ] =
    await Promise.all([
      requireUser(),
      createClient(),
      getPet(),
    ]);

  /*
   * ================================
   * UPDATE
   * ================================
   */
  if (
    action.action ===
    "update"
  ) {
    if (!action.task) {
      throw new Error(
        "Update task action has no task data.",
      );
    }

    const title =
      action.task
        .title
        .trim();

    if (!title) {
      throw new Error(
        "Updated task title is empty.",
      );
    }

    /*
     * Prefer the taskId supplied by Gemini.
     *
     * If it forgot taskId, resolve the
     * target safely from the database.
     */
    const taskId =
      action.taskId ??
      await resolveUpdateTaskId({
        supabase,

        userId:
          user.id,

        petId:
          pet.id,

        title,
      });

    const dueAt =
      normalizeTaskDueAt(
        action.task.dueAt,
        action.task
          .timePrecision,
      );

    /*
     * If a dated task cannot be parsed,
     * never silently erase its old date.
     */
    if (
      action.task
        .timePrecision !==
        "none" &&
      action.task.dueAt &&
      !dueAt
    ) {
      throw new Error(
        `無法解析新的待辦時間：${action.task.dueAt}`,
      );
    }

    const dueHasTime =
      action.task
        .timePrecision ===
        "daypart" ||
      action.task
        .timePrecision ===
        "exact";

    const {
      data,
      error,
    } =
      await supabase
        .from("pet_tasks")
        .update({
          title,

          note:
            action.task
              .note
              ?.trim() ||
            null,

          due_at:
            dueAt,

          due_has_time:
            dueHasTime,

          temporal_kind:
            action.task
              .temporalKind,

          time_precision:
            action.task
              .timePrecision,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          taskId,
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
        .select(
          `
            id,
            title,
            due_at,
            temporal_kind,
            time_precision
          `,
        )
        .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to update Pet task: ${error.message}`,
      );
    }

    if (!data) {
      throw new Error(
        "找不到要修改的待辦，資料可能已經變更。",
      );
    }

    console.log(
      "[Pet task update succeeded]",
      {
        id:
          data.id,

        title:
          data.title,

        dueAt:
          data.due_at,

        temporalKind:
          data.temporal_kind,

        timePrecision:
          data.time_precision,

        taskIdSource:
          action.taskId
            ? "model"
            : "server-resolved",
      },
    );

    revalidateTaskViews();

    return;
  }

  /*
   * ================================
   * COMPLETE / CANCEL
   * ================================
   */
  if (!action.taskId) {
    throw new Error(
      `${action.action} action has no taskId.`,
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from("pet_tasks")
      .delete()
      .eq(
        "id",
        action.taskId,
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
      .select("id")
      .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to ${action.action} Pet task: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      "找不到要完成或取消的待辦。",
    );
  }

  revalidateTaskViews();
}
