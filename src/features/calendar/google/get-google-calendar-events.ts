import "server-only";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  getGoogleCalendarOAuthConfig,
} from "@/features/calendar/google/config";

import type {
  CalendarEvent,
} from "@/features/calendar/types";

type GetGoogleCalendarEventsInput = {
  userId: string;
  startDate: string;
  endDate: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;

  error?: string;
  error_description?: string;
};

type GoogleEventDateTime = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

type GoogleCalendarEvent = {
  id?: string;

  status?: string;

  summary?: string;

  description?: string;

  htmlLink?: string;

  start?: GoogleEventDateTime;

  end?: GoogleEventDateTime;

  recurringEventId?: string;
};

type GoogleEventsResponse = {
  items?: GoogleCalendarEvent[];

  nextPageToken?: string;
};

function addDays(
  dateKey: string,
  days: number,
) {
  const [
    year,
    month,
    day,
  ] = dateKey
    .split("-")
    .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + days,
      ),
    );

  return [
    date.getUTCFullYear(),

    String(
      date.getUTCMonth() + 1,
    ).padStart(
      2,
      "0",
    ),

    String(
      date.getUTCDate(),
    ).padStart(
      2,
      "0",
    ),
  ].join("-");
}

async function getAccessToken(
  refreshToken: string,
) {
  const {
    clientId,
    clientSecret,
  } =
    getGoogleCalendarOAuthConfig();

  const response =
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
            client_id:
              clientId,

            client_secret:
              clientSecret,

            refresh_token:
              refreshToken,

            grant_type:
              "refresh_token",
          }),

        cache:
          "no-store",
      },
    );

  const data =
    (
      await response.json()
    ) as GoogleTokenResponse;

  if (
    !response.ok ||
    !data.access_token
  ) {
    throw new Error(
      data.error_description ??
        data.error ??
        "Failed to refresh Google Calendar access token.",
    );
  }

  return data.access_token;
}

async function fetchGoogleEvents(
  accessToken: string,
  startDate: string,
  endDate: string,
) {
  /*
   * Google timeMax is exclusive.
   *
   * Calendar range:
   * 2026-10-01 ... 2026-10-31
   *
   * API:
   * timeMin = Oct 1 00:00
   * timeMax = Nov 1 00:00
   */
  const timeMin =
    new Date(
      `${startDate}T00:00:00+08:00`,
    ).toISOString();

  const nextDay =
    addDays(
      endDate,
      1,
    );

  const timeMax =
    new Date(
      `${nextDay}T00:00:00+08:00`,
    ).toISOString();

  const result:
    GoogleCalendarEvent[] =
      [];

  let pageToken:
    string | null = null;

  do {
    const url =
      new URL(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      );

    url.searchParams.set(
      "timeMin",
      timeMin,
    );

    url.searchParams.set(
      "timeMax",
      timeMax,
    );

    /*
     * Let Google expand recurring events
     * into individual occurrences.
     */
    url.searchParams.set(
      "singleEvents",
      "true",
    );

    url.searchParams.set(
      "orderBy",
      "startTime",
    );

    url.searchParams.set(
      "showDeleted",
      "false",
    );

    url.searchParams.set(
      "timeZone",
      "Asia/Taipei",
    );

    url.searchParams.set(
      "maxResults",
      "2500",
    );

    if (pageToken) {
      url.searchParams.set(
        "pageToken",
        pageToken,
      );
    }

    const response =
      await fetch(
        url,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache:
            "no-store",
        },
      );

    if (!response.ok) {
      const body =
        await response.text();

      throw new Error(
        `Google Calendar events request failed (${response.status}): ${body}`,
      );
    }

    const data =
      (
        await response.json()
      ) as GoogleEventsResponse;

    result.push(
      ...(
        data.items ??
        []
      ),
    );

    pageToken =
      data.nextPageToken ??
      null;
  } while (
    pageToken
  );

  return result;
}

function mapGoogleEvent(
  event: GoogleCalendarEvent,
): CalendarEvent | null {
  if (
    !event.id ||
    event.status ===
      "cancelled"
  ) {
    return null;
  }

  /*
   * --------------------------------
   * All-day event
   * --------------------------------
   *
   * Google end.date is exclusive.
   *
   * start 10/10
   * end   10/13
   *
   * actually means:
   * 10/10 ~ 10/12
   */
  if (
    event.start?.date
  ) {
    const startDate =
      event.start.date;

    const endExclusive =
      event.end?.date ??
      addDays(
        startDate,
        1,
      );

    let endDate =
      addDays(
        endExclusive,
        -1,
      );

    if (
      endDate <
      startDate
    ) {
      endDate =
        startDate;
    }

    return {
      id:
        `google:${event.id}`,

      source:
        "google",

      sourceId:
        event.id,

      title:
        event.summary?.trim() ||
        "（無標題）",

      startAt:
        null,

      endAt:
        null,

      startDate,

      endDate,

      allDay:
        true,

      kind:
        "event",

      completed:
        false,

      /*
       * Read-only phase.
       */
      sourceEditable:
        false,

      href:
        event.htmlLink ??
        null,
    };
  }

  /*
   * --------------------------------
   * Timed event
   * --------------------------------
   */
  if (
    event.start?.dateTime
  ) {
    const startAt =
      new Date(
        event.start.dateTime,
      ).toISOString();

    const endAt =
      event.end?.dateTime
        ? new Date(
            event.end.dateTime,
          ).toISOString()
        : startAt;

    return {
      id:
        `google:${event.id}`,

      source:
        "google",

      sourceId:
        event.id,

      title:
        event.summary?.trim() ||
        "（無標題）",

      startAt,

      endAt,

      startDate:
        null,

      endDate:
        null,

      allDay:
        false,

      kind:
        "event",

      completed:
        false,

      /*
       * Read-only phase.
       */
      sourceEditable:
        false,

      href:
        event.htmlLink ??
        null,
    };
  }

  return null;
}

export async function getGoogleCalendarEvents({
  userId,
  startDate,
  endDate,
}: GetGoogleCalendarEventsInput): Promise<
  CalendarEvent[]
> {
  const supabase =
    createAdminClient();

  const {
    data: connection,
    error,
  } =
    await supabase
      .from(
        "google_calendar_connections",
      )
      .select(
        `
          refresh_token
        `,
      )
      .eq(
        "user_id",
        userId,
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load Google Calendar connection: ${error.message}`,
    );
  }

  /*
   * User simply has not connected Google yet.
   */
  if (!connection) {
    return [];
  }

  const accessToken =
    await getAccessToken(
      connection.refresh_token,
    );

  const googleEvents =
    await fetchGoogleEvents(
      accessToken,
      startDate,
      endDate,
    );

  return googleEvents
    .map(
      mapGoogleEvent,
    )
    .filter(
      (
        event,
      ): event is CalendarEvent =>
        event !== null,
    );
}
