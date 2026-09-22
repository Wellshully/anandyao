import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import { searchRestaurants } from "@/features/eat/lib/search-restaurants";

import type {
  PickRestaurantOptions,
  RestaurantPickResult,
} from "@/features/eat/types";

function randomItem<T>(items: T[]): T {
  const index = Math.floor(Math.random() * items.length);

  return items[index];
}

export async function pickRestaurant(
  options: PickRestaurantOptions = {},
): Promise<RestaurantPickResult | null> {
  const {
    excludeRestaurantIds = [],
    avoidVisitedWithinDays = 7,
    ...filters
  } = options;

  const restaurants = await searchRestaurants(filters);

  const explicitlyExcluded = new Set(excludeRestaurantIds);

  const candidates = restaurants.filter(
    (restaurant) => !explicitlyExcluded.has(restaurant.id),
  );

  if (candidates.length === 0) {
    return null;
  }

  if (avoidVisitedWithinDays <= 0) {
    return {
      restaurant: randomItem(candidates),

      candidateCount: candidates.length,

      recentlyVisitedCount: 0,

      usedRecentFallback: false,
    };
  }

  const supabase = await createClient();

  const space = await requireSpace();

  const cutoff = new Date();

  cutoff.setDate(cutoff.getDate() - avoidVisitedWithinDays);

  const candidateIds = candidates.map((restaurant) => restaurant.id);

  const { data: recentVisits, error } = await supabase
    .from("restaurant_visits")
    .select("restaurant_id")
    .eq("space_id", space.id)
    .gte("visited_at", cutoff.toISOString())
    .in("restaurant_id", candidateIds);

  if (error) {
    throw new Error(
      `Failed to load recent restaurant visits: ${error.message}`,
    );
  }

  const recentlyVisited = new Set(
    recentVisits.map((visit) => visit.restaurant_id),
  );

  const freshCandidates = candidates.filter(
    (restaurant) => !recentlyVisited.has(restaurant.id),
  );

  const usedRecentFallback = freshCandidates.length === 0;

  const pool = usedRecentFallback ? candidates : freshCandidates;

  return {
    restaurant: randomItem(pool),

    candidateCount: candidates.length,

    recentlyVisitedCount: recentlyVisited.size,

    usedRecentFallback,
  };
}
