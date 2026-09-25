"use server";

import { revalidatePath } from "next/cache";

import { syncNtuCool } from "@/features/study/lib/sync-ntu-cool";

type SyncStudyResult =
  | {
      success: true;

      courses: number;

      assignments: number;

      announcements: number;

      unreadAnnouncements: number;
    }
  | {
      success: false;

      error: string;
    };

export async function syncStudyAction(): Promise<SyncStudyResult> {
  try {
    const result = await syncNtuCool();

    revalidatePath("/study");

    return {
      success: true,

      courses: result.courses,

      assignments: result.assignments,

      announcements: result.announcements,

      unreadAnnouncements: result.announcements,
    };
  } catch (cause) {
    console.error("syncStudyAction:", cause);

    return {
      success: false,

      error: cause instanceof Error ? cause.message : "同步失敗。",
    };
  }
}
