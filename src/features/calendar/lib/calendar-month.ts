const DAY_MS =
  24 * 60 * 60 * 1000;

function parseDateKey(
  value: string,
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  if (!match) {
    throw new Error(
      `Invalid date key: ${value}`,
    );
  }

  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
    ),
  );
}

export function formatDateKey(
  date: Date,
) {
  return [
    date.getUTCFullYear(),

    String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0"),

    String(
      date.getUTCDate(),
    ).padStart(2, "0"),
  ].join("-");
}

export function normalizeCalendarMonth(
  value: string | undefined,
  now = new Date(),
) {
  if (
    value &&
    /^\d{4}-\d{2}$/.test(value)
  ) {
    const [
      year,
      month,
    ] = value
      .split("-")
      .map(Number);

    if (
      year >= 2000 &&
      year <= 2100 &&
      month >= 1 &&
      month <= 12
    ) {
      return value;
    }
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Taipei",
        year:
          "numeric",
        month:
          "2-digit",
      },
    ).formatToParts(now);

  const year =
    parts.find(
      (part) =>
        part.type === "year",
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month",
    )?.value;

  if (!year || !month) {
    throw new Error(
      "Failed to resolve current month.",
    );
  }

  return `${year}-${month}`;
}

export function getAdjacentMonth(
  monthKey: string,
  offset: number,
) {
  const [
    year,
    month,
  ] = monthKey
    .split("-")
    .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1 + offset,
        1,
      ),
    );

  return [
    date.getUTCFullYear(),

    String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0"),
  ].join("-");
}

export function getCalendarMonthGrid(
  monthKey: string,
) {
  const [
    year,
    month,
  ] = monthKey
    .split("-")
    .map(Number);

  const firstDay =
    new Date(
      Date.UTC(
        year,
        month - 1,
        1,
      ),
    );

  /*
   * Sunday = 0.
   */
  const leadingDays =
    firstDay.getUTCDay();

  const gridStart =
    new Date(
      firstDay.getTime() -
        leadingDays *
          DAY_MS,
    );

  const days =
    Array.from(
      {
        length: 42,
      },
      (_, index) => {
        const date =
          new Date(
            gridStart.getTime() +
              index *
                DAY_MS,
          );

        return {
          date:
            formatDateKey(
              date,
            ),

          day:
            date.getUTCDate(),

          inCurrentMonth:
            date.getUTCMonth() ===
            month - 1,
        };
      },
    );

  return {
    days,

    startDate:
      days[0].date,

    endDate:
      days[
        days.length - 1
      ].date,
  };
}

export function getDateKeysBetween(
  startDate: string,
  endDate: string,
) {
  const start =
    parseDateKey(
      startDate,
    );

  const end =
    parseDateKey(
      endDate,
    );

  const result:
    string[] = [];

  for (
    let timestamp =
      start.getTime();
    timestamp <=
    end.getTime();
    timestamp += DAY_MS
  ) {
    result.push(
      formatDateKey(
        new Date(timestamp),
      ),
    );
  }

  return result;
}
