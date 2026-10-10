import "server-only";

import {
  getDates,
} from "@/features/dates/lib/get-dates";

import {
  getDateRecapStatuses,
} from "@/features/dates/recap/lib/get-date-recap-statuses";

import {
  getTaipeiToday,
} from "@/lib/time/get-taipei-today";

import {
  selectHomePendingDateRecaps,
} from "./select-home-date-recaps";

export async function getHomePendingDateRecaps() {
  try {
    const [dates, statuses] = await Promise.all([
      getDates(),
      getDateRecapStatuses(),
    ]);

    return selectHomePendingDateRecaps(
      dates.map((item) => ({
        id: item.date.id,
        title: item.date.title,
        endDate: item.date.end_date,
        status: item.date.status,
        participantStatus:
          item.currentUserParticipant?.status ?? null,
      })),
      statuses,
      getTaipeiToday(),
    );
  } catch (error) {
    // A recap query failure must not break Home.
    console.warn(
      "[Home Date recap query failed]",
      error,
    );

    return [];
  }
}
