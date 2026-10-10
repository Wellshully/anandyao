export type PetReportSlot = {
  reportDate: string;
  reportTime: string;
  timeZone: string;
};

export function getPetReportLocalDateTime(
  now: Date,
  timeZone: string,
) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid Pet report timestamp.");
  }

  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    },
  ).formatToParts(now);

  function part(type: string) {
    const value = parts.find(
      (item) => item.type === type,
    )?.value;

    if (!value) {
      throw new Error(
        `Missing Pet report date component: ${type}`,
      );
    }

    return value;
  }

  return {
    date: [
      part("year"),
      part("month"),
      part("day"),
    ].join("-"),

    time: [
      part("hour"),
      part("minute"),
    ].join(":"),
  };
}

export function normalizePetReportTime(
  reportTime: string,
) {
  const match =
    /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/
      .exec(reportTime.trim());

  if (
    !match ||
    Number(match[1]) > 23 ||
    Number(match[2]) > 59
  ) {
    throw new Error(
      "Invalid Pet Daily Report time.",
    );
  }

  return `${match[1]}:${match[2]}`;
}

export function getDuePetReportSlot(
  now: Date,
  timeZone: string,
  reportTime: string,
): PetReportSlot | null {
  const local = getPetReportLocalDateTime(
    now,
    timeZone,
  );

  const scheduled =
    normalizePetReportTime(reportTime);

  if (local.time < scheduled) {
    return null;
  }

  return {
    reportDate: local.date,
    reportTime: scheduled,
    timeZone,
  };
}

export function getPetReportJobKey(
  userId: string,
  slot: PetReportSlot,
) {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new Error(
      "Pet Daily Report requires a user ID.",
    );
  }

  return [
    "pet.daily-report",
    normalizedUserId,
    slot.reportDate,
    slot.reportTime,
  ].join(":");
}

const HOUR_MS = 60 * 60 * 1000;
const MIN_RETRY_DELAY_MS = 30 * 60 * 1000;

export function isPetReportJobDateCurrent(
  reportDate: string,
  timeZone: string,
  now: Date,
): boolean {
  return getPetReportLocalDateTime(
    now,
    timeZone,
  ).date === reportDate;
}

/**
 * A missing push subscription is not an AI failure.
 *
 * Recheck at a future UTC-hour boundary, at least
 * 30 minutes from now, while still on the user's
 * original local report date.
 *
 * The returned key deduplicates the retry slot.
 */
export function getPetReportNoDeviceRetry(
  now: Date,
  userId: string,
  reportDate: string,
  timeZone: string,
) {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new Error(
      "Pet Daily Report requires a user ID.",
    );
  }

  if (!Number.isFinite(now.getTime())) {
    throw new Error(
      "Invalid Pet Daily Report retry time.",
    );
  }

  const nextTimestamp =
    Math.ceil(
      (now.getTime() + MIN_RETRY_DELAY_MS) /
        HOUR_MS,
    ) * HOUR_MS;

  const retryAt = new Date(nextTimestamp);

  if (
    !isPetReportJobDateCurrent(
      reportDate,
      timeZone,
      retryAt,
    )
  ) {
    return null;
  }

  return {
    runAt: retryAt,
    idempotencyKey: [
      "pet.daily-report",
      normalizedUserId,
      reportDate,
      "no-device",
      retryAt.toISOString(),
    ].join(":"),
  };
}
