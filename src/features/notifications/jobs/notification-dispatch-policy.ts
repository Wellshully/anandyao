export type ReminderCandidate = {
  userId: string;
  notificationKey: string;
  notificationType: string;
  sourceId: string;
};

const DISPATCH_BUCKET_MS = 5 * 60 * 1000;

export function getNotificationDispatchBucket(
  now: Date,
): string {
  const timestamp = now.getTime();

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      "Invalid notification dispatch time.",
    );
  }

  return new Date(
    Math.floor(
      timestamp / DISPATCH_BUCKET_MS,
    ) * DISPATCH_BUCKET_MS,
  ).toISOString();
}

export function getNotificationDispatchKey(
  userId: string,
  now: Date,
): string {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new Error(
      "Notification dispatch requires a user ID.",
    );
  }

  return [
    "notification.dispatch",
    normalizedUserId,
    getNotificationDispatchBucket(now),
  ].join(":");
}
