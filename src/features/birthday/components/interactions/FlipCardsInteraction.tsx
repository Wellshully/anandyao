"use client";

import Image from "next/image";

import { motion } from "motion/react";

import type { FlipCardOption } from "@/features/birthday/types/story";

type FlipCardsInteractionProps = {
  title: string;
  description?: string;

  cards: FlipCardOption[];

  revealedIds: string[];

  onChange: (ids: string[]) => void;
};

export default function FlipCardsInteraction({
  title,
  description,
  cards,
  revealedIds,
  onChange,
}: FlipCardsInteractionProps) {
  function revealCard(cardId: string) {
    if (revealedIds.includes(cardId)) {
      return;
    }

    onChange([...revealedIds, cardId]);
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="max-w-2xl">
        <h2 className="font-story text-3xl font-semibold leading-tight sm:text-5xl">
          {title}
        </h2>

        {description && (
          <p className="mt-5 leading-7 text-[var(--birthday-muted)]">
            {description}
          </p>
        )}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, index) => {
          const revealed = revealedIds.includes(card.id);

          return (
            <motion.button
              key={card.id}
              type="button"
              onClick={() => revealCard(card.id)}
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: index * 0.06,
              }}
              whileTap={{
                scale: 0.98,
              }}
              className="
                  relative
                  min-h-64
                  rounded-[1.75rem]
                  text-left
                  [perspective:1000px]
                "
            >
              <motion.div
                animate={{
                  rotateY: revealed ? 180 : 0,
                }}
                transition={{
                  duration: 0.65,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="
                    relative
                    h-full
                    min-h-64
                    w-full
                    [transform-style:preserve-3d]
                  "
              >
                {/* FRONT */}

                <div
                  className="
                      absolute
                      inset-0
                      flex
                      items-center
                      justify-center
                      rounded-[1.75rem]
                      border
                      border-white/10
                      bg-white/[0.04]
                      p-6
                      [backface-visibility:hidden]
                    "
                >
                  <div className="text-center">
                    <p className="font-story text-2xl">{card.front}</p>

                    <p className="mt-4 text-xs text-[var(--birthday-muted)]">
                      點一下翻開
                    </p>
                  </div>
                </div>

                {/* BACK */}

                <div
                  className="
                      absolute
                      inset-0
                      overflow-hidden
                      rounded-[1.75rem]
                      border
                      border-[var(--birthday-accent)]/40
                      bg-[var(--birthday-surface)]
                      [backface-visibility:hidden]
                      [transform:rotateY(180deg)]
                    "
                >
                  {card.imageSrc && (
                    <div className="relative h-36 w-full">
                      <Image
                        src={card.imageSrc}
                        alt={card.imageAlt ?? ""}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                  )}

                  <div className="p-6">
                    <h3 className="font-story text-xl font-semibold">
                      {card.backTitle}
                    </h3>

                    {card.backBody && (
                      <p className="mt-3 text-sm leading-6 text-[var(--birthday-muted)]">
                        {card.backBody}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.button>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-[var(--birthday-muted)]">
        {revealedIds.length} / {cards.length} 已翻開
      </p>
    </div>
  );
}
