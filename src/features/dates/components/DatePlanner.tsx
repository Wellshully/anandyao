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

  /*
   * Organizer can start planning immediately,
   * even while the invitation is still pending.
   *
   * After the invitation is accepted, accepted
   * participants can plan normally.
   */
  const canPlan =
    !isPast &&
    ((isPending && isOrganizer) || (isAccepted && isAcceptedParticipant));

  const canCancel =
    !isPast &&
    ((isAccepted && isAcceptedParticipant) || (isPending && isOrganizer));

  /*
   * A pending invitee still waits for the
   * invitation flow.
   *
   * The organizer, however, is allowed into
   * the planner immediately.
   */
  if ((isPending && !isOrganizer) || isDeclined) {
    return (
      <div className="space-y-4">
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
            {isDeclined ? "這個邀請已經婉拒。" : "邀請還在等待回覆。"}
          </p>
        </div>
      </div>
    );
  }

  const [restaurants, places] = await Promise.all([
    getRestaurants(),
    getPlannerPlaces(),
  ]);

  let plannerMessage: string | null = null;

  if (isCancelled) {
    plannerMessage = "這次 Date 已取消，原本排好的行程仍然保留。";
  } else if (isCompleted) {
    plannerMessage = "這次 Date 已完成，行程以唯讀方式保留。";
  } else if (isPast) {
    plannerMessage = "這個 Date 的日期已經過了，行程以唯讀方式保留。";
  } else if (isPending && isOrganizer) {
    plannerMessage = "邀請還在等待回覆，你可以先把行程排好。";
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          {plannerMessage && (
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
              <p className="text-sm text-[var(--muted)]">{plannerMessage}</p>
            </div>
          )}
        </div>

        {canCancel &&
          (isPending ? (
            <CancelDateButton dateId={date.id} mode="withdraw" />
          ) : (
            <CancelDateButton dateId={date.id} />
          ))}
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
