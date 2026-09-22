import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import { requireUser } from "@/lib/auth/require-user";

import type {
  AddItineraryInput,
  ItineraryItemType,
} from "@/features/dates/types";

function buildGoogleMapsUrl({
  latitude,
  longitude,
  address,
}: {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}) {
  let query: string | null = null;

  if (latitude !== null && longitude !== null) {
    query = `${latitude},${longitude}`;
  } else if (address) {
    query = address;
  }

  if (!query) {
    return null;
  }

  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(query)
  );
}

export async function addItineraryItem(input: AddItineraryInput) {
  const [supabase, space, user] = await Promise.all([
    createClient(),
    requireSpace(),
    requireUser(),
  ]);

  if (input.restaurantId && input.placeId) {
    throw new Error("行程不能同時連結餐廳和地點。");
  }

  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes <= 0 ||
    input.durationMinutes > 1440
  ) {
    throw new Error("行程時間不正確。");
  }

  if (input.timingType === "fixed" && !input.fixedStartTime) {
    throw new Error("固定時間行程需要設定開始時間。");
  }

  const { data: day, error: dayError } = await supabase
    .from("date_days")
    .select("id, date_id")
    .eq("id", input.dateDayId)
    .eq("date_id", input.dateId)
    .eq("space_id", space.id)
    .maybeSingle();

  if (dayError) {
    throw new Error(`Failed to load date day: ${dayError.message}`);
  }

  if (!day) {
    throw new Error("找不到這一天。");
  }

  let itemType: ItineraryItemType = input.itemType;

  let restaurantId: string | null = null;

  let placeId: string | null = null;

  let title = input.title.trim();

  let locationName = input.locationName?.trim() || null;

  let address = input.address?.trim() || null;

  let googleMapsUrl = input.googleMapsUrl?.trim() || null;

  let latitude: number | null = null;

  let longitude: number | null = null;

  /*
   * Eat module
   */
  if (input.restaurantId) {
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select(
        `
          id,
          name,
          area,
          address,
          google_maps_url,
          is_hidden
        `,
      )
      .eq("id", input.restaurantId)
      .eq("space_id", space.id)
      .maybeSingle();

    if (restaurantError) {
      throw new Error(`Failed to load restaurant: ${restaurantError.message}`);
    }

    if (!restaurant) {
      throw new Error("找不到這間餐廳。");
    }

    if (restaurant.is_hidden) {
      throw new Error("這間餐廳目前已隱藏。");
    }

    restaurantId = restaurant.id;

    itemType = "restaurant";

    title = restaurant.name;

    locationName = restaurant.area;

    address = restaurant.address;

    googleMapsUrl = restaurant.google_maps_url;
  }

  /*
   * Places module
   */
  if (input.placeId) {
    const { data: place, error: placeError } = await supabase
      .from("places")
      .select(
        `
          id,
          name,
          address,
          latitude,
          longitude
        `,
      )
      .eq("id", input.placeId)
      .eq("space_id", space.id)
      .maybeSingle();

    if (placeError) {
      throw new Error(`Failed to load place: ${placeError.message}`);
    }

    if (!place) {
      throw new Error("找不到這個地點。");
    }

    placeId = place.id;

    itemType = "place";

    title = place.name;

    locationName = null;

    address = place.address;

    latitude = place.latitude;

    longitude = place.longitude;

    googleMapsUrl = buildGoogleMapsUrl({
      latitude,
      longitude,
      address,
    });
  }

  if (!title) {
    throw new Error("行程名稱不能為空。");
  }

  const { data: lastItem, error: orderError } = await supabase
    .from("date_itinerary_items")
    .select("sort_order")
    .eq("date_day_id", day.id)
    .eq("space_id", space.id)
    .order("sort_order", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (orderError) {
    throw new Error(
      `Failed to determine itinerary order: ${orderError.message}`,
    );
  }

  const nextSortOrder = (lastItem?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("date_itinerary_items")
    .insert({
      date_id: input.dateId,

      date_day_id: input.dateDayId,

      space_id: space.id,

      item_type: itemType,

      restaurant_id: restaurantId,

      place_id: placeId,

      title,

      description: input.description?.trim() || null,

      location_name: locationName,

      address,

      latitude,

      longitude,

      google_maps_url: googleMapsUrl,

      sort_order: nextSortOrder,

      timing_type: input.timingType,

      fixed_start_time:
        input.timingType === "fixed" ? input.fixedStartTime : null,

      duration_minutes: input.durationMinutes,

      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to add itinerary item: ${error.message}`);
  }

  return data;
}
