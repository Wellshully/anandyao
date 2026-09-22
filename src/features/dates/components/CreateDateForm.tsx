"use client";

import type { FormEvent } from "react";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { createDateAction } from "@/features/dates/actions";

import type { DateKind } from "@/features/dates/types";

const DATE_KINDS: {
  value: DateKind;
  label: string;
  description: string;
}[] = [
  {
    value: "meal",
    label: "吃飯",
    description: "一起吃頓飯。",
  },
  {
    value: "date",
    label: "約會",
    description: "一個簡單的約會。",
  },
  {
    value: "half_day",
    label: "半日",
    description: "安排半天一起出去。",
  },
  {
    value: "day",
    label: "一日",
    description: "從早到晚的一天。",
  },
  {
    value: "trip",
    label: "旅行",
    description: "一天以上的小旅行。",
  },
];

export default function CreateDateForm() {
  const router = useRouter();

  const [kind, setKind] = useState<DateKind>("date");

  const [error, setError] = useState("");

  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    const form = new FormData(event.currentTarget);

    const startDate = String(form.get("startDate") ?? "");

    const rawEndDate = String(form.get("endDate") ?? "");

    const endDate = rawEndDate || startDate;
    startTransition(async () => {
      const result = await createDateAction({
        title: String(form.get("title") ?? ""),

        description: String(form.get("description") ?? "") || undefined,

        kind,

        startDate,
        endDate,
      });

      if (!result.success) {
        setError(result.error);

        return;
      }

      router.push("/dates");

      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <p className="text-sm font-medium">這次想約什麼？</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {DATE_KINDS.map((item) => {
            const selected = kind === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setKind(item.value)}
                className={`
                    rounded-[var(--radius-md)]
                    border
                    p-4
                    text-left
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
                          bg-[var(--surface)]
                        `
                    }
                  `}
              >
                <p className="font-medium">{item.label}</p>

                <p
                  className={`
                      mt-1 text-xs

                      ${selected ? "text-white/70" : "text-[var(--muted)]"}
                    `}
                >
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium">約會名稱</span>

        <input
          name="title"
          required
          placeholder="例如：台南兩天一夜"
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
        <label>
          <span className="text-sm font-medium">開始日期</span>

          <input
            type="date"
            name="startDate"
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
            "
          />
        </label>

        <label>
          <span className="text-sm font-medium">結束日期</span>

          <input
            type="date"
            name="endDate"
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

          <p className="mt-2 text-xs text-[var(--muted)]">不填代表同一天。</p>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">想跟她說什麼？</span>

        <textarea
          name="description"
          rows={5}
          placeholder="例如：想帶妳去吃之前一直想吃的那間。"
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
          text-white
          disabled:opacity-50
        "
      >
        {isPending ? "Sending..." : "送出邀請"}
      </button>
    </form>
  );
}
