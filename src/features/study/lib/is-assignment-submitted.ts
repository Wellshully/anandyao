import type { NtuCoolAssignment } from "@/features/study/lib/ntu-cool-client";

export function isAssignmentSubmitted(assignment: NtuCoolAssignment) {
  const submission = assignment.submission;

  if (!submission) {
    return false;
  }

  if (submission.excused === true) {
    return true;
  }

  if (submission.submitted_at) {
    return true;
  }

  return (
    submission.workflow_state === "submitted" ||
    submission.workflow_state === "graded" ||
    submission.workflow_state === "pending_review"
  );
}
