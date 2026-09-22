"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import Link from "next/link";

import {
  deleteRestaurantAction,
  recordRestaurantVisitAction,
  setRestaurantHiddenAction,
} from "@/features/eat/actions";

type RestaurantActionsProps = {
  restaurantId: string;
  isHidden: boolean;
};

export default function RestaurantActions({
  restaurantId,
  isHidden,
}: RestaurantActionsProps) {
  const router = useRouter();

  const [message, setMessage] = useState("");

  const [isPending, startTransition] = useTransition();

  function recordToday() {
    startTransition(async () => {
      try {
        await recordRestaurantVisitAction({
          restaurantId,
          selectedByPicker: false,
        });

        setMessage("已記錄今天吃過。");

        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "紀錄失敗。");
      }
    });
  }

  function toggleHidden() {
    startTransition(async () => {
      try {
        await setRestaurantHiddenAction(restaurantId, !isHidden);

        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "更新失敗。");
      }
    });
  }

  function remove() {
    const confirmed = window.confirm(
      "確定要永久刪除這間餐廳嗎？吃過的紀錄也會一起刪除。",
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteRestaurantAction(restaurantId);

        router.push("/eat");

        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "刪除失敗。");
      }
    });
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={recordToday}
          className="
            rounded-xl
            bg-[var(--foreground)]
            px-4
            py-2.5
            text-sm
            font-medium
            text-white
            disabled:opacity-50
          "
        >
          今天吃過
        </button>

        <Link
          href={`/eat/${restaurantId}/edit`}
          className="
            rounded-xl
            border
            border-[var(--border)]
            px-4
            py-2.5
            text-sm
          "
        >
          Edit
        </Link>

        <button
          type="button"
          disabled={isPending}
          onClick={toggleHidden}
          className="
            rounded-xl
            border
            border-[var(--border)]
            px-4
            py-2.5
            text-sm
            disabled:opacity-50
          "
        >
          {isHidden ? "Unhide" : "Hide"}
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={remove}
          className="
            rounded-xl
            border
            border-[var(--border)]
            px-4
            py-2.5
            text-sm
            text-[var(--danger)]
            disabled:opacity-50
          "
        >
          Delete
        </button>
      </div>

      {message && <p className="mt-4 text-sm text-[var(--muted)]">{message}</p>}
    </div>
  );
}
