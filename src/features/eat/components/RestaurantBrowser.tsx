"use client";

import { useMemo, useState } from "react";

import RestaurantCard from "@/features/eat/components/RestaurantCard";

import type { Restaurant } from "@/features/eat/types";

type RestaurantBrowserProps = {
  restaurants: Restaurant[];
};

const PAGE_SIZE = 24;

export default function RestaurantBrowser({
  restaurants,
}: RestaurantBrowserProps) {
  const [search, setSearch] = useState("");

  const [selectedArea, setSelectedArea] = useState("");

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const areas = useMemo(
    () =>
      Array.from(
        new Set(
          restaurants
            .map((restaurant) => restaurant.area)
            .filter((area): area is string => Boolean(area)),
        ),
      ).sort(),
    [restaurants],
  );

  const filteredRestaurants = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return restaurants.filter((restaurant) => {
      if (selectedArea && restaurant.area !== selectedArea) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchable = [
        restaurant.name,
        restaurant.area,
        ...restaurant.cuisines,
        restaurant.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [restaurants, search, selectedArea]);

  const visibleRestaurants = filteredRestaurants.slice(0, visibleCount);

  function selectArea(area: string) {
    setSelectedArea(area);

    setVisibleCount(PAGE_SIZE);
  }

  return (
    <section>
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Our database
          </p>

          <h2 className="font-story mt-2 text-3xl font-semibold">
            Restaurants
          </h2>
        </div>

        <p className="text-sm text-[var(--muted)]">
          {filteredRestaurants.length} places
        </p>
      </div>

      <div className="mt-6">
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);

            setVisibleCount(PAGE_SIZE);
          }}
          placeholder="搜尋店名、料理、備註..."
          className="
            w-full
            rounded-2xl
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-5
            py-3.5
            outline-none
            transition
            placeholder:text-[var(--muted)]
            focus:border-[var(--foreground)]
          "
        />
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => selectArea("")}
          className={`
            shrink-0
            rounded-full
            border
            px-4
            py-2
            text-sm
            transition

            ${
              !selectedArea
                ? `
                  border-[var(--foreground)]
                  bg-[var(--foreground)]
                  text-[var(--on-foreground)]
                `
                : `
                  border-[var(--border)]
                  bg-[var(--surface)]
                  text-[var(--muted)]
                `
            }
          `}
        >
          全部
        </button>

        {areas.map((area) => {
          const selected = selectedArea === area;

          return (
            <button
              key={area}
              type="button"
              onClick={() => selectArea(area)}
              className={`
                  shrink-0
                  rounded-full
                  border
                  px-4
                  py-2
                  text-sm
                  transition

                  ${
                    selected
                      ? `
                        border-[var(--foreground)]
                        bg-[var(--foreground)]
                        text-[var(--on-foreground)]
                      `
                      : `
                        border-[var(--border)]
                        bg-[var(--surface)]
                        text-[var(--muted)]
                      `
                  }
                `}
            >
              {area}
            </button>
          );
        })}
      </div>

      {visibleRestaurants.length === 0 ? (
        <div
          className="
            mt-8
            rounded-[var(--radius-md)]
            border
            border-dashed
            border-[var(--border)]
            p-10
            text-center
          "
        >
          <p className="font-story text-xl">沒找到符合的餐廳。</p>

          <p className="mt-2 text-sm text-[var(--muted)]">
            換個關鍵字或地區看看。
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {visibleRestaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>

          {visibleCount < filteredRestaurants.length && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((current) => current + PAGE_SIZE)
                }
                className="
                  rounded-xl
                  border
                  border-[var(--border)]
                  bg-[var(--surface)]
                  px-5
                  py-3
                  text-sm
                  transition
                  hover:bg-[var(--surface-soft)]
                "
              >
                顯示更多
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
