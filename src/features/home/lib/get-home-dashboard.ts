import "server-only";

import { getDates } from "@/features/dates/lib/get-dates";
import { getLatestPetDailyReport } from "@/features/pet/report/get-latest-report";
import { getCurrentProfile } from "@/features/profile/lib/get-current-profile";
import { getTodayOverview } from "@/features/today/lib/get-today-overview";

import type { TodayItem } from "@/features/today/types";

import { requireSpace } from "@/lib/space/require-space";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { getTaipeiDateKey } from "@/lib/time/taipei-time";

const DAY_MS = 24 * 60 * 60 * 1000;

export type HomeUrgentItem = {
  id: string;
  kind:
    | "date_invitation"
    | "study_overdue"
    | "pet_task_overdue";
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

export type HomeDashboard = {
  now: number;
  today: string;

  profile: {
    displayName: string;
  };

  nextUp: TodayItem | null;

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
  items: TodayItem[],
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

  const current = timed.find(
    (item) =>
      item.startAt !== null &&
      item.startAt <= now &&
      item.endAt !== null &&
      item.endAt > now,
  );

  if (current) {
    return current;
  }

  return (
    timed.find(
      (item) =>
        item.startAt !== null &&
        item.startAt >= now,
    ) ?? null
  );
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
  ] = await Promise.all([
    createClient(),
    requireUser(),
    requireSpace(),
    getCurrentProfile(),
    getTodayOverview(),
    getDates(),
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

  const todayPetTasks = petTasks.filter(
    (task) =>
      task.dueAt !== null &&
      getTaipeiDateKey(
        Date.parse(task.dueAt),
      ) === today,
  );

  const overduePetTasks = petTasks
    .filter(
      (task) =>
        task.dueAt !== null &&
        Date.parse(task.dueAt) < now,
    )
    .slice(0, 3);

  const urgent: HomeUrgentItem[] = [];

  const invitation = dates.find(
    (item) =>
      item.currentUserParticipant?.role ===
        "invitee" &&
      item.currentUserParticipant.status ===
        "pending",
  );

  if (invitation) {
    const organizer =
      invitation.participants.find(
        (participant) =>
          participant.role === "organizer",
      );

    urgent.push({
      id: `date:${invitation.date.id}`,
      kind: "date_invitation",
      title: invitation.date.title,
      subtitle:
        `${organizer?.displayName ?? "對方"} 邀請你 · ` +
        invitation.date.start_date,
      href: `/dates/${invitation.date.id}`,
      timestamp: null,
    });
  }

  for (
    const assignment of
    overdueStudyResult.data ?? []
  ) {
    if (!assignment.due_at) {
      continue;
    }

    urgent.push({
      id: `study:${assignment.id}`,
      kind: "study_overdue",
      title: assignment.title,
      subtitle:
        assignment.course_name ??
        "NTU COOL",
      href:
        `/study/assignments/${assignment.id}`,
      timestamp: Date.parse(
        assignment.due_at,
      ),
    });
  }

  for (const task of overduePetTasks) {
    urgent.push({
      id: `pet:${task.id}`,
      kind: "pet_task_overdue",
      title: task.title,
      subtitle: "萌蛋幫你記住的待辦",
      href: "/pet",
      timestamp: task.dueAt
        ? Date.parse(task.dueAt)
        : null,
    });
  }

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

    nextUp: getNextUp(
      todayItems,
      now,
    ),

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
