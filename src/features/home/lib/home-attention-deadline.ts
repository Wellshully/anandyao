const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function isHomeAttentionDeadline(
  deadlineAt: number | null,
  now: number,
  completed = false,
): boolean {
  return (
    !completed &&
    deadlineAt !== null &&
    Number.isFinite(deadlineAt) &&
    deadlineAt >= now &&
    deadlineAt <= now + THREE_DAYS_MS
  );
}

export function getHomePetTaskDeadline(
  dueAt: string | null,
  dueHasTime: boolean,
): number | null {
  if (!dueAt) {
    return null;
  }

  const timestamp = Date.parse(dueAt);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  if (dueHasTime) {
    return timestamp;
  }

  // An all-day Pet Task remains due until
  // the end of its date in Taipei.
  const taipeiDate = new Date(
    timestamp + 8 * 60 * 60 * 1000,
  ).toISOString().slice(0, 10);

  return Date.parse(
    `${taipeiDate}T23:59:59.999+08:00`,
  );
}
