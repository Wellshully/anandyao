import "server-only";

import { siteConfig } from "@/config/site";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/features/pet/lib/get-pet";

import {
  expandPetRecurringSchedule,
} from "@/features/calendar/lib/expand-pet-recurring-schedule";

import {
  applyPetRecurringException,
} from "@/features/calendar/lib/apply-pet-recurring-exception";

import type {
  PetRecurringOccurrenceContextItem,
  PetRecurringSchedulesContext,
} from "@/features/pet/ai/context/types";

const MAX_OCCURRENCES = 120;

function currentDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: siteConfig.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value;

  const year = get("year");
  const month = get("month");
  const day = get("day");

  if (!year || !month || !day) {
    throw new Error("Cannot determine local date.");
  }

  return `${year}-${month}-${day}`;
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatLocalTime(startAt: string | null) {
  if (!startAt) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: siteConfig.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).format(new Date(startAt));
}

export async function getPetRecurringSchedulesContext(): Promise<
  PetRecurringSchedulesContext
> {
  const [user, supabase, pet] = await Promise.all([
    requireUser(),
    createClient(),
    getPet(),
  ]);

  const { data, error } = await supabase
    .from("pet_recurring_schedules")
    .select(`
      id,
      title,
      note,
      recurrence_rule,
      recurrence_start_date,
      recurrence_end_date,
      time_precision,
      start_time,
      status
    `)
    .eq("user_id", user.id)
    .eq("pet_id", pet.id)
    .eq("status", "active")
    .order("recurrence_start_date", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Failed to load recurring schedules: ${error.message}`,
    );
  }

  const schedules = data ?? [];

  const currentDate = currentDateKey();
  const windowStartDate = shiftDate(currentDate, -7);
  const windowEndDate = shiftDate(currentDate, 35);

  const scheduleIds = schedules.map((item) => item.id);

  const exceptionsResult =
    scheduleIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("pet_recurring_schedule_exceptions")
          .select(`
            schedule_id,
            occurrence_date,
            kind,
            title_override,
            note_override,
            time_precision_override,
            start_time_override
          `)
          .in("schedule_id", scheduleIds)
          .gte("occurrence_date", windowStartDate)
          .lte("occurrence_date", windowEndDate);

  if (exceptionsResult.error) {
    throw new Error(
      `Failed to load recurring exceptions: ${
        exceptionsResult.error.message
      }`,
    );
  }

  const exceptionsByKey = new Map(
    (exceptionsResult.data ?? []).map(
      (exception) => [
        `${exception.schedule_id}:${exception.occurrence_date}`,
        exception,
      ] as const,
    ),
  );

  const occurrences = schedules.flatMap((schedule) =>
    expandPetRecurringSchedule(
      schedule,
      windowStartDate,
      windowEndDate,
    ).map((occurrence): PetRecurringOccurrenceContextItem => {
      const key = `${schedule.id}:${occurrence.date}` as const;
      const exception = exceptionsByKey.get(key) ?? null;

      const effective = applyPetRecurringException(
        schedule,
        occurrence,
        exception,
      );

      return {
        scheduleId: schedule.id,
        occurrenceDate: occurrence.date,
        status: effective ? "active" : "cancelled",
        title: effective?.title ?? schedule.title,
        note:
          exception?.kind === "override"
            ? exception.note_override ?? schedule.note
            : schedule.note,
        timePrecision:
          exception?.kind === "override"
            ? exception.time_precision_override ??
              schedule.time_precision
            : schedule.time_precision,
        localStartTime: formatLocalTime(
          effective?.startAt ?? null,
        ),
        exceptionKind:
          exception?.kind === "override"
            ? "override"
            : exception?.kind === "cancelled"
              ? "cancelled"
              : null,
      };
    }),
  );

  occurrences.sort(
    (a, b) =>
      a.occurrenceDate.localeCompare(b.occurrenceDate) ||
      a.title.localeCompare(b.title),
  );

  return {
    currentDate,
    timeZone: siteConfig.timeZone,
    windowStartDate,
    windowEndDate,
    truncated: occurrences.length > MAX_OCCURRENCES,
    total: schedules.length,
    items: schedules.map((item) => ({
      scheduleId: item.id,
      title: item.title,
      note: item.note,
      recurrenceRule: item.recurrence_rule,
      recurrenceStartDate: item.recurrence_start_date,
      recurrenceEndDate: item.recurrence_end_date,
      timePrecision: item.time_precision,
      startTime: item.start_time,
    })),
    occurrences: occurrences.slice(0, MAX_OCCURRENCES),
  };
}
