import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import { requireUser } from "@/lib/auth/require-user";

import { getTaipeiDateKey } from "@/lib/time/taipei-time";

import { calculateItinerarySchedule } from "@/features/dates/lib/calculate-itinerary-schedule";

import type { TodayItem } from "@/features/today/types";
import { ensureStudyFresh } from "@/features/study/lib/ensure-study-fresh";
function buildTimestamp(date: string, time: string) {
  return new Date(`${date}T${time}+08:00`).getTime();
}

function dayStartTimestamp(date: string) {
  return new Date(`${date}T00:00:00+08:00`).getTime();
}

function getStudyWindow(today: string) {
  const start = new Date(`${today}T00:00:00+08:00`).getTime();

  /*
   * Today + the following 7 days.
   *
   * Example:
   * 9/24 → through 10/1 23:59:59.999
   */
  const end = start + 8 * 24 * 60 * 60 * 1000 - 1;

  return {
    startIso: new Date(start).toISOString(),

    endIso: new Date(end).toISOString(),
  };
}

async function getStudyReminderItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  today: string,
): Promise<TodayItem[]> {
  const { startIso, endIso } = getStudyWindow(today);

  const [assignmentsResult, announcementsResult, mailResult] =
    await Promise.all([
      supabase
        .from("study_assignments")
        .select(
          `
            id,
            title,
            course_name,
            due_at
          `,
        )
        .eq("user_id", userId)
        .eq("submitted", false)
        .not("due_at", "is", null)
        .gte("due_at", startIso)
        .lte("due_at", endIso)
        .order("due_at", {
          ascending: true,
        }),

      supabase
        .from("study_announcements")
        .select("id", {
          count: "exact",

          head: true,
        })
        .eq("user_id", userId)
        .is("seen_at", null),

      supabase
        .from("study_mail_messages")
        .select("id", {
          count: "exact",

          head: true,
        })
        .eq("user_id", userId)
        .is("seen_at", null)
        .not("subject", "like", "「校內訊息」%"),
    ]);

  /*
   * Study reminders should never make
   * the whole Today panel unavailable.
   */
  if (assignmentsResult.error) {
    console.warn(
      "Failed to load Study assignments:",
      assignmentsResult.error.message,
    );
  }

  if (announcementsResult.error) {
    console.warn(
      "Failed to load Study announcements:",
      announcementsResult.error.message,
    );
  }

  if (mailResult.error) {
    console.warn("Failed to load Study mail:", mailResult.error.message);
  }

  const items: TodayItem[] = [];

  if (!assignmentsResult.error) {
    for (const assignment of assignmentsResult.data ?? []) {
      if (!assignment.due_at) {
        continue;
      }

      const dueAt = new Date(assignment.due_at).getTime();

      items.push({
        id: assignment.id,

        kind: "study_assignment",

        title: assignment.title,

        subtitle: assignment.course_name ?? "NTU COOL",

        startAt: dueAt,

        endAt: dueAt,

        href: `/study/assignments/${assignment.id}`,

        completed: false,
      });
    }
  }

  const announcementCount = announcementsResult.error
    ? 0
    : (announcementsResult.count ?? 0);

  if (announcementCount > 0) {
    items.push({
      id: "study-announcements",

      kind: "study_announcement",

      title: `有 ${announcementCount} 則新公告`,

      subtitle: "NTU COOL",

      startAt: null,

      endAt: null,

      href: "/study?tab=announcements",

      completed: false,
    });
  }

  const mailCount = mailResult.error ? 0 : (mailResult.count ?? 0);

  if (mailCount > 0) {
    items.push({
      id: "study-mail",

      kind: "study_mail",

      title: `有 ${mailCount} 封新信`,

      subtitle: "NTU Mail",

      startAt: null,

      endAt: null,

      href: "/study/inbox",

      completed: false,
    });
  }

  return items;
}

export async function getTodayOverview(): Promise<TodayItem[]> {
  await ensureStudyFresh();
  const [supabase, space, user] = await Promise.all([
    createClient(),
    requireSpace(),
    requireUser(),
  ]);

  const today = getTaipeiDateKey(Date.now());

  const [plansResult, daysResult, studyItems] = await Promise.all([
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

    getStudyReminderItems(supabase, user.id, today),
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

  const dateItems: TodayItem[] = [];

  if (daysResult.data.length > 0) {
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

    if (dates.length > 0) {
      const acceptedDateMap = new Map(dates.map((date) => [date.id, date]));

      const acceptedDays = daysResult.data.filter((day) =>
        acceptedDateMap.has(day.date_id),
      );

      if (acceptedDays.length > 0) {
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

        for (const day of acceptedDays) {
          const date = acceptedDateMap.get(day.date_id);

          if (!date) {
            continue;
          }

          const items = itineraryItems.filter(
            (item) => item.date_day_id === day.id,
          );

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
      }
    }
  }

  return sortTodayItems([...personalItems, ...dateItems, ...studyItems]);
}

function sortTodayItems(items: TodayItem[]) {
  return [...items].sort((a, b) => {
    if (a.startAt === null && b.startAt === null) {
      return a.title.localeCompare(b.title, "zh-TW");
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
