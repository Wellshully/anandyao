"use client";

import { useMemo, useState, useTransition } from "react";

import {
  pickRestaurantAction,
  recordRestaurantVisitAction,
} from "@/features/eat/actions";

import {
  getContextLabel,
  RESTAURANT_CONTEXTS,
} from "@/features/eat/config/restaurant-options";

import type { RestaurantPickResult } from "@/features/eat/types";

type EatPickerProps = {
  areas: string[];
  cuisines: string[];
};

function toggleItem(current: string[], value: string) {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

export default function EatPicker({ areas, cuisines }: EatPickerProps) {
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);

  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);

  const [maxPriceLevel, setMaxPriceLevel] = useState<number | undefined>();

  const [showAllCuisines, setShowAllCuisines] = useState(false);

  const [result, setResult] = useState<RestaurantPickResult | null>(null);

  const [message, setMessage] = useState("");

  const [recorded, setRecorded] = useState(false);

  const [isPending, startTransition] = useTransition();

  const hasFilters =
    selectedAreas.length > 0 ||
    selectedCuisines.length > 0 ||
    selectedContexts.length > 0 ||
    maxPriceLevel !== undefined;

  const visibleCuisines = useMemo(() => {
    if (showAllCuisines) {
      return cuisines;
    }

    return Array.from(new Set([...cuisines.slice(0, 10), ...selectedCuisines]));
  }, [cuisines, selectedCuisines, showAllCuisines]);

  function clearFilters() {
    setSelectedAreas([]);
    setSelectedCuisines([]);
    setSelectedContexts([]);
    setMaxPriceLevel(undefined);
  }

  function runPicker(excludeCurrent = false) {
    setMessage("");
    setRecorded(false);

    startTransition(async () => {
      try {
        const options = {
          areas: selectedAreas.length > 0 ? selectedAreas : undefined,

          cuisines: selectedCuisines.length > 0 ? selectedCuisines : undefined,

          contexts: selectedContexts.length > 0 ? selectedContexts : undefined,

          maxPriceLevel,

          avoidVisitedWithinDays: 7,

          excludeRestaurantIds:
            excludeCurrent && result ? [result.restaurant.id] : undefined,
        };

        let nextResult = await pickRestaurantAction(options);

        // 如果篩完只剩目前這間，
        // 不要因為「再選一次」而得到空結果。
        if (!nextResult && excludeCurrent) {
          nextResult = await pickRestaurantAction({
            ...options,
            excludeRestaurantIds: undefined,
          });
        }

        setResult(nextResult);

        if (!nextResult) {
          setMessage("沒有符合這些條件的餐廳，可以放寬一點條件。");
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "選餐廳時發生錯誤。",
        );
      }
    });
  }

  function recordVisit() {
    if (!result) {
      return;
    }

    startTransition(async () => {
      try {
        await recordRestaurantVisitAction({
          restaurantId: result.restaurant.id,

          selectedByPicker: true,
        });

        setRecorded(true);

        setMessage("記下來了，今天就吃這間。");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "紀錄時發生錯誤。");
      }
    });
  }

  return (
    <section
      className="
        rounded-[var(--radius-lg)]
        border
        border-[var(--border)]
        bg-[var(--surface)]
        p-6
        sm:p-8
      "
    >
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
            Pick for us
          </p>

          <h2 className="font-story mt-3 text-3xl font-semibold sm:text-4xl">
            今天吃什麼？
          </h2>

          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            給一點條件，剩下的交給命運。
          </p>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="shrink-0 text-xs text-[var(--muted)] underline underline-offset-4"
          >
            清除條件
          </button>
        )}
      </div>

      {/* AREA */}

      <fieldset className="mt-9">
        <legend className="text-sm font-medium">今天想在哪裡吃？</legend>

        <div className="mt-3 flex flex-wrap gap-2">
          {areas.map((area) => {
            const selected = selectedAreas.includes(area);

            return (
              <button
                key={area}
                type="button"
                onClick={() =>
                  setSelectedAreas((current) => toggleItem(current, area))
                }
                className={`
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
                          text-white
                        `
                        : `
                          border-[var(--border)]
                          bg-[var(--background)]
                          text-[var(--muted)]
                          hover:text-[var(--foreground)]
                        `
                    }
                  `}
              >
                {area}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* CUISINE */}

      <fieldset className="mt-8">
        <legend className="text-sm font-medium">想吃什麼？</legend>

        <div className="mt-3 flex flex-wrap gap-2">
          {visibleCuisines.map((cuisine) => {
            const selected = selectedCuisines.includes(cuisine);

            return (
              <button
                key={cuisine}
                type="button"
                onClick={() =>
                  setSelectedCuisines((current) => toggleItem(current, cuisine))
                }
                className={`
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
                          text-white
                        `
                        : `
                          border-[var(--border)]
                          bg-[var(--background)]
                          text-[var(--muted)]
                          hover:text-[var(--foreground)]
                        `
                    }
                  `}
              >
                {cuisine}
              </button>
            );
          })}
        </div>

        {cuisines.length > 10 && (
          <button
            type="button"
            onClick={() => setShowAllCuisines((current) => !current)}
            className="mt-3 text-xs text-[var(--muted)] underline underline-offset-4"
          >
            {showAllCuisines ? "收起" : `看全部 ${cuisines.length} 種`}
          </button>
        )}
      </fieldset>

      {/* CONTEXT */}

      <fieldset className="mt-8">
        <legend className="text-sm font-medium">今天是哪種吃法？</legend>

        <div className="mt-3 flex flex-wrap gap-2">
          {RESTAURANT_CONTEXTS.map((context) => {
            const selected = selectedContexts.includes(context.value);

            return (
              <button
                key={context.value}
                type="button"
                onClick={() =>
                  setSelectedContexts((current) =>
                    toggleItem(current, context.value),
                  )
                }
                className={`
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
                          text-white
                        `
                        : `
                          border-[var(--border)]
                          bg-[var(--background)]
                          text-[var(--muted)]
                        `
                    }
                  `}
              >
                {context.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* PRICE */}

      <fieldset className="mt-8">
        <legend className="text-sm font-medium">最多想花多少？</legend>

        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((level) => {
            const selected = maxPriceLevel === level;

            return (
              <button
                key={level}
                type="button"
                onClick={() => setMaxPriceLevel(selected ? undefined : level)}
                className={`
                    min-w-14
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
                          text-white
                        `
                        : `
                          border-[var(--border)]
                          bg-[var(--background)]
                          text-[var(--muted)]
                        `
                    }
                  `}
              >
                {"$".repeat(level)}
              </button>
            );
          })}
        </div>

        {maxPriceLevel && (
          <p className="mt-2 text-xs text-[var(--muted)]">
            會包含 $ 到 {"$".repeat(maxPriceLevel)} 的餐廳。
          </p>
        )}
      </fieldset>

      {/* PICK */}

      <div className="mt-9 border-t border-[var(--border)] pt-6">
        <button
          type="button"
          disabled={isPending}
          onClick={() => runPicker(false)}
          className="
            w-full
            rounded-xl
            bg-[var(--foreground)]
            px-6
            py-3.5
            text-sm
            font-medium
            text-white
            transition
            hover:opacity-90
            disabled:opacity-50
            sm:w-auto
          "
        >
          {isPending ? "正在想..." : "幫我們選"}
        </button>
      </div>

      {/* RESULT */}

      {result && (
        <div
          className="
            mt-10
            rounded-[var(--radius-lg)]
            bg-[var(--surface-soft)]
            p-6
            sm:p-8
          "
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
                Today&apos;s pick
              </p>

              <h3 className="font-story mt-3 text-3xl font-semibold sm:text-4xl">
                {result.restaurant.name}
              </h3>
            </div>

            <span className="text-xs text-[var(--muted)]">
              {result.candidateCount} 間候選
            </span>
          </div>

          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
            {[
              result.restaurant.area,

              ...result.restaurant.cuisines,

              result.restaurant.price_level
                ? "$".repeat(result.restaurant.price_level)
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {result.restaurant.contexts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {result.restaurant.contexts.map((context) => (
                <span
                  key={context}
                  className="
                        rounded-full
                        border
                        border-[var(--border)]
                        bg-[var(--surface)]
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

          {result.restaurant.note && (
            <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
              {result.restaurant.note}
            </p>
          )}

          {result.usedRecentFallback && (
            <p className="mt-5 text-xs leading-5 text-[var(--muted)]">
              最近符合條件的店幾乎都吃過了，所以這次也把近期吃過的店放回候選。
            </p>
          )}

          {result.restaurant.google_maps_url && (
            <a
              href={result.restaurant.google_maps_url}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-block text-sm underline underline-offset-4"
            >
              Google Maps ↗
            </a>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isPending || recorded}
              onClick={recordVisit}
              className="
                rounded-xl
                bg-[var(--foreground)]
                px-5
                py-2.5
                text-sm
                font-medium
                text-white
                transition
                disabled:opacity-40
              "
            >
              {recorded ? "已記錄" : "就吃這間"}
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => runPicker(true)}
              className="
                rounded-xl
                border
                border-[var(--border)]
                bg-[var(--surface)]
                px-5
                py-2.5
                text-sm
                transition
                hover:bg-[var(--background)]
              "
            >
              再選一次
            </button>
          </div>
        </div>
      )}

      {message && <p className="mt-5 text-sm text-[var(--muted)]">{message}</p>}
    </section>
  );
}
