const TIMEZONE = "Asia/Taipei";

const timeFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: TIMEZONE,

  hour: "2-digit",

  minute: "2-digit",

  hour12: false,
});

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,

  year: "numeric",

  month: "2-digit",

  day: "2-digit",
});

export function formatTaipeiTime(timestamp: number) {
  return timeFormatter.format(new Date(timestamp));
}

export function getTaipeiDateKey(timestamp: number) {
  const parts = dateKeyFormatter.formatToParts(new Date(timestamp));

  const map = new Map(parts.map((part) => [part.type, part.value]));

  return [map.get("year"), map.get("month"), map.get("day")].join("-");
}

function dateKeyToUtcDay(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}

export function getRelationshipDay(timestamp: number, startedAt: string) {
  const today = getTaipeiDateKey(timestamp);

  const difference = dateKeyToUtcDay(today) - dateKeyToUtcDay(startedAt);

  const days = Math.floor(difference / 86_400_000);

  return Math.max(0, days + 1);
}
