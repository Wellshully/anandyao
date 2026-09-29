import Link from "next/link";

import EatPicker from "@/features/eat/components/EatPicker";
import RecentEats from "@/features/eat/components/RecentEats";
import RestaurantBrowser from "@/features/eat/components/RestaurantBrowser";

import { getRecentRestaurantVisits } from "@/features/eat/lib/get-recent-restaurant-visits";

import { getRestaurants } from "@/features/eat/lib/get-restaurants";

export default async function EatPage() {
  const [restaurants, recentVisits] = await Promise.all([
    getRestaurants(),
    getRecentRestaurantVisits(10),
  ]);

  const areas = Array.from(
    new Set(
      restaurants
        .map((restaurant) => restaurant.area)
        .filter((area): area is string => Boolean(area)),
    ),
  ).sort();

  const cuisines = Array.from(
    new Set(restaurants.flatMap((restaurant) => restaurant.cuisines)),
  ).sort();

  return (
    <div className="py-4 sm:py-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
            Everyday problem
          </p>

          <h1 className="font-story mt-3 text-4xl font-semibold sm:text-5xl">
            Eat
          </h1>

          <p className="mt-4 max-w-xl leading-7 text-[var(--muted)]">
            最大的問題不是要不要吃， 是到底要吃什麼。
          </p>
        </div>

        <Link
          href="/eat/new"
          className="
            shrink-0
            rounded-xl
            bg-[var(--foreground)]
            px-4
            py-2.5
            text-sm
            font-medium
            text-[var(--on-foreground)]
          "
        >
          Add restaurant
        </Link>
      </div>

      <div className="mt-10">
        <EatPicker areas={areas} cuisines={cuisines} />
      </div>

      {recentVisits.length > 0 && (
        <div className="mt-16">
          <RecentEats visits={recentVisits} />
        </div>
      )}

      <div className="mt-16">
        <RestaurantBrowser restaurants={restaurants} />
      </div>
    </div>
  );
}
