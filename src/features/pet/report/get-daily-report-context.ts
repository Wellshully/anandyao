import "server-only";

import { siteConfig } from "@/config/site";

import { createAdminClient } from "@/lib/supabase/admin";

import { calculateItinerarySchedule } from "@/features/dates/lib/calculate-itinerary-schedule";

import type { DateItineraryItem } from "@/features/dates/types";

const REPORT_LOOKAHEAD_DAYS = 7;

const MAX_OVERDUE_STUDY = 5;
const MAX_UPCOMING_STUDY = 8;

const MAX_OVERDUE_TASKS = 5;
const MAX_UPCOMING_TASKS = 8;
const MAX_NO_DUE_TASKS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

function getDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: siteConfig.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to calculate Daily Report date.");
  }

  return `${year}-${month}-${day}`;
}

function getTimeKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: siteConfig.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = parts.find(
    (part) => part.type === "hour",
  )?.value;

  const minute = parts.find(
    (part) => part.type === "minute",
  )?.value;

  if (!hour || !minute) {
    throw new Error(
      "Failed to calculate Daily Report local time.",
    );
  }

  return `${hour}:${minute}`;
}

function getDateRange(now: Date) {
  const today = getDateKey(now);

  const through = getDateKey(
    new Date(now.getTime() + REPORT_LOOKAHEAD_DAYS * DAY_MS),
  );

  return {
    today,
    through,
  };
}

export type DailyReportStudyItem = {
  id: string;
  title: string;
  courseName: string;

  /*
   * dueAt is the machine timestamp.
   *
   * localDate/localTime are the authoritative
   * Asia/Taipei values shown to the report AI.
   */
  dueAt: string;
  localDate: string;
  localTime: string;

  late: boolean;
  missing: boolean;
  deadlinePassed: boolean;
};

export type DailyReportPetTaskItem = {
  id: string;
  title: string;
  note: string | null;

  dueAt: string | null;
  dueHasTime: boolean;

  localDate: string | null;
  localTime: string | null;

  createdAt: string;
  deadlinePassed: boolean;
};

export type DailyReportDateItineraryItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;

  locationName: string | null;
  address: string | null;

  startTime: string;
  durationMinutes: number;
};

export type DailyReportDateDay = {
  id: string;
  date: string;
  dayNumber: number;

  title: string | null;
  note: string | null;

  items: DailyReportDateItineraryItem[];
};

export type DailyReportDateItem = {
  id: string;

  title: string;
  description: string | null;

  kind: string;

  startDate: string;
  endDate: string;

  days: DailyReportDateDay[];
};

export type PetDailyReportContext = {
  currentDate: string;
  currentTime: string;
  throughDate: string;
  timeZone: string;

  user: {
    id: string;
    displayName: string;
  };

  pet: {
    id: string;
    name: string;
  };

  dates: DailyReportDateItem[];

  study: {
    overdue: DailyReportStudyItem[];
    dueToday: DailyReportStudyItem[];
    upcoming: DailyReportStudyItem[];
  };

  petTasks: {
    overdue: DailyReportPetTaskItem[];
    dueToday: DailyReportPetTaskItem[];
    upcoming: DailyReportPetTaskItem[];
    noDueDate: DailyReportPetTaskItem[];
  };
};

type GetPetDailyReportContextInput = {
  userId: string;
  petId: string;
};

export async function getPetDailyReportContext({
  userId,
  petId,
}: GetPetDailyReportContextInput): Promise<PetDailyReportContext> {
  const supabase = createAdminClient();

  const now = new Date();

  const { today, through } = getDateRange(now);

  /*
   * Cron uses the admin client and therefore bypasses RLS.
   *
   * Never trust userId + petId blindly.
   * Explicitly verify that this user belongs to the space
   * containing this pet.
   */
  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select(
      `
        id,
        name,
        space_id
      `,
    )
    .eq("id", petId)
    .maybeSingle();

  if (petError) {
    throw new Error(`Failed to load Daily Report pet: ${petError.message}`);
  }

  if (!pet) {
    throw new Error("Daily Report pet not found.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("user_id", userId)
    .eq("space_id", pet.space_id)
    .maybeSingle();

  if (membershipError) {
    throw new Error(
      `Failed to verify Daily Report membership: ${membershipError.message}`,
    );
  }

  if (!membership) {
    throw new Error("Daily Report user does not belong to the pet space.");
  }

  const [
    profileResult,
    petTasksResult,
    studyResult,
    participantsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("id", userId)
      .maybeSingle(),

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
      .eq("user_id", userId)
      .eq("pet_id", pet.id)
      .eq("status", "pending")
      .order("created_at", {
        ascending: false,
      })
      .limit(50),

    supabase
      .from("study_assignments")
      .select(
        `
          id,
          title,
          course_name,
          due_at,
          late,
          missing
        `,
      )
      .eq("user_id", userId)
      .eq("submitted", false)
      .not("due_at", "is", null)
      .order("due_at", {
        ascending: true,
      })
      .limit(100),

    /*
     * A Date belongs in this user's report only when
     * this user has accepted participation.
     */
    supabase
      .from("date_participants")
      .select("date_id")
      .eq("user_id", userId)
      .eq("status", "accepted"),
  ]);

  if (profileResult.error) {
    throw new Error(
      `Failed to load Daily Report profile: ${profileResult.error.message}`,
    );
  }

  if (!profileResult.data) {
    throw new Error("Daily Report profile not found.");
  }

  if (petTasksResult.error) {
    throw new Error(
      `Failed to load Daily Report pet tasks: ${petTasksResult.error.message}`,
    );
  }

  if (studyResult.error) {
    throw new Error(
      `Failed to load Daily Report Study data: ${studyResult.error.message}`,
    );
  }

  if (participantsResult.error) {
    throw new Error(
      `Failed to load Daily Report Date participants: ${participantsResult.error.message}`,
    );
  }

  /*
   * --------------------------------
   * Study
   * --------------------------------
   */

  const studyItems: DailyReportStudyItem[] = (
    studyResult.data ?? []
  )
    .filter(
      (
        assignment,
      ): assignment is typeof assignment & {
        due_at: string;
      } => assignment.due_at !== null,
    )
    .map((assignment) => {
      const dueDate = new Date(
        assignment.due_at,
      );

      return {
        id: assignment.id,

        title: assignment.title,

        courseName:
          assignment.course_name,

        dueAt: assignment.due_at,

        localDate: getDateKey(
          dueDate,
        ),

        localTime: getTimeKey(
          dueDate,
        ),

        late: assignment.late,

        missing: assignment.missing,

        deadlinePassed:
          dueDate.getTime() <=
          now.getTime(),
      };
    });

  const studyOverdue = studyItems
    .filter((assignment) => {
      return getDateKey(new Date(assignment.dueAt)) < today;
    })
    .sort(
      (a, b) =>
        new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime(),
    )
    .slice(0, MAX_OVERDUE_STUDY);

  const studyDueToday = studyItems.filter((assignment) => {
    return getDateKey(new Date(assignment.dueAt)) === today;
  });

  const studyUpcoming = studyItems
    .filter((assignment) => {
      const date = getDateKey(new Date(assignment.dueAt));

      return date > today && date <= through;
    })
    .slice(0, MAX_UPCOMING_STUDY);

  /*
   * --------------------------------
   * Pet Tasks
   * --------------------------------
   */

  const petTaskItems: DailyReportPetTaskItem[] = (
    petTasksResult.data ?? []
  ).map((task) => {
    const dueDate =
      task.due_at !== null
        ? new Date(task.due_at)
        : null;

    return {
      id: task.id,

      title: task.title,

      note: task.note,

      dueAt: task.due_at,

      dueHasTime:
        task.due_has_time,

      localDate:
        dueDate !== null
          ? getDateKey(dueDate)
          : null,

      /*
       * 23:59:59 is only an internal anchor for
       * date-only tasks. Never expose it to the AI.
       */
      localTime:
        dueDate !== null &&
        task.due_has_time
          ? getTimeKey(dueDate)
          : null,

      createdAt: task.created_at,

      deadlinePassed:
        dueDate !== null &&
        dueDate.getTime() <=
          now.getTime(),
    };
  });

  const petTasksWithDueDate = petTaskItems.filter(
    (
      task,
    ): task is DailyReportPetTaskItem & {
      dueAt: string;
    } => task.dueAt !== null,
  );

  const petTasksOverdue = petTasksWithDueDate
    .filter((task) => {
      return getDateKey(new Date(task.dueAt)) < today;
    })
    .sort(
      (a, b) =>
        new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime(),
    )
    .slice(0, MAX_OVERDUE_TASKS);

  const petTasksDueToday = petTasksWithDueDate
    .filter((task) => {
      return getDateKey(new Date(task.dueAt)) === today;
    })
    .sort(
      (a, b) =>
        new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
    );

  const petTasksUpcoming = petTasksWithDueDate
    .filter((task) => {
      const date = getDateKey(new Date(task.dueAt));

      return date > today && date <= through;
    })
    .sort(
      (a, b) =>
        new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
    )
    .slice(0, MAX_UPCOMING_TASKS);

  const petTasksNoDueDate = petTaskItems
    .filter((task) => task.dueAt === null)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    )
    .slice(0, MAX_NO_DUE_TASKS);

  /*
   * --------------------------------
   * Dates
   * --------------------------------
   */

  const participantDateIds = Array.from(
    new Set(
      (participantsResult.data ?? []).map(
        (participant) => participant.date_id,
      ),
    ),
  );

  const reportDates: DailyReportDateItem[] = [];

  if (participantDateIds.length > 0) {
    const { data: dates, error: datesError } = await supabase
      .from("dates")
      .select(
        `
          id,
          title,
          description,
          kind,
          start_date,
          end_date,
          status
        `,
      )
      .in("id", participantDateIds)
      .eq("status", "accepted")
      .gte("end_date", today)
      .lte("start_date", through)
      .order("start_date", {
        ascending: true,
      });

    if (datesError) {
      throw new Error(
        `Failed to load Daily Report Dates: ${datesError.message}`,
      );
    }

    const acceptedDates = dates ?? [];

    if (acceptedDates.length > 0) {
      const acceptedDateIds = acceptedDates.map((date) => date.id);

      const { data: days, error: daysError } = await supabase
        .from("date_days")
        .select("*")
        .in("date_id", acceptedDateIds)
        .gte("date", today)
        .lte("date", through)
        .order("date", {
          ascending: true,
        })
        .order("day_number", {
          ascending: true,
        });

      if (daysError) {
        throw new Error(
          `Failed to load Daily Report Date days: ${daysError.message}`,
        );
      }

      const dayIds = (days ?? []).map((day) => day.id);

      let itineraryItems: DateItineraryItem[] = [];

      if (dayIds.length > 0) {
        const { data: rawItems, error: itemsError } = await supabase
          .from("date_itinerary_items")
          .select("*")
          .in("date_day_id", dayIds)
          .order("sort_order", {
            ascending: true,
          });

        if (itemsError) {
          throw new Error(
            `Failed to load Daily Report itinerary: ${itemsError.message}`,
          );
        }

        itineraryItems = (rawItems ?? []) as DateItineraryItem[];
      }

      for (const date of acceptedDates) {
        const dateDays = (days ?? []).filter(
          (day) => day.date_id === date.id,
        );

        reportDates.push({
          id: date.id,

          title: date.title,

          description: date.description,

          kind: date.kind,

          startDate: date.start_date,

          endDate: date.end_date,

          days: dateDays.map((day) => {
            const dayItems = itineraryItems.filter(
              (item) => item.date_day_id === day.id,
            );

            const scheduled = calculateItinerarySchedule(
              day.planning_start_time,
              dayItems,
            );

            return {
              id: day.id,

              date: day.date,

              dayNumber: day.day_number,

              title: day.title,

              note: day.note,

              items: scheduled.map((scheduledItem) => ({
                id: scheduledItem.item.id,

                type: scheduledItem.item.item_type,

                title: scheduledItem.item.title,

                description: scheduledItem.item.description,

                locationName:
                  scheduledItem.item.location_name,

                address: scheduledItem.item.address,

                startTime: scheduledItem.displayStartTime,

                durationMinutes:
                  scheduledItem.item.duration_minutes,
              })),
            };
          }),
        });
      }
    }
  }

  return {
    currentDate: today,

    currentTime: getTimeKey(now),

    throughDate: through,

    timeZone: siteConfig.timeZone,

    user: {
      id: profileResult.data.id,

      displayName:
        profileResult.data.display_name ?? "主人",
    },

    pet: {
      id: pet.id,

      name: pet.name,
    },

    dates: reportDates,

    study: {
      overdue: studyOverdue,

      dueToday: studyDueToday,

      upcoming: studyUpcoming,
    },

    petTasks: {
      overdue: petTasksOverdue,

      dueToday: petTasksDueToday,

      upcoming: petTasksUpcoming,

      noDueDate: petTasksNoDueDate,
    },
  };
}
