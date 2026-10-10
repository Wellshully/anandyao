import {
  getDateRecapDeadline,
  getDateRecapWindowState,
} from "../../dates/lib/date-recap-window";

type Candidate = {
  id: string;
  title: string;
  endDate: string;
  status: string;
  participantStatus: string | null;
};

export type HomePendingDateRecap = {
  id: string;
  title: string;
  endDate: string;
  deadline: string;
};

export function selectHomePendingDateRecaps(
  candidates: Candidate[],
  statuses: Record<string, "draft" | "completed">,
  today: string,
): HomePendingDateRecap[] {
  return candidates
    .filter((date) =>
      date.status === "accepted" &&
      date.participantStatus === "accepted" &&
      getDateRecapWindowState({
        endDate: date.endDate,
        today,
        recapStatus: statuses[date.id],
      }) === "available",
    )
    .map((date) => ({
      id: date.id,
      title: date.title,
      endDate: date.endDate,
      deadline: getDateRecapDeadline(date.endDate),
    }))
    .sort((a, b) =>
      b.endDate.localeCompare(a.endDate),
    );
}
