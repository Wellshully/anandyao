import "server-only";

import { createClient } from "@/lib/supabase/server";

export type StudyOverview = {
  lastSyncedAt: string | null;

  courseCount: number;

  assignmentCount: number;

  pendingAssignmentCount: number;

  unreadAnnouncementCount: number;
};

export async function getStudyOverview(): Promise<StudyOverview> {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return {
      lastSyncedAt: null,

      courseCount: 0,

      assignmentCount: 0,

      pendingAssignmentCount: 0,

      unreadAnnouncementCount: 0,
    };
  }

  const userId = authData.user.id;

  const { data: syncState } = await supabase
    .from("study_sync_state")
    .select("last_synced_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!syncState) {
    return {
      lastSyncedAt: null,

      courseCount: 0,

      assignmentCount: 0,

      pendingAssignmentCount: 0,

      unreadAnnouncementCount: 0,
    };
  }

  const lastSyncedAt = syncState.last_synced_at;

  const [coursesResult, assignmentsResult, pendingResult, announcementsResult] =
    await Promise.all([
      supabase
        .from("study_courses")
        .select("id", {
          count: "exact",

          head: true,
        })
        .eq("user_id", userId)
        .eq("synced_at", lastSyncedAt),

      supabase
        .from("study_assignments")
        .select("id", {
          count: "exact",

          head: true,
        })
        .eq("user_id", userId)
        .eq("synced_at", lastSyncedAt),

      supabase
        .from("study_assignments")
        .select("id", {
          count: "exact",

          head: true,
        })
        .eq("user_id", userId)
        .eq("synced_at", lastSyncedAt)
        .eq("submitted", false)
        .not("due_at", "is", null),

      supabase
        .from("study_announcements")
        .select("id", {
          count: "exact",

          head: true,
        })
        .eq("user_id", userId)
        .eq("synced_at", lastSyncedAt)
        .eq("read_state", "unread"),
    ]);

  return {
    lastSyncedAt,

    courseCount: coursesResult.count ?? 0,

    assignmentCount: assignmentsResult.count ?? 0,

    pendingAssignmentCount: pendingResult.count ?? 0,

    unreadAnnouncementCount: announcementsResult.count ?? 0,
  };
}
