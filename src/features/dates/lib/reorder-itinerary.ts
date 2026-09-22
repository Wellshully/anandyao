import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function reorderItinerary(dateDayId: string, itemIds: string[]) {
  const supabase = await createClient();

  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error("行程順序包含重複項目。");
  }

  const { error } = await supabase.rpc("reorder_date_itinerary", {
    p_date_day_id: dateDayId,

    p_item_ids: itemIds,
  });

  if (error) {
    throw new Error(`Failed to reorder itinerary: ${error.message}`);
  }
}
