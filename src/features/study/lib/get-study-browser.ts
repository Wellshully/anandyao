import "server-only";

import { createClient } from "@/lib/supabase/server";

import { isStudyAssignmentVisible } from "@/features/study/lib/study-assignment-visibility";

import type {
  StudyAnnouncementItem,
  StudyAssignmentItem,
  StudyBrowserData,
  StudyCourseItem,
} from "@/features/study/browser-types";

export async function getStudyBrowser(): Promise<StudyBrowserData> {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("Not authenticated.");
  }

  const userId = authData.user.id;

  const [coursesResult, assignmentsResult, announcementsResult] =
    await Promise.all([
      supabase
        .from("study_courses")
        .select(
          `
          id,
          cool_course_id,
          name,
          course_code
        `,
        )
        .eq("user_id", userId),

      supabase
        .from("study_assignments")
        .select(
          `
          id,
          cool_assignment_id,
          cool_course_id,
          course_name,
          title,
          due_at,
          submitted,
          submission_state,
          submitted_at,
          late,
          missing,
          html_url
        `,
        )
        .eq("user_id", userId),

      supabase
        .from("study_announcements")
        .select(
          `
            id,
            cool_announcement_id,
            cool_course_id,
            course_name,
            title,
            posted_at,
            read_state,
            seen_at,
            html_url
          `,
        )
        .eq("user_id", userId),
    ]);

  if (coursesResult.error) {
    throw new Error(coursesResult.error.message);
  }

  if (assignmentsResult.error) {
    throw new Error(assignmentsResult.error.message);
  }

  if (announcementsResult.error) {
    throw new Error(announcementsResult.error.message);
  }

  const courses: StudyCourseItem[] = (coursesResult.data ?? [])
    .map((course) => ({
      id: course.id,

      coolCourseId: Number(course.cool_course_id),

      name: course.name,

      courseCode: course.course_code,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-TW"));

  const assignments: StudyAssignmentItem[] = (assignmentsResult.data ?? [])
    .filter(
      (assignment) =>
        assignment.due_at !== null &&
        (
          assignment.submitted ||
          isStudyAssignmentVisible(
            assignment.due_at,
          )
        ),
    )
    .map((assignment) => ({
      id: assignment.id,

      coolAssignmentId: Number(assignment.cool_assignment_id),

      coolCourseId: Number(assignment.cool_course_id),

      courseName: assignment.course_name,

      title: assignment.title,

      dueAt: assignment.due_at,

      submitted: assignment.submitted,

      submissionState: assignment.submission_state,

      submittedAt: assignment.submitted_at,

      late: assignment.late,

      missing: assignment.missing,

      htmlUrl: assignment.html_url,
    }))
    .sort((a, b) => {
      /*
       * Unsubmitted assignments first.
       */
      if (a.submitted !== b.submitted) {
        return a.submitted ? 1 : -1;
      }

      /*
       * Assignments without due dates
       * go to the bottom.
       */
      if (!a.dueAt && !b.dueAt) {
        return 0;
      }

      if (!a.dueAt) {
        return 1;
      }

      if (!b.dueAt) {
        return -1;
      }

      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });

  const announcements: StudyAnnouncementItem[] = (
    announcementsResult.data ?? []
  )
    .map((announcement) => ({
      id: announcement.id,

      coolAnnouncementId: Number(announcement.cool_announcement_id),

      coolCourseId: Number(announcement.cool_course_id),

      courseName: announcement.course_name ?? "Unknown course",

      title: announcement.title,

      postedAt: announcement.posted_at,
      readState: announcement.read_state as "read" | "unread",

      seenAt: announcement.seen_at,

      htmlUrl: announcement.html_url,
    }))
    .sort((a, b) => {
      /*
       * Unread announcements first.
       */
      const aUnseen = !a.seenAt;

      const bUnseen = !b.seenAt;

      if (aUnseen !== bUnseen) {
        return aUnseen ? -1 : 1;
      }
      /*
       * Then newest first.
       */
      if (!a.postedAt && !b.postedAt) {
        return 0;
      }

      if (!a.postedAt) {
        return 1;
      }

      if (!b.postedAt) {
        return -1;
      }

      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    });

  return {
    courses,
    assignments,
    announcements,
  };
}
