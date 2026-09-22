import "server-only";

import { searchRestaurants } from "@/features/eat/lib/search-restaurants";

import type { Restaurant } from "@/features/eat/types";

type GetRestaurantsOptions = {
  includeHidden?: boolean;
};

export async function getRestaurants(
  options: GetRestaurantsOptions = {},
): Promise<Restaurant[]> {
  return searchRestaurants({
    includeHidden: options.includeHidden,
  });
}
