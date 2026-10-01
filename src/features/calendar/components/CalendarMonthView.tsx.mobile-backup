import Link from "next/link";

import type {
  CalendarEvent,
} from "@/features/calendar/types";

import {
  getAdjacentMonth,
  getCalendarMonthGrid,
  getDateKeysBetween,
} from "@/features/calendar/lib/calendar-month";

type CalendarMonthViewProps = {
  month: string;

  today: string;

  events:
    CalendarEvent[];
};

const WEEKDAYS = [
  "日",
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
];

function getTaipeiDateFromIso(
  value: string,
) {
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

        day:
          "2-digit",
      },
    ).formatToParts(
      new Date(value),
    );

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

  const day =
    parts.find(
      (part) =>
        part.type === "day",
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function getEventTimeLabel(
  event: CalendarEvent,
) {
  if (
    event.allDay ||
    !event.startAt
  ) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "zh-TW",
    {
      timeZone:
        "Asia/Taipei",

      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        false,
    },
  ).format(
    new Date(
      event.startAt,
    ),
  );
}

function groupEventsByDate(
  events: CalendarEvent[],
) {
  const result =
    new Map<
      string,
      CalendarEvent[]
    >();

  const push = (
    date: string,
    event: CalendarEvent,
  ) => {
    const current =
      result.get(date) ??
      [];

    current.push(event);

    result.set(
      date,
      current,
    );
  };

  for (
    const event of events
  ) {
    /*
     * all-day / multi-day event.
     */
    if (
      event.startDate
    ) {
      const endDate =
        event.endDate ??
        event.startDate;

      for (
        const date of
          getDateKeysBetween(
            event.startDate,
            endDate,
          )
      ) {
        push(
          date,
          event,
        );
      }

      continue;
    }

    /*
     * Timed event.
     */
    if (
      event.startAt
    ) {
      const date =
        getTaipeiDateFromIso(
          event.startAt,
        );

      if (date) {
        push(
          date,
          event,
        );
      }
    }
  }

  for (
    const [
      date,
      items,
    ] of result
  ) {
    result.set(
      date,
      items.sort(
        (a, b) => {
          if (
            a.allDay &&
            !b.allDay
          ) {
            return -1;
          }

          if (
            !a.allDay &&
            b.allDay
          ) {
            return 1;
          }

          if (
            a.startAt &&
            b.startAt
          ) {
            return (
              new Date(
                a.startAt,
              ).getTime() -
              new Date(
                b.startAt,
              ).getTime()
            );
          }

          return a.title.localeCompare(
            b.title,
            "zh-TW",
          );
        },
      ),
    );
  }

  return result;
}

function getMonthTitle(
  month: string,
) {
  const [
    year,
    monthNumber,
  ] = month
    .split("-")
    .map(Number);

  return `${year} 年 ${monthNumber} 月`;
}

export function CalendarMonthView({
  month,
  today,
  events,
}: CalendarMonthViewProps) {
  const grid =
    getCalendarMonthGrid(
      month,
    );

  const eventsByDate =
    groupEventsByDate(
      events,
    );

  const previousMonth =
    getAdjacentMonth(
      month,
      -1,
    );

  const nextMonth =
    getAdjacentMonth(
      month,
      1,
    );

  const currentMonth =
    today.slice(
      0,
      7,
    );

  return (
    <section>
      <div
        className="
          mb-6
          flex
          flex-wrap
          items-center
          justify-between
          gap-4
        "
      >
        <div>
          <p
            className="
              text-sm
              text-[var(--muted)]
            "
          >
            Calendar
          </p>

          <h1
            className="
              mt-1
              text-3xl
              font-semibold
            "
          >
            {getMonthTitle(
              month,
            )}
          </h1>
        </div>

        <nav
          className="
            flex
            items-center
            gap-2
          "
        >
          <Link
            href={
              `/calendar?month=${previousMonth}`
            }
            className="
              rounded-xl
              border
              border-[var(--border)]
              px-3
              py-2
              text-sm
              transition
              hover:bg-[var(--surface)]
            "
          >
            ←
          </Link>

          <Link
            href={
              `/calendar?month=${currentMonth}`
            }
            className="
              rounded-xl
              border
              border-[var(--border)]
              px-4
              py-2
              text-sm
              transition
              hover:bg-[var(--surface)]
            "
          >
            今天
          </Link>

          <Link
            href={
              `/calendar?month=${nextMonth}`
            }
            className="
              rounded-xl
              border
              border-[var(--border)]
              px-3
              py-2
              text-sm
              transition
              hover:bg-[var(--surface)]
            "
          >
            →
          </Link>
        </nav>
      </div>

      <div
        className="
          overflow-hidden
          rounded-2xl
          border
          border-[var(--border)]
        "
      >
        <div
          className="
            grid
            grid-cols-7
            border-b
            border-[var(--border)]
            bg-[var(--surface)]
          "
        >
          {WEEKDAYS.map(
            (weekday) => (
              <div
                key={
                  weekday
                }
                className="
                  px-2
                  py-3
                  text-center
                  text-xs
                  font-medium
                  text-[var(--muted)]
                "
              >
                {weekday}
              </div>
            ),
          )}
        </div>

        <div
          className="
            grid
            grid-cols-7
          "
        >
          {grid.days.map(
            (
              day,
              index,
            ) => {
              const dayEvents =
                eventsByDate.get(
                  day.date,
                ) ?? [];

              const isToday =
                day.date ===
                today;

              return (
                <div
                  key={
                    day.date
                  }
                  className={`
                    min-h-32
                    border-[var(--border)]
                    p-2
                    sm:min-h-40
                    sm:p-3

                    ${
                      index %
                        7 !==
                      6
                        ? "border-r"
                        : ""
                    }

                    ${
                      index <
                      35
                        ? "border-b"
                        : ""
                    }

                    ${
                      day.inCurrentMonth
                        ? ""
                        : "opacity-40"
                    }
                  `}
                >
                  <div
                    className="
                      mb-2
                      flex
                      justify-end
                    "
                  >
                    <span
                      className={`
                        flex
                        h-7
                        w-7
                        items-center
                        justify-center
                        rounded-full
                        text-sm

                        ${
                          isToday
                            ? "bg-[var(--foreground)] text-[var(--background)]"
                            : ""
                        }
                      `}
                    >
                      {
                        day.day
                      }
                    </span>
                  </div>

                  <div
                    className="
                      space-y-1
                    "
                  >
                    {dayEvents
                      .slice(
                        0,
                        4,
                      )
                      .map(
                        (
                          event,
                        ) => {
                          const time =
                            getEventTimeLabel(
                              event,
                            );

                          return (
                            <div
                              key={
                                event.id
                              }
                              className="
                                overflow-hidden
                                rounded-lg
                                bg-[var(--surface)]
                                px-2
                                py-1.5
                                text-xs
                              "
                            >
                              {time ? (
                                <span
                                  className="
                                    mr-1
                                    text-[var(--muted)]
                                  "
                                >
                                  {
                                    time
                                  }
                                </span>
                              ) : null}

                              <span
                                className="
                                  font-medium
                                "
                              >
                                {
                                  event.title
                                }
                              </span>
                            </div>
                          );
                        },
                      )}

                    {dayEvents.length >
                    4 ? (
                      <p
                        className="
                          px-1
                          text-xs
                          text-[var(--muted)]
                        "
                      >
                        +
                        {dayEvents.length -
                          4}{" "}
                        件
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            },
          )}
        </div>
      </div>
    </section>
  );
}
