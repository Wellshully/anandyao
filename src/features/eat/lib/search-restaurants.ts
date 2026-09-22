import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import type { Restaurant, RestaurantSearchFilters } from "@/features/eat/types";

export async function searchRestaurants(
  filters: RestaurantSearchFilters = {},
): Promise<Restaurant[]> {
  const supabase = await createClient();

  const space = await requireSpace();

  let query = supabase.from("restaurants").select("*").eq("space_id", space.id);

  if (!filters.includeHidden) {
    query = query.eq("is_hidden", false);
  }

  const searchText = filters.query?.trim();

  if (searchText) {
    query = query.ilike("name", `%${searchText}%`);
  }

  if (filters.areas && filters.areas.length > 0) {
    query = query.in("area", filters.areas);
  }

  if (filters.cuisines && filters.cuisines.length > 0) {
    query = query.overlaps("cuisines", filters.cuisines);
  }

  if (filters.contexts && filters.contexts.length > 0) {
    query = query.overlaps("contexts", filters.contexts);
  }

  if (filters.maxPriceLevel !== undefined) {
    query = query.lte("price_level", filters.maxPriceLevel);
  }

  query = query.order("name", {
    ascending: true,
  });

  if (filters.limit !== undefined && filters.limit > 0) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to search restaurants: ${error.message}`);
  }

  return data;
}
