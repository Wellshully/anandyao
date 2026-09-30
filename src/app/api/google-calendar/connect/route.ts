import {
  randomBytes,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  requireUser,
} from "@/lib/auth/require-user";

import {
  GOOGLE_CALENDAR_READONLY_SCOPE,
  getGoogleCalendarOAuthConfig,
} from "@/features/calendar/google/config";

const STATE_COOKIE =
  "google_calendar_oauth_state";

export async function GET() {
  /*
   * Google connection always belongs to
   * the currently logged-in An & Yao user.
   */
  await requireUser();

  const {
    clientId,
    redirectUri,
  } =
    getGoogleCalendarOAuthConfig();

  const state =
    randomBytes(32)
      .toString("hex");

  const authorizationUrl =
    new URL(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );

  authorizationUrl.searchParams.set(
    "client_id",
    clientId,
  );

  authorizationUrl.searchParams.set(
    "redirect_uri",
    redirectUri,
  );

  authorizationUrl.searchParams.set(
    "response_type",
    "code",
  );

  authorizationUrl.searchParams.set(
    "scope",
    GOOGLE_CALENDAR_READONLY_SCOPE,
  );

  authorizationUrl.searchParams.set(
    "access_type",
    "offline",
  );

  authorizationUrl.searchParams.set(
    "include_granted_scopes",
    "true",
  );

  /*
   * Helpful during initial connection /
   * reconnection because Google normally
   * only returns refresh_token on the
   * first authorization.
   */
  authorizationUrl.searchParams.set(
    "prompt",
    "consent",
  );

  authorizationUrl.searchParams.set(
    "state",
    state,
  );

  const response =
    NextResponse.redirect(
      authorizationUrl,
    );

  response.cookies.set(
    STATE_COOKIE,
    state,
    {
      httpOnly:
        true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite:
        "lax",

      path:
        "/",

      maxAge:
        10 * 60,
    },
  );

  return response;
}
