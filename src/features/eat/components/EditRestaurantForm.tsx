"use client";

import { FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { updateRestaurantAction } from "@/features/eat/actions";

import { RESTAURANT_CONTEXTS } from "@/features/eat/config/restaurant-options";

import type { Restaurant } from "@/features/eat/types";

type EditRestaurantFormProps = {
  restaurant: Restaurant;
};

export default function EditRestaurantForm({
  restaurant,
}: EditRestaurantFormProps) {
  const router = useRouter();

  const [contexts, setContexts] = useState<string[]>(restaurant.contexts);

  const [error, setError] = useState("");

  const [isPending, startTransition] = useTransition();

  function toggleContext(value: string) {
    setContexts((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    const form = new FormData(event.currentTarget);

    const cuisines = String(form.get("cuisines") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const price = String(form.get("priceLevel") ?? "");

    startTransition(async () => {
      try {
        await updateRestaurantAction({
          restaurantId: restaurant.id,

          name: String(form.get("name") ?? ""),

          area: String(form.get("area") ?? "") || undefined,

          address: String(form.get("address") ?? "") || undefined,

          cuisines,

          contexts,

          priceLevel: price ? Number(price) : undefined,

          googleMapsUrl: String(form.get("googleMapsUrl") ?? "") || undefined,

          note: String(form.get("note") ?? "") || undefined,

          latitude: restaurant.latitude ?? undefined,

          longitude: restaurant.longitude ?? undefined,

          googlePlaceId: restaurant.google_place_id ?? undefined,
        });

        router.push(`/eat/${restaurant.id}`);

        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "更新餐廳失敗。");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <label className="block">
        <span className="text-sm font-medium">店名</span>

        <input
          name="name"
          required
          defaultValue={restaurant.name}
          className="
            mt-2
            w-full
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-4
            py-3
          "
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label>
          <span className="text-sm font-medium">地區</span>

          <input
            name="area"
            defaultValue={restaurant.area ?? ""}
            className="
              mt-2
              w-full
              rounded-xl
              border
              border-[var(--border)]
              bg-[var(--surface)]
              px-4
              py-3
            "
          />
        </label>

        <label>
          <span className="text-sm font-medium">價位</span>

          <select
            name="priceLevel"
            defaultValue={restaurant.price_level ?? ""}
            className="
              mt-2
              w-full
              rounded-xl
              border
              border-[var(--border)]
              bg-[var(--surface)]
              px-4
              py-3
            "
          >
            <option value="">未設定</option>

            {[1, 2, 3, 4, 5].map((level) => (
              <option key={level} value={level}>
                {"$".repeat(level)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">料理類型</span>

        <input
          name="cuisines"
          defaultValue={restaurant.cuisines.join(", ")}
          className="
            mt-2
            w-full
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-4
            py-3
          "
        />
      </label>

      <div>
        <p className="text-sm font-medium">適合情境</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {RESTAURANT_CONTEXTS.map((item) => {
            const selected = contexts.includes(item.value);

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => toggleContext(item.value)}
                className={`
                    rounded-full
                    border
                    px-4
                    py-2
                    text-sm

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
                        `
                    }
                  `}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium">地址</span>

        <input
          name="address"
          defaultValue={restaurant.address ?? ""}
          className="
            mt-2
            w-full
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-4
            py-3
          "
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Google Maps</span>

        <input
          name="googleMapsUrl"
          defaultValue={restaurant.google_maps_url ?? ""}
          className="
            mt-2
            w-full
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-4
            py-3
          "
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">備註</span>

        <textarea
          name="note"
          rows={5}
          defaultValue={restaurant.note ?? ""}
          className="
            mt-2
            w-full
            resize-none
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-4
            py-3
          "
        />
      </label>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="
          rounded-xl
          bg-[var(--foreground)]
          px-5
          py-3
          text-sm
          font-medium
          text-[var(--on-foreground)]
          disabled:opacity-50
        "
      >
        {isPending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
