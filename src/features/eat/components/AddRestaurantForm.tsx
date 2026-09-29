"use client";

import { FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { addRestaurantAction } from "@/features/eat/actions";

import { RESTAURANT_CONTEXTS } from "@/features/eat/config/restaurant-options";

export default function AddRestaurantForm() {
  const router = useRouter();

  const [contexts, setContexts] = useState<string[]>([]);

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
        await addRestaurantAction({
          name: String(form.get("name") ?? ""),

          area: String(form.get("area") ?? "") || undefined,

          address: String(form.get("address") ?? "") || undefined,

          cuisines,

          contexts,

          priceLevel: price ? Number(price) : undefined,

          googleMapsUrl: String(form.get("googleMapsUrl") ?? "") || undefined,

          note: String(form.get("note") ?? "") || undefined,
        });

        router.push("/eat");

        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "新增餐廳失敗。");
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
          className="
            mt-2
            w-full
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-4
            py-3
            outline-none
          "
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">地區</span>

          <input
            name="area"
            placeholder="例如：公館"
            className="
              mt-2
              w-full
              rounded-xl
              border
              border-[var(--border)]
              bg-[var(--surface)]
              px-4
              py-3
              outline-none
            "
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">價位</span>

          <select
            name="priceLevel"
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
            <option value="1">$</option>
            <option value="2">$$</option>
            <option value="3">$$$</option>
            <option value="4">$$$$</option>
            <option value="5">$$$$$</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">料理類型</span>

        <input
          name="cuisines"
          placeholder="日式, 拉麵"
          className="
            mt-2
            w-full
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-4
            py-3
            outline-none
          "
        />

        <p className="mt-2 text-xs text-[var(--muted)]">多個類型用逗號分隔。</p>
      </label>

      <div>
        <p className="text-sm font-medium">適合什麼情境？</p>

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
          className="
            mt-2
            w-full
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-4
            py-3
            outline-none
          "
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Google Maps</span>

        <input
          name="googleMapsUrl"
          placeholder="之後也可以再補"
          className="
            mt-2
            w-full
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-4
            py-3
            outline-none
          "
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">備註</span>

        <textarea
          name="note"
          rows={4}
          placeholder="例如：安喜歡這家的咖哩"
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
            outline-none
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
        {isPending ? "Saving..." : "Add restaurant"}
      </button>
    </form>
  );
}
