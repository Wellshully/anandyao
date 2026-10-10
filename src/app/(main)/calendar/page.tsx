import {
  getCalendarEvents,
} from "@/features/calendar/lib/get-calendar-events";

import {
  getCalendarMonthGrid,
  normalizeCalendarMonth,
} from "@/features/calendar/lib/calendar-month";

import {
  CalendarMonthView,
} from "@/features/calendar/components/CalendarMonthView";

import {
  CalendarEventDetailPanel,
} from "@/features/calendar/components/CalendarEventDetailPanel";

import {
  getCalendarRecurringSeries,
} from "@/features/calendar/lib/get-calendar-recurring-series";

import {
  getGoogleCalendarConnection,
} from "@/features/calendar/google/get-google-calendar-connection";

export const dynamic =
  "force-dynamic";

type CalendarPageProps = {
  searchParams:
    Promise<{
      month?: string;
      google?: string;
      view?: string;
      date?: string;
       event?: string;
    }>;
};

function getTodayKey() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(
      new Date(),
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
    throw new Error(
      "Failed to resolve today.",
    );
  }

  return `${year}-${month}-${day}`;
}

function isValidDateKey(
  value: string | undefined,
): value is string {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return false;
  }

  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(Number);

  const parsed =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  return (
    parsed.getUTCFullYear() ===
      year &&
    parsed.getUTCMonth() ===
      month - 1 &&
    parsed.getUTCDate() ===
      day
  );
}

function getGoogleMessage(
  status: string | undefined,
) {
  switch (status) {
    case "connected":
      return "Google Calendar 已成功連結。";

    case "denied":
      return "Google Calendar 授權已取消。";

    case "invalid_state":
      return "Google Calendar 授權驗證失敗，請重新連結。";

    case "token_error":
      return "無法取得 Google Calendar 授權，請重新連結。";

    case "calendar_error":
      return "無法讀取 Google Calendar。";

    case "refresh_token_missing":
      return "Google 沒有提供長期授權，請重新連結。";

    default:
      return null;
  }
}

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const params =
    await searchParams;

  const today =
    getTodayKey();

  const view:
    "month" | "day" =
    params.view === "day"
      ? "day"
      : "month";

  const requestedMonth =
    normalizeCalendarMonth(
      params.month,
    );

  const selectedDate =
    isValidDateKey(
      params.date,
    )
      ? params.date
      : requestedMonth ===
          today.slice(
            0,
            7,
          )
        ? today
        : `${requestedMonth}-01`;

  const month =
    view === "day"
      ? selectedDate.slice(
          0,
          7,
        )
      : requestedMonth;

  const grid =
    getCalendarMonthGrid(
      month,
    );

  const [
    events,
    googleConnection,
  ] =
    await Promise.all([
      getCalendarEvents({
        startDate:
          grid.startDate,

        endDate:
          grid.endDate,
      }),

      getGoogleCalendarConnection(),
    ]);

  const googleMessage =
    getGoogleMessage(
      params.google,
    );

  const selectedEvent = params.event
    ? events.find((event) => event.id === params.event) ?? null
    : null;

  const selectedRecurringSeries =
    selectedEvent?.source === "pet_recurring_schedule"
      ? await getCalendarRecurringSeries(selectedEvent.sourceId)
      : null;

  return (
    <main
      className="
        space-y-3
      "
    >
      {googleMessage ? (
        <div
          className="
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-3
            py-2
            text-xs
          "
        >
          {googleMessage}
        </div>
      ) : null}



      {selectedEvent ? (
        <CalendarEventDetailPanel
          event={selectedEvent}
          month={month}
          view={view}
          selectedDate={selectedDate}
          recurringSeries={selectedRecurringSeries}
        />
      ) : null}

      <CalendarMonthView
        month={
          month
        }
        today={
          today
        }
        events={
          events
        }
        view={
          view
        }
        selectedDate={
          selectedDate
        }
        googleConnected={
          googleConnection.connected
        }
        googleCalendarSummary={
          googleConnection.calendarSummary
        }
      />
    </main>
  );
}
