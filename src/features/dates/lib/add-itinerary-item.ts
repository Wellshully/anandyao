import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import { requireUser } from "@/lib/auth/require-user";

import type { AddItineraryInput } from "@/features/dates/types";

export async function addItineraryItem(input: AddItineraryInput) {
  const [supabase, space, user] = await Promise.all([
    createClient(),
    requireSpace(),
    requireUser(),
  ]);

  const title = input.title.trim();

  if (!title) {
    throw new Error("行程名稱不能為空。");
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

      item_type: input.itemType,

      title,

      description: input.description?.trim() || null,

      location_name: input.locationName?.trim() || null,

      address: input.address?.trim() || null,

      google_maps_url: input.googleMapsUrl?.trim() || null,

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
