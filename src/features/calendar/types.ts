export type CalendarEventSource =
  | "google"
  | "study"
  | "date"
  | "pet_task"
  | "pet_recurring_schedule";

export type CalendarEventKind =
  | "event"
  | "deadline"
  | "task";

export type CalendarEvent = {
  /*
   * Globally unique inside the Calendar UI.
   *
   * Examples:
   * study:<uuid>
   * pet_task:<uuid>
   * date:<uuid>
   * google:<calendarId>:<eventId>
   */
  id: string;

  source: CalendarEventSource;
  sourceId: string;

  title: string;

  /*
   * ISO timestamp for timed events.
   *
   * For all-day events, startDate / endDate
   * are used instead.
   */
  startAt: string | null;
  endAt: string | null;

  startDate: string | null;
  endDate: string | null;

  allDay: boolean;

  kind: CalendarEventKind;

  /*
   * Completed / submitted state where
   * the source supports it.
   */
  completed: boolean;

  /*
   * Whether the original source itself
   * may be edited from Calendar.
   *
   * Calendar notes are handled separately.
   */
  sourceEditable: boolean;

  href: string | null;
};

export type CalendarEventDetail = CalendarEvent & {
  sourceLabel: string;

  sourceNote: string | null;
  calendarNote: string | null;

  metadata: {
    courseName?: string;
    temporalKind?: string;
    timePrecision?: string;
    googleCalendarName?: string;
  };
};
