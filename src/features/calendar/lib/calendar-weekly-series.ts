export const WEEKDAYS = [
  "MO", "TU", "WE", "TH", "FR", "SA", "SU",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type WeeklyRule = {
  interval: number;
  days: Weekday[];
};

export function parseCalendarWeeklyRule(
  rule: string,
): WeeklyRule | null {
  const fields = new Map<string, string>();

  for (const part of rule.split(";")) {
    const pieces = part.split("=");

    if (pieces.length !== 2) return null;

    const [key, value] = pieces;

    if (
      !["FREQ", "INTERVAL", "BYDAY"].includes(key) ||
      fields.has(key)
    ) {
      return null;
    }

    fields.set(key, value);
  }

  if (fields.get("FREQ") !== "WEEKLY") return null;

  const interval = Number(fields.get("INTERVAL") ?? "1");

  if (
    !Number.isInteger(interval) ||
    interval < 1 ||
    interval > 12
  ) {
    return null;
  }

  const rawDays = fields.get("BYDAY")?.split(",") ?? [];

  if (
    rawDays.length === 0 ||
    rawDays.some((day) => !WEEKDAYS.includes(day as Weekday))
  ) {
    return null;
  }

  const days = WEEKDAYS.filter((day) => rawDays.includes(day));

  if (days.length !== rawDays.length) return null;

  return { interval, days: [...days] };
}

export function buildCalendarWeeklyRule(input: WeeklyRule): string {
  if (
    !Number.isInteger(input.interval) ||
    input.interval < 1 ||
    input.interval > 12
  ) {
    throw new Error("重複間隔必須介於 1 至 12 週。");
  }

  const days = WEEKDAYS.filter((day) =>
    input.days.includes(day),
  );

  if (
    days.length === 0 ||
    days.length !== input.days.length
  ) {
    throw new Error("請選擇有效且不重複的星期。");
  }

  return `FREQ=WEEKLY;INTERVAL=${input.interval};BYDAY=${days.join(",")}`;
}

const DAY_NAMES: Record<Weekday, string> = {
  MO: "一",
  TU: "二",
  WE: "三",
  TH: "四",
  FR: "五",
  SA: "六",
  SU: "日",
};

export function describeCalendarWeeklyRule(
  input: WeeklyRule,
  precision: "none" | "daypart" | "exact",
  time: string | null,
  previousDaypartExpression?: string | null,
): string {
  const prefix = input.interval === 1
    ? "每週"
    : `每 ${input.interval} 週`;

  const days = WEEKDAYS
    .filter((day) => input.days.includes(day))
    .map((day) => `週${DAY_NAMES[day]}`)
    .join("、");

  const suffix = precision === "exact" && time
    ? ` ${time}`
    : precision === "daypart"
      ? ` ${previousDaypartExpression?.match(/早上|上午|中午|下午|傍晚|晚上|夜間/)?.[0] ?? "原本時段"}`
      : "";

  return `${prefix}${days}${suffix}`;
}
