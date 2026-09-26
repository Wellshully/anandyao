"use client";

import Image from "next/image";
import { motion } from "motion/react";

import type { PetAnimation, PetMood } from "@/features/pet/types";

import type { PetPose } from "@/features/pet/ai/pet-reply";

type PetCharacterProps = {
  mood: PetMood;
  animation: PetAnimation;
  pose?: PetPose | null;
};

const poseImages: Record<PetPose, string> = {
  normal: "/pet/pet00.png",
  cute: "/pet/pet01.png",
  happy: "/pet/pet02.png",
  excited: "/pet/pet03.png",

  angry: "/pet/pet10.png",
  sad: "/pet/pet11.png",
  resting: "/pet/pet12.png",
  sleeping: "/pet/pet13.png",

  love: "/pet/pet20.png",
  petted: "/pet/pet21.png",
  playing: "/pet/pet22.png",
  rolling: "/pet/pet23.png",
};

const moodLabels: Record<PetMood, string> = {
  normal: "今天很平靜",
  happy: "今天心情很好",
  sad: "好像有點不開心",
  hungry: "肚子餓了",
  sleepy: "看起來想睡覺",
};

function getMoodImage(mood: PetMood) {
  switch (mood) {
    case "happy":
      return "/pet/pet02.png";

    case "sad":
      return "/pet/pet11.png";

    case "hungry":
      return "/pet/pet12.png";

    case "sleepy":
      return "/pet/pet13.png";

    case "normal":
    default:
      return "/pet/pet00.png";
  }
}

function getImage(
  mood: PetMood,
  animation: PetAnimation,
  pose?: PetPose | null,
) {
  /*
   * Direct pet interactions have
   * temporary visual priority.
   */
  switch (animation) {
    case "feed":
      return "/pet/pet03.png";

    case "pet":
      return "/pet/pet21.png";

    case "play":
      return "/pet/pet22.png";

    case "idle":
    default:
      break;
  }

  /*
   * AI reply pose overrides the
   * normal mood while the pet is idle.
   */
  if (pose) {
    return poseImages[pose];
  }

  return getMoodImage(mood);
}

function getAnimation(animation: PetAnimation) {
  switch (animation) {
    case "feed":
      return {
        y: [0, -5, 0, -5, 0],
        scale: [1, 1.05, 1, 1.05, 1],
        rotate: 0,
      };

    case "pet":
      return {
        y: [0, 3, 0],
        scale: [1, 1.04, 1],
        rotate: [0, -3, 3, -2, 0],
      };

    case "play":
      return {
        y: [0, -18, -6, -20, 0],
        scale: [1, 1.04, 1],
        rotate: [0, -4, 4, -3, 0],
      };

    case "idle":
    default:
      return {
        y: [0, -6, 0],
        scale: [1, 1.015, 1],
        rotate: 0,
      };
  }
}

function getTransition(animation: PetAnimation) {
  if (animation === "idle") {
    return {
      duration: 2.8,
      repeat: Infinity,
      ease: "easeInOut" as const,
    };
  }

  return {
    duration: 1.2,
    ease: "easeInOut" as const,
  };
}

export default function PetCharacter({
  mood,
  animation,
  pose,
}: PetCharacterProps) {
  const image = getImage(mood, animation, pose);

  return (
    <div className="flex flex-col items-center">
      <div
        className="
          relative
          flex
          h-[60vh]
          min-h-[22rem]
          max-h-[36rem]
          w-[86vw]
          max-w-[38rem]
          items-center
          justify-center
        "
      >
        <motion.div
          key={`${image}-${animation}`}
          className="relative h-full w-full"
          animate={getAnimation(animation)}
          transition={getTransition(animation)}
        >
          <Image
            src={image}
            alt="我們的寵物"
            fill
            priority
            sizes="
              (max-width: 640px) 86vw,
              608px
            "
            className="object-contain select-none"
            draggable={false}
          />
        </motion.div>
      </div>

      {!pose && (
        <p className="mt-2 text-sm text-[var(--muted)]">{moodLabels[mood]}</p>
      )}
    </div>
  );
}
