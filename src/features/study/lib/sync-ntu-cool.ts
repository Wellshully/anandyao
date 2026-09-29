import "server-only";

import { createClient } from "@/lib/supabase/server";

import { createAdminClient } from "@/lib/supabase/admin";

import { requireSpace } from "@/lib/space/require-space";

import { requireUser } from "@/lib/auth/require-user";

import {
  getNtuCoolAnnouncementsForUser,
  getNtuCoolAssignmentsForUser,
  getNtuCoolCoursesForUser,
} from "@/features/study/lib/ntu-cool-client";

import { getConfiguredStudyUserIds } from "@/features/study/lib/get-study-credentials";

import { isAssignmentSubmitted } from "@/features/study/lib/is-assignment-submitted";

export type SyncNtuCoolResult = {
  courses: number;
  assignments: number;
  announcements: number;
};

export type StudySyncTrigger = "app" | "background";

type BackgroundSyncAccountResult =
  | {
      userId: string;
      success: true;
      result: SyncNtuCoolResult;
    }
  | {
      userId: string;
      success: false;
      error: string;
    };

async function startSyncLog(userId: string, triggerSource: StudySyncTrigger) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("study_sync_runs")
    .insert({
      user_id: userId,

      provider: "cool",

      trigger_source: triggerSource,

      status: "running",
    })
    .select("id")
    .single();

  if (error) {
    console.warn("Failed to create COOL sync log:", error.message);

    return null;
  }

  return data.id;
}

async function finishSyncLogSuccess(
  logId: string | null,
  result: SyncNtuCoolResult,
) {
  if (!logId) {
    return;
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("study_sync_runs")
    .update({
      status: "success",

      courses_count: result.courses,

      assignments_count: result.assignments,

      announcements_count: result.announcements,

      finished_at: new Date().toISOString(),

      error_message: null,
    })
    .eq("id", logId);

  if (error) {
    console.warn("Failed to finish COOL sync log:", error.message);
  }
}

async function finishSyncLogError(logId: string | null, cause: unknown) {
  if (!logId) {
    return;
  }

  const supabase = createAdminClient();

  const message = cause instanceof Error ? cause.message : String(cause);

  const { error } = await supabase
    .from("study_sync_runs")
    .update({
      status: "error",

      finished_at: new Date().toISOString(),

      error_message: message.slice(0, 1000),
    })
    .eq("id", logId);

  if (error) {
    console.warn("Failed to write COOL sync error log:", error.message);
  }
}

export async function syncNtuCoolForUser(
  userId: string,
  triggerSource: StudySyncTrigger = "background",
): Promise<SyncNtuCoolResult> {
  const logId = await startSyncLog(userId, triggerSource);

  try {
    const supabase = createAdminClient();

    /*
     * Explicit user ID is the important part.
     *
     * No browser session / requireUser() is
     * needed anywhere in the COOL login flow.
     */
    const courses = await getNtuCoolCoursesForUser(userId);

    const now = new Date().toISOString();

    /*
     * ===============================
     * Courses
     * ===============================
     */

    const courseRows = courses.map((course) => ({
      user_id: userId,

      cool_course_id: course.id,

      name: course.name,

      course_code: course.course_code ?? null,

      synced_at: now,
    }));

    if (courseRows.length > 0) {
      const { error: coursesError } = await supabase
        .from("study_courses")
        .upsert(courseRows, {
          onConflict: "user_id,cool_course_id",
        });

      if (coursesError) {
        throw new Error(
          `Failed to sync Study courses: ${coursesError.message}`,
        );
      }
    }

    /*
     * ===============================
     * Assignments
     * ===============================
     */

    const assignmentRows: {
      user_id: string;

      cool_assignment_id: number;

      cool_course_id: number;

      course_name: string;

      title: string;

      due_at: string | null;

      submitted: boolean;

      submission_state: string | null;

      submitted_at: string | null;

      late: boolean;

      missing: boolean;

      html_url: string;

      synced_at: string;
    }[] = [];

    /*
     * Sequential fetching remains intentional
     * so we do not burst many requests at COOL.
     */
    for (const course of courses) {
      const assignments = await getNtuCoolAssignmentsForUser(userId, course.id);

      for (const assignment of assignments) {
        const submission = assignment.submission;

        assignmentRows.push({
          user_id: userId,

          cool_assignment_id: assignment.id,

          cool_course_id: course.id,

          course_name: course.name,

          title: assignment.name,

          due_at: assignment.due_at,

          submitted: isAssignmentSubmitted(assignment),

          submission_state: submission?.workflow_state ?? null,

          submitted_at: submission?.submitted_at ?? null,

          late: submission?.late ?? false,

          missing: submission?.missing ?? false,

          html_url: assignment.html_url,

          synced_at: now,
        });
      }
    }

    if (assignmentRows.length > 0) {
      const { error: assignmentsError } = await supabase
        .from("study_assignments")
        .upsert(assignmentRows, {
          onConflict: "user_id,cool_assignment_id",
        });

      if (assignmentsError) {
        throw new Error(
          `Failed to sync Study assignments: ${assignmentsError.message}`,
        );
      }
    }

    /*
     * ===============================
     * Announcements
     * ===============================
     */

    const courseIds = courses.map((course) => course.id);

    const announcements =
      courseIds.length > 0
        ? await getNtuCoolAnnouncementsForUser(userId, courseIds)
        : [];

    const courseMap = new Map(courses.map((course) => [course.id, course]));

    const announcementRows = announcements
      .map((announcement) => {
        const match = /^course_(\d+)$/.exec(announcement.context_code);

        const coolCourseId = match ? Number(match[1]) : null;

        const course =
          coolCourseId !== null ? courseMap.get(coolCourseId) : undefined;

        return {
          user_id: userId,

          cool_announcement_id: announcement.id,

          cool_course_id: coolCourseId ?? 0,

          course_name: course?.name ?? null,

          title: announcement.title,

          posted_at: announcement.posted_at,

          read_state: announcement.read_state,

          html_url: announcement.html_url,

          synced_at: now,
        };
      })
      .filter((announcement) => announcement.cool_course_id > 0);

    if (announcementRows.length > 0) {
      const { error: announcementsError } = await supabase
        .from("study_announcements")
        .upsert(announcementRows, {
          onConflict: "user_id,cool_announcement_id",
        });

      if (announcementsError) {
        throw new Error(
          `Failed to sync Study announcements: ${announcementsError.message}`,
        );
      }
    }

    /*
     * ===============================
     * Snapshot reconciliation
     * ===============================
     *
     * At this point ALL current COOL data has been
     * fetched successfully and upserted.
     *
     * Every current row was stamped with exactly
     * the same `now` value above.
     *
     * Rows for this user whose synced_at is older
     * therefore belong to an older snapshot and
     * are no longer returned by COOL.
     *
     * Never perform this cleanup before all remote
     * fetching succeeds. If COOL fails halfway,
     * execution jumps to catch and old data remains
     * available instead of being accidentally lost.
     */

    const { error: staleAssignmentsError } =
      await supabase
        .from("study_assignments")
        .delete()
        .eq("user_id", userId)
        .lt("synced_at", now);

    if (staleAssignmentsError) {
      throw new Error(
        `Failed to reconcile stale Study assignments: ${staleAssignmentsError.message}`,
      );
    }

    const { error: staleAnnouncementsError } =
      await supabase
        .from("study_announcements")
        .delete()
        .eq("user_id", userId)
        .lt("synced_at", now);

    if (staleAnnouncementsError) {
      throw new Error(
        `Failed to reconcile stale Study announcements: ${staleAnnouncementsError.message}`,
      );
    }

    /*
     * Courses are cleaned last in case child rows
     * ever gain foreign-key relationships.
     */
    const { error: staleCoursesError } =
      await supabase
        .from("study_courses")
        .delete()
        .eq("user_id", userId)
        .lt("synced_at", now);

    if (staleCoursesError) {
      throw new Error(
        `Failed to reconcile stale Study courses: ${staleCoursesError.message}`,
      );
    }

    const result: SyncNtuCoolResult = {
      courses: courseRows.length,

      assignments: assignmentRows.length,

      announcements: announcementRows.length,
    };

    await finishSyncLogSuccess(logId, result);

    return result;
  } catch (cause) {
    await finishSyncLogError(logId, cause);

    throw cause;
  }
}

/*
 * Existing application sync.
 *
 * Existing callers do not have to change.
 */
export async function syncNtuCool(): Promise<SyncNtuCoolResult> {
  const [supabase, space, user] = await Promise.all([
    createClient(),
    requireSpace(),
    requireUser(),
  ]);

  const {
    data: membership,

    error: membershipError,
  } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", space.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    throw new Error(
      `Failed to verify space membership: ${membershipError.message}`,
    );
  }

  if (!membership) {
    throw new Error("You are not a member of this space.");
  }

  return syncNtuCoolForUser(user.id, "app");
}

export async function syncAllConfiguredNtuCoolAccounts(): Promise<
  BackgroundSyncAccountResult[]
> {
  const userIds = getConfiguredStudyUserIds();

  const results: BackgroundSyncAccountResult[] = [];

  /*
   * Sequential by user as well.
   *
   * If 堯 fails, 安 still gets a chance
   * to sync afterwards.
   */
  for (const userId of userIds) {
    try {
      const result = await syncNtuCoolForUser(userId, "background");

      results.push({
        userId,
        success: true,
        result,
      });
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);

      console.error("Background COOL sync failed:", {
        userId,
        error,
      });

      results.push({
        userId,
        success: false,
        error,
      });
    }
  }

  return results;
}
