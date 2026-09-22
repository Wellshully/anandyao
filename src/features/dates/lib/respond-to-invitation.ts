import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function respondToDateInvitation(
  dateId: string,
  response: "accepted" | "declined",
) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("respond_to_date_invitation", {
    p_date_id: dateId,

    p_response: response,
  });

  if (error) {
    throw new Error(`Failed to respond to invitation: ${error.message}`);
  }
}
