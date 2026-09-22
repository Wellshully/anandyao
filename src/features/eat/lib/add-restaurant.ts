import "server-only";

import { requireUser } from "@/lib/auth/require-user";

import { requireSpace } from "@/lib/space/require-space";

import { createClient } from "@/lib/supabase/server";

import type {
  AddRestaurantInput,
  Restaurant,
  RestaurantInsert,
} from "@/features/eat/types";

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim();

  return trimmed || null;
}

function normalizeTags(values: string[] = []) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

export async function addRestaurant(
  input: AddRestaurantInput,
): Promise<Restaurant> {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Restaurant name is required.");
  }

  if (
    input.priceLevel !== undefined &&
    (!Number.isInteger(input.priceLevel) ||
      input.priceLevel < 1 ||
      input.priceLevel > 5)
  ) {
    throw new Error("Price level must be between 1 and 5.");
  }

  if (
    input.latitude !== undefined &&
    (input.latitude < -90 || input.latitude > 90)
  ) {
    throw new Error("Invalid latitude.");
  }

  if (
    input.longitude !== undefined &&
    (input.longitude < -180 || input.longitude > 180)
  ) {
    throw new Error("Invalid longitude.");
  }

  const [supabase, user, space] = await Promise.all([
    createClient(),
    requireUser(),
    requireSpace(),
  ]);

  const restaurant: RestaurantInsert = {
    space_id: space.id,

    name,

    area: normalizeOptionalText(input.area),

    address: normalizeOptionalText(input.address),

    cuisines: normalizeTags(input.cuisines),

    contexts: normalizeTags(input.contexts),

    price_level: input.priceLevel ?? null,

    latitude: input.latitude ?? null,

    longitude: input.longitude ?? null,

    google_place_id: normalizeOptionalText(input.googlePlaceId),

    google_maps_url: normalizeOptionalText(input.googleMapsUrl),

    note: normalizeOptionalText(input.note),

    source: "manual",

    created_by: user.id,
  };

  const { data, error } = await supabase
    .from("restaurants")
    .insert(restaurant)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add restaurant: ${error.message}`);
  }

  return data;
}
