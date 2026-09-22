import Link from "next/link";

import { getContextLabel } from "@/features/eat/config/restaurant-options";

import type { Restaurant } from "@/features/eat/types";

type RestaurantCardProps = {
  restaurant: Restaurant;
};

export default function RestaurantCard({ restaurant }: RestaurantCardProps) {
  return (
    <Link href={`/eat/${restaurant.id}`} className="group block">
      <article
        className="
          h-full
          rounded-[var(--radius-md)]
          border
          border-[var(--border)]
          bg-[var(--surface)]
          p-5
          transition
          duration-200
          group-hover:-translate-y-0.5
          group-hover:shadow-[0_12px_30px_rgba(38,35,31,0.06)]
        "
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-story text-xl font-semibold">
              {restaurant.name}
            </h3>

            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {[
                restaurant.area,

                ...restaurant.cuisines,

                restaurant.price_level
                  ? "$".repeat(restaurant.price_level)
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <span className="text-lg text-[var(--muted)] transition group-hover:translate-x-1">
            →
          </span>
        </div>

        {restaurant.contexts.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {restaurant.contexts.map((context) => (
              <span
                key={context}
                className="
                    rounded-full
                    bg-[var(--surface-soft)]
                    px-3
                    py-1
                    text-xs
                    text-[var(--muted)]
                  "
              >
                {getContextLabel(context)}
              </span>
            ))}
          </div>
        )}

        {restaurant.note && (
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
            {restaurant.note}
          </p>
        )}
      </article>
    </Link>
  );
}
