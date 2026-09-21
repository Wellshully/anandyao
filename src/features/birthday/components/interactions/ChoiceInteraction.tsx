"use client";

import { motion } from "motion/react";

import type {
  AnswerFeedback,
  ChoiceOption,
} from "@/features/birthday/types/story";

type ChoiceInteractionProps = {
  question: string;

  options: ChoiceOption[];

  value?: string;

  correctAnswer?: string;

  feedback?: AnswerFeedback;

  onChange: (value: string) => void;
};

export default function ChoiceInteraction({
  question,
  options,
  value,
  correctAnswer,
  feedback,
  onChange,
}: ChoiceInteractionProps) {
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

      <div className="mt-10 space-y-3">
        {options.map((option, index) => {
          const selected = value === option.value;

          return (
            <motion.button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              initial={{
                opacity: 0,
                y: 15,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: index * 0.07,
              }}
              whileTap={{
                scale: 0.98,
              }}
              className={`
                  flex
                  w-full
                  items-center
                  justify-between
                  rounded-2xl
                  border
                  px-5
                  py-4
                  text-left
                  transition

                  ${
                    selected
                      ? `
                        border-[var(--birthday-accent)]
                        bg-[var(--birthday-accent)]/10
                        text-[var(--birthday-foreground)]
                      `
                      : `
                        border-white/10
                        bg-white/[0.03]
                        text-[var(--birthday-muted)]
                        hover:border-white/20
                        hover:bg-white/[0.06]
                      `
                  }
                `}
            >
              <span>{option.label}</span>

              <span
                className={`
                    flex
                    h-5
                    w-5
                    items-center
                    justify-center
                    rounded-full
                    border

                    ${
                      selected
                        ? "border-[var(--birthday-accent)]"
                        : "border-white/20"
                    }
                  `}
              >
                {selected && (
                  <span className="h-2 w-2 rounded-full bg-[var(--birthday-accent)]" />
                )}
              </span>
            </motion.button>
          );
        })}
      </div>

      {isCorrect === true && feedback?.correct && (
        <motion.p
          initial={{
            opacity: 0,
            y: 6,
          }}
          animate={{
            opacity: 1,
            y: 0,
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
            y: 6,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="mt-6 text-sm text-[var(--birthday-muted)]"
        >
          {feedback.incorrect}
        </motion.p>
      )}
    </div>
  );
}
