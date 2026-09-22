import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import type { Restaurant, RestaurantVisit } from "@/features/eat/types";

export type RestaurantDetails = {
  restaurant: Restaurant;
  visits: RestaurantVisit[];
};

export async function getRestaurant(
  restaurantId: string,
): Promise<RestaurantDetails | null> {
  const supabase = await createClient();

  const space = await requireSpace();

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .eq("space_id", space.id)
    .maybeSingle();

  if (restaurantError) {
    throw new Error(`Failed to load restaurant: ${restaurantError.message}`);
  }

  if (!restaurant) {
    return null;
  }

  const { data: visits, error: visitsError } = await supabase
    .from("restaurant_visits")
    .select("*")
    .eq("space_id", space.id)
    .eq("restaurant_id", restaurant.id)
    .order("visited_at", {
      ascending: false,
    });

  if (visitsError) {
    throw new Error(`Failed to load restaurant visits: ${visitsError.message}`);
  }

  return {
    restaurant,
    visits,
  };
}
