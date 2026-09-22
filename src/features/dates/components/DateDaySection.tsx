import AddItineraryForm from "@/features/dates/components/AddItineraryForm";
import SortableItineraryList from "@/features/dates/components/SortableItineraryList";

import type { DatePlannerDay, PlannerPlace } from "@/features/dates/types";

import type { Restaurant } from "@/features/eat/types";

type DateDaySectionProps = {
  dateId: string;

  plannerDay: DatePlannerDay;

  canPlan: boolean;

  restaurants: Restaurant[];

  places: PlannerPlace[];
};

const formatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",

  month: "long",

  day: "numeric",

  weekday: "short",
});

function formatDate(value: string) {
  return formatter.format(new Date(`${value}T00:00:00+08:00`));
}

export default function DateDaySection({
  dateId,
  plannerDay,
  canPlan,
  restaurants,
  places,
}: DateDaySectionProps) {
  const { day, items } = plannerDay;

  return (
    <section>
      <div className="flex items-end justify-between gap-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            Day {day.day_number}
          </p>

          <h2 className="font-story mt-2 text-2xl font-semibold">
            {day.title ?? formatDate(day.date)}
          </h2>
        </div>

        <p className="text-xs text-[var(--muted)]">
          從 {day.planning_start_time.slice(0, 5)} 開始
        </p>
      </div>

      {day.note && (
        <p className="mt-3 text-sm text-[var(--muted)]">{day.note}</p>
      )}

      <div className="mt-6">
        {items.length === 0 ? (
          <div
            className="
              rounded-[var(--radius-md)]
              border
              border-dashed
              border-[var(--border)]
              p-6
              text-sm
              text-[var(--muted)]
            "
          >
            這一天還沒有行程。
          </div>
        ) : (
          <SortableItineraryList
            dateId={dateId}
            dateDayId={day.id}
            date={day.date}
            planningStartTime={day.planning_start_time}
            items={items}
          />
        )}
      </div>

      {canPlan && (
        <div className="mt-4">
          <AddItineraryForm
            dateId={dateId}
            dateDayId={day.id}
            restaurants={restaurants}
            places={places}
          />
        </div>
      )}
    </section>
  );
}
