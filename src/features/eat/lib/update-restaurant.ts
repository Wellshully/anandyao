import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import type { Restaurant, UpdateRestaurantInput } from "@/features/eat/types";

function optionalText(value?: string) {
  return value?.trim() || null;
}

function normalizeTags(values: string[] = []) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

export async function updateRestaurant(
  input: UpdateRestaurantInput,
): Promise<Restaurant> {
  if (!input.name.trim()) {
    throw new Error("Restaurant name is required.");
  }

  if (
    input.priceLevel !== undefined &&
    (input.priceLevel < 1 || input.priceLevel > 5)
  ) {
    throw new Error("Price level must be between 1 and 5.");
  }

  const supabase = await createClient();

  const space = await requireSpace();

  const { data, error } = await supabase
    .from("restaurants")
    .update({
      name: input.name.trim(),

      area: optionalText(input.area),

      address: optionalText(input.address),

      cuisines: normalizeTags(input.cuisines),

      contexts: normalizeTags(input.contexts),

      price_level: input.priceLevel ?? null,

      latitude: input.latitude ?? null,

      longitude: input.longitude ?? null,

      google_place_id: optionalText(input.googlePlaceId),

      google_maps_url: optionalText(input.googleMapsUrl),

      note: optionalText(input.note),
    })
    .eq("id", input.restaurantId)
    .eq("space_id", space.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update restaurant: ${error.message}`);
  }

  return data;
}
