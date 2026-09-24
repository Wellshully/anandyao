import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function cancelDate(dateId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("cancel_date", {
    p_date_id: dateId,
  });

  if (error) {
    throw new Error(error.message);
  }
}
