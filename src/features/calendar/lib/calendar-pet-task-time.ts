export function resolveCalendarPetTaskTime(
  date: string,
  time: string,
) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    throw new Error("日期格式不正確。");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = new Date(
    `${date}T12:00:00+08:00`,
  );

  const valid =
    Number.isFinite(parsed.getTime()) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day;

  if (!valid) {
    throw new Error("日期不存在。");
  }

  if (time === "") {
    return {
      dueAt: new Date(
        `${date}T23:59:59+08:00`,
      ).toISOString(),
      timePrecision: "date" as const,
      dueHasTime: false,
    };
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error("時間格式不正確。");
  }

  return {
    dueAt: new Date(
      `${date}T${time}:00+08:00`,
    ).toISOString(),
    timePrecision: "exact" as const,
    dueHasTime: true,
  };
}
