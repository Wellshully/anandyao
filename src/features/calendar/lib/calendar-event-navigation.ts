export type CalendarViewLocation = {
  month: string;
  view: "month" | "day";
  date: string;
  eventId?: string;
};

export function getCalendarViewHref({
  month,
  view,
  date,
  eventId,
}: CalendarViewLocation): string {
  const params = new URLSearchParams({
    month,
    view,
    date,
  });

  if (eventId) {
    params.set("event", eventId);
  }

  return `/calendar?${params.toString()}`;
}
