"use client";

import Image from "next/image";
import { motion } from "motion/react";

import type {
  PetAnimation,
  PetMood,
} from "@/features/pet/types";

import type {
  PetPose,
} from "@/features/pet/ai/pet-reply";


type PetCharacterProps = {
  mood: PetMood;
  animation: PetAnimation;
  pose?: PetPose | null;

  /**
   * AI 正在產生回覆時，
   * 顯示「思考中」的萌蛋。
   */
  thinking?: boolean;
};


/**
 * AI reply pose
 * ↓
 * 新 24 張萌蛋圖片
 *
 * 這裡維持既有 PetPose API，
 * 不修改 AI / memory / action 邏輯。
 */
const poseImages: Record<PetPose, string> = {
  // pet00 — 一般、待機
  normal: "/pet/pet00.png",

  // pet01 — 眨眼、俏皮、可愛
  cute: "/pet/pet01.png",

  // pet02 — 愛心、親密
  love: "/pet/pet02.png",

  // pet03 — 非常興奮
  excited: "/pet/pet03.png",

  // pet04 — 開心大笑
  happy: "/pet/pet04.png",

  // pet05 — 玩耍、蹦跳
  playing: "/pet/pet05.png",

  // pet06 — 疑惑
  confused: "/pet/pet06.png",

  // pet07 — 思考
  thinking: "/pet/pet07.png",

  // pet08 — 驚訝、嚇到
  surprised: "/pet/pet08.png",

  // pet09 — 難過、哭哭
  sad: "/pet/pet09.png",

  // pet10 — 生氣
  angry: "/pet/pet10.png",

  // pet11 — 疲倦、想睡
  resting: "/pet/pet11.png",

  // pet12 — 用電腦、工作
  working: "/pet/pet12.png",

  // pet13 — 喝飲料、悠閒
  drinking: "/pet/pet13.png",

  // pet14 — 吃點心
  eating: "/pet/pet14.png",

  // pet15 — 看書、讀書
  studying: "/pet/pet15.png",

  // pet16 — 看手機
  phone: "/pet/pet16.png",

  // pet17 — 戴耳機、聽音樂
  music: "/pet/pet17.png",

  // pet18 — 正式睡覺
  sleeping: "/pet/pet18.png",

  // pet19 — 偷偷探頭
  hiding: "/pet/pet19.png",

  // pet20 — 笑到翻滾
  rolling: "/pet/pet20.png",

  // pet21 — 累趴、耗盡
  exhausted: "/pet/pet21.png",

  // pet22 — 抱著食物
  food: "/pet/pet22.png",

  // pet23 — 被摸摸後閃亮開心
  petted: "/pet/pet23.png",
};


const moodLabels: Record<PetMood, string> = {
  normal: "今天很平靜",
  happy: "今天心情很好",
  sad: "好像有點不開心",
  hungry: "肚子餓了",
  sleepy: "看起來想睡覺",
};


/**
 * 沒有 AI pose 時，
 * 依照寵物數值計算出的 mood 顯示圖片。
 */
function getMoodImage(
  mood: PetMood,
) {
  switch (mood) {
    case "happy":
      // 閃亮、滿足
      return "/pet/pet23.png";

    case "sad":
      // 哭哭
      return "/pet/pet09.png";

    case "hungry":
      // 抱著食物
      return "/pet/pet22.png";

    case "sleepy":
      // 睏睏
      return "/pet/pet11.png";

    case "normal":
    default:
      return "/pet/pet00.png";
  }
}


/**
 * 決定萌蛋目前使用哪一張圖片。
 *
 * Priority:
 *
 * 1. 玩家直接互動
 * 2. AI 思考
 * 3. AI reply pose
 * 4. 基礎 mood
 */
function getImage(
  mood: PetMood,
  animation: PetAnimation,
  pose?: PetPose | null,
  thinking = false,
) {
  /*
   * 玩家直接互動具有最高優先權。
   */
  switch (animation) {
    case "feed":
      // 吃餅乾
      return "/pet/pet14.png";

    case "pet":
      // 愛心
      return "/pet/pet02.png";

    case "play":
      // 笑到翻滾
      return "/pet/pet20.png";

    case "idle":
    default:
      break;
  }


  /*
   * 萌蛋正在思考 AI 回覆。
   */
  if (thinking) {
    return "/pet/pet07.png";
  }


  /*
   * AI reply 指定的 pose。
   */
  if (pose) {
    return poseImages[pose];
  }


  /*
   * 普通數值狀態。
   */
  return getMoodImage(mood);
}


function getAnimation(
  animation: PetAnimation,
  thinking: boolean,
) {
  /*
   * 思考時稍微左右晃，
   * 比普通 idle 慢。
   */
  if (
    thinking &&
    animation === "idle"
  ) {
    return {
      y: [0, -3, 0],
      scale: [1, 1.01, 1],
      rotate: [0, -1.5, 1.5, 0],
    };
  }


  switch (animation) {
    case "feed":
      return {
        y: [0, -5, 0, -5, 0],
        scale: [
          1,
          1.05,
          1,
          1.05,
          1,
        ],
        rotate: 0,
      };

    case "pet":
      return {
        y: [0, 3, 0],
        scale: [1, 1.04, 1],
        rotate: [
          0,
          -3,
          3,
          -2,
          0,
        ],
      };

    case "play":
      return {
        y: [
          0,
          -18,
          -6,
          -20,
          0,
        ],
        scale: [1, 1.04, 1],
        rotate: [
          0,
          -4,
          4,
          -3,
          0,
        ],
      };

    case "idle":
    default:
      return {
        y: [0, -6, 0],
        scale: [
          1,
          1.015,
          1,
        ],
        rotate: 0,
      };
  }
}


function getTransition(
  animation: PetAnimation,
  thinking: boolean,
) {
  if (
    thinking &&
    animation === "idle"
  ) {
    return {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut" as const,
    };
  }


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
  thinking = false,
}: PetCharacterProps) {
  const image = getImage(
    mood,
    animation,
    pose,
    thinking,
  );


  return (
    <div className="flex flex-col items-center">
      <div
        className="
          relative
          flex
          h-[38dvh]
          min-h-[12rem]
          max-h-[19rem]
          w-[76vw]
          max-w-[20rem]
          sm:h-[60vh]
          sm:min-h-[22rem]
          sm:max-h-[36rem]
          sm:w-[86vw]
          sm:max-w-[38rem]
          items-center
          justify-center
        "
      >
        <motion.div
          key={`${image}-${animation}`}
          className="relative h-full w-full"
          animate={getAnimation(
            animation,
            thinking,
          )}
          transition={getTransition(
            animation,
            thinking,
          )}
        >
          <Image
            src={image}
            alt="萌蛋"
            fill
            priority
            sizes="
              (max-width: 640px) 76vw,
              608px
            "
            className="
              object-contain
              select-none
            "
            draggable={false}
          />
        </motion.div>
      </div>

      {!pose && !thinking && (
        <p
          className="
            mt-2
            text-sm
            text-[var(--muted)]
          "
        >
          {moodLabels[mood]}
        </p>
      )}
    </div>
  );
}
