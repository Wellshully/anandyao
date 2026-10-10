import type {
  CalendarEvent,
} from "@/features/calendar/types";

export function getCalendarRecurringOccurrenceDate(
  event: Pick<
    CalendarEvent,
    "id" | "source" | "sourceId"
  >,
): string | null {
  if (event.source !== "pet_recurring_schedule") {
    return null;
  }

  const prefix =
    `pet_recurring_schedule:${event.sourceId}:`;

  if (!event.id.startsWith(prefix)) {
    return null;
  }

  const date = event.id.slice(prefix.length);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const timestamp = Date.parse(`${date}T00:00:00Z`);

  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== date
  ) {
    return null;
  }

  return date;
}
