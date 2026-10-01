import {
  pickPetExpression,
  type PetExpressionDefinition,
  type PetExpressionMood,
} from "./pet-expressions";


export type PetMood =
  | "neutral"
  | "happy"
  | "excited"
  | "loving"
  | "sad"
  | "angry"
  | "confused"
  | "surprised";


export type PetActivity =
  | "idle"
  | "working"
  | "studying"
  | "reading"
  | "drinking"
  | "eating"
  | "phone"
  | "music"
  | "sleeping"
  | "resting"
  | "hiding"
  | "playing";


export type PetImageState = {
  /**
   * 萌蛋目前的大方向情緒。
   */
  mood?: PetMood | null;

  /**
   * 萌蛋正在做什麼。
   *
   * Activity 的優先度通常比 mood 高，
   * 例如正在讀書時，就算 mood = happy，
   * 還是優先顯示讀書圖片。
   */
  activity?: PetActivity | null;

  /**
   * 0 ~ 100
   */
  energy?: number | null;

  /**
   * 0 ~ 100
   *
   * 數值越高代表越餓。
   */
  hunger?: number | null;

  /**
   * 0 ~ 100
   *
   * 可以用來表示親密 / affection。
   */
  affection?: number | null;

  /**
   * AI / 萌蛋目前正在思考。
   */
  isThinking?: boolean;

  /**
   * 明確進入睡眠狀態。
   */
  isSleeping?: boolean;

  /**
   * 剛完成任務、行程或某件值得慶祝的事情。
   */
  justCompletedTask?: boolean;

  /**
   * 剛收到愛心、親密互動等。
   */
  justReceivedLove?: boolean;

  /**
   * 剛發生意外 / 驚訝事件。
   */
  justSurprised?: boolean;

  /**
   * 用於讓同一狀態可以穩定切換不同圖片。
   *
   * 例如：
   * variationSeed = message.id
   * variationSeed = date
   * variationSeed = interaction count
   */
  variationSeed?: string | number | null;
};


function clampPercent(
  value: number | null | undefined,
  fallback: number,
) {
  if (
    typeof value !== "number" ||
    Number.isNaN(value)
  ) {
    return fallback;
  }

  return Math.max(
    0,
    Math.min(100, value),
  );
}


function getMoodFromActivity(
  activity: PetActivity,
): PetExpressionMood {
  switch (activity) {
    case "working":
      return "working";

    case "studying":
    case "reading":
      return "studying";

    case "drinking":
      return "relaxed";

    case "eating":
      return "hungry";

    case "phone":
      return "social";

    case "music":
      return "music";

    case "sleeping":
      return "sleepy";

    case "resting":
      return "exhausted";

    case "hiding":
      return "hiding";

    case "playing":
      return "playful";

    case "idle":
    default:
      return "idle";
  }
}


function getMoodFromEmotion(
  mood: PetMood,
): PetExpressionMood {
  switch (mood) {
    case "happy":
      return "happy";

    case "excited":
      return "excited";

    case "loving":
      return "loving";

    case "sad":
      return "sad";

    case "angry":
      return "angry";

    case "confused":
      return "confused";

    case "surprised":
      return "surprised";

    case "neutral":
    default:
      return "idle";
  }
}


/**
 * 根據萌蛋目前狀態，決定要使用哪一類表情。
 *
 * 優先順序很重要：
 *
 * 1. 睡覺
 * 2. 體力耗盡
 * 3. 特殊即時事件
 * 4. 生氣 / 難過
 * 5. 思考
 * 6. 具體活動
 * 7. 肚子餓
 * 8. 情緒
 * 9. 親密度
 * 10. 待機
 */
export function getPetExpressionMoodFromState(
  state: PetImageState,
): PetExpressionMood {
  const energy = clampPercent(
    state.energy,
    100,
  );

  const hunger = clampPercent(
    state.hunger,
    0,
  );

  const affection = clampPercent(
    state.affection,
    0,
  );


  // 1. 明確睡覺
  if (
    state.isSleeping ||
    state.activity === "sleeping"
  ) {
    return "sleepy";
  }


  // 2. 完全累壞
  if (energy <= 15) {
    return "exhausted";
  }


  // 3. 特殊事件
  if (state.justSurprised) {
    return "surprised";
  }

  if (state.justReceivedLove) {
    return "loving";
  }

  if (state.justCompletedTask) {
    return "excited";
  }


  // 4. 負面情緒優先
  if (state.mood === "angry") {
    return "angry";
  }

  if (state.mood === "sad") {
    return "sad";
  }


  // 5. AI / 萌蛋正在思考
  if (state.isThinking) {
    return "thinking";
  }


  // 6. 有明確活動時，顯示活動圖片
  if (
    state.activity &&
    state.activity !== "idle"
  ) {
    return getMoodFromActivity(
      state.activity,
    );
  }


  // 7. 很餓
  if (hunger >= 75) {
    return "hungry";
  }


  // 8. 正常 mood
  if (state.mood) {
    return getMoodFromEmotion(
      state.mood,
    );
  }


  // 9. 高親密度偶爾呈現可愛 / 愛心狀態
  if (affection >= 90) {
    return "loving";
  }

  if (affection >= 70) {
    return "happy";
  }


  // 10. 一般待機
  return "idle";
}


/**
 * 回傳完整 expression 資訊。
 *
 * 例如：
 *
 * {
 *   id: "pet03",
 *   src: "/pet/pet03.png",
 *   label: "超開心",
 *   mood: "excited"
 * }
 */
export function getPetExpressionFromState(
  state: PetImageState,
): PetExpressionDefinition {
  const mood =
    getPetExpressionMoodFromState(
      state,
    );

  const seed =
    state.variationSeed ??
    `${mood}-default`;

  return pickPetExpression(
    mood,
    seed,
  );
}


/**
 * 最常用的函式。
 *
 * 直接取得：
 *
 * /pet/pet03.png
 */
export function getPetImageFromState(
  state: PetImageState,
): string {
  return getPetExpressionFromState(
    state,
  ).src;
}
