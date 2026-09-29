export type PetTaskTemporalKind =
  | "scheduled"
  | "deadline"
  | "flexible";

export type PetTaskTimePrecision =
  | "none"
  | "date"
  | "daypart"
  | "exact";

export type PetTaskTemporalState =
  | "undated"
  | "today"
  | "later_today"
  | "passed_expected_time"
  | "due_today"
  | "tomorrow"
  | "future"
  | "overdue"
  | "expired";

const TIME_ZONE = "Asia/Taipei";

function getDateKey(date: Date) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(date);

  const year =
    parts.find(
      (part) => part.type === "year",
    )?.value;

  const month =
    parts.find(
      (part) => part.type === "month",
    )?.value;

  const day =
    parts.find(
      (part) => part.type === "day",
    )?.value;

  if (!year || !month || !day) {
    throw new Error(
      "Failed to calculate Taipei date.",
    );
  }

  return `${year}-${month}-${day}`;
}

export function getTaipeiTodayStartIso(
  now = new Date(),
) {
  const date = getDateKey(now);

  return new Date(
    `${date}T00:00:00+08:00`,
  ).toISOString();
}

function getTomorrowDateKey(
  today: string,
) {
  const midday =
    new Date(
      `${today}T12:00:00+08:00`,
    ).getTime();

  return getDateKey(
    new Date(
      midday +
        24 * 60 * 60 * 1000,
    ),
  );
}

type GetPetTaskTemporalStateInput = {
  dueAt: string | null;
  temporalKind: PetTaskTemporalKind;
  timePrecision: PetTaskTimePrecision;
};

export function getPetTaskTemporalState(
  task: GetPetTaskTemporalStateInput,
  now = new Date(),
): PetTaskTemporalState {
  if (!task.dueAt) {
    return "undated";
  }

  const due = new Date(task.dueAt);

  if (
    !Number.isFinite(
      due.getTime(),
    )
  ) {
    return "undated";
  }

  const today = getDateKey(now);
  const tomorrow =
    getTomorrowDateKey(today);
  const dueDate = getDateKey(due);

  /*
   * Previous calendar day.
   */
  if (dueDate < today) {
    if (
      task.temporalKind ===
      "scheduled"
    ) {
      return "expired";
    }

    return "overdue";
  }

  if (dueDate === tomorrow) {
    return "tomorrow";
  }

  if (dueDate > tomorrow) {
    return "future";
  }

  /*
   * Same calendar day.
   */
  if (
    task.temporalKind ===
    "scheduled"
  ) {
    /*
     * Date-only scheduled item means:
     * sometime today.
     *
     * We do not pretend to know whether
     * its expected time already passed.
     */
    if (
      task.timePrecision ===
      "date"
    ) {
      return "today";
    }

    if (
      due.getTime() <=
      now.getTime()
    ) {
      return "passed_expected_time";
    }

    return "later_today";
  }

  if (
    task.temporalKind ===
    "deadline"
  ) {
    if (
      due.getTime() <=
      now.getTime()
    ) {
      return "overdue";
    }

    return "due_today";
  }

  /*
   * Flexible tasks normally have no dueAt.
   * If one exists, keep the temporal
   * information without treating it as a
   * scheduled appointment.
   */
  if (
    due.getTime() <=
    now.getTime()
  ) {
    return "overdue";
  }

  return "due_today";
}
