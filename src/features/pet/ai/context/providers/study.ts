import "server-only";

import { siteConfig } from "@/config/site";

import { getStudyAssignmentCutoffIso } from "@/features/study/lib/study-assignment-visibility";
import { createClient } from "@/lib/supabase/server";

import type { PetStudyAssignmentContextItem, PetStudyContext } from "../types";

const MAX_OVERDUE = 5;
const MAX_UPCOMING = 8;

/*
 * Convert a Date into YYYY-MM-DD using the
 * application's configured timezone.
 *
 * This is important because Supabase timestamps
 * are normally stored in UTC, while "today" for
 * the user is Asia/Taipei.
 */
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
    throw new Error("Failed to calculate Study date.");
  }

  return `${year}-${month}-${day}`;
}

export async function getPetStudyContext(): Promise<PetStudyContext> {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();

  const now = new Date();
  const today = getDateKey(now);

  const emptyContext: PetStudyContext = {
    currentDate: today,
    timeZone: siteConfig.timeZone,
    dueToday: [],
    overdue: [],
    upcoming: [],
  };

  /*
   * Study data belongs to the currently
   * authenticated user only.
   */
  if (authError || !authData.user) {
    return emptyContext;
  }

  const userId = authData.user.id;

  /*
   * study_assignments is treated as the current
   * state of assignments.
   *
   * The Study sync process upserts assignments
   * using user_id + cool_assignment_id, so we do
   * not filter by synced_at here.
   */
  const { data: assignments, error } = await supabase
    .from("study_assignments")
    .select(
      `
        title,
        course_name,
        due_at,
        submitted,
        late,
        missing
      `,
    )
    .eq("user_id", userId)
    .eq("submitted", false)
    .not("due_at", "is", null)
    .gte(
      "due_at",
      getStudyAssignmentCutoffIso(
        now,
      ),
    )
    .order("due_at", {
      ascending: true,
    })
    .limit(100);

  if (error) {
    throw new Error(
      `Failed to load Study assignments for pet: ${error.message}`,
    );
  }

  /*
   * Convert database rows into the smaller,
   * explicit structure that can be given to
   * the pet's LLM context.
   */
  const items: PetStudyAssignmentContextItem[] = (assignments ?? [])
    .filter(
      (
        assignment,
      ): assignment is typeof assignment & {
        due_at: string;
      } => assignment.due_at !== null,
    )
    .map((assignment) => ({
      title: assignment.title,
      courseName: assignment.course_name ?? "Unknown course",
      dueAt: assignment.due_at,

      late: assignment.late,
      missing: assignment.missing,

      /*
       * deadlinePassed is different from "overdue".
       *
       * Example:
       * Today is 9/27.
       * Assignment deadline was 9/27 15:00.
       *
       * It still belongs to dueToday, but the
       * deadline itself has already passed.
       */
      deadlinePassed: new Date(assignment.due_at).getTime() <= now.getTime(),
    }));

  /*
   * Assignments whose due date is today.
   *
   * Even if the exact deadline has already passed,
   * they remain in dueToday. deadlinePassed tells
   * the LLM whether the deadline time has passed.
   */
  const dueToday = items.filter(
    (assignment) => getDateKey(new Date(assignment.dueAt)) === today,
  );

  /*
   * Assignments whose due DATE is before today.
   *
   * Sort newest overdue assignments first so the
   * most relevant ones are sent to the LLM.
   */
  const overdue = items
    .filter((assignment) => {
      const dueDate = getDateKey(new Date(assignment.dueAt));

      return dueDate < today;
    })
    .sort((a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime())
    .slice(0, MAX_OVERDUE);

  /*
   * Future assignments.
   *
   * The Supabase query already orders due_at
   * ascending, so the nearest deadlines appear
   * first.
   */
  const upcoming = items
    .filter((assignment) => {
      const dueDate = getDateKey(new Date(assignment.dueAt));

      return dueDate > today;
    })
    .slice(0, MAX_UPCOMING);

  return {
    currentDate: today,
    timeZone: siteConfig.timeZone,
    dueToday,
    overdue,
    upcoming,
  };
}
