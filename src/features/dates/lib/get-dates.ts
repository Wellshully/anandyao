import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import { requireUser } from "@/lib/auth/require-user";

import type {
  DateListItem,
  DateParticipantSummary,
} from "@/features/dates/types";

export async function getDates(): Promise<DateListItem[]> {
  const [supabase, space, user] = await Promise.all([
    createClient(),
    requireSpace(),
    requireUser(),
  ]);

  const { data: dates, error: datesError } = await supabase
    .from("dates")
    .select("*")
    .eq("space_id", space.id)
    .order("start_date", {
      ascending: true,
    });

  if (datesError) {
    throw new Error(`Failed to load dates: ${datesError.message}`);
  }

  if (dates.length === 0) {
    return [];
  }

  const dateIds = dates.map((date) => date.id);

  const { data: participants, error: participantError } = await supabase
    .from("date_participants")
    .select("*")
    .in("date_id", dateIds);

  if (participantError) {
    throw new Error(
      `Failed to load date participants: ${participantError.message}`,
    );
  }

  const userIds = Array.from(
    new Set(participants.map((participant) => participant.user_id)),
  );

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);

  if (profileError) {
    throw new Error(`Failed to load profiles: ${profileError.message}`);
  }

  const profileMap = new Map(
    profiles.map((profile) => [profile.id, profile.display_name ?? "Member"]),
  );

  return dates.map((date) => {
    const dateParticipants = participants
      .filter((participant) => participant.date_id === date.id)
      .map(
        (participant): DateParticipantSummary => ({
          userId: participant.user_id,

          role: participant.role as "organizer" | "invitee",

          status: participant.status as "pending" | "accepted" | "declined",

          displayName: profileMap.get(participant.user_id) ?? "Member",
        }),
      );

    return {
      date,

      participants: dateParticipants,

      currentUserParticipant: dateParticipants.find(
        (participant) => participant.userId === user.id,
      ),
    };
  });
}
