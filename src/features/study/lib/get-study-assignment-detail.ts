import "server-only";

import { createClient } from "@/lib/supabase/server";

import {
  getNtuCoolAssignment,
  isNtuCoolAuthError,
} from "@/features/study/lib/ntu-cool-client";

import { sanitizeStudyHtml } from "@/features/study/lib/sanitize-study-html";

export async function getStudyAssignmentDetail(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("study_assignments")
    .select(
      `
          id,
          cool_course_id,
          cool_assignment_id,
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
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  try {
    const assignment = await getNtuCoolAssignment(
      Number(data.cool_course_id),

      Number(data.cool_assignment_id),
    );

    return {
      id: data.id,

      courseName: data.course_name ?? "Unknown course",

      title: assignment.name ?? data.title,

      dueAt: assignment.due_at ?? data.due_at,

      submitted: data.submitted,

      submissionState: data.submission_state,

      submittedAt: data.submitted_at,

      late: data.late,

      missing: data.missing,

      pointsPossible: assignment.points_possible ?? null,

      submissionTypes: assignment.submission_types ?? [],

      descriptionHtml: sanitizeStudyHtml(assignment.description),

      htmlUrl: assignment.html_url ?? data.html_url,

      detailAvailable: true,

      unavailableReason: null,
    };
  } catch (cause) {
    return {
      id: data.id,

      courseName: data.course_name ?? "Unknown course",

      title: data.title,

      dueAt: data.due_at,

      submitted: data.submitted,

      submissionState: data.submission_state,

      submittedAt: data.submitted_at,

      late: data.late,

      missing: data.missing,

      pointsPossible: null,

      submissionTypes: [],

      descriptionHtml: "",

      htmlUrl: data.html_url,

      detailAvailable: false,

      unavailableReason: isNtuCoolAuthError(cause)
        ? "auth_expired"
        : "cool_unavailable",
    };
  }
}
