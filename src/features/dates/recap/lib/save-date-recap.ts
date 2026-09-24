import "server-only";

import { createClient } from "@/lib/supabase/server";

export type SaveDateRecapInput = {
  recapId: string;

  favoriteMoment: string;
};

export async function saveDateRecap({
  recapId,
  favoriteMoment,
}: SaveDateRecapInput) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("date_recaps")
    .update({
      favorite_moment: favoriteMoment.trim() || null,

      /*
       * This field is no longer used by the UI.
       */
      future_note: null,
    })
    .eq("id", recapId)
    .select(
      `
        id,
        favorite_moment,
        updated_at
      `,
    )
    .single();

  if (error) {
    console.error("saveDateRecap database error:", error);

    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Recap 沒有成功更新。");
  }

  return data;
}
