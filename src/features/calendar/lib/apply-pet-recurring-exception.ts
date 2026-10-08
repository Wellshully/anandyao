import type {
  CalendarRecurringSchedule,
  RecurringOccurrence,
} from "@/features/calendar/lib/expand-pet-recurring-schedule";

export type CalendarRecurringException = {
  schedule_id: string;
  occurrence_date: string;

  kind: string;

  title_override: string | null;

  time_precision_override: string | null;
  start_time_override: string | null;
};

export type ResolvedRecurringOccurrence =
  RecurringOccurrence & {
    title: string;
  };

function makeExactStartAt(
  date: string,
  time: string,
): string {
  const normalizedTime =
    time.length === 5
      ? `${time}:00`
      : time;

  const timestamp = Date.parse(
    `${date}T${normalizedTime}+08:00`,
  );

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      `Invalid recurring exception time: ${time}`,
    );
  }

  return new Date(timestamp).toISOString();
}

export function applyPetRecurringException(
  schedule: CalendarRecurringSchedule,
  occurrence: RecurringOccurrence,
  exception: CalendarRecurringException | null,
): ResolvedRecurringOccurrence | null {
  const original = {
    ...occurrence,
    title: schedule.title,
  };

  if (!exception) {
    return original;
  }

  if (
    exception.schedule_id !== schedule.id ||
    exception.occurrence_date !== occurrence.date
  ) {
    throw new Error(
      "Recurring exception does not match occurrence.",
    );
  }

  if (exception.kind === "cancelled") {
    return null;
  }

  if (exception.kind !== "override") {
    throw new Error(
      `Unknown recurring exception kind: ${exception.kind}`,
    );
  }

  const title =
    exception.title_override ?? schedule.title;

  const precision =
    exception.time_precision_override;

  /*
   * No time override:
   * preserve the original occurrence time.
   */
  if (precision === null) {
    return {
      ...occurrence,
      title,
    };
  }

  /*
   * Override with an exact start time.
   */
  if (precision === "exact") {
    if (!exception.start_time_override) {
      throw new Error(
        "Exact recurring exception requires start time.",
      );
    }

    return {
      date: occurrence.date,
      title,

      startAt: makeExactStartAt(
        occurrence.date,
        exception.start_time_override,
      ),

      allDay: false,
    };
  }

  /*
   * An unspecified time or daypart is
   * displayed as an all-day event.
   */
  if (
    precision === "none" ||
    precision === "daypart"
  ) {
    return {
      date: occurrence.date,
      title,

      startAt: null,
      allDay: true,
    };
  }

  throw new Error(
    `Invalid recurring exception precision: ${precision}`,
  );
}
