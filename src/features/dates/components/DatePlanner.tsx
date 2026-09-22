import DateDaySection from "@/features/dates/components/DateDaySection";

import type { DateDetails } from "@/features/dates/types";

type DatePlannerProps = {
  details: DateDetails;
};

export default function DatePlanner({ details }: DatePlannerProps) {
  const canPlan =
    details.date.status === "accepted" &&
    details.currentUserParticipant?.status === "accepted";

  if (!canPlan) {
    return (
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
          對方接受約會後， 就可以一起開始排行程。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-14">
      {details.days.map((plannerDay) => (
        <DateDaySection
          key={plannerDay.day.id}
          dateId={details.date.id}
          plannerDay={plannerDay}
          canPlan={canPlan}
        />
      ))}
    </div>
  );
}
