import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function deleteArchivedDate(dateId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("delete_archived_date", {
    p_date_id: dateId,
  });

  if (error) {
    throw new Error(error.message);
  }
}
