import "server-only";

import {
  requireUser,
} from "@/lib/auth/require-user";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export type GoogleCalendarConnection = {
  connected: boolean;

  calendarSummary:
    string | null;
};

export async function getGoogleCalendarConnection(): Promise<
  GoogleCalendarConnection
> {
  const user =
    await requireUser();

  const supabase =
    createAdminClient();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "google_calendar_connections",
      )
      .select(
        `
          primary_calendar_summary
        `,
      )
      .eq(
        "user_id",
        user.id,
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load Google Calendar connection: ${error.message}`,
    );
  }

  if (!data) {
    return {
      connected:
        false,

      calendarSummary:
        null,
    };
  }

  return {
    connected:
      true,

    calendarSummary:
      data.primary_calendar_summary,
  };
}
