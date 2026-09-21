"use client";

import { useCallback, useEffect, useState } from "react";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import BirthdayNavigation from "@/features/birthday/components/BirthdayNavigation";
import ChapterRenderer from "@/features/birthday/components/ChapterRenderer";

import { birthdayStory } from "@/features/birthday/config/story";

import type {
  BirthdayAnswer,
  BirthdayAnswers,
} from "@/features/birthday/types/story";

export default function BirthdayStory() {
  const [current, setCurrent] = useState(0);

  const [direction, setDirection] = useState(1);

  const [answers, setAnswers] = useState<BirthdayAnswers>({});

  const reduceMotion = useReducedMotion();

  const chapter = birthdayStory[current];

  const answer = answers[chapter.id];

  function setAnswer(value: BirthdayAnswer) {
    setAnswers((previous) => ({
      ...previous,
      [chapter.id]: value,
    }));
  }

  let canContinue = true;

  switch (chapter.type) {
    case "text": {
      if (chapter.required !== false) {
        canContinue = typeof answer === "string" && answer.trim().length > 0;
      }

      break;
    }

    case "choice":
    case "photo-choice": {
      if (chapter.required !== false) {
        canContinue = typeof answer === "string";
      }

      if (canContinue && chapter.requireCorrect && chapter.correctAnswer) {
        canContinue = answer === chapter.correctAnswer;
      }

      break;
    }

    case "yes-no": {
      if (chapter.required !== false) {
        canContinue = typeof answer === "boolean";
      }

      if (
        canContinue &&
        chapter.requireCorrect &&
        chapter.correctAnswer !== undefined
      ) {
        canContinue = answer === chapter.correctAnswer;
      }

      break;
    }

    case "reveal": {
      if (chapter.required !== false) {
        canContinue = answer === true;
      }

      break;
    }

    case "flip-cards": {
      if (chapter.required !== false && chapter.requireAll !== false) {
        canContinue =
          Array.isArray(answer) && answer.length === chapter.cards.length;
      }

      break;
    }

    case "timeline-order": {
      if (chapter.required !== false) {
        canContinue = Array.isArray(answer);
      }

      if (canContinue && chapter.requireCorrect) {
        canContinue =
          Array.isArray(answer) &&
          answer.length === chapter.correctOrder.length &&
          answer.every((id, index) => id === chapter.correctOrder[index]);
      }

      break;
    }
    case "content":
      canContinue = true;
      break;
  }

  const goNext = useCallback(() => {
    if (!canContinue) {
      return;
    }

    if (current >= birthdayStory.length - 1) {
      return;
    }

    setDirection(1);

    setCurrent((value) => value + 1);
  }, [current, canContinue]);

  const goPrevious = useCallback(() => {
    if (current <= 0) {
      return;
    }

    setDirection(-1);

    setCurrent((value) => value - 1);
  }, [current]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowRight") {
        goNext();
      }

      if (event.key === "ArrowLeft") {
        goPrevious();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [goNext, goPrevious]);

  return (
    <main
      className="
        relative
        min-h-[100svh]
        overflow-hidden
        bg-[var(--birthday-background)]
        text-[var(--birthday-foreground)]
      "
    >
      <div
        className="
          pointer-events-none
          absolute
          -left-40
          -top-40
          h-[30rem]
          w-[30rem]
          rounded-full
          bg-[var(--birthday-accent)]
          opacity-[0.08]
          blur-[100px]
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          -bottom-40
          -right-40
          h-[30rem]
          w-[30rem]
          rounded-full
          bg-white
          opacity-[0.03]
          blur-[120px]
        "
      />

      <div
        className="
          relative
          mx-auto
          flex
          min-h-[100svh]
          w-full
          max-w-6xl
          flex-col
          px-5
          py-6
          sm:px-8
          sm:py-8
        "
      >
        <header className="flex items-center justify-between">
          <span className="font-story text-lg">An & Yao</span>

          <span className="text-xs tracking-[0.2em] text-[var(--birthday-muted)]">
            10 · 29
          </span>
        </header>

        <div className="relative flex flex-1 items-center py-12">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={chapter.id}
              custom={direction}
              initial={
                reduceMotion
                  ? {
                      opacity: 0,
                    }
                  : {
                      opacity: 0,
                      x: direction > 0 ? 45 : -45,
                    }
              }
              animate={{
                opacity: 1,
                x: 0,
              }}
              exit={
                reduceMotion
                  ? {
                      opacity: 0,
                    }
                  : {
                      opacity: 0,
                      x: direction > 0 ? -45 : 45,
                    }
              }
              transition={{
                duration: reduceMotion ? 0.15 : 0.55,

                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-full"
            >
              <ChapterRenderer
                chapter={chapter}
                answer={answer}
                onAnswer={setAnswer}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <footer>
          <BirthdayNavigation
            current={current}
            total={birthdayStory.length}
            canContinue={canContinue}
            onNext={goNext}
            onPrevious={goPrevious}
          />
        </footer>
      </div>
    </main>
  );
}
