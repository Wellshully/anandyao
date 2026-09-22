"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { deleteItineraryItemAction } from "@/features/dates/actions";

type ItineraryActionsProps = {
  dateId: string;
  itemId: string;
};

export default function ItineraryActions({
  dateId,
  itemId,
}: ItineraryActionsProps) {
  const router = useRouter();

  const [error, setError] = useState("");

  const [isPending, startTransition] = useTransition();

  function remove() {
    const confirmed = window.confirm("確定要刪掉這個行程嗎？");

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteItineraryItemAction(dateId, itemId);

      if (!result.success) {
        setError(result.error);

        return;
      }

      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={remove}
        className="text-xs text-[var(--muted)] hover:text-[var(--danger)]"
      >
        Delete
      </button>

      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
