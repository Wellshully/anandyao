"use client";

import type { FormEvent } from "react";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { addItineraryItemAction } from "@/features/dates/actions";

import type {
  ItineraryItemType,
  ItineraryTimingType,
} from "@/features/dates/types";

type AddItineraryFormProps = {
  dateId: string;
  dateDayId: string;
};

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

export default function AddItineraryForm({
  dateId,
  dateDayId,
}: AddItineraryFormProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);

  const [itemType, setItemType] = useState<ItineraryItemType>("activity");

  const [timingType, setTimingType] = useState<ItineraryTimingType>("flexible");

  const [error, setError] = useState("");

  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    const form = new FormData(event.currentTarget);

    const durationMinutes = Number(form.get("durationMinutes") ?? 60);

    startTransition(async () => {
      const result = await addItineraryItemAction({
        dateId,
        dateDayId,

        itemType,

        title: String(form.get("title") ?? ""),

        description: String(form.get("description") ?? "") || undefined,

        locationName: String(form.get("locationName") ?? "") || undefined,

        address: String(form.get("address") ?? "") || undefined,

        googleMapsUrl: String(form.get("googleMapsUrl") ?? "") || undefined,

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

      setIsOpen(false);

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
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Add plan</h4>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-sm text-[var(--muted)]"
        >
          Cancel
        </button>
      </div>

      <div className="mt-5">
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
                        bg-[var(--surface)]
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
          required
          placeholder="例如：文章牛肉湯"
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

      <div className="mt-5">
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

      <label className="mt-5 block">
        <span className="text-sm font-medium">地點</span>

        <input
          name="locationName"
          placeholder="例如：中西區"
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

      <label className="mt-5 block">
        <span className="text-sm font-medium">備註</span>

        <textarea
          name="description"
          rows={3}
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
