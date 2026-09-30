import "server-only";

import { requireSpace } from "@/lib/space/require-space";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { getTaipeiDateKey } from "@/lib/time/taipei-time";

import type {
  CalendarEvent,
  CalendarEventKind,
} from "@/features/calendar/types";

import {
  getGoogleCalendarEvents,
} from "@/features/calendar/google/get-google-calendar-events";

import {
  expandPetRecurringSchedule,
  type CalendarRecurringSchedule,
} from "@/features/calendar/lib/expand-pet-recurring-schedule";

type GetCalendarEventsInput = {
  /*
   * YYYY-MM-DD in Asia/Taipei.
   *
   * Both ends are inclusive.
   */
  startDate: string;
  endDate: string;
};

function getRangeIso(
  startDate: string,
  endDate: string,
) {
  return {
    startIso:
      new Date(
        `${startDate}T00:00:00+08:00`,
      ).toISOString(),

    endIso:
      new Date(
        `${endDate}T23:59:59.999+08:00`,
      ).toISOString(),
  };
}

function getPetTaskKind(
  temporalKind: string,
): CalendarEventKind {
  if (temporalKind === "deadline") {
    return "deadline";
  }

  return "task";
}

function getPetTaskCalendarTime(
  dueAt: string,
  timePrecision: string,
) {
  /*
   * date / daypart are intentionally rendered
   * as all-day calendar entries.
   *
   * Example:
   *
   * "後天晚上看電影"
   *
   * may internally resolve to 23:59:59, but
   * 23:59 is NOT the real event time.
   */
  if (
    timePrecision === "date" ||
    timePrecision === "daypart"
  ) {
    const date =
      getTaipeiDateKey(
        new Date(dueAt).getTime(),
      );

    return {
      startAt: null,
      endAt: null,
      startDate: date,
      endDate: date,
      allDay: true,
    };
  }

  return {
    startAt: dueAt,
    endAt: dueAt,
    startDate: null,
    endDate: null,
    allDay: false,
  };
}

function getEventSortTime(
  event: CalendarEvent,
) {
  if (event.startAt) {
    return new Date(
      event.startAt,
    ).getTime();
  }

  if (event.startDate) {
    return new Date(
      `${event.startDate}T00:00:00+08:00`,
    ).getTime();
  }

  return Number.MAX_SAFE_INTEGER;
}

export async function getCalendarEvents({
  startDate,
  endDate,
}: GetCalendarEventsInput): Promise<
  CalendarEvent[]
> {
  const [
    supabase,
    user,
    space,
  ] = await Promise.all([
    createClient(),
    requireUser(),
    requireSpace(),
  ]);

  const {
    startIso,
    endIso,
  } = getRangeIso(
    startDate,
    endDate,
  );

  /*
   * --------------------------------
   * Resolve Date participation first
   * --------------------------------
   *
   * Calendar should only show shared Dates
   * that the current user accepted.
   */
  const {
    data: participationRows,
    error: participationError,
  } = await supabase
    .from("date_participants")
    .select("date_id")
    .eq(
      "user_id",
      user.id,
    )
    .eq(
      "status",
      "accepted",
    );

  if (participationError) {
    throw new Error(
      `Failed to load Calendar Date participation: ${participationError.message}`,
    );
  }

  const acceptedDateIds =
    Array.from(
      new Set(
        (
          participationRows ??
          []
        ).map(
          (row) =>
            row.date_id,
        ),
      ),
    );

  const [
    studyResult,
    petTasksResult,
    recurringSchedulesResult,
    datesResult,
  ] = await Promise.all([
    /*
     * --------------------------------
     * Study
     * --------------------------------
     *
     * due_at = null is intentionally excluded.
     * In this project it represents content
     * that has not received its real deadline.
     */
    supabase
      .from(
        "study_assignments",
      )
      .select(
        `
          id,
          title,
          course_name,
          due_at,
          submitted
        `,
      )
      .eq(
        "user_id",
        user.id,
      )
      .not(
        "due_at",
        "is",
        null,
      )
      .gte(
        "due_at",
        startIso,
      )
      .lte(
        "due_at",
        endIso,
      )
      .order(
        "due_at",
        {
          ascending: true,
        },
      ),

    /*
     * --------------------------------
     * Pet Tasks
     * --------------------------------
     *
     * Flexible tasks without due_at are
     * deliberately not forced onto a date.
     * They can later live in an
     * "Unscheduled" sidebar.
     */
    supabase
      .from(
        "pet_tasks",
      )
      .select(
        `
          id,
          title,
          due_at,
          temporal_kind,
          time_precision,
          status
        `,
      )
      .eq(
        "user_id",
        user.id,
      )
      .not(
        "due_at",
        "is",
        null,
      )
      .in(
        "status",
        [
          "pending",
          "completed",
        ],
      )
      .gte(
        "due_at",
        startIso,
      )
      .lte(
        "due_at",
        endIso,
      )
      .order(
        "due_at",
        {
          ascending: true,
        },
      ),

    /*
     * --------------------------------
     * Pet Recurring Schedules
     * --------------------------------
     *
     * The database stores only the recurrence
     * definition. Calendar expands occurrences
     * for the requested range.
     */
    supabase
      .from(
        "pet_recurring_schedules",
      )
      .select(
        `
          id,
          title,
          recurrence_rule,
          recurrence_start_date,
          recurrence_end_date,
          time_precision,
          start_time,
          status
        `,
      )
      .eq(
        "user_id",
        user.id,
      )
      .eq(
        "status",
        "active",
      )
      .lte(
        "recurrence_start_date",
        endDate,
      )
      .order(
        "recurrence_start_date",
        {
          ascending: true,
        },
      ),

    /*
     * --------------------------------
     * Shared Dates
     * --------------------------------
     *
     * A multi-day Date is included whenever
     * its date range overlaps the requested
     * Calendar window.
     */
    acceptedDateIds.length ===
    0
      ? Promise.resolve({
          data: [],
          error: null,
        })
      : supabase
          .from("dates")
          .select(
            `
              id,
              title,
              start_date,
              end_date,
              status
            `,
          )
          .eq(
            "space_id",
            space.id,
          )
          .in(
            "id",
            acceptedDateIds,
          )
          .in(
            "status",
            [
              "accepted",
              "completed",
            ],
          )
          .lte(
            "start_date",
            endDate,
          )
          .gte(
            "end_date",
            startDate,
          )
          .order(
            "start_date",
            {
              ascending: true,
            },
          ),
  ]);

  if (
    studyResult.error
  ) {
    throw new Error(
      `Failed to load Calendar Study events: ${studyResult.error.message}`,
    );
  }

  if (
    petTasksResult.error
  ) {
    throw new Error(
      `Failed to load Calendar Pet Tasks: ${petTasksResult.error.message}`,
    );
  }

  if (
    recurringSchedulesResult.error
  ) {
    throw new Error(
      `Failed to load Calendar recurring schedules: ${recurringSchedulesResult.error.message}`,
    );
  }

  if (
    datesResult.error
  ) {
    throw new Error(
      `Failed to load Calendar Dates: ${datesResult.error.message}`,
    );
  }

  const events:
    CalendarEvent[] = [];

  /*
   * --------------------------------
   * Study → CalendarEvent
   * --------------------------------
   */
  for (
    const assignment of
      studyResult.data ?? []
  ) {
    if (
      !assignment.due_at
    ) {
      continue;
    }

    events.push({
      id:
        `study:${assignment.id}`,

      source:
        "study",

      sourceId:
        assignment.id,

      title:
        assignment.title,

      startAt:
        assignment.due_at,

      endAt:
        assignment.due_at,

      startDate:
        null,

      endDate:
        null,

      allDay:
        false,

      kind:
        "deadline",

      completed:
        assignment.submitted,

      /*
       * COOL is source-of-truth.
       * We do not modify the original
       * assignment from Calendar.
       */
      sourceEditable:
        false,

      href:
        `/study/assignments/${assignment.id}`,
    });
  }

  /*
   * --------------------------------
   * Pet Task → CalendarEvent
   * --------------------------------
   */
  for (
    const task of
      petTasksResult.data ?? []
  ) {
    if (
      !task.due_at
    ) {
      continue;
    }

    const calendarTime =
      getPetTaskCalendarTime(
        task.due_at,
        task.time_precision,
      );

    events.push({
      id:
        `pet_task:${task.id}`,

      source:
        "pet_task",

      sourceId:
        task.id,

      title:
        task.title,

      ...calendarTime,

      kind:
        getPetTaskKind(
          task.temporal_kind,
        ),

      completed:
        task.status ===
        "completed",

      sourceEditable:
        true,

      /*
       * Pet currently has no dedicated
       * task detail route.
       *
       * Later the Calendar drawer itself
       * will edit this item.
       */
      href:
        null,
    });
  }

  /*
   * --------------------------------
   * Pet Recurring Schedule
   * → CalendarEvent occurrences
   * --------------------------------
   */
  for (
    const rawSchedule of
      recurringSchedulesResult.data ?? []
  ) {
    /*
     * The SQL query only checks the start
     * boundary because recurrence_end_date
     * may be null.
     */
    if (
      rawSchedule.recurrence_end_date &&
      rawSchedule.recurrence_end_date <
        startDate
    ) {
      continue;
    }

    const schedule =
      rawSchedule as CalendarRecurringSchedule;

    const occurrences =
      expandPetRecurringSchedule(
        schedule,
        startDate,
        endDate,
      );

    for (
      const occurrence of
        occurrences
    ) {
      events.push({
        /*
         * An occurrence needs its own stable
         * Calendar id while sourceId continues
         * pointing at the recurring definition.
         */
        id:
          `pet_recurring_schedule:${schedule.id}:${occurrence.date}`,

        source:
          "pet_recurring_schedule",

        sourceId:
          schedule.id,

        title:
          schedule.title,

        startAt:
          occurrence.startAt,

        endAt:
          occurrence.startAt,

        startDate:
          occurrence.allDay
            ? occurrence.date
            : null,

        endDate:
          occurrence.allDay
            ? occurrence.date
            : null,

        allDay:
          occurrence.allDay,

        kind:
          "event",

        completed:
          false,

        /*
         * Later the Calendar detail drawer
         * can edit the whole recurrence.
         */
        sourceEditable:
          true,

        href:
          null,
      });
    }
  }

  /*
   * --------------------------------
   * Date → CalendarEvent
   * --------------------------------
   */
  for (
    const date of
      datesResult.data ?? []
  ) {
    events.push({
      id:
        `date:${date.id}`,

      source:
        "date",

      sourceId:
        date.id,

      title:
        date.title,

      startAt:
        null,

      endAt:
        null,

      startDate:
        date.start_date,

      endDate:
        date.end_date,

      allDay:
        true,

      kind:
        "event",

      completed:
        date.status ===
        "completed",

      /*
       * Date currently has its own
       * dedicated planner.
       */
      sourceEditable:
        false,

      href:
        `/dates/${date.id}`,
    });
  }

  /*
   * --------------------------------
   * Google Calendar
   * --------------------------------
   *
   * Google is intentionally best-effort.
   * A temporary Google API failure must not
   * make Study / Date / Pet Calendar disappear.
   */
  try {
    const googleEvents =
      await getGoogleCalendarEvents({
        userId:
          user.id,

        startDate,

        endDate,
      });

    events.push(
      ...googleEvents,
    );
  } catch (cause) {
    console.error(
      "Failed to load Google Calendar events:",
      cause instanceof Error
        ? cause.message
        : cause,
    );
  }

  return events.sort(
    (a, b) =>
      getEventSortTime(a) -
      getEventSortTime(b),
  );
}
