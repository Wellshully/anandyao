import Link from "next/link";

import type { RecentRestaurantVisit } from "@/features/eat/lib/get-recent-restaurant-visits";

type RecentEatsProps = {
  visits: RecentRestaurantVisit[];
};

const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  month: "numeric",
  day: "numeric",
});

export default function RecentEats({ visits }: RecentEatsProps) {
  if (visits.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Recently
          </p>

          <h2 className="font-story mt-2 text-3xl font-semibold">最近吃過</h2>
        </div>
      </div>

      <div className="mt-6 flex gap-4 overflow-x-auto pb-3">
        {visits.map(({ visit, restaurant }) => (
          <Link
            key={visit.id}
            href={`/eat/${restaurant.id}`}
            className="
                group
                min-w-[230px]
                max-w-[230px]
                rounded-[var(--radius-md)]
                border
                border-[var(--border)]
                bg-[var(--surface)]
                p-5
                transition
                hover:-translate-y-0.5
                hover:shadow-[0_10px_25px_rgba(38,35,31,0.05)]
              "
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-[var(--muted)]">
                {dateFormatter.format(new Date(visit.visited_at))}
              </p>

              <span className="text-sm text-[var(--muted)] transition group-hover:translate-x-1">
                →
              </span>
            </div>

            <h3 className="font-story mt-5 text-xl font-semibold">
              {restaurant.name}
            </h3>

            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {[restaurant.area, ...restaurant.cuisines.slice(0, 2)]
                .filter(Boolean)
                .join(" · ")}
            </p>

            {visit.selected_by_picker && (
              <p className="mt-4 text-xs text-[var(--accent)]">
                Eat 幫我們選的
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
