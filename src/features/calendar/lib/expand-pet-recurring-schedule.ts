const DAY_MS =
  24 * 60 * 60 * 1000;

const RRULE_DAY_TO_NUMBER: Record<
  string,
  number
> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

export type CalendarRecurringSchedule = {
  id: string;
  title: string;

  recurrence_rule: string;

  recurrence_start_date: string;
  recurrence_end_date: string | null;

  time_precision: string;
  start_time: string | null;

  status: string;
};

export type RecurringOccurrence = {
  date: string;

  startAt: string | null;

  allDay: boolean;
};

function parseDateKey(
  value: string,
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  if (!match) {
    return null;
  }

  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
    ),
  );
}

function formatDateKey(
  date: Date,
) {
  return [
    date.getUTCFullYear(),

    String(
      date.getUTCMonth() + 1,
    ).padStart(
      2,
      "0",
    ),

    String(
      date.getUTCDate(),
    ).padStart(
      2,
      "0",
    ),
  ].join("-");
}

function getMondayStart(
  date: Date,
) {
  const day =
    date.getUTCDay();

  const offset =
    (day + 6) % 7;

  return new Date(
    date.getTime() -
      offset * DAY_MS,
  );
}

function parseWeeklyRule(
  rule: string,
) {
  const parts =
    new Map<string, string>();

  for (
    const rawPart of
      rule.split(";")
  ) {
    const [
      key,
      value,
    ] =
      rawPart.split("=");

    if (
      key &&
      value
    ) {
      parts.set(
        key.toUpperCase(),
        value.toUpperCase(),
      );
    }
  }

  if (
    parts.get("FREQ") !==
    "WEEKLY"
  ) {
    return null;
  }

  const intervalRaw =
    Number(
      parts.get(
        "INTERVAL",
      ) ?? "1",
    );

  const interval =
    Number.isInteger(
      intervalRaw,
    ) &&
    intervalRaw >= 1
      ? intervalRaw
      : 1;

  const weekdays =
    (
      parts.get(
        "BYDAY",
      ) ?? ""
    )
      .split(",")
      .map(
        (value) =>
          value.trim(),
      )
      .filter(
        (
          value,
        ): value is keyof typeof RRULE_DAY_TO_NUMBER =>
          value in
          RRULE_DAY_TO_NUMBER,
      )
      .map(
        (value) =>
          RRULE_DAY_TO_NUMBER[
            value
          ],
      );

  if (
    weekdays.length === 0
  ) {
    return null;
  }

  return {
    interval,

    weekdays:
      new Set(
        weekdays,
      ),
  };
}

function makeExactStartAt(
  date: string,
  time: string,
) {
  const normalizedTime =
    time.length === 5
      ? `${time}:00`
      : time;

  const timestamp =
    Date.parse(
      `${date}T${normalizedTime}+08:00`,
    );

  if (
    Number.isNaN(
      timestamp,
    )
  ) {
    return null;
  }

  return new Date(
    timestamp,
  ).toISOString();
}

export function expandPetRecurringSchedule(
  schedule:
    CalendarRecurringSchedule,
  rangeStartDate: string,
  rangeEndDate: string,
): RecurringOccurrence[] {
  if (
    schedule.status !==
    "active"
  ) {
    return [];
  }

  const rule =
    parseWeeklyRule(
      schedule.recurrence_rule,
    );

  if (!rule) {
    return [];
  }

  const recurrenceStart =
    parseDateKey(
      schedule
        .recurrence_start_date,
    );

  const requestedStart =
    parseDateKey(
      rangeStartDate,
    );

  const requestedEnd =
    parseDateKey(
      rangeEndDate,
    );

  if (
    !recurrenceStart ||
    !requestedStart ||
    !requestedEnd
  ) {
    return [];
  }

  const recurrenceEnd =
    schedule
      .recurrence_end_date
      ? parseDateKey(
          schedule
            .recurrence_end_date,
        )
      : null;

  const startTimestamp =
    Math.max(
      recurrenceStart.getTime(),
      requestedStart.getTime(),
    );

  const endTimestamp =
    Math.min(
      requestedEnd.getTime(),

      recurrenceEnd
        ? recurrenceEnd.getTime()
        : Number.MAX_SAFE_INTEGER,
    );

  if (
    startTimestamp >
    endTimestamp
  ) {
    return [];
  }

  /*
   * INTERVAL=2 needs a stable week anchor.
   *
   * recurrence_start_date determines which
   * week is "week zero".
   */
  const anchorWeek =
    getMondayStart(
      recurrenceStart,
    );

  const occurrences:
    RecurringOccurrence[] =
      [];

  for (
    let timestamp =
      startTimestamp;
    timestamp <=
    endTimestamp;
    timestamp +=
      DAY_MS
  ) {
    const candidate =
      new Date(
        timestamp,
      );

    if (
      !rule.weekdays.has(
        candidate.getUTCDay(),
      )
    ) {
      continue;
    }

    const candidateWeek =
      getMondayStart(
        candidate,
      );

    const weekDifference =
      Math.floor(
        (
          candidateWeek.getTime() -
          anchorWeek.getTime()
        ) /
          (
            DAY_MS *
            7
          ),
      );

    if (
      weekDifference < 0 ||
      weekDifference %
        rule.interval !==
        0
    ) {
      continue;
    }

    const date =
      formatDateKey(
        candidate,
      );

    /*
     * Only exact time means Calendar
     * should render a timed occurrence.
     *
     * none / daypart remain all-day
     * until the user gives an exact time.
     */
    if (
      schedule.time_precision ===
        "exact" &&
      schedule.start_time
    ) {
      const startAt =
        makeExactStartAt(
          date,
          schedule.start_time,
        );

      if (!startAt) {
        continue;
      }

      occurrences.push({
        date,
        startAt,
        allDay:
          false,
      });

      continue;
    }

    occurrences.push({
      date,
      startAt:
        null,
      allDay:
        true,
    });
  }

  return occurrences;
}
