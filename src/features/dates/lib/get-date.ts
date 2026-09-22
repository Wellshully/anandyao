import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import { requireUser } from "@/lib/auth/require-user";

import type {
  DateDetails,
  DateParticipantSummary,
} from "@/features/dates/types";

export async function getDate(dateId: string): Promise<DateDetails | null> {
  const [supabase, space, user] = await Promise.all([
    createClient(),
    requireSpace(),
    requireUser(),
  ]);

  const { data: date, error: dateError } = await supabase
    .from("dates")
    .select("*")
    .eq("id", dateId)
    .eq("space_id", space.id)
    .maybeSingle();

  if (dateError) {
    throw new Error(`Failed to load date: ${dateError.message}`);
  }

  if (!date) {
    return null;
  }

  const [daysResult, itemsResult, participantsResult] = await Promise.all([
    supabase
      .from("date_days")
      .select("*")
      .eq("date_id", date.id)
      .eq("space_id", space.id)
      .order("day_number", {
        ascending: true,
      }),

    supabase
      .from("date_itinerary_items")
      .select("*")
      .eq("date_id", date.id)
      .eq("space_id", space.id)
      .order("sort_order", {
        ascending: true,
      }),

    supabase
      .from("date_participants")
      .select("*")
      .eq("date_id", date.id)
      .eq("space_id", space.id),
  ]);

  if (daysResult.error) {
    throw new Error(`Failed to load date days: ${daysResult.error.message}`);
  }

  if (itemsResult.error) {
    throw new Error(`Failed to load itinerary: ${itemsResult.error.message}`);
  }

  if (participantsResult.error) {
    throw new Error(
      `Failed to load participants: ${participantsResult.error.message}`,
    );
  }

  const participants = participantsResult.data;

  const userIds = participants.map((participant) => participant.user_id);

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

  const participantSummaries = participants.map(
    (participant): DateParticipantSummary => ({
      userId: participant.user_id,

      role: participant.role as "organizer" | "invitee",

      status: participant.status as "pending" | "accepted" | "declined",

      displayName: profileMap.get(participant.user_id) ?? "Member",
    }),
  );

  return {
    date,

    participants: participantSummaries,

    currentUserParticipant: participantSummaries.find(
      (participant) => participant.userId === user.id,
    ),

    days: daysResult.data.map((day) => ({
      day,

      items: itemsResult.data.filter((item) => item.date_day_id === day.id),
    })),
  };
}
