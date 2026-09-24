"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { cancelDateAction } from "@/features/dates/cancel-date-action";

type CancelDateButtonProps = {
  dateId: string;

  mode?: "cancel" | "withdraw";
};

export default function CancelDateButton({
  dateId,
  mode = "cancel",
}: CancelDateButtonProps) {
  const router = useRouter();

  const [error, setError] = useState("");

  const [isPending, startTransition] = useTransition();

  const label = mode === "withdraw" ? "收回邀請" : "取消 Date";

  function handleCancel() {
    const confirmed = window.confirm(
      mode === "withdraw"
        ? "確定要收回這個邀請嗎？"
        : "確定要取消這次 Date 嗎？原本排好的行程會保留在 Archive。",
    );

    if (!confirmed) {
      return;
    }

    setError("");

    startTransition(async () => {
      const result = await cancelDateAction(dateId);

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
        onClick={handleCancel}
        className="
          rounded-xl
          border
          border-[var(--border)]
          px-4
          py-2.5
          text-sm
          text-[var(--muted)]
          transition
          hover:border-[var(--danger)]
          hover:text-[var(--danger)]
          disabled:opacity-50
        "
      >
        {isPending ? "處理中…" : label}
      </button>

      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
