export type ReminderCandidate = {
  userId: string;
  notificationKey: string;
  notificationType: string;
  sourceId: string;
};

/**
 * The same reminder event always has the
 * same queue idempotency key.
 *
 * JSON encoding avoids ambiguous delimiters.
 */
export function getNotificationDispatchKey(
  candidate: Pick<
    ReminderCandidate,
    "userId" | "notificationKey"
  >,
): string {
  const userId = candidate.userId.trim();
  const notificationKey =
    candidate.notificationKey.trim();

  if (!userId || !notificationKey) {
    throw new Error(
      "Notification dispatch requires userId and notificationKey.",
    );
  }

  return (
    "notification.dispatch:" +
    JSON.stringify([
      userId,
      notificationKey,
    ])
  );
}

export type NotificationReminderCategory =
  | "personal"
  | "assignments"
  | "dates";

/**
 * Resolve the scanner for one notification event.
 * Reject unknown or malformed keys.
 */
export function getNotificationDispatchCategory(
  notificationKey: string,
): NotificationReminderCategory {
  if (/^personal:[^:]+:10m(?::\d{13})?$/.test(notificationKey)) {
    return "personal";
  }

  if (/^assignment:[^:]+:24h(?::\d{13})?$/.test(notificationKey)) {
    return "assignments";
  }

  if (/^date:[^:]+:[^:]+:1h(?::\d{13})?$/.test(notificationKey)) {
    return "dates";
  }

  throw new Error("Invalid notification dispatch key.");
}

/**
 * Untargeted discovery scans every category.
 * Targeted Worker dispatch scans only its own.
 */
export function shouldRunNotificationCategory(
  category: NotificationReminderCategory,
  onlyNotificationKey?: string,
): boolean {
  return (
    onlyNotificationKey === undefined ||
    getNotificationDispatchCategory(
      onlyNotificationKey,
    ) === category
  );
}

/**
 * Include the schedule timestamp so rescheduling
 * the same source creates a different reminder.
 */
export function buildScheduledNotificationKey(
  legacyKey: string,
  scheduledAt: number,
): string {
  getNotificationDispatchCategory(legacyKey);

  if (
    !Number.isSafeInteger(scheduledAt) ||
    scheduledAt <= 0
  ) {
    throw new Error("Invalid reminder scheduled time.");
  }

  if (getLegacyNotificationKey(legacyKey)) {
    throw new Error(
      "Expected a notification key without a schedule version.",
    );
  }

  return `${legacyKey}:${scheduledAt}`;
}

export function getLegacyNotificationKey(
  notificationKey: string,
): string | null {
  const match = /^(.*):(\d{13})$/.exec(
    notificationKey,
  );

  if (!match) {
    return null;
  }

  const legacyKey = match[1];

  try {
    getNotificationDispatchCategory(legacyKey);
    return legacyKey;
  } catch {
    return null;
  }
}

/**
 * During migration, treat an old-format delivery as
 * covering the current schedule only when it was
 * sent within that schedule's reminder window.
 *
 * This avoids replaying unchanged reminders while
 * allowing a substantially rescheduled event to
 * generate a new notification.
 */
export function legacyDeliveryCoversSchedule(
  notificationKey: string,
  sentAt: string | null,
): boolean {
  const legacyKey =
    getLegacyNotificationKey(notificationKey);

  if (!legacyKey || !sentAt) {
    return false;
  }

  const category =
    getNotificationDispatchCategory(legacyKey);

  const scheduledAt = Number(
    notificationKey.slice(
      notificationKey.lastIndexOf(":") + 1,
    ),
  );

  const sentTimestamp = Date.parse(sentAt);

  if (!Number.isFinite(sentTimestamp)) {
    return false;
  }

  const windowMs =
    category === "personal"
      ? 10 * 60 * 1000
      : category === "assignments"
        ? 24 * 60 * 60 * 1000
        : 60 * 60 * 1000;

  return (
    sentTimestamp >= scheduledAt - windowMs &&
    sentTimestamp <= scheduledAt
  );
}

export function matchesNotificationDispatchKey(
  eventKey: string,
  targetKey?: string,
): boolean {
  return targetKey === undefined || eventKey === targetKey;
}

export function uniqueNotificationCandidates(
  candidates: readonly ReminderCandidate[],
): ReminderCandidate[] {
  const unique = new Map<
    string,
    ReminderCandidate
  >();

  for (const candidate of candidates) {
    const normalized = {
      ...candidate,
      userId: candidate.userId.trim(),
      notificationKey:
        candidate.notificationKey.trim(),
    };

    const key = getNotificationDispatchKey(
      normalized,
    );

    if (!unique.has(key)) {
      unique.set(key, normalized);
    }
  }

  return [...unique.values()];
}

export function filterDeliveredNotificationCandidates(
  candidates: readonly ReminderCandidate[],
  deliveredJobKeys: ReadonlySet<string>,
): ReminderCandidate[] {
  return candidates.filter(
    (candidate) =>
      !deliveredJobKeys.has(
        getNotificationDispatchKey(candidate),
      ),
  );
}
