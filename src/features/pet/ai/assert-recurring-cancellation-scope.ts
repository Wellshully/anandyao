import type { PetReply } from "./pet-reply";

export function assertRecurringCancellationScope(
  message: string,
  scheduleActions: PetReply["recurringScheduleActions"],
  occurrenceActions: PetReply["recurringOccurrenceActions"],
) {
  const cancelsSeries = scheduleActions.some(
    (action) => action.action === "cancel",
  );

  if (!cancelsSeries) {
    return;
  }

  if (occurrenceActions.length > 0) {
    throw new Error(
      "Cannot mix whole-series cancellation with occurrence actions.",
    );
  }

  const normalized = message
    .normalize("NFKC")
    .replace(/\s+/gu, "");

  const explicitSeries =
    /(?:以後|往後|之後都|不再|永遠|每週|每周|每星期|每禮拜|隔週|整個|所有|全部|固定行程)/u.test(
      normalized,
    );

  const specificOccurrence =
    /(?:今天|明天|後天|這週|本週|下週|這星期|下星期|這禮拜|下禮拜|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|\d{1,2}月\d{1,2}日)/u.test(
      normalized,
    );

  if (!explicitSeries || specificOccurrence) {
    throw new Error(
      "Whole-series cancellation requires unambiguous series-level intent.",
    );
  }
}
