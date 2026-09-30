import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireUser,
} from "@/lib/auth/require-user";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  GOOGLE_CALENDAR_READONLY_SCOPE,
  getGoogleCalendarOAuthConfig,
} from "@/features/calendar/google/config";

const STATE_COOKIE =
  "google_calendar_oauth_state";

type GoogleTokenResponse = {
  access_token?: string;

  expires_in?: number;

  refresh_token?: string;

  scope?: string;

  token_type?: string;

  error?: string;

  error_description?: string;
};

type GoogleCalendarResponse = {
  id?: string;

  summary?: string;

  timeZone?: string;
};

function redirectToCalendar(
  request: NextRequest,
  status: string,
) {
  const url =
    new URL(
      "/calendar",
      request.url,
    );

  url.searchParams.set(
    "google",
    status,
  );

  return NextResponse.redirect(
    url,
  );
}

export async function GET(
  request: NextRequest,
) {
  const user =
    await requireUser();

  const googleError =
    request.nextUrl.searchParams.get(
      "error",
    );

  if (googleError) {
    return redirectToCalendar(
      request,
      "denied",
    );
  }

  const code =
    request.nextUrl.searchParams.get(
      "code",
    );

  const returnedState =
    request.nextUrl.searchParams.get(
      "state",
    );

  const expectedState =
    request.cookies.get(
      STATE_COOKIE,
    )?.value;

  if (
    !code ||
    !returnedState ||
    !expectedState ||
    returnedState !==
      expectedState
  ) {
    return redirectToCalendar(
      request,
      "invalid_state",
    );
  }

  const {
    clientId,
    clientSecret,
    redirectUri,
  } =
    getGoogleCalendarOAuthConfig();

  const tokenResponse =
    await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            code,

            client_id:
              clientId,

            client_secret:
              clientSecret,

            redirect_uri:
              redirectUri,

            grant_type:
              "authorization_code",
          }),

        cache:
          "no-store",
      },
    );

  const tokenData =
    (
      await tokenResponse.json()
    ) as GoogleTokenResponse;

  if (
    !tokenResponse.ok ||
    !tokenData.access_token
  ) {
    console.error(
      "Google token exchange failed:",
      tokenData,
    );

    return redirectToCalendar(
      request,
      "token_error",
    );
  }

  /*
   * Google officially allows the keyword
   * "primary" for the current user's
   * primary calendar.
   */
  const calendarResponse =
    await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary",
      {
        headers: {
          Authorization:
            `Bearer ${tokenData.access_token}`,
        },

        cache:
          "no-store",
      },
    );

  if (
    !calendarResponse.ok
  ) {
    console.error(
      "Failed to read Google primary calendar:",
      await calendarResponse.text(),
    );

    return redirectToCalendar(
      request,
      "calendar_error",
    );
  }

  const calendar =
    (
      await calendarResponse.json()
    ) as GoogleCalendarResponse;

  const supabase =
    createAdminClient();

  /*
   * refresh_token is normally returned only
   * during the first offline authorization.
   *
   * Preserve an existing one if Google does
   * not send another during reconnection.
   */
  const {
    data:
      existingConnection,
    error:
      existingConnectionError,
  } =
    await supabase
      .from(
        "google_calendar_connections",
      )
      .select(
        "refresh_token",
      )
      .eq(
        "user_id",
        user.id,
      )
      .maybeSingle();

  if (
    existingConnectionError
  ) {
    throw new Error(
      existingConnectionError.message,
    );
  }

  const refreshToken =
    tokenData.refresh_token ??
    existingConnection
      ?.refresh_token;

  if (!refreshToken) {
    console.error(
      "Google did not return a refresh token.",
    );

    return redirectToCalendar(
      request,
      "refresh_token_missing",
    );
  }

  const {
    error:
      connectionError,
  } =
    await supabase
      .from(
        "google_calendar_connections",
      )
      .upsert(
        {
          user_id:
            user.id,

          refresh_token:
            refreshToken,

          scope:
            tokenData.scope ??
            GOOGLE_CALENDAR_READONLY_SCOPE,

          primary_calendar_id:
            calendar.id ??
            "primary",

          primary_calendar_summary:
            calendar.summary ??
            "Google Calendar",

          updated_at:
            new Date()
              .toISOString(),
        },
        {
          onConflict:
            "user_id",
        },
      );

  if (connectionError) {
    throw new Error(
      connectionError.message,
    );
  }

  const response =
    redirectToCalendar(
      request,
      "connected",
    );

  response.cookies.delete(
    STATE_COOKIE,
  );

  return response;
}
