import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function completeDateRecap(dateId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("complete_date_recap", {
    p_date_id: dateId,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Memory 建立失敗。");
  }

  return data;
}
