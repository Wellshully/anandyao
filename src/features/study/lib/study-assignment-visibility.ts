const STUDY_OVERDUE_GRACE_MS =
  24 * 60 * 60 * 1000;

export function getStudyAssignmentCutoffIso(
  now = new Date(),
) {
  return new Date(
    now.getTime() -
      STUDY_OVERDUE_GRACE_MS,
  ).toISOString();
}

export function isStudyAssignmentVisible(
  dueAt: string | null,
  now = new Date(),
) {
  /*
   * An assignment without a due date
   * has not become stale by deadline.
   */
  if (!dueAt) {
    return false;
  }

  const timestamp =
    new Date(dueAt).getTime();

  /*
   * Do not silently hide malformed
   * source data.
   */
  if (
    !Number.isFinite(timestamp)
  ) {
    return true;
  }

  return (
    timestamp >=
    now.getTime() -
      STUDY_OVERDUE_GRACE_MS
  );
}
