import { siteConfig } from "@/config/site";

export function isBirthday(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: siteConfig.timeZone,
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const month = Number(parts.find((part) => part.type === "month")?.value);

  const day = Number(parts.find((part) => part.type === "day")?.value);

  return month === siteConfig.birthday.month && day === siteConfig.birthday.day;
}
