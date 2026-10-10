import Link from "next/link";

import {
  CalendarRecurringCancelControls,
} from "@/features/calendar/components/CalendarRecurringCancelControls";

import {
  CalendarRecurringSeriesEditor,
} from "@/features/calendar/components/CalendarRecurringSeriesEditor";

import type {
  CalendarRecurringSeries,
} from "@/features/calendar/lib/get-calendar-recurring-series";

import {
  CalendarRecurringOccurrenceEditor,
} from "@/features/calendar/components/CalendarRecurringOccurrenceEditor";

import {
  CalendarPetTaskEditor,
} from "@/features/calendar/components/CalendarPetTaskEditor";

import type {
  CalendarEvent,
} from "@/features/calendar/types";

import {
  getCalendarViewHref,
} from "@/features/calendar/lib/calendar-event-navigation";

type Props = {
  event: CalendarEvent;
  month: string;
  view: "month" | "day";
  selectedDate: string;
  recurringSeries: CalendarRecurringSeries | null;
};

const SOURCE_LABELS: Record<
  CalendarEvent["source"],
  string
> = {
  google: "Google Calendar",
  study: "Study",
  date: "Date",
  pet_task: "Pet Task",
  pet_recurring_schedule: "Pet 固定行程",
};

function getTimeLabel(event: CalendarEvent) {
  if (event.allDay) {
    const start = event.startDate ?? "日期未知";
    const end = event.endDate;

    return end && end !== start
      ? `${start} ～ ${end}（全天）`
      : `${start}（全天）`;
  }

  if (!event.startAt) {
    return "未指定時間";
  }

  const formatter = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const start = formatter.format(
    new Date(event.startAt),
  );

  if (!event.endAt || event.endAt === event.startAt) {
    return start;
  }

  const end = formatter.format(
    new Date(event.endAt),
  );

  return `${start} ～ ${end}`;
}

export function CalendarEventDetailPanel({
  event,
  month,
  view,
  selectedDate,
  recurringSeries,
}: Props) {
  const closeHref = getCalendarViewHref({
    month,
    view,
    date: selectedDate,
  });

  return (
    <section
      id="calendar-event-detail"
      aria-label="行程詳情"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-[var(--muted)]">
            行程詳情
          </p>

          <h2 className="mt-1 break-words text-lg font-semibold">
            {event.title}
          </h2>
        </div>

        <Link
          href={closeHref}
          className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
        >
          關閉
        </Link>
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-[var(--muted)]">
            來源
          </dt>
          <dd className="mt-1">
            {SOURCE_LABELS[event.source]}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-[var(--muted)]">
            日期與時間
          </dt>
          <dd className="mt-1">
            {getTimeLabel(event)}
          </dd>
        </div>

        {event.completed ? (
          <div>
            <dt className="text-xs text-[var(--muted)]">
              狀態
            </dt>
            <dd className="mt-1">已完成</dd>
          </div>
        ) : null}
      </dl>

      {event.source === "pet_task" &&
      event.sourceEditable &&
      !event.completed ? (
        <CalendarPetTaskEditor
          key={event.id}
          event={event}
          view={view}
        />
      ) : null}

      {event.source === "pet_recurring_schedule" &&
      event.sourceEditable ? (
        <CalendarRecurringOccurrenceEditor
          key={event.id}
          event={event}
          view={view}
        />
      ) : null}

      {event.source === "pet_recurring_schedule" &&
      recurringSeries ? (
        <CalendarRecurringSeriesEditor
          key={recurringSeries.id}
          series={recurringSeries}
        />
      ) : null}

      {event.source === "pet_recurring_schedule" &&
      event.sourceEditable ? (
        <CalendarRecurringCancelControls
          key={`cancel:${event.id}`}
          event={event}
          view={view}
          seriesTitle={recurringSeries?.title ?? null}
        />
      ) : null}

      {event.href ? (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <Link
            href={event.href}
            className="inline-flex rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium"
          >
            查看原始紀錄 →
          </Link>
        </div>
      ) : null}
    </section>
  );
}
