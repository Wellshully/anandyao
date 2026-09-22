"use server";

import { revalidatePath } from "next/cache";

import { createPersonalPlan } from "@/features/today/lib/create-personal-plan";

import { setPersonalPlanCompleted } from "@/features/today/lib/set-personal-plan-completed";

import { deletePersonalPlan } from "@/features/today/lib/delete-personal-plan";

import type { CreatePersonalPlanInput } from "@/features/today/types";

export type TodayActionResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

function refreshToday() {
  revalidatePath("/", "layout");
}

export async function createPersonalPlanAction(
  input: CreatePersonalPlanInput,
): Promise<TodayActionResult> {
  try {
    await createPersonalPlan(input);

    refreshToday();

    return {
      success: true,
    };
  } catch (cause) {
    console.error("createPersonalPlanAction error:", cause);

    return {
      success: false,

      error: cause instanceof Error ? cause.message : "新增計畫失敗。",
    };
  }
}

export async function setPersonalPlanCompletedAction(
  planId: string,
  completed: boolean,
): Promise<TodayActionResult> {
  try {
    await setPersonalPlanCompleted(planId, completed);

    refreshToday();

    return {
      success: true,
    };
  } catch (cause) {
    console.error("setPersonalPlanCompletedAction error:", cause);

    return {
      success: false,

      error: cause instanceof Error ? cause.message : "更新計畫失敗。",
    };
  }
}

export async function deletePersonalPlanAction(
  planId: string,
): Promise<TodayActionResult> {
  try {
    await deletePersonalPlan(planId);

    refreshToday();

    return {
      success: true,
    };
  } catch (cause) {
    console.error("deletePersonalPlanAction error:", cause);

    return {
      success: false,

      error: cause instanceof Error ? cause.message : "刪除計畫失敗。",
    };
  }
}
