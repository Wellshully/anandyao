import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import { requireUser } from "@/lib/auth/require-user";

import { getTaipeiDateKey } from "@/lib/time/taipei-time";

import { calculateItinerarySchedule } from "@/features/dates/lib/calculate-itinerary-schedule";

import type { TodayItem } from "@/features/today/types";

function buildTimestamp(date: string, time: string) {
  return new Date(`${date}T${time}+08:00`).getTime();
}

function dayStartTimestamp(date: string) {
  return new Date(`${date}T00:00:00+08:00`).getTime();
}

export async function getTodayOverview(): Promise<TodayItem[]> {
  const [supabase, space, user] = await Promise.all([
    createClient(),
    requireSpace(),
    requireUser(),
  ]);

  const today = getTaipeiDateKey(Date.now());

  const [plansResult, daysResult] = await Promise.all([
    supabase
      .from("personal_plans")
      .select("*")
      .eq("space_id", space.id)
      .eq("user_id", user.id)
      .eq("plan_date", today),

    supabase
      .from("date_days")
      .select("*")
      .eq("space_id", space.id)
      .eq("date", today),
  ]);

  if (plansResult.error) {
    throw new Error(
      `Failed to load personal plans: ${plansResult.error.message}`,
    );
  }

  if (daysResult.error) {
    throw new Error(
      `Failed to load today's date days: ${daysResult.error.message}`,
    );
  }

  const personalItems: TodayItem[] = plansResult.data.map((plan) => {
    const startAt = plan.start_time
      ? buildTimestamp(plan.plan_date, plan.start_time.slice(0, 8))
      : null;

    const endAt =
      startAt !== null ? startAt + plan.duration_minutes * 60_000 : null;

    return {
      id: plan.id,

      kind: "personal",

      title: plan.title,

      subtitle: "自己的計畫",

      startAt,

      endAt,

      href: null,

      completed: Boolean(plan.completed_at),
    };
  });

  if (daysResult.data.length === 0) {
    return sortTodayItems(personalItems);
  }

  const dateIds = Array.from(
    new Set(daysResult.data.map((day) => day.date_id)),
  );

  const { data: dates, error: datesError } = await supabase
    .from("dates")
    .select("id, title, status")
    .in("id", dateIds)
    .eq("space_id", space.id)
    .eq("status", "accepted");

  if (datesError) {
    throw new Error(`Failed to load today's dates: ${datesError.message}`);
  }

  if (dates.length === 0) {
    return sortTodayItems(personalItems);
  }

  const acceptedDateMap = new Map(dates.map((date) => [date.id, date]));

  const acceptedDays = daysResult.data.filter((day) =>
    acceptedDateMap.has(day.date_id),
  );

  if (acceptedDays.length === 0) {
    return sortTodayItems(personalItems);
  }

  const dayIds = acceptedDays.map((day) => day.id);

  const { data: itineraryItems, error: itineraryError } = await supabase
    .from("date_itinerary_items")
    .select("*")
    .eq("space_id", space.id)
    .in("date_day_id", dayIds)
    .order("sort_order", {
      ascending: true,
    });

  if (itineraryError) {
    throw new Error(
      `Failed to load today's itinerary: ${itineraryError.message}`,
    );
  }

  const dateItems: TodayItem[] = [];

  for (const day of acceptedDays) {
    const date = acceptedDateMap.get(day.date_id);

    if (!date) {
      continue;
    }

    const items = itineraryItems.filter((item) => item.date_day_id === day.id);

    const scheduled = calculateItinerarySchedule(
      day.planning_start_time,
      items,
    );

    const dayStart = dayStartTimestamp(day.date);

    for (const scheduledItem of scheduled) {
      dateItems.push({
        id: scheduledItem.item.id,

        kind: "date",

        title: scheduledItem.item.title,

        subtitle: date.title,

        startAt: dayStart + scheduledItem.startMinutes * 60_000,

        endAt: dayStart + scheduledItem.endMinutes * 60_000,

        href: `/dates/${date.id}`,

        completed: false,
      });
    }
  }

  return sortTodayItems([...personalItems, ...dateItems]);
}

function sortTodayItems(items: TodayItem[]) {
  return [...items].sort((a, b) => {
    if (a.startAt === null && b.startAt === null) {
      return a.title.localeCompare(b.title);
    }

    if (a.startAt === null) {
      return 1;
    }

    if (b.startAt === null) {
      return -1;
    }

    return a.startAt - b.startAt;
  });
}
