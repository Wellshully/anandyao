import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

export async function setRestaurantHidden(
  restaurantId: string,
  hidden: boolean,
) {
  const supabase = await createClient();

  const space = await requireSpace();

  const { data, error } = await supabase
    .from("restaurants")
    .update({
      is_hidden: hidden,
    })
    .eq("id", restaurantId)
    .eq("space_id", space.id)
    .select("id, is_hidden")
    .maybeSingle();

  if (error) {
    console.error("setRestaurantHidden error:", error);

    throw new Error(`Failed to update restaurant visibility: ${error.message}`);
  }

  if (!data) {
    throw new Error(
      "Restaurant not found or you do not have permission to update it.",
    );
  }

  return data;
}
