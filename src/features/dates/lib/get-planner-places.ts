import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import type { PlannerPlace } from "@/features/dates/types";

export async function getPlannerPlaces(): Promise<PlannerPlace[]> {
  const [supabase, space] = await Promise.all([createClient(), requireSpace()]);

  const { data, error } = await supabase
    .from("places")
    .select(
      `
        id,
        name,
        status,
        note,
        address,
        latitude,
        longitude
      `,
    )
    .eq("space_id", space.id)
    .order("name", {
      ascending: true,
    });

  if (error) {
    throw new Error(`Failed to load places: ${error.message}`);
  }

  return data;
}
