import Link from "next/link";
import { notFound } from "next/navigation";

import RestaurantActions from "@/features/eat/components/RestaurantActions";
import { getContextLabel } from "@/features/eat/config/restaurant-options";
import { getRestaurant } from "@/features/eat/lib/get-restaurant";

type RestaurantPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "long",
  day: "numeric",
});

export default async function RestaurantPage({ params }: RestaurantPageProps) {
  const { id } = await params;

  const details = await getRestaurant(id);

  if (!details) {
    notFound();
  }

  const { restaurant, visits } = details;

  const lastVisit = visits[0];

  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-10">
      <Link href="/eat" className="text-sm text-[var(--muted)]">
        ← Eat
      </Link>

      <section className="mt-8">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
            {restaurant.area ?? "Restaurant"}
          </p>

          <h1 className="font-story mt-3 text-4xl font-semibold sm:text-5xl">
            {restaurant.name}
          </h1>

          {restaurant.is_hidden && (
            <span
              className="
                mt-4
                inline-block
                rounded-full
                bg-[var(--surface-soft)]
                px-3
                py-1
                text-xs
                text-[var(--muted)]
              "
            >
              Hidden from picker
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {restaurant.cuisines.map((cuisine) => (
            <span
              key={cuisine}
              className="
                  rounded-full
                  bg-[var(--surface-soft)]
                  px-3
                  py-1.5
                  text-sm
                  text-[var(--muted)]
                "
            >
              {cuisine}
            </span>
          ))}

          {restaurant.price_level && (
            <span
              className="
                rounded-full
                bg-[var(--surface-soft)]
                px-3
                py-1.5
                text-sm
                text-[var(--muted)]
              "
            >
              {"$".repeat(restaurant.price_level)}
            </span>
          )}
        </div>

        {restaurant.contexts.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {restaurant.contexts.map((context) => (
              <span
                key={context}
                className="
                    rounded-full
                    border
                    border-[var(--border)]
                    px-3
                    py-1.5
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
          <p className="mt-8 whitespace-pre-line leading-7 text-[var(--muted)]">
            {restaurant.note}
          </p>
        )}

        {(restaurant.address || restaurant.google_maps_url) && (
          <div
            className="
              mt-8
              rounded-[var(--radius-md)]
              border
              border-[var(--border)]
              bg-[var(--surface)]
              p-5
            "
          >
            {restaurant.address && (
              <p className="text-sm leading-6">{restaurant.address}</p>
            )}

            {restaurant.google_maps_url && (
              <a
                href={restaurant.google_maps_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm underline underline-offset-4"
              >
                Google Maps ↗
              </a>
            )}
          </div>
        )}

        <RestaurantActions
          restaurantId={restaurant.id}
          isHidden={restaurant.is_hidden}
        />
      </section>

      <section className="mt-14 border-t border-[var(--border)] pt-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Our history
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div
            className="
              rounded-[var(--radius-md)]
              bg-[var(--surface-soft)]
              p-5
            "
          >
            <p className="text-sm text-[var(--muted)]">吃過</p>

            <p className="font-story mt-2 text-3xl font-semibold">
              {visits.length}
              <span className="ml-1 text-lg">次</span>
            </p>
          </div>

          <div
            className="
              rounded-[var(--radius-md)]
              bg-[var(--surface-soft)]
              p-5
            "
          >
            <p className="text-sm text-[var(--muted)]">上次吃</p>

            <p className="font-story mt-2 text-xl font-semibold">
              {lastVisit
                ? dateFormatter.format(new Date(lastVisit.visited_at))
                : "還沒有"}
            </p>
          </div>
        </div>
      </section>

      {visits.length > 0 && (
        <section className="mt-12">
          <h2 className="font-story text-2xl font-semibold">Visit history</h2>

          <div className="mt-5 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {visits.map((visit) => (
              <div key={visit.id} className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm">
                    {dateFormatter.format(new Date(visit.visited_at))}
                  </p>

                  {visit.selected_by_picker && (
                    <span className="text-xs text-[var(--muted)]">
                      Eat 幫我們選的
                    </span>
                  )}
                </div>

                {visit.note && (
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {visit.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
