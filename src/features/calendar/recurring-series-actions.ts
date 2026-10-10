"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/features/pet/lib/get-pet";

import {
  WEEKDAYS,
  buildCalendarWeeklyRule,
  describeCalendarWeeklyRule,
  parseCalendarWeeklyRule,
} from "@/features/calendar/lib/calendar-weekly-series";

const schema = z.object({
  scheduleId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  title: z.string().trim().min(1).max(120),
  interval: z.number().int().min(1).max(12),
  days: z.array(z.enum(WEEKDAYS)).min(1).max(7),
  timePrecision: z.enum(["none", "daypart", "exact"]),
  startTime: z.string().regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
  ).nullable(),
  confirmRuleChange: z.boolean(),
}).strict().superRefine((value, ctx) => {
  if (
    (value.timePrecision === "exact") !==
    (value.startTime !== null)
  ) {
    ctx.addIssue({
      code: "custom",
      message: "精確時間與時間模式不一致。",
    });
  }
});

type Result =
  | { success: true }
  | { success: false; error: string };

export async function updateCalendarRecurringSeries(
  input: unknown,
): Promise<Result> {
  try {
    const parsed = schema.safeParse(input);

    if (!parsed.success) {
      const invalidFields = [
        ...new Set(
          parsed.error.issues.map(
            (issue) => issue.path.join(".") || "input",
          ),
        ),
      ].join("、");

      return {
        success: false,
        error: `固定行程資料驗證失敗：${invalidFields}`,
      };
    }

    const value = parsed.data;
    const newRule = buildCalendarWeeklyRule({
      interval: value.interval,
      days: value.days,
    });

    const [user, supabase, pet] = await Promise.all([
      requireUser(),
      createClient(),
      getPet(),
    ]);

    const { data: current, error: loadError } = await supabase
      .from("pet_recurring_schedules")
      .select(`
        id,
        title,
        recurrence_rule,
        recurrence_expression,
        time_precision,
        start_time,
        updated_at
      `)
      .eq("id", value.scheduleId)
      .eq("user_id", user.id)
      .eq("pet_id", pet.id)
      .eq("status", "active")
      .maybeSingle();

    if (loadError) throw new Error(loadError.message);

    if (!current) {
      return { success: false, error: "找不到有效的固定行程。" };
    }

    if (current.updated_at !== value.expectedUpdatedAt) {
      return {
        success: false,
        error: "固定行程已被其他操作修改，請重新整理。",
      };
    }

    const original = parseCalendarWeeklyRule(
      current.recurrence_rule,
    );

    if (!original) {
      return {
        success: false,
        error: "這個重複規則暫不支援從 Calendar 編輯。",
      };
    }

    const normalizedDays = WEEKDAYS.filter((day) =>
      value.days.includes(day),
    );

    const ruleChanged =
      original.interval !== value.interval ||
      original.days.join(",") !== normalizedDays.join(",");

    if (ruleChanged && !value.confirmRuleChange) {
      return {
        success: false,
        error: "變更重複星期前，請先確認影響範圍。",
      };
    }

    if (
      value.timePrecision === "daypart" &&
      current.time_precision !== "daypart"
    ) {
      return {
        success: false,
        error: "無法直接建立未指定時段的固定行程。",
      };
    }

    const originalTime =
      current.start_time?.slice(0, 5) ?? null;

    const timeChanged =
      current.time_precision !== value.timePrecision ||
      (
        value.timePrecision === "exact" &&
        originalTime !== value.startTime
      );

    const expression =
      ruleChanged || timeChanged
        ? describeCalendarWeeklyRule(
            {
              interval: value.interval,
              days: normalizedDays,
            },
            value.timePrecision,
            value.startTime,
            current.recurrence_expression,
          )
        : current.recurrence_expression;

    const { data: updated, error: updateError } =
      await supabase
        .from("pet_recurring_schedules")
        .update({
          title: value.title,
          recurrence_rule: newRule,
          recurrence_expression: expression,
          time_precision: value.timePrecision,
          start_time: value.startTime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id)
        .eq("user_id", user.id)
        .eq("pet_id", pet.id)
        .eq("status", "active")
        .eq("updated_at", current.updated_at)
        .select("id")
        .maybeSingle();

    if (updateError) throw new Error(updateError.message);

    if (!updated) {
      return {
        success: false,
        error: "資料已變更，請重新整理後再試。",
      };
    }

    revalidatePath("/calendar");
    revalidatePath("/pet");

    return { success: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[Calendar series update]", error);

    return {
      success: false,
      error: "儲存固定行程失敗，請稍後再試。",
    };
  }
}
