import "server-only";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/features/pet/lib/get-pet";

export type CalendarRecurringSeries = {
  id: string;
  title: string;
  recurrenceRule: string;
  timePrecision: string;
  startTime: string | null;
  updatedAt: string;
};

export async function getCalendarRecurringSeries(
  id: string,
): Promise<CalendarRecurringSeries | null> {
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
      recurrence_rule,
      time_precision,
      start_time,
      updated_at
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("pet_id", pet.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    recurrenceRule: data.recurrence_rule,
    timePrecision: data.time_precision,
    startTime: data.start_time,
    updatedAt: data.updated_at,
  };
}
