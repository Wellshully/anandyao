"use client";

import { useState, useTransition } from "react";

import { syncStudyAction } from "@/features/study/actions";

export default function StudySyncButton() {
  const [isPending, startTransition] = useTransition();

  const [message, setMessage] = useState("");

  function sync() {
    setMessage("");

    startTransition(async () => {
      const result = await syncStudyAction();

      if (!result.success) {
        setMessage(result.error);

        return;
      }

      setMessage(
        `同步完成：${result.courses} 門課、${result.assignments} 個作業、${result.unreadAnnouncements} 則新公告`,
      );
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={sync}
        className="
          rounded-xl
          bg-[var(--foreground)]
          px-4
          py-3
          text-sm
          font-medium
          text-white
          disabled:opacity-50
        "
      >
        {isPending ? "同步中…" : "Sync now"}
      </button>

      {message && <p className="mt-3 text-xs text-[var(--muted)]">{message}</p>}
    </div>
  );
}
