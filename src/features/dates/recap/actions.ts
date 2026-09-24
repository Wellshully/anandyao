"use server";

import { revalidatePath } from "next/cache";

import { saveDateRecap } from "@/features/dates/recap/lib/save-date-recap";

import { completeDateRecap } from "@/features/dates/recap/lib/complete-date-recap";

type SaveRecapResult =
  | {
      success: true;
      savedAt: string;
    }
  | {
      success: false;
      error: string;
    };

type CompleteRecapResult =
  | {
      success: true;
      memoryId: string;
    }
  | {
      success: false;
      error: string;
    };

export async function saveDateRecapAction(input: {
  recapId: string;
  dateId: string;
  favoriteMoment: string;
}): Promise<SaveRecapResult> {
  try {
    if (!input.recapId) {
      return {
        success: false,
        error: "找不到 Recap ID。",
      };
    }

    if (input.favoriteMoment.length > 5000) {
      return {
        success: false,
        error: "文字太長了。",
      };
    }

    const saved = await saveDateRecap({
      recapId: input.recapId,

      favoriteMoment: input.favoriteMoment,
    });

    revalidatePath(`/dates/${input.dateId}/recap`);

    return {
      success: true,

      savedAt: saved.updated_at,
    };
  } catch (cause) {
    console.error("saveDateRecapAction error:", cause);

    return {
      success: false,

      error: cause instanceof Error ? cause.message : "儲存失敗。",
    };
  }
}

export async function completeDateRecapAction(
  dateId: string,
): Promise<CompleteRecapResult> {
  try {
    const memoryId = await completeDateRecap(dateId);

    revalidatePath("/dates");

    revalidatePath(`/dates/${dateId}`);

    revalidatePath("/memories");

    revalidatePath(`/memories/${memoryId}`);

    revalidatePath("/");

    return {
      success: true,

      memoryId,
    };
  } catch (cause) {
    console.error("completeDateRecapAction:", cause);

    return {
      success: false,

      error: cause instanceof Error ? cause.message : "完成回顧失敗。",
    };
  }
}
