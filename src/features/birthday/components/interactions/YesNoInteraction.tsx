"use client";

import { motion } from "motion/react";

import type { AnswerFeedback } from "@/features/birthday/types/story";

type YesNoInteractionProps = {
  question: string;

  value?: boolean;

  onChange: (value: boolean) => void;

  yesLabel?: string;
  noLabel?: string;

  correctAnswer?: boolean;

  feedback?: AnswerFeedback;
};

export default function YesNoInteraction({
  question,
  value,
  onChange,
  yesLabel = "是",
  noLabel = "不是",
  correctAnswer,
  feedback,
}: YesNoInteractionProps) {
  const answered = value !== undefined;

  const isCorrect =
    answered && correctAnswer !== undefined
      ? value === correctAnswer
      : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h2 className="font-story text-3xl font-semibold leading-tight sm:text-5xl">
        {question}
      </h2>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <motion.button
          type="button"
          whileTap={{
            scale: 0.97,
          }}
          onClick={() => onChange(true)}
          className={`
            rounded-2xl
            border
            px-6
            py-8
            text-lg
            transition

            ${
              value === true
                ? `
                  border-[var(--birthday-accent)]
                  bg-[var(--birthday-accent)]/10
                `
                : `
                  border-white/10
                  bg-white/[0.03]
                  text-[var(--birthday-muted)]
                `
            }
          `}
        >
          {yesLabel}
        </motion.button>

        <motion.button
          type="button"
          whileTap={{
            scale: 0.97,
          }}
          onClick={() => onChange(false)}
          className={`
            rounded-2xl
            border
            px-6
            py-8
            text-lg
            transition

            ${
              value === false
                ? `
                  border-[var(--birthday-accent)]
                  bg-[var(--birthday-accent)]/10
                `
                : `
                  border-white/10
                  bg-white/[0.03]
                  text-[var(--birthday-muted)]
                `
            }
          `}
        >
          {noLabel}
        </motion.button>
      </div>

      {isCorrect === true && feedback?.correct && (
        <motion.p
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          className="mt-6 text-sm text-[var(--birthday-accent)]"
        >
          {feedback.correct}
        </motion.p>
      )}

      {isCorrect === false && feedback?.incorrect && (
        <motion.p
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          className="mt-6 text-sm text-[var(--birthday-muted)]"
        >
          {feedback.incorrect}
        </motion.p>
      )}
    </div>
  );
}
