import "server-only";

export const GOOGLE_CALENDAR_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";

export function getGoogleCalendarOAuthConfig() {
  const clientId =
    process.env.GOOGLE_CALENDAR_CLIENT_ID;

  const clientSecret =
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI;

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri
  ) {
    throw new Error(
      "Google Calendar OAuth environment variables are incomplete.",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}
