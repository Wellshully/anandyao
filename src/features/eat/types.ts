import type { Database } from "@/types/database";

export type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

export type RestaurantInsert =
  Database["public"]["Tables"]["restaurants"]["Insert"];

export type RestaurantVisit =
  Database["public"]["Tables"]["restaurant_visits"]["Row"];

export type RestaurantSearchFilters = {
  query?: string;

  areas?: string[];
  cuisines?: string[];
  contexts?: string[];

  maxPriceLevel?: number;

  includeHidden?: boolean;

  limit?: number;
};

export type AddRestaurantInput = {
  name: string;

  area?: string;
  address?: string;

  cuisines?: string[];
  contexts?: string[];

  priceLevel?: number;

  latitude?: number;
  longitude?: number;

  googlePlaceId?: string;
  googleMapsUrl?: string;

  note?: string;
};
export type UpdateRestaurantInput = AddRestaurantInput & {
  restaurantId: string;
};
export type RecordRestaurantVisitInput = {
  restaurantId: string;

  visitedAt?: Date;

  selectedByPicker?: boolean;

  note?: string;
};

export type PickRestaurantOptions = RestaurantSearchFilters & {
  excludeRestaurantIds?: string[];

  /**
   * Restaurants visited within this many days
   * are avoided when possible.
   */
  avoidVisitedWithinDays?: number;
};

export type RestaurantPickResult = {
  restaurant: Restaurant;

  candidateCount: number;

  recentlyVisitedCount: number;

  /**
   * true means every remaining restaurant
   * had been visited recently, so the picker
   * fell back to the complete candidate pool.
   */
  usedRecentFallback: boolean;
};
