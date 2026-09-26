"use client";

import type { FormEvent } from "react";

import { useRef, useState, useTransition } from "react";

import { performPetAction } from "@/features/pet/actions";

import { talkToPetAction } from "@/features/pet/ai/actions";

import PetCharacter from "@/features/pet/components/PetCharacter";

import { PET_RULES } from "@/features/pet/lib/pet-rules";

import type { PetPose } from "@/features/pet/ai/pet-reply";

import type {
  PetAction,
  PetAnimation,
  PetViewState,
} from "@/features/pet/types";

type PetPanelProps = {
  name: string;
  initialState: PetViewState;
};

const MAX_MESSAGE_LENGTH = 500;

const actionMessages: Record<PetAction, string> = {
  feed: "吃飽了一點",
  pet: "很喜歡被摸摸",
  play: "玩得很開心",
};

function StatRow({ label, value }: { label: string; value: number }) {
  const normalized = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm">{label}</span>

        <span className="text-xs tabular-nums text-[var(--muted)]">
          {normalized}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
          style={{
            width: `${normalized}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function PetPanel({ name, initialState }: PetPanelProps) {
  const [state, setState] = useState(initialState);

  const [animation, setAnimation] = useState<PetAnimation>("idle");

  const [interactionMessage, setInteractionMessage] = useState("");

  const [input, setInput] = useState("");

  const [petReply, setPetReply] = useState("");

  const [petPose, setPetPose] = useState<PetPose | null>(null);

  const [aiError, setAiError] = useState("");

  const [isInteractionPending, startInteractionTransition] = useTransition();

  const [isTalking, startTalkingTransition] = useTransition();

  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function interact(action: PetAction) {
    if (isInteractionPending || isTalking) {
      return;
    }

    if (animationTimer.current) {
      clearTimeout(animationTimer.current);
    }

    setInteractionMessage("");
    setAiError("");

    /*
     * A direct physical interaction
     * returns the character to its
     * ordinary state afterward.
     */
    setPetPose(null);

    startInteractionTransition(async () => {
      const result = await performPetAction(action);

      if (!result.success) {
        setInteractionMessage(result.error);

        return;
      }

      setState(result.state);

      setAnimation(action);

      setInteractionMessage(actionMessages[action]);

      animationTimer.current = setTimeout(() => {
        setAnimation("idle");

        setInteractionMessage("");
      }, 1500);
    });
  }

  function handleTalk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isTalking || isInteractionPending) {
      return;
    }

    const message = input.trim();

    if (!message) {
      return;
    }

    setAiError("");
    setInteractionMessage("");

    startTalkingTransition(async () => {
      const result = await talkToPetAction(message);

      if (!result.success) {
        setAiError(result.error);

        return;
      }

      setPetReply(result.reply.reply);

      setPetPose(result.reply.pose);

      setAnimation("idle");

      setInput("");
    });
  }

  const xpInLevel = state.xp % PET_RULES.xpPerLevel;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Our Pet
        </p>

        <h1 className="font-story mt-2 text-3xl font-semibold">{name}</h1>

        <p className="mt-2 text-xs text-[var(--muted)]">
          Lv. {state.level}
          {" · "}
          {xpInLevel} / {PET_RULES.xpPerLevel} XP
        </p>
      </div>

      <div className="mt-4">
        <PetCharacter mood={state.mood} animation={animation} pose={petPose} />
      </div>

      <div
        className="
          mx-auto
          mt-4
          min-h-14
          max-w-lg
        "
        aria-live="polite"
      >
        {isTalking ? (
          <div
            className="
              rounded-2xl
              border
              border-[var(--border)]
              bg-[var(--surface)]
              px-5
              py-4
              text-center
              text-sm
              text-[var(--muted)]
            "
          >
            牠正在想……
          </div>
        ) : petReply ? (
          <div
            className="
              rounded-2xl
              border
              border-[var(--border)]
              bg-[var(--surface)]
              px-5
              py-4
              text-sm
              leading-6
            "
          >
            {petReply}
          </div>
        ) : interactionMessage ? (
          <div className="text-center">
            <span
              className="
                inline-block
                rounded-full
                border
                border-[var(--border)]
                bg-[var(--surface)]
                px-4
                py-2
                text-xs
              "
            >
              {interactionMessage}
            </span>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={handleTalk}
        className="
          mx-auto
          mt-4
          max-w-lg
        "
      >
        <div
          className="
            flex
            items-end
            gap-2
            rounded-2xl
            border
            border-[var(--border)]
            bg-[var(--surface)]
            p-2
          "
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={1}
            disabled={isTalking}
            placeholder="跟牠說點什麼……"
            className="
              min-h-10
              flex-1
              resize-none
              bg-transparent
              px-3
              py-2
              text-sm
              outline-none
              placeholder:text-[var(--muted)]
              disabled:opacity-60
            "
          />
        </div>
        <button
          type="submit"
          disabled={isTalking || isInteractionPending}
          className="
    shrink-0
    rounded-xl
    border
    border-[var(--border)]
    px-4
    py-2
    text-sm
    transition
    hover:border-[var(--foreground)]
    disabled:cursor-default
    disabled:opacity-40
  "
        >
          {isTalking ? "..." : "送出"}
        </button>
        {aiError && (
          <p className="mt-2 text-xs text-[var(--danger)]">{aiError}</p>
        )}
      </form>

      <div
        className="
          mt-10
          space-y-5
          rounded-[var(--radius-md)]
          border
          border-[var(--border)]
          bg-[var(--surface)]
          p-5
        "
      >
        <StatRow label="飽足" value={state.hunger} />

        <StatRow label="心情" value={state.happiness} />

        <StatRow label="精力" value={state.energy} />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <button
          type="button"
          disabled={isInteractionPending || isTalking}
          onClick={() => interact("feed")}
          className="
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-3
            py-3
            text-sm
            transition
            hover:border-[var(--foreground)]
            disabled:opacity-50
          "
        >
          餵食
        </button>

        <button
          type="button"
          disabled={isInteractionPending || isTalking}
          onClick={() => interact("pet")}
          className="
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-3
            py-3
            text-sm
            transition
            hover:border-[var(--foreground)]
            disabled:opacity-50
          "
        >
          摸摸
        </button>

        <button
          type="button"
          disabled={isInteractionPending || isTalking}
          onClick={() => interact("play")}
          className="
            rounded-xl
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-3
            py-3
            text-sm
            transition
            hover:border-[var(--foreground)]
            disabled:opacity-50
          "
        >
          玩耍
        </button>
      </div>
    </div>
  );
}
