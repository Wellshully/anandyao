"use server";

import { revalidatePath } from "next/cache";

import { deleteArchivedDate } from "@/features/dates/lib/delete-archived-date";

export type DeleteArchivedDateActionResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

export async function deleteArchivedDateAction(
  dateId: string,
): Promise<DeleteArchivedDateActionResult> {
  try {
    await deleteArchivedDate(dateId);

    revalidatePath("/dates");

    revalidatePath("/");

    return {
      success: true,
    };
  } catch (cause) {
    console.error("deleteArchivedDateAction error:", cause);

    return {
      success: false,

      error: cause instanceof Error ? cause.message : "永久刪除 Date 失敗。",
    };
  }
}
