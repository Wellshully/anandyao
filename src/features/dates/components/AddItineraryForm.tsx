"use client";

import type { FormEvent } from "react";

import { useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { addItineraryItemAction } from "@/features/dates/actions";

import type {
  DateItineraryItem,
  ItineraryItemType,
  ItineraryTimingType,
  PlannerPlace,
} from "@/features/dates/types";

import type { Restaurant } from "@/features/eat/types";

type AddItineraryFormProps = {
  dateId: string;
  dateDayId: string;

  restaurants: Restaurant[];

  places: PlannerPlace[];

  onItemAdded?: (item: DateItineraryItem) => void;
};
type AddMode = "eat" | "place" | "custom";

const ITEM_TYPES: {
  value: ItineraryItemType;
  label: string;
}[] = [
  {
    value: "place",
    label: "景點",
  },
  {
    value: "restaurant",
    label: "餐廳",
  },
  {
    value: "transport",
    label: "交通",
  },
  {
    value: "hotel",
    label: "住宿",
  },
  {
    value: "activity",
    label: "活動",
  },
  {
    value: "note",
    label: "備註",
  },
];

function getPlaceStatusLabel(status: string) {
  switch (status) {
    case "want_to_go":
      return "想去";

    case "visited":
      return "去過";

    case "revisit":
      return "想再去";

    default:
      return status;
  }
}

export default function AddItineraryForm({
  dateId,
  dateDayId,
  restaurants,
  places,
  onItemAdded,
}: AddItineraryFormProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);

  const [mode, setMode] = useState<AddMode>("eat");

  const [itemType, setItemType] = useState<ItineraryItemType>("activity");

  const [timingType, setTimingType] = useState<ItineraryTimingType>("flexible");

  /*
   * Eat
   */

  const [restaurantSearch, setRestaurantSearch] = useState("");

  const [selectedRestaurantId, setSelectedRestaurantId] = useState<
    string | null
  >(null);

  /*
   * Places
   */

  const [placeSearch, setPlaceSearch] = useState("");

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  /*
   * Form state
   */

  const [error, setError] = useState("");

  const [isPending, startTransition] = useTransition();

  /*
   * Restaurant search
   */

  const filteredRestaurants = useMemo(() => {
    const query = restaurantSearch.trim().toLowerCase();

    if (!query) {
      return restaurants.slice(0, 12);
    }

    return restaurants
      .filter((restaurant) => {
        const haystack = [
          restaurant.name,
          restaurant.area,
          ...restaurant.cuisines,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .slice(0, 12);
  }, [restaurantSearch, restaurants]);

  const selectedRestaurant = selectedRestaurantId
    ? restaurants.find((restaurant) => restaurant.id === selectedRestaurantId)
    : undefined;

  /*
   * Places search
   */

  const filteredPlaces = useMemo(() => {
    const query = placeSearch.trim().toLowerCase();

    if (!query) {
      return places.slice(0, 12);
    }

    return places
      .filter((place) => {
        const haystack = [place.name, place.address, place.note]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .slice(0, 12);
  }, [placeSearch, places]);

  const selectedPlace = selectedPlaceId
    ? places.find((place) => place.id === selectedPlaceId)
    : undefined;

  function reset() {
    setMode("eat");

    setItemType("activity");

    setTimingType("flexible");

    setRestaurantSearch("");

    setSelectedRestaurantId(null);

    setPlaceSearch("");

    setSelectedPlaceId(null);

    setError("");
  }

  function close() {
    reset();

    setIsOpen(false);
  }

  function changeMode(nextMode: AddMode) {
    setMode(nextMode);

    setError("");

    if (nextMode === "eat") {
      setItemType("restaurant");

      setSelectedPlaceId(null);
    }

    if (nextMode === "place") {
      setItemType("place");

      setSelectedRestaurantId(null);
    }

    if (nextMode === "custom") {
      setSelectedRestaurantId(null);

      setSelectedPlaceId(null);

      setItemType("activity");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    const form = new FormData(event.currentTarget);

    if (mode === "eat" && !selectedRestaurantId) {
      setError("請先選一間餐廳。");

      return;
    }

    if (mode === "place" && !selectedPlaceId) {
      setError("請先選一個地點。");

      return;
    }

    const durationMinutes = Number(form.get("durationMinutes") ?? 60);

    startTransition(async () => {
      const result = await addItineraryItemAction({
        dateId,
        dateDayId,

        itemType:
          mode === "eat" ? "restaurant" : mode === "place" ? "place" : itemType,

        restaurantId:
          mode === "eat" ? (selectedRestaurantId ?? undefined) : undefined,

        placeId: mode === "place" ? (selectedPlaceId ?? undefined) : undefined,

        title:
          mode === "eat"
            ? (selectedRestaurant?.name ?? "")
            : mode === "place"
              ? (selectedPlace?.name ?? "")
              : String(form.get("title") ?? ""),

        description: String(form.get("description") ?? "") || undefined,

        locationName:
          mode === "custom"
            ? String(form.get("locationName") ?? "") || undefined
            : undefined,

        address:
          mode === "custom"
            ? String(form.get("address") ?? "") || undefined
            : undefined,

        googleMapsUrl:
          mode === "custom"
            ? String(form.get("googleMapsUrl") ?? "") || undefined
            : undefined,

        timingType,

        fixedStartTime:
          timingType === "fixed"
            ? String(form.get("fixedStartTime") ?? "")
            : undefined,

        durationMinutes,
      });

      if (!result.success) {
        setError(result.error);

        return;
      }
      onItemAdded?.(result.item);

      close();

      router.refresh();
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="
          rounded-xl
          border
          border-dashed
          border-[var(--border)]
          px-4
          py-3
          text-sm
          text-[var(--muted)]
          transition
          hover:border-[var(--foreground)]
          hover:text-[var(--foreground)]
        "
      >
        + Add plan
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="
        rounded-[var(--radius-md)]
        border
        border-[var(--border)]
        bg-[var(--surface)]
        p-5
      "
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Itinerary
          </p>

          <h4 className="mt-1 font-medium">Add plan</h4>
        </div>

        <button
          type="button"
          onClick={close}
          className="text-sm text-[var(--muted)]"
        >
          Cancel
        </button>
      </div>

      {/* Source / module */}

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => changeMode("eat")}
          className={`
            rounded-xl
            border
            px-4
            py-3
            text-sm
            transition

            ${
              mode === "eat"
                ? `
                  border-[var(--foreground)]
                  bg-[var(--foreground)]
                  text-white
                `
                : `
                  border-[var(--border)]
                `
            }
          `}
        >
          從 Eat 選餐廳
        </button>

        <button
          type="button"
          onClick={() => changeMode("place")}
          className={`
            rounded-xl
            border
            px-4
            py-3
            text-sm
            transition

            ${
              mode === "place"
                ? `
                  border-[var(--foreground)]
                  bg-[var(--foreground)]
                  text-white
                `
                : `
                  border-[var(--border)]
                `
            }
          `}
        >
          從 Places 選地點
        </button>

        <button
          type="button"
          onClick={() => changeMode("custom")}
          className={`
            rounded-xl
            border
            px-4
            py-3
            text-sm
            transition

            ${
              mode === "custom"
                ? `
                  border-[var(--foreground)]
                  bg-[var(--foreground)]
                  text-white
                `
                : `
                  border-[var(--border)]
                `
            }
          `}
        >
          自己建立
        </button>
      </div>

      {/* Eat */}

      {mode === "eat" && (
        <div className="mt-6">
          <label className="block">
            <span className="text-sm font-medium">找餐廳</span>

            <input
              value={restaurantSearch}
              onChange={(event) => setRestaurantSearch(event.target.value)}
              placeholder="名稱、地區、料理..."
              className="
                mt-2
                w-full
                rounded-xl
                border
                border-[var(--border)]
                bg-[var(--background)]
                px-4
                py-3
                outline-none
              "
            />
          </label>

          {selectedRestaurant ? (
            <div
              className="
                mt-4
                rounded-[var(--radius-md)]
                border
                border-[var(--foreground)]
                bg-[var(--surface-soft)]
                p-4
              "
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{selectedRestaurant.name}</p>

                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {[
                      selectedRestaurant.area,
                      ...selectedRestaurant.cuisines.slice(0, 2),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRestaurantId(null)}
                  className="text-xs text-[var(--muted)]"
                >
                  換一間
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {filteredRestaurants.map((restaurant) => (
                <button
                  key={restaurant.id}
                  type="button"
                  onClick={() => setSelectedRestaurantId(restaurant.id)}
                  className="
                      w-full
                      rounded-xl
                      border
                      border-[var(--border)]
                      bg-[var(--background)]
                      p-3
                      text-left
                      transition
                      hover:border-[var(--foreground)]
                    "
                >
                  <p className="text-sm font-medium">{restaurant.name}</p>

                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {[restaurant.area, ...restaurant.cuisines.slice(0, 2)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </button>
              ))}

              {filteredRestaurants.length === 0 && (
                <p className="py-5 text-center text-sm text-[var(--muted)]">
                  找不到餐廳。
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Places */}

      {mode === "place" && (
        <div className="mt-6">
          <label className="block">
            <span className="text-sm font-medium">找地點</span>

            <input
              value={placeSearch}
              onChange={(event) => setPlaceSearch(event.target.value)}
              placeholder="名稱、地址..."
              className="
                mt-2
                w-full
                rounded-xl
                border
                border-[var(--border)]
                bg-[var(--background)]
                px-4
                py-3
                outline-none
              "
            />
          </label>

          {selectedPlace ? (
            <div
              className="
                mt-4
                rounded-[var(--radius-md)]
                border
                border-[var(--foreground)]
                bg-[var(--surface-soft)]
                p-4
              "
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{selectedPlace.name}</p>

                  {selectedPlace.address && (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {selectedPlace.address}
                    </p>
                  )}

                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {getPlaceStatusLabel(selectedPlace.status)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPlaceId(null)}
                  className="text-xs text-[var(--muted)]"
                >
                  換一個
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {filteredPlaces.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => setSelectedPlaceId(place.id)}
                  className="
                      w-full
                      rounded-xl
                      border
                      border-[var(--border)]
                      bg-[var(--background)]
                      p-3
                      text-left
                      transition
                      hover:border-[var(--foreground)]
                    "
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{place.name}</p>

                      {place.address && (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {place.address}
                        </p>
                      )}
                    </div>

                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      {getPlaceStatusLabel(place.status)}
                    </span>
                  </div>
                </button>
              ))}

              {filteredPlaces.length === 0 && (
                <p className="py-5 text-center text-sm text-[var(--muted)]">
                  找不到地點。
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Custom */}

      {mode === "custom" && (
        <>
          <div className="mt-6">
            <p className="text-sm font-medium">類型</p>

            <div className="mt-2 flex flex-wrap gap-2">
              {ITEM_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setItemType(type.value)}
                  className={`
                      rounded-full
                      border
                      px-3
                      py-1.5
                      text-sm
                      transition

                      ${
                        itemType === type.value
                          ? `
                            border-[var(--foreground)]
                            bg-[var(--foreground)]
                            text-white
                          `
                          : `
                            border-[var(--border)]
                          `
                      }
                    `}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-5 block">
            <span className="text-sm font-medium">名稱</span>

            <input
              name="title"
              required={mode === "custom"}
              placeholder="例如：神農街散步"
              className="
                mt-2
                w-full
                rounded-xl
                border
                border-[var(--border)]
                bg-[var(--background)]
                px-4
                py-3
                outline-none
              "
            />
          </label>
        </>
      )}

      {/* Timing */}

      <div className="mt-6">
        <p className="text-sm font-medium">時間</p>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setTimingType("flexible")}
            className={`
              rounded-xl
              border
              px-4
              py-2
              text-sm

              ${
                timingType === "flexible"
                  ? `
                    border-[var(--foreground)]
                    bg-[var(--foreground)]
                    text-white
                  `
                  : `
                    border-[var(--border)]
                  `
              }
            `}
          >
            自動安排
          </button>

          <button
            type="button"
            onClick={() => setTimingType("fixed")}
            className={`
              rounded-xl
              border
              px-4
              py-2
              text-sm

              ${
                timingType === "fixed"
                  ? `
                    border-[var(--foreground)]
                    bg-[var(--foreground)]
                    text-white
                  `
                  : `
                    border-[var(--border)]
                  `
              }
            `}
          >
            固定時間
          </button>
        </div>
      </div>

      {timingType === "fixed" && (
        <label className="mt-5 block">
          <span className="text-sm font-medium">開始時間</span>

          <input
            type="time"
            name="fixedStartTime"
            required
            className="
              mt-2
              rounded-xl
              border
              border-[var(--border)]
              bg-[var(--background)]
              px-4
              py-3
            "
          />
        </label>
      )}

      <label className="mt-5 block">
        <span className="text-sm font-medium">預計多久</span>

        <select
          name="durationMinutes"
          defaultValue="60"
          className="
            mt-2
            w-full
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--background)]
            px-4
            py-3
          "
        >
          <option value="30">30 分鐘</option>

          <option value="60">1 小時</option>

          <option value="90">1.5 小時</option>

          <option value="120">2 小時</option>

          <option value="180">3 小時</option>

          <option value="240">4 小時</option>
        </select>
      </label>

      {/* Custom location */}

      {mode === "custom" && (
        <>
          <label className="mt-5 block">
            <span className="text-sm font-medium">地點</span>

            <input
              name="locationName"
              placeholder="例如：台南中西區"
              className="
                mt-2
                w-full
                rounded-xl
                border
                border-[var(--border)]
                bg-[var(--background)]
                px-4
                py-3
              "
            />
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-medium">地址</span>

            <input
              name="address"
              className="
                mt-2
                w-full
                rounded-xl
                border
                border-[var(--border)]
                bg-[var(--background)]
                px-4
                py-3
              "
            />
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-medium">Google Maps</span>

            <input
              type="url"
              name="googleMapsUrl"
              placeholder="https://..."
              className="
                mt-2
                w-full
                rounded-xl
                border
                border-[var(--border)]
                bg-[var(--background)]
                px-4
                py-3
              "
            />
          </label>
        </>
      )}

      {/* Shared note */}

      <label className="mt-5 block">
        <span className="text-sm font-medium">這次行程的備註</span>

        <textarea
          name="description"
          rows={3}
          placeholder="有什麼要記得的？"
          className="
            mt-2
            w-full
            resize-none
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--background)]
            px-4
            py-3
          "
        />
      </label>

      {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="
          mt-6
          rounded-xl
          bg-[var(--foreground)]
          px-5
          py-3
          text-sm
          font-medium
          text-white
          disabled:opacity-50
        "
      >
        {isPending ? "Adding..." : "加入行程"}
      </button>
    </form>
  );
}
