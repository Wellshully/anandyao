import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";

import { getCurrentProfile } from "@/features/profile/lib/get-current-profile";

import { sendDateResponseNotification } from "@/features/dates/lib/send-date-response-notification";

export async function respondToDateInvitation(
  dateId: string,
  response: "accepted" | "declined",
) {
  const [supabase, user] = await Promise.all([createClient(), requireUser()]);

  /*
   * The Date response itself is the important operation.
   * Do this first.
   */
  const { error } = await supabase.rpc("respond_to_date_invitation", {
    p_date_id: dateId,
    p_response: response,
  });

  if (error) {
    throw new Error(`Failed to respond to invitation: ${error.message}`);
  }

  /*
   * Everything below is notification-only.
   *
   * If profile lookup / Date lookup / Push fails,
   * the invitation response must still remain successful.
   */
  try {
    const [profile, dateResult, participantResult] = await Promise.all([
      getCurrentProfile(),

      supabase.from("dates").select("title").eq("id", dateId).single(),

      supabase
        .from("date_participants")
        .select("user_id")
        .eq("date_id", dateId)
        .neq("user_id", user.id)
        .limit(1)
        .maybeSingle(),
    ]);

    if (dateResult.error) {
      throw new Error(
        `Failed to load Date for notification: ${dateResult.error.message}`,
      );
    }

    if (participantResult.error) {
      throw new Error(
        `Failed to find Date organizer: ${participantResult.error.message}`,
      );
    }

    const organizer = participantResult.data;

    if (!organizer) {
      console.warn("Date response notification skipped: organizer not found.");

      return;
    }

    await sendDateResponseNotification({
      organizerUserId: organizer.user_id,

      responderName: profile.displayName,

      dateId,

      title: dateResult.data.title,

      response,
    });
  } catch (cause) {
    console.warn(
      "Date response notification failed:",
      cause instanceof Error ? cause.message : String(cause),
    );
  }
}
