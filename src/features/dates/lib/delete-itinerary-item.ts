import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

export async function deleteItineraryItem(itineraryItemId: string) {
  const [supabase, space] = await Promise.all([createClient(), requireSpace()]);

  const { error } = await supabase
    .from("date_itinerary_items")
    .delete()
    .eq("id", itineraryItemId)
    .eq("space_id", space.id);

  if (error) {
    throw new Error(`Failed to delete itinerary item: ${error.message}`);
  }
}
