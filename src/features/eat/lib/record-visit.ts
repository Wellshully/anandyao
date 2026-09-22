import "server-only";

import { requireUser } from "@/lib/auth/require-user";

import { requireSpace } from "@/lib/space/require-space";

import { createClient } from "@/lib/supabase/server";

import type {
  RecordRestaurantVisitInput,
  RestaurantVisit,
} from "@/features/eat/types";

export async function recordRestaurantVisit(
  input: RecordRestaurantVisitInput,
): Promise<RestaurantVisit> {
  const [supabase, user, space] = await Promise.all([
    createClient(),
    requireUser(),
    requireSpace(),
  ]);

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id")
    .eq("id", input.restaurantId)
    .eq("space_id", space.id)
    .maybeSingle();

  if (restaurantError) {
    throw new Error(`Failed to verify restaurant: ${restaurantError.message}`);
  }

  if (!restaurant) {
    throw new Error("Restaurant not found.");
  }

  const { data, error } = await supabase
    .from("restaurant_visits")
    .insert({
      space_id: space.id,

      restaurant_id: input.restaurantId,

      visited_at: (input.visitedAt ?? new Date()).toISOString(),

      selected_by_picker: input.selectedByPicker ?? false,

      note: input.note?.trim() || null,

      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to record restaurant visit: ${error.message}`);
  }

  return data;
}
