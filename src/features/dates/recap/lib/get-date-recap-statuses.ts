import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { DateRecapStatus } from "@/features/dates/recap/types";

export async function getDateRecapStatuses() {
  const supabase = await createClient();

  const { data, error } = await supabase.from("date_recaps").select(
    `
        date_id,
        status
      `,
  );

  if (error) {
    throw new Error(error.message);
  }

  const result: Record<string, DateRecapStatus> = {};

  for (const recap of data ?? []) {
    result[recap.date_id] = recap.status as DateRecapStatus;
  }

  return result;
}
