import "server-only";

import { getDates } from "@/features/dates/lib/get-dates";
import { getCalendarEvents } from "@/features/calendar/lib/get-calendar-events";
import type { CalendarEvent } from "@/features/calendar/types";
import { getLatestPetDailyReport } from "@/features/pet/report/get-latest-report";
import { getCurrentProfile } from "@/features/profile/lib/get-current-profile";
import { getTodayOverview } from "@/features/today/lib/get-today-overview";
import { getStudyAssignmentCutoffIso } from "@/features/study/lib/study-assignment-visibility";

import type { TodayItem } from "@/features/today/types";

import { requireSpace } from "@/lib/space/require-space";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { getTaipeiDateKey } from "@/lib/time/taipei-time";

import {
  isHomeAttentionDeadline,
  getHomePetTaskDeadline,
} from "@/features/home/lib/home-attention-deadline";

const DAY_MS = 24 * 60 * 60 * 1000;

export type HomeUrgentItem = {
  id: string;
  kind:
    | "study_due_soon"
    | "pet_task_due_soon";
  title: string;
  subtitle: string;
  href: string;
  timestamp: number | null;
};

export type HomePetTask = {
  id: string;
  title: string;
  note: string | null;
  dueAt: string | null;
  dueHasTime: boolean;
  createdAt: string;
};

export type HomeDateSummary = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  startDate: string;
  endDate: string;
};

export type HomeDailyReportSummary = {
  id: string;
  reportDate: string;
  content: string;
  createdAt: string;
};

export type HomeScheduleItem = {
  id: string;

  kind:
    | "date"
    | "personal"
    | "study"
    | "google_calendar"
    | "pet_task"
    | "pet_recurring_schedule";

  title: string;
  subtitle: string | null;

  startAt: number | null;
  endAt: number | null;

  timing:
    | "event"
    | "deadline"
    | "untimed";

  href: string | null;
  completed: boolean;
};

export type HomeDashboard = {
  now: number;
  today: string;

  profile: {
    displayName: string;
  };

  nextUp: HomeScheduleItem | null;

  todayUntimed: HomeScheduleItem[];

  urgent: HomeUrgentItem[];

  todayItems: TodayItem[];

  study: {
    assignments: TodayItem[];
    announcement: TodayItem | null;
    mail: TodayItem | null;
    overdueCount: number;
  };

  nextDate: HomeDateSummary | null;

  pet: {
    id: string | null;
    name: string;
    todayTasks: HomePetTask[];
    pendingTaskCount: number;
    todayReport: HomeDailyReportSummary | null;
  };
};

function getDayRange(dateKey: string) {
  const start = new Date(
    `${dateKey}T00:00:00+08:00`,
  ).getTime();

  return {
    start,
    end: start + DAY_MS - 1,
  };
}

function getNextUp(
  items: HomeScheduleItem[],
  now: number,
) {
  const timed = items
    .filter(
      (item) =>
        !item.completed &&
        item.startAt !== null,
    )
    .sort(
      (a, b) =>
        (a.startAt ?? Infinity) -
        (b.startAt ?? Infinity),
    );

  /*
   * An event that is happening right now
   * has priority over a future event.
   *
   * Some Pet recurring occurrences are
   * point-in-time events where start=end,
   * so give them a short 30-minute active
   * window for the homepage.
   */
  const current = timed.find(
    (item) => {
      if (
        item.timing !== "event" ||
        item.startAt === null ||
        item.startAt > now
      ) {
        return false;
      }

      const effectiveEnd =
        item.endAt !== null &&
        item.endAt > item.startAt
          ? item.endAt
          : item.startAt +
            30 * 60 * 1000;

      return now < effectiveEnd;
    },
  );

  if (current) {
    return current;
  }

  /*
   * Deadlines that have already passed
   * do not become "Next up".
   * They are handled by Attention instead.
   */
  const nextTimed =
    timed.find(
      (item) =>
        item.startAt !== null &&
        item.startAt >= now,
    ) ?? null;

  if (nextTimed) {
    return nextTimed;
  }

  /*
   * If there is no current / upcoming
   * timed item, still show one of today's
   * untimed items as the main Next Up.
   *
   * Timed items always have priority.
   */
  return (
    items.find(
      (item) =>
        !item.completed &&
        item.startAt === null,
    ) ?? null
  );
}


function fromTodayItem(
  item: TodayItem,
): HomeScheduleItem | null {
  let kind:
    HomeScheduleItem["kind"];

  switch (item.kind) {
    case "date":
      kind = "date";
      break;

    case "personal":
      kind = "personal";
      break;

    case "study_assignment":
      kind = "study";
      break;

    /*
     * Announcement / Mail belong to the
     * Study section, not Next Up.
     */
    case "study_announcement":
    case "study_mail":
      return null;
  }

  return {
    id:
      `today:${item.kind}:${item.id}`,

    kind,

    title:
      item.title,

    subtitle:
      item.subtitle,

    startAt:
      item.startAt,

    endAt:
      item.endAt,

    timing:
      item.kind === "study_assignment"
        ? "deadline"
        : item.startAt === null
          ? "untimed"
          : "event",

    href:
      item.href,

    completed:
      item.completed,
  };
}


function fromCalendarEvent(
  event: CalendarEvent,
): HomeScheduleItem | null {
  let kind:
    HomeScheduleItem["kind"];

  let subtitle:
    string;

  switch (event.source) {
    case "google":
      kind =
        "google_calendar";

      subtitle =
        "Google Calendar";

      break;

    case "pet_task":
      kind =
        "pet_task";

      subtitle =
        "萌蛋待辦";

      break;

    case "pet_recurring_schedule":
      kind =
        "pet_recurring_schedule";

      subtitle =
        "固定行程";

      break;

    /*
     * Date + Study already have richer
     * data from getTodayOverview().
     *
     * Excluding them here prevents
     * duplicated homepage entries.
     */
    case "date":
    case "study":
      return null;
  }

  const startAt =
    event.startAt
      ? Date.parse(
          event.startAt,
        )
      : null;

  const endAt =
    event.endAt
      ? Date.parse(
          event.endAt,
        )
      : null;

  return {
    id:
      `calendar:${event.id}`,

    kind,

    title:
      event.title,

    subtitle,

    startAt,

    endAt,

    timing:
      event.allDay ||
      startAt === null
        ? "untimed"
        : event.kind === "deadline"
          ? "deadline"
          : "event",

    href:
      event.href ??
      "/calendar",

    completed:
      event.completed,
  };
}


function sortPetTasks(
  tasks: HomePetTask[],
) {
  return [...tasks].sort((a, b) => {
    if (a.dueAt && b.dueAt) {
      return (
        Date.parse(a.dueAt) -
        Date.parse(b.dueAt)
      );
    }

    if (a.dueAt) {
      return -1;
    }

    if (b.dueAt) {
      return 1;
    }

    return (
      Date.parse(b.createdAt) -
      Date.parse(a.createdAt)
    );
  });
}

export async function getHomeDashboard(): Promise<HomeDashboard> {
  const now = Date.now();
  const today = getTaipeiDateKey(now);

  const [
    supabase,
    user,
    space,
    profile,
    overview,
    dates,
    calendarEvents,
  ] = await Promise.all([
    createClient(),
    requireUser(),
    requireSpace(),
    getCurrentProfile(),
    getTodayOverview(),
    getDates(),

    getCalendarEvents({
      startDate: today,
      endDate: today,
    }),
  ]);

  const { start: todayStart, end: todayEnd } =
    getDayRange(today);

  const [
    petResult,
    overdueStudyResult,
  ] = await Promise.all([
    supabase
      .from("pets")
      .select("id, name")
      .eq("space_id", space.id)
      .limit(1)
      .maybeSingle(),

    supabase
      .from("study_assignments")
      .select(
        `
          id,
          title,
          course_name,
          due_at
        `,
        {
          count: "exact",
        },
      )
      .eq("user_id", user.id)
      .eq("submitted", false)
      .not("due_at", "is", null)
      .gte(
        "due_at",
        getStudyAssignmentCutoffIso(
          new Date(now),
        ),
      )
      .lt(
        "due_at",
        new Date(now).toISOString(),
      )
      .order("due_at", {
        ascending: false,
      })
      .limit(5),
  ]);

  if (petResult.error) {
    throw new Error(
      `Failed to load home Pet: ${petResult.error.message}`,
    );
  }

  if (overdueStudyResult.error) {
    throw new Error(
      `Failed to load overdue Study assignments: ${overdueStudyResult.error.message}`,
    );
  }

  const pet = petResult.data;

  let petTasks: HomePetTask[] = [];
  let latestReport: HomeDailyReportSummary | null =
    null;

  if (pet) {
    const [tasksResult, report] =
      await Promise.all([
        supabase
          .from("pet_tasks")
          .select(
            `
              id,
              title,
              note,
              due_at,
              due_has_time,
              created_at
            `,
          )
          .eq("user_id", user.id)
          .eq("pet_id", pet.id)
          .eq("status", "pending")
          .order("created_at", {
            ascending: false,
          })
          .limit(30),

        getLatestPetDailyReport(pet.id),
      ]);

    if (tasksResult.error) {
      throw new Error(
        `Failed to load home Pet tasks: ${tasksResult.error.message}`,
      );
    }

    petTasks = sortPetTasks(
      (tasksResult.data ?? []).map(
        (task) => ({
          id: task.id,
          title: task.title,
          note: task.note,
          dueAt: task.due_at,
          dueHasTime:
            task.due_has_time ?? false,
          createdAt: task.created_at,
        }),
      ),
    );

    if (
      report &&
      report.reportDate === today
    ) {
      latestReport = {
        id: report.id,
        reportDate: report.reportDate,
        content: report.content,
        createdAt: report.createdAt,
      };
    }
  }

  const studyAssignments = overview.filter(
    (item) =>
      item.kind === "study_assignment",
  );

  const announcement =
    overview.find(
      (item) =>
        item.kind === "study_announcement",
    ) ?? null;

  const mail =
    overview.find(
      (item) => item.kind === "study_mail",
    ) ?? null;

  /*
   * Today should contain only things that
   * actually belong to today.
   *
   * getTodayOverview intentionally includes
   * Study deadlines for the coming week.
   */
  const todayItems = overview.filter(
    (item) => {
      if (
        item.kind === "study_announcement" ||
        item.kind === "study_mail"
      ) {
        return false;
      }

      if (
        item.kind === "study_assignment"
      ) {
        return (
          item.startAt !== null &&
          item.startAt >= todayStart &&
          item.startAt <= todayEnd
        );
      }

      return true;
    },
  );

  /*
   * --------------------------------
   * Homepage schedule
   * --------------------------------
   *
   * Existing Today data supplies:
   * - Personal
   * - Date itinerary
   * - Study deadlines
   *
   * Calendar supplies:
   * - Google Calendar
   * - Pet Tasks
   * - Pet recurring schedules
   */
  const homeScheduleItems: HomeScheduleItem[] = [
    ...todayItems
      .map(fromTodayItem)
      .filter(
        (
          item,
        ): item is HomeScheduleItem =>
          item !== null,
      ),

    ...calendarEvents
      .map(fromCalendarEvent)
      .filter(
        (
          item,
        ): item is HomeScheduleItem =>
          item !== null,
      ),
  ];

  const nextUp =
    getNextUp(
      homeScheduleItems,
      now,
    );

  const todayUntimed =
    homeScheduleItems
      .filter(
        (item) =>
          !item.completed &&
          item.startAt === null &&
          item.id !== nextUp?.id,
      )
      .sort(
        (a, b) =>
          a.title.localeCompare(
            b.title,
            "zh-TW",
          ),
      );

  const todayPetTasks = petTasks.filter(
    (task) =>
      task.dueAt !== null &&
      getTaipeiDateKey(
        Date.parse(task.dueAt),
      ) === today,
  );

  /*
   * Attention: upcoming deadlines only.
   * Exclude overdue and completed items.
   * Study overdue counts remain available
   * to the existing Study section.
   */
  const urgent: HomeUrgentItem[] = [];

  for (const assignment of studyAssignments) {
    if (
      !isHomeAttentionDeadline(
        assignment.startAt,
        now,
        assignment.completed,
      )
    ) {
      continue;
    }

    urgent.push({
      id: `study:${assignment.id}`,
      kind: "study_due_soon",
      title: assignment.title,
      subtitle: assignment.subtitle ?? "NTU COOL",
      href:
        assignment.href ??
        `/study/assignments/${assignment.id}`,
      timestamp: assignment.startAt,
    });
  }

  for (const task of petTasks) {
    const deadlineAt = getHomePetTaskDeadline(
      task.dueAt,
      task.dueHasTime,
    );

    if (!isHomeAttentionDeadline(deadlineAt, now)) {
      continue;
    }

    urgent.push({
      id: `pet:${task.id}`,
      kind: "pet_task_due_soon",
      title: task.title,
      subtitle: "萌蛋幫你記住的待辦",
      href: "/calendar",
      timestamp: deadlineAt,
    });
  }

  urgent.sort(
    (a, b) =>
      (a.timestamp ?? Infinity) -
      (b.timestamp ?? Infinity),
  );

  const nextDateItem =
    dates
      .filter(
        (item) =>
          item.date.status ===
            "accepted" &&
          item.date.end_date >= today,
      )
      .sort((a, b) =>
        a.date.start_date.localeCompare(
          b.date.start_date,
        ),
      )[0] ?? null;

  const nextDate: HomeDateSummary | null =
    nextDateItem
      ? {
          id: nextDateItem.date.id,
          title:
            nextDateItem.date.title,
          description:
            nextDateItem.date.description,
          kind: nextDateItem.date.kind,
          startDate:
            nextDateItem.date.start_date,
          endDate:
            nextDateItem.date.end_date,
        }
      : null;

  return {
    now,
    today,

    profile: {
      displayName: profile.displayName,
    },

    nextUp,

    todayUntimed,

    urgent,

    todayItems,

    study: {
      assignments: studyAssignments,
      announcement,
      mail,
      overdueCount:
        overdueStudyResult.count ??
        overdueStudyResult.data?.length ??
        0,
    },

    nextDate,

    pet: {
      id: pet?.id ?? null,
      name: pet?.name ?? "萌蛋",
      todayTasks: todayPetTasks,
      pendingTaskCount: petTasks.length,
      todayReport: latestReport,
    },
  };
}
