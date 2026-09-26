import "server-only";

import { siteConfig } from "@/config/site";

import { getDate } from "@/features/dates/lib/get-date";
import { getDates } from "@/features/dates/lib/get-dates";

import type { PetDateContextItem, PetDatesContext } from "../types";

const MAX_PAST_DATES = 3;
const MAX_UPCOMING_DATES = 5;

function getTodayKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: siteConfig.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to calculate current date.");
  }

  return `${year}-${month}-${day}`;
}

function getTemporalStatus(
  startDate: string,
  endDate: string,
  today: string,
): PetDateContextItem["temporalStatus"] {
  if (endDate < today) {
    return "past";
  }

  if (startDate > today) {
    return "upcoming";
  }

  return "current";
}

export async function getPetDatesContext(): Promise<PetDatesContext> {
  const dates = await getDates();
  const today = getTodayKey();

  if (dates.length === 0) {
    return {
      currentDate: today,
      timeZone: siteConfig.timeZone,
      total: 0,
      items: [],
    };
  }

  const past = dates
    .filter(({ date }) => date.end_date < today)
    .sort((a, b) => b.date.end_date.localeCompare(a.date.end_date))
    .slice(0, MAX_PAST_DATES);

  const currentAndUpcoming = dates
    .filter(({ date }) => date.end_date >= today)
    .sort((a, b) => a.date.start_date.localeCompare(b.date.start_date))
    .slice(0, MAX_UPCOMING_DATES);

  const selected = [...past, ...currentAndUpcoming];

  const details = await Promise.all(
    selected.map(({ date }) => getDate(date.id)),
  );

  const items: PetDateContextItem[] = details
    .filter((detail): detail is NonNullable<typeof detail> => detail !== null)
    .map((detail) => ({
      title: detail.date.title,
      description: detail.date.description,
      kind: detail.date.kind,
      status: detail.date.status,

      startDate: detail.date.start_date,
      endDate: detail.date.end_date,

      temporalStatus: getTemporalStatus(
        detail.date.start_date,
        detail.date.end_date,
        today,
      ),

      participants: detail.participants.map(
        (participant) => participant.displayName,
      ),

      days: detail.days.map(({ day, items }) => ({
        date: day.date,
        dayNumber: day.day_number,
        title: day.title,
        note: day.note,

        items: items.map((item) => ({
          type: item.item_type,
          title: item.title,
          description: item.description,
          locationName: item.location_name,
          address: item.address,
          fixedStartTime: item.fixed_start_time,
        })),
      })),
    }));

  return {
    currentDate: today,
    timeZone: siteConfig.timeZone,
    total: dates.length,
    items,
  };
}
