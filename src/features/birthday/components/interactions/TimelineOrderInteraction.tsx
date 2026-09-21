"use client";

import { useEffect, useState } from "react";

import { Reorder, motion } from "motion/react";

import type {
  AnswerFeedback,
  TimelineItem,
} from "@/features/birthday/types/story";

type TimelineOrderInteractionProps = {
  question: string;

  items: TimelineItem[];

  value?: string[];

  correctOrder: string[];

  feedback?: AnswerFeedback;

  onChange: (order: string[]) => void;
};

export default function TimelineOrderInteraction({
  question,
  items,
  value,
  correctOrder,
  feedback,
  onChange,
}: TimelineOrderInteractionProps) {
  const initialOrder = value ?? items.map((item) => item.id);

  const [order, setOrder] = useState(initialOrder);

  useEffect(() => {
    if (value) {
      setOrder(value);
    }
  }, [value]);

  const itemMap = new Map(items.map((item) => [item.id, item]));

  const hasAnswered = value !== undefined;

  const isCorrect =
    hasAnswered &&
    order.length === correctOrder.length &&
    order.every((id, index) => id === correctOrder[index]);

  function handleReorder(nextOrder: string[]) {
    setOrder(nextOrder);

    onChange(nextOrder);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h2 className="font-story text-3xl font-semibold leading-tight sm:text-5xl">
        {question}
      </h2>

      <p className="mt-5 text-sm text-[var(--birthday-muted)]">
        拖曳卡片，把它們排成妳記得的順序。
      </p>

      <Reorder.Group
        axis="y"
        values={order}
        onReorder={handleReorder}
        className="mt-10 space-y-3"
      >
        {order.map((id, index) => {
          const item = itemMap.get(id);

          if (!item) {
            return null;
          }

          return (
            <Reorder.Item
              key={id}
              value={id}
              whileDrag={{
                scale: 1.02,
              }}
              className="
                  relative
                  cursor-grab
                  rounded-2xl
                  border
                  border-white/10
                  bg-[var(--birthday-surface)]
                  p-5
                  active:cursor-grabbing
                "
            >
              <div className="flex items-center gap-4">
                <span
                  className="
                      flex
                      h-8
                      w-8
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      border
                      border-white/10
                      text-xs
                      text-[var(--birthday-muted)]
                    "
                >
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-story text-lg">{item.title}</p>

                  {item.description && (
                    <p className="mt-1 text-sm text-[var(--birthday-muted)]">
                      {item.description}
                    </p>
                  )}
                </div>

                <span className="select-none text-lg text-[var(--birthday-muted)]">
                  ≡
                </span>
              </div>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>

      {hasAnswered && (
        <motion.p
          key={isCorrect ? "correct" : "incorrect"}
          initial={{
            opacity: 0,
            y: 5,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className={`
            mt-6
            text-sm

            ${
              isCorrect
                ? "text-[var(--birthday-accent)]"
                : "text-[var(--birthday-muted)]"
            }
          `}
        >
          {isCorrect
            ? (feedback?.correct ?? "順序對了。")
            : (feedback?.incorrect ?? "好像還不是這個順序。")}
        </motion.p>
      )}
    </div>
  );
}
