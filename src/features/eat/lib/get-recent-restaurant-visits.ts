import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import type { Restaurant, RestaurantVisit } from "@/features/eat/types";

export type RecentRestaurantVisit = {
  visit: RestaurantVisit;
  restaurant: Restaurant;
};

export async function getRecentRestaurantVisits(
  limit = 10,
): Promise<RecentRestaurantVisit[]> {
  const supabase = await createClient();

  const space = await requireSpace();

  const { data: visits, error } = await supabase
    .from("restaurant_visits")
    .select("*")
    .eq("space_id", space.id)
    .order("visited_at", {
      ascending: false,
    })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to load recent restaurant visits: ${error.message}`,
    );
  }

  if (visits.length === 0) {
    return [];
  }

  const restaurantIds = Array.from(
    new Set(visits.map((visit) => visit.restaurant_id)),
  );

  const { data: restaurants, error: restaurantsError } = await supabase
    .from("restaurants")
    .select("*")
    .eq("space_id", space.id)
    .in("id", restaurantIds);

  if (restaurantsError) {
    throw new Error(`Failed to load restaurants: ${restaurantsError.message}`);
  }

  const restaurantMap = new Map(
    restaurants.map((restaurant) => [restaurant.id, restaurant]),
  );

  return visits.flatMap((visit) => {
    const restaurant = restaurantMap.get(visit.restaurant_id);

    if (!restaurant) {
      return [];
    }

    return [
      {
        visit,
        restaurant,
      },
    ];
  });
}
