"use server";

import { revalidatePath } from "next/cache";

import { cancelDate } from "@/features/dates/lib/cancel-date";

export type CancelDateActionResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

export async function cancelDateAction(
  dateId: string,
): Promise<CancelDateActionResult> {
  try {
    await cancelDate(dateId);

    revalidatePath("/dates");

    revalidatePath(`/dates/${dateId}`);

    revalidatePath("/");

    return {
      success: true,
    };
  } catch (cause) {
    console.error("cancelDateAction error:", cause);

    return {
      success: false,

      error: cause instanceof Error ? cause.message : "取消 Date 失敗。",
    };
  }
}
