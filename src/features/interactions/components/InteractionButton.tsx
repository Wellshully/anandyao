"use client";

import { useEffect, useState, useTransition } from "react";

import { sendInteractionAction } from "@/features/interactions/actions";

type InteractionButtonProps = {
  initialActionName: string;
  initialCooldownSeconds: number;
};

export default function InteractionButton({
  initialActionName,
  initialCooldownSeconds,
}: InteractionButtonProps) {
  const [actionName, setActionName] = useState(initialActionName);

  const [cooldownSeconds, setCooldownSeconds] = useState(
    initialCooldownSeconds,
  );

  const [message, setMessage] = useState("");

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [cooldownSeconds]);

  function send() {
    if (isPending || cooldownSeconds > 0) {
      return;
    }

    setMessage("");

    startTransition(async () => {
      const result = await sendInteractionAction();

      if (!result.success) {
        if (result.retryAfterSeconds) {
          setCooldownSeconds(result.retryAfterSeconds);
        }

        setMessage(result.error);

        return;
      }

      setActionName(result.actionName);

      setCooldownSeconds(result.cooldownSeconds);

      setMessage("已送出");

      window.setTimeout(() => {
        setMessage("");
      }, 1500);
    });
  }

  const disabled = isPending || cooldownSeconds > 0;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={send}
        title={
          cooldownSeconds > 0 ? `${cooldownSeconds} 秒後可以再傳送` : actionName
        }
        aria-label={
          cooldownSeconds > 0
            ? `${cooldownSeconds} 秒後可以再${actionName}`
            : actionName
        }
        className="
          flex
          h-9
          w-9
          shrink-0
          items-center
          justify-center
          rounded-full
          border
          border-[var(--border)]
          bg-[var(--surface)]
          text-xs
          font-medium
          tabular-nums
          transition

          hover:border-[var(--foreground)]

          disabled:cursor-default
          disabled:opacity-60
        "
      >
        {isPending ? (
          <span aria-hidden="true" className="text-sm">
            …
          </span>
        ) : cooldownSeconds > 0 ? (
          <span>{cooldownSeconds}</span>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-4.5 w-4.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9.5 11V5.5a1.5 1.5 0 0 1 3 0V10" />
            <path d="M12.5 10V4.5a1.5 1.5 0 0 1 3 0V10" />
            <path d="M15.5 10V6a1.5 1.5 0 0 1 3 0v7" />
            <path d="M9.5 10.5 8 9a1.6 1.6 0 0 0-2.3 2.2l4.1 5.2A5.5 5.5 0 0 0 14.1 18H15a3.5 3.5 0 0 0 3.5-3.5V13" />
          </svg>
        )}
      </button>

      {message && (
        <div
          className="
            absolute
            right-0
            top-[calc(100%+0.5rem)]
            z-50
            whitespace-nowrap
            rounded-lg
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-3
            py-2
            text-[11px]
            shadow-[0_10px_30px_rgba(38,35,31,0.10)]
          "
        >
          {message}
        </div>
      )}
    </div>
  );
}
