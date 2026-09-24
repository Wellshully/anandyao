import CancelDateButton from "@/features/dates/components/CancelDateButton";
import DateDaySection from "@/features/dates/components/DateDaySection";

import { getRestaurants } from "@/features/eat/lib/get-restaurants";

import { getPlannerPlaces } from "@/features/dates/lib/get-planner-places";

import { getTaipeiToday } from "@/lib/time/get-taipei-today";

import type { DateDetails } from "@/features/dates/types";

type DatePlannerProps = {
  details: DateDetails;
};

export default async function DatePlanner({ details }: DatePlannerProps) {
  const today = getTaipeiToday();

  const { date, currentUserParticipant } = details;

  const isPast = date.end_date < today;

  const isAccepted = date.status === "accepted";

  const isPending = date.status === "pending";

  const isCancelled = date.status === "cancelled";

  const isCompleted = date.status === "completed";

  const isDeclined = date.status === "declined";

  const isAcceptedParticipant = currentUserParticipant?.status === "accepted";

  const isOrganizer = currentUserParticipant?.role === "organizer";

  const canPlan = isAccepted && !isPast && isAcceptedParticipant;

  const canCancel =
    !isPast &&
    ((isAccepted && isAcceptedParticipant) || (isPending && isOrganizer));

  /*
   * Pending and declined dates do not
   * expose the planner yet.
   */

  if (isPending || isDeclined) {
    return (
      <div className="space-y-4">
        {canCancel && (
          <div className="flex justify-end">
            <CancelDateButton dateId={date.id} mode="withdraw" />
          </div>
        )}

        <div
          className="
            rounded-[var(--radius-md)]
            border
            border-dashed
            border-[var(--border)]
            p-8
          "
        >
          <p className="text-sm text-[var(--muted)]">
            {isDeclined
              ? "這個邀請已經婉拒。"
              : "對方接受約會後，就可以一起開始排行程。"}
          </p>
        </div>
      </div>
    );
  }

  const [restaurants, places] = await Promise.all([
    getRestaurants(),
    getPlannerPlaces(),
  ]);

  let readOnlyMessage: string | null = null;

  if (isCancelled) {
    readOnlyMessage = "這次 Date 已取消，原本排好的行程仍然保留。";
  } else if (isCompleted) {
    readOnlyMessage = "這次 Date 已完成，行程以唯讀方式保留。";
  } else if (isPast) {
    readOnlyMessage = "這個 Date 的日期已經過了，行程以唯讀方式保留。";
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          {readOnlyMessage && (
            <div
              className="
                rounded-[var(--radius-md)]
                border
                border-[var(--border)]
                bg-[var(--surface-soft)]
                px-4
                py-3
              "
            >
              <p className="text-sm text-[var(--muted)]">{readOnlyMessage}</p>
            </div>
          )}
        </div>

        {canCancel && <CancelDateButton dateId={date.id} />}
      </div>

      <div className="space-y-14">
        {details.days.map((plannerDay) => (
          <DateDaySection
            key={[
              plannerDay.day.id,
              ...plannerDay.items.map((item) => item.id),
              canPlan ? "edit" : "readonly",
            ].join(":")}
            dateId={date.id}
            plannerDay={plannerDay}
            canPlan={canPlan}
            restaurants={restaurants}
            places={places}
          />
        ))}
      </div>
    </div>
  );
}
