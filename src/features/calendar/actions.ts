"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/features/pet/lib/get-pet";

import {
  applyPetRecurringOccurrenceAction,
} from "@/features/pet/ai/apply-pet-recurring-occurrence-action";

import {
  petRecurringOccurrenceActionSchema,
} from "@/features/pet/ai/pet-reply";

import {
  resolveCalendarPetTaskTime,
} from "@/features/calendar/lib/calendar-pet-task-time";

const updateTaskSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  date: z.string(),
  time: z.string(),
}).strict();

type UpdateResult =
  | { success: true }
  | { success: false; error: string };

export async function updateCalendarPetTask(
  input: unknown,
): Promise<UpdateResult> {
  try {
    const parsed = updateTaskSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: "請確認標題、日期與時間格式。",
      };
    }

    const { taskId, title, date, time } = parsed.data;

    const temporal = resolveCalendarPetTaskTime(
      date,
      time,
    );

    const user = await requireUser();
    const pet = await getPet();
    const supabase = await createClient();

    const { data: current, error: loadError } =
      await supabase
        .from("pet_tasks")
        .select("id, updated_at")
        .eq("id", taskId)
        .eq("user_id", user.id)
        .eq("pet_id", pet.id)
        .eq("status", "pending")
        .maybeSingle();

    if (loadError) {
      throw new Error(loadError.message);
    }

    if (!current) {
      return {
        success: false,
        error: "找不到可編輯的待辦，或待辦已經完成。",
      };
    }

    const { data: updated, error: updateError } =
      await supabase
        .from("pet_tasks")
        .update({
          title,
          due_at: temporal.dueAt,
          due_has_time: temporal.dueHasTime,
          time_precision: temporal.timePrecision,
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id)
        .eq("user_id", user.id)
        .eq("pet_id", pet.id)
        .eq("status", "pending")
        .eq("updated_at", current.updated_at)
        .select("id")
        .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (!updated) {
      return {
        success: false,
        error: "待辦可能已被其他操作修改，請重新整理後再試。",
      };
    }

    revalidatePath("/calendar");
    revalidatePath("/pet");

    return { success: true };
  } catch (error) {
    unstable_rethrow(error);

    console.error(
      "[Calendar Pet Task Update Failed]",
      error,
    );

    return {
      success: false,
      error:
        error instanceof Error &&
        (
          error.message === "日期格式不正確。" ||
          error.message === "日期不存在。" ||
          error.message === "時間格式不正確。"
        )
          ? error.message
          : "無法儲存待辦，請稍後再試。",
    };
  }
}


type RecurringOccurrenceResult =
  | { success: true }
  | { success: false; error: string };

export async function updateCalendarRecurringOccurrence(
  input: unknown,
): Promise<RecurringOccurrenceResult> {
  try {
    const parsed =
      petRecurringOccurrenceActionSchema.safeParse(input);

    if (
      !parsed.success ||
      parsed.data.action !== "override"
    ) {
      return {
        success: false,
        error: "固定行程修改內容不正確。",
      };
    }

    await applyPetRecurringOccurrenceAction(parsed.data);

    revalidatePath("/calendar");
    revalidatePath("/pet");

    return { success: true };
  } catch (error) {
    unstable_rethrow(error);

    console.error(
      "[Calendar Recurring Occurrence Update Failed]",
      error,
    );

    return {
      success: false,
      error: "無法修改此固定行程，請重新整理後再試。",
    };
  }
}
