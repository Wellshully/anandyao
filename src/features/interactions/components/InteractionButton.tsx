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

  /*
   * Local countdown is only UX.
   *
   * The real one-minute limit is still
   * enforced by the database/server action.
   */
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

  let label = actionName;

  if (isPending) {
    label = "傳送中…";
  } else if (cooldownSeconds > 0) {
    label = `${actionName} · ${cooldownSeconds}s`;
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={send}
        title={
          cooldownSeconds > 0 ? `${cooldownSeconds} 秒後可以再傳送` : actionName
        }
        className="
          max-w-24
          sm:max-w-32
          truncate
          rounded-xl
          border
          border-[var(--border)]
          bg-[var(--surface)]
          px-2
          sm:px-3
          py-2
          text-xs
          font-medium
          transition

          hover:border-[var(--foreground)]

          disabled:cursor-default
          disabled:opacity-50
        "
      >
        {label}
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
