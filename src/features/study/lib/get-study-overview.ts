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

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return {
      lastSyncedAt: null,
      courseCount: 0,
      assignmentCount: 0,
      pendingAssignmentCount: 0,
      unreadAnnouncementCount: 0,
    };
  }

  const userId = authData.user.id;

  /*
   * last_synced_at is metadata describing when
   * Study was last synchronized.
   *
   * It is NOT used to filter Study rows.
   *
   * study_courses / study_assignments /
   * study_announcements are current-state tables
   * whose rows are updated by the sync process.
   */
  const { data: syncState, error: syncStateError } = await supabase
    .from("study_sync_state")
    .select("last_synced_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (syncStateError) {
    throw new Error(
      `Failed to load Study sync state: ${syncStateError.message}`,
    );
  }

  const lastSyncedAt = syncState?.last_synced_at ?? null;

  /*
   * Keep the Overview consistent with Study Browser:
   * current Study data is selected by user_id,
   * not by an exact synced_at timestamp.
   */
  const [coursesResult, assignmentsResult, pendingResult, announcementsResult] =
    await Promise.all([
      supabase
        .from("study_courses")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("user_id", userId),

      supabase
        .from("study_assignments")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("user_id", userId),

      supabase
        .from("study_assignments")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("user_id", userId)
        .eq("submitted", false)
        .not("due_at", "is", null),

      supabase
        .from("study_announcements")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("user_id", userId)
        .eq("read_state", "unread"),
    ]);

  if (coursesResult.error) {
    throw new Error(
      `Failed to count Study courses: ${coursesResult.error.message}`,
    );
  }

  if (assignmentsResult.error) {
    throw new Error(
      `Failed to count Study assignments: ${assignmentsResult.error.message}`,
    );
  }

  if (pendingResult.error) {
    throw new Error(
      `Failed to count pending Study assignments: ${pendingResult.error.message}`,
    );
  }

  if (announcementsResult.error) {
    throw new Error(
      `Failed to count Study announcements: ${announcementsResult.error.message}`,
    );
  }

  return {
    lastSyncedAt,

    courseCount: coursesResult.count ?? 0,

    assignmentCount: assignmentsResult.count ?? 0,

    pendingAssignmentCount: pendingResult.count ?? 0,

    unreadAnnouncementCount: announcementsResult.count ?? 0,
  };
}
