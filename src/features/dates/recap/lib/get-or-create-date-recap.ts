import "server-only";

import { createClient } from "@/lib/supabase/server";

import { getTaipeiToday } from "@/lib/time/get-taipei-today";

import { getDateRecapWindowState } from "@/features/dates/lib/date-recap-window";

import type { DateRecap } from "@/features/dates/recap/types";

export async function getOrCreateDateRecap(dateId: string): Promise<DateRecap> {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("Not authenticated");
  }

  const user = authData.user;

  const { data: date, error: dateError } = await supabase
    .from("dates")
    .select(
      `
        id,
        space_id,
        status,
        end_date
      `,
    )
    .eq("id", dateId)
    .single();

  if (dateError || !date) {
    throw new Error("Date not found");
  }

  if (date.status !== "accepted") {
    throw new Error("This Date cannot be recapped.");
  }

  const { data: participant } = await supabase
    .from("date_participants")
    .select("status")
    .eq("date_id", dateId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (participant?.status !== "accepted") {
    throw new Error("You are not an accepted participant.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("date_recaps")
    .select("*")
    .eq("date_id", dateId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return existing as DateRecap;
  }

  const today = getTaipeiToday();

  const windowState = getDateRecapWindowState({
    endDate: date.end_date,

    today,
  });

  if (windowState !== "available") {
    throw new Error("This Date is not in the recap window.");
  }

  const { data: created, error: createError } = await supabase
    .from("date_recaps")
    .insert({
      date_id: date.id,

      space_id: date.space_id,

      created_by: user.id,
    })
    .select("*")
    .single();

  if (createError) {
    /*
     * If both people open the Recap at almost
     * exactly the same time, unique(date_id)
     * may cause one insert to lose the race.
     *
     * In that case just load the existing draft.
     */
    if (createError.code === "23505") {
      const { data: racedRecap, error: racedError } = await supabase
        .from("date_recaps")
        .select("*")
        .eq("date_id", dateId)
        .single();

      if (racedError || !racedRecap) {
        throw new Error(racedError?.message ?? "Unable to load recap.");
      }

      return racedRecap as DateRecap;
    }

    throw new Error(createError.message);
  }

  return created as DateRecap;
}
