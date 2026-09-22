import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

export async function deleteRestaurant(restaurantId: string) {
  const supabase = await createClient();

  const space = await requireSpace();

  const { error } = await supabase
    .from("restaurants")
    .delete()
    .eq("id", restaurantId)
    .eq("space_id", space.id);

  if (error) {
    throw new Error(`Failed to delete restaurant: ${error.message}`);
  }
}
