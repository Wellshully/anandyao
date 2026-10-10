const MINUTE_MS = 60 * 1000;

export function getStudyMailSyncBucket(
  now: Date,
): string {
  const milliseconds = now.getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error("Invalid Study Mail sync time.");
  }

  return new Date(
    Math.floor(milliseconds / MINUTE_MS) * MINUTE_MS,
  ).toISOString();
}

export function getStudyMailSyncIdempotencyKey(
  userId: string,
  now: Date,
): string {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new Error(
      "Study Mail sync requires a user ID.",
    );
  }

  return [
    "study.mail-sync",
    normalizedUserId,
    getStudyMailSyncBucket(now),
  ].join(":");
}
