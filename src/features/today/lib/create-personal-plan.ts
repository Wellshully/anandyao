import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import { requireUser } from "@/lib/auth/require-user";

import { getTaipeiDateKey } from "@/lib/time/taipei-time";

import type { CreatePersonalPlanInput } from "@/features/today/types";

export async function createPersonalPlan(input: CreatePersonalPlanInput) {
  const [supabase, space, user] = await Promise.all([
    createClient(),
    requireSpace(),
    requireUser(),
  ]);

  const title = input.title.trim();

  if (!title) {
    throw new Error("計畫名稱不能為空。");
  }

  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes <= 0 ||
    input.durationMinutes > 1440
  ) {
    throw new Error("時間長度不正確。");
  }

  const startTime = input.startTime?.trim() || null;

  if (startTime && !/^\d{2}:\d{2}$/.test(startTime)) {
    throw new Error("開始時間格式不正確。");
  }

  const today = getTaipeiDateKey(Date.now());

  const { data, error } = await supabase
    .from("personal_plans")
    .insert({
      space_id: space.id,

      user_id: user.id,

      title,

      plan_date: today,

      start_time: startTime,

      duration_minutes: input.durationMinutes,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create personal plan: ${error.message}`);
  }

  return data;
}
