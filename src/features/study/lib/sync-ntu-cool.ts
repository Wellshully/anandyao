import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import { requireUser } from "@/lib/auth/require-user";

import {
  getNtuCoolAnnouncements,
  getNtuCoolAssignments,
  getNtuCoolCourses,
} from "@/features/study/lib/ntu-cool-client";

import { isAssignmentSubmitted } from "@/features/study/lib/is-assignment-submitted";

export type SyncNtuCoolResult = {
  courses: number;

  assignments: number;

  announcements: number;
};

export async function syncNtuCool(): Promise<SyncNtuCoolResult> {
  const [supabase, space, user] = await Promise.all([
    createClient(),
    requireSpace(),
    requireUser(),
  ]);

  /*
   * Study is available to any authenticated
   * member of this An & Yao space.
   *
   * Do NOT restrict this to role = owner,
   * because both 堯 and 安 have their own
   * private Study integration.
   */
  const { data: membership, error: membershipError } = await supabase
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

  /*
   * Authentication to COOL is handled
   * inside ntu-cool-session.ts.
   *
   * That layer chooses credentials based on
   * the current Supabase user ID, so:
   *
   * 堯 → 堯's NTU account
   * 安 → 安's NTU account
   */
  const courses = await getNtuCoolCourses();

  const now = new Date().toISOString();

  /*
   * ===============================
   * Courses
   * ===============================
   */

  const courseRows = courses.map((course) => ({
    user_id: user.id,

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
      throw new Error(`Failed to sync Study courses: ${coursesError.message}`);
    }
  }

  /*
   * ===============================
   * Assignments
   * ===============================
   *
   * Sequential course fetching is intentional.
   * It avoids firing a large burst of requests
   * at NTU COOL at once.
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

  for (const course of courses) {
    const assignments = await getNtuCoolAssignments(course.id);

    for (const assignment of assignments) {
      const submission = assignment.submission;

      assignmentRows.push({
        user_id: user.id,

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
    courseIds.length > 0 ? await getNtuCoolAnnouncements(courseIds) : [];

  const courseMap = new Map(courses.map((course) => [course.id, course]));

  const announcementRows = announcements
    .map((announcement) => {
      const match = /^course_(\d+)$/.exec(announcement.context_code);

      const coolCourseId = match ? Number(match[1]) : null;

      const course =
        coolCourseId !== null ? courseMap.get(coolCourseId) : undefined;

      return {
        user_id: user.id,

        cool_announcement_id: announcement.id,

        cool_course_id: coolCourseId ?? 0,

        course_name: course?.name ?? null,

        title: announcement.title,

        posted_at: announcement.posted_at,

        read_state: announcement.read_state,

        html_url: announcement.html_url,

        synced_at: now,

        /*
         * IMPORTANT:
         *
         * Do not include seen_at here.
         *
         * seen_at belongs to An & Yao's
         * local read state. Re-syncing COOL
         * must never make an already-read
         * announcement unread again.
         */
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

  return {
    courses: courseRows.length,

    assignments: assignmentRows.length,

    announcements: announcementRows.length,
  };
}
