"use client";

import { type FormEvent, useState, useTransition } from "react";

import { updateInteractionNameAction } from "@/features/interactions/actions";

type InteractionSettingsProps = {
  initialActionName: string;
};

export default function InteractionSettings({
  initialActionName,
}: InteractionSettingsProps) {
  const [actionName, setActionName] = useState(initialActionName);

  const [savedName, setSavedName] = useState(initialActionName);

  const [message, setMessage] = useState("");

  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");

    startTransition(async () => {
      const result = await updateInteractionNameAction(actionName);

      if (!result.success) {
        setMessage(result.error);

        return;
      }

      setActionName(result.actionName);

      setSavedName(result.actionName);

      setMessage("已儲存");
    });
  }

  const hasChanges = actionName.trim() !== savedName;

  return (
    <div className="mt-5 border-t border-[var(--border)] pt-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
        Interaction
      </p>

      <p className="mt-2 text-xs text-[var(--muted)]">
        自訂你傳給對方的動作名稱
      </p>

      <form onSubmit={handleSubmit} className="mt-3">
        <input
          type="text"
          value={actionName}
          onChange={(event) => {
            setActionName(event.target.value);

            setMessage("");
          }}
          maxLength={12}
          placeholder="戳一下"
          className="
            w-full
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--background)]
            px-3
            py-2.5
            text-sm
            outline-none
            transition
            focus:border-[var(--foreground)]
          "
        />

        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[10px] text-[var(--muted)]">最多 12 個字</p>

          <button
            type="submit"
            disabled={isPending || !hasChanges || !actionName.trim()}
            className="
              rounded-lg
              border
              border-[var(--border)]
              px-3
              py-1.5
              text-xs
              transition
              hover:border-[var(--foreground)]
              disabled:cursor-default
              disabled:opacity-40
            "
          >
            {isPending ? "儲存中…" : "儲存"}
          </button>
        </div>

        {message && (
          <p className="mt-2 text-xs text-[var(--muted)]">{message}</p>
        )}
      </form>
    </div>
  );
}
