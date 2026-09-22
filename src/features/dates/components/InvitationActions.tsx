"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { respondToDateInvitationAction } from "@/features/dates/actions";

type InvitationActionsProps = {
  dateId: string;
};

export default function InvitationActions({ dateId }: InvitationActionsProps) {
  const router = useRouter();

  const [error, setError] = useState("");

  const [isPending, startTransition] = useTransition();

  function respond(response: "accepted" | "declined") {
    setError("");

    startTransition(async () => {
      const result = await respondToDateInvitationAction(dateId, response);

      if (!result.success) {
        setError(result.error);

        return;
      }

      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => respond("accepted")}
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
          接受
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => respond("declined")}
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
          婉拒
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
