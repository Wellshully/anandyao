import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireUser } from "@/lib/auth/require-user";

import { requireSpace } from "@/lib/space/require-space";

import { getCurrentProfile } from "@/features/profile/lib/get-current-profile";

import { sendDateInviteNotification } from "@/features/dates/lib/send-date-invite-notification";

import type { CreateDateInput } from "@/features/dates/types";

export async function createDate(input: CreateDateInput) {
  const [supabase, user, space] = await Promise.all([
    createClient(),
    requireUser(),
    requireSpace(),
  ]);

  const title = input.title.trim();

  if (!title) {
    throw new Error("Date title is required.");
  }

  if (input.endDate < input.startDate) {
    throw new Error("End date cannot be before start date.");
  }

  const { data: members, error: memberError } = await supabase
    .from("space_members")
    .select("user_id")
    .eq("space_id", space.id)
    .neq("user_id", user.id)
    .limit(1);

  if (memberError) {
    throw new Error(`Failed to find invitee: ${memberError.message}`);
  }

  const invitee = members[0];

  if (!invitee) {
    throw new Error("目前 An & Yao 還沒有另一位成員可以邀請。");
  }

  const { data: dateId, error } = await supabase.rpc("create_date_invitation", {
    p_space_id: space.id,

    p_invitee_id: invitee.user_id,

    p_title: title,

    p_description: input.description?.trim() ?? "",

    p_kind: input.kind,

    p_start_date: input.startDate,

    p_end_date: input.endDate,
  });

  if (error) {
    throw new Error(`Failed to create date: ${error.message}`);
  }

  if (!dateId) {
    throw new Error("Date was created without a valid ID.");
  }

  /*
   * Date creation is already complete at this point.
   *
   * Notification is best-effort:
   * profile lookup / Push failure must never roll back
   * or make the successfully-created Date look failed.
   */
  try {
    const profile = await getCurrentProfile();

    await sendDateInviteNotification({
      inviteeUserId: invitee.user_id,

      organizerName: profile.displayName,

      dateId,

      title,
    });
  } catch (cause) {
    console.warn(
      "Date invitation notification failed:",
      cause instanceof Error ? cause.message : String(cause),
    );
  }

  return dateId;
}
