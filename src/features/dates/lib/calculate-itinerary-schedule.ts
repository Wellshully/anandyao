import type { DateItineraryItem } from "@/features/dates/types";

export type ScheduledItineraryItem = {
  item: DateItineraryItem;

  startMinutes: number;
  endMinutes: number;

  displayStartTime: string;

  hasConflict: boolean;
};

function parseTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);

  return hour * 60 + minute;
}

function formatTime(totalMinutes: number) {
  const dayOffset = Math.floor(totalMinutes / (24 * 60));

  const normalized = totalMinutes % (24 * 60);

  const hour = Math.floor(normalized / 60);

  const minute = normalized % 60;

  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0",
  )}`;

  if (dayOffset <= 0) {
    return time;
  }

  return `+${dayOffset}日 ${time}`;
}

export function calculateItinerarySchedule(
  planningStartTime: string,
  items: DateItineraryItem[],
): ScheduledItineraryItem[] {
  let cursor = parseTime(planningStartTime);

  return items.map((item) => {
    if (item.timing_type === "fixed" && item.fixed_start_time) {
      const fixedStart = parseTime(item.fixed_start_time);

      const hasConflict = fixedStart < cursor;

      const end = fixedStart + item.duration_minutes;

      cursor = Math.max(cursor, end);

      return {
        item,

        startMinutes: fixedStart,

        endMinutes: end,

        displayStartTime: formatTime(fixedStart),

        hasConflict,
      };
    }

    const start = cursor;

    const end = start + item.duration_minutes;

    cursor = end;

    return {
      item,

      startMinutes: start,

      endMinutes: end,

      displayStartTime: formatTime(start),

      hasConflict: false,
    };
  });
}
