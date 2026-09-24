"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { deleteArchivedDateAction } from "@/features/dates/delete-archived-date-action";

type DeleteArchivedDateButtonProps = {
  dateId: string;
};

export default function DeleteArchivedDateButton({
  dateId,
}: DeleteArchivedDateButtonProps) {
  const router = useRouter();

  const [error, setError] = useState("");

  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      "確定要永久刪除這個 Date 嗎？所有行程和相關資料都會一起刪除，而且無法復原。",
    );

    if (!confirmed) {
      return;
    }

    setError("");

    startTransition(async () => {
      const result = await deleteArchivedDateAction(dateId);

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
        onClick={handleDelete}
        className="
          rounded-xl
          border
          border-[var(--border)]
          px-3
          py-2
          text-xs
          text-[var(--muted)]
          transition
          hover:border-[var(--danger)]
          hover:text-[var(--danger)]
          disabled:opacity-50
        "
      >
        {isPending ? "刪除中…" : "永久刪除"}
      </button>

      {error && (
        <p className="mt-2 max-w-xs text-xs text-[var(--danger)]">{error}</p>
      )}
    </div>
  );
}
