"use client";

import Image from "next/image";

import { AnimatePresence, motion } from "motion/react";

type RevealInteractionProps = {
  prompt: string;

  revealLabel?: string;

  title: string;
  body?: string;

  imageSrc?: string;
  imageAlt?: string;

  revealed: boolean;

  onReveal: () => void;
};

export default function RevealInteraction({
  prompt,
  revealLabel = "打開",
  title,
  body,
  imageSrc,
  imageAlt = "",
  revealed,
  onReveal,
}: RevealInteractionProps) {
  return (
    <div className="mx-auto w-full max-w-3xl text-center">
      <p className="font-story text-3xl font-semibold sm:text-5xl">{prompt}</p>

      {!revealed && (
        <motion.button
          type="button"
          whileTap={{
            scale: 0.96,
          }}
          onClick={onReveal}
          className="
            mt-10
            rounded-full
            border
            border-white/15
            bg-white/[0.05]
            px-7
            py-3
            text-sm
            text-[var(--birthday-foreground)]
            transition
            hover:bg-white/[0.1]
          "
        >
          {revealLabel}
        </motion.button>
      )}

      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{
              opacity: 0,
              y: 25,
              scale: 0.98,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            transition={{
              duration: 0.7,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mt-12"
          >
            {imageSrc && (
              <div className="relative mx-auto mb-8 aspect-[4/3] max-w-xl overflow-hidden rounded-[2rem]">
                <Image
                  src={imageSrc}
                  alt={imageAlt}
                  fill
                  sizes="(max-width: 640px) 90vw, 600px"
                  className="object-cover"
                />
              </div>
            )}

            <h2 className="font-story text-4xl font-semibold sm:text-5xl">
              {title}
            </h2>

            {body && (
              <p className="mx-auto mt-6 max-w-xl whitespace-pre-line leading-8 text-[var(--birthday-muted)]">
                {body}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
