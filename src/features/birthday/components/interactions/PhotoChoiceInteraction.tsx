"use client";

import Image from "next/image";
import { motion } from "motion/react";

import type {
  AnswerFeedback,
  PhotoChoiceOption,
} from "@/features/birthday/types/story";

type PhotoChoiceInteractionProps = {
  question: string;

  options: PhotoChoiceOption[];

  value?: string;

  correctAnswer?: string;

  feedback?: AnswerFeedback;

  onChange: (value: string) => void;
};

export default function PhotoChoiceInteraction({
  question,
  options,
  value,
  correctAnswer,
  feedback,
  onChange,
}: PhotoChoiceInteractionProps) {
  const answered = value !== undefined;

  const isCorrect =
    answered && correctAnswer !== undefined
      ? value === correctAnswer
      : undefined;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h2 className="font-story text-3xl font-semibold leading-tight sm:text-5xl">
        {question}
      </h2>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-5">
        {options.map((option, index) => {
          const selected = value === option.value;

          return (
            <motion.button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: index * 0.08,
              }}
              whileTap={{
                scale: 0.98,
              }}
              className={`
                  overflow-hidden
                  rounded-[1.5rem]
                  border
                  text-left
                  transition

                  ${
                    selected
                      ? "border-[var(--birthday-accent)]"
                      : "border-white/10"
                  }
                `}
            >
              <div className="relative aspect-[4/5]">
                <Image
                  src={option.src}
                  alt={option.alt}
                  fill
                  sizes="(max-width: 640px) 50vw, 400px"
                  className="object-cover"
                />

                {selected && (
                  <div className="absolute inset-0 border-4 border-[var(--birthday-accent)]/60" />
                )}
              </div>

              {option.label && (
                <div className="bg-white/[0.04] px-4 py-3 text-sm text-[var(--birthday-muted)]">
                  {option.label}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {isCorrect === true && feedback?.correct && (
        <p className="mt-6 text-sm text-[var(--birthday-accent)]">
          {feedback.correct}
        </p>
      )}

      {isCorrect === false && feedback?.incorrect && (
        <p className="mt-6 text-sm text-[var(--birthday-muted)]">
          {feedback.incorrect}
        </p>
      )}
    </div>
  );
}
