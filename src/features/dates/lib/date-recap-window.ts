export type DateRecapWindowState =
  | "not_ready"
  | "available"
  | "expired"
  | "completed";

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day + days));

  return date.toISOString().slice(0, 10);
}

export function getDateRecapDeadline(endDate: string) {
  return addDays(endDate, 7);
}

export function getDateRecapWindowState({
  endDate,
  today,
  recapStatus,
}: {
  endDate: string;
  today: string;
  recapStatus?: "draft" | "completed";
}): DateRecapWindowState {
  if (recapStatus === "completed") {
    return "completed";
  }

  /*
   * The Date hasn't ended yet.
   */
  if (endDate >= today) {
    return "not_ready";
  }

  const deadline = getDateRecapDeadline(endDate);

  if (today <= deadline) {
    return "available";
  }

  return "expired";
}
