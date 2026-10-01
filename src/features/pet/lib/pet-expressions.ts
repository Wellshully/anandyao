export type PetExpressionId =
  | "pet00"
  | "pet01"
  | "pet02"
  | "pet03"
  | "pet04"
  | "pet05"
  | "pet06"
  | "pet07"
  | "pet08"
  | "pet09"
  | "pet10"
  | "pet11"
  | "pet12"
  | "pet13"
  | "pet14"
  | "pet15"
  | "pet16"
  | "pet17"
  | "pet18"
  | "pet19"
  | "pet20"
  | "pet21"
  | "pet22"
  | "pet23";

export type PetExpressionMood =
  | "idle"
  | "happy"
  | "excited"
  | "loving"
  | "playful"
  | "confused"
  | "thinking"
  | "surprised"
  | "sad"
  | "angry"
  | "sleepy"
  | "exhausted"
  | "working"
  | "studying"
  | "relaxed"
  | "hungry"
  | "social"
  | "music"
  | "hiding";

export type PetExpressionDefinition = {
  id: PetExpressionId;
  src: string;
  label: string;
  mood: PetExpressionMood;
};

/**
 * 24 張萌蛋圖片的完整定義。
 *
 * 排序方式：
 * 由左到右、由上到下。
 */
export const PET_EXPRESSIONS = {
  pet00: {
    id: "pet00",
    src: "/pet/pet00.png",
    label: "普通開心",
    mood: "idle",
  },

  pet01: {
    id: "pet01",
    src: "/pet/pet01.png",
    label: "眨眼",
    mood: "playful",
  },

  pet02: {
    id: "pet02",
    src: "/pet/pet02.png",
    label: "抱愛心",
    mood: "loving",
  },

  pet03: {
    id: "pet03",
    src: "/pet/pet03.png",
    label: "超開心",
    mood: "excited",
  },

  pet04: {
    id: "pet04",
    src: "/pet/pet04.png",
    label: "開心大笑",
    mood: "happy",
  },

  pet05: {
    id: "pet05",
    src: "/pet/pet05.png",
    label: "開心蹦跳",
    mood: "music",
  },

  pet06: {
    id: "pet06",
    src: "/pet/pet06.png",
    label: "疑惑",
    mood: "confused",
  },

  pet07: {
    id: "pet07",
    src: "/pet/pet07.png",
    label: "思考",
    mood: "thinking",
  },

  pet08: {
    id: "pet08",
    src: "/pet/pet08.png",
    label: "嚇到",
    mood: "surprised",
  },

  pet09: {
    id: "pet09",
    src: "/pet/pet09.png",
    label: "哭哭",
    mood: "sad",
  },

  pet10: {
    id: "pet10",
    src: "/pet/pet10.png",
    label: "生氣",
    mood: "angry",
  },

  pet11: {
    id: "pet11",
    src: "/pet/pet11.png",
    label: "睏睏",
    mood: "sleepy",
  },

  pet12: {
    id: "pet12",
    src: "/pet/pet12.png",
    label: "用電腦",
    mood: "working",
  },

  pet13: {
    id: "pet13",
    src: "/pet/pet13.png",
    label: "喝飲料",
    mood: "relaxed",
  },

  pet14: {
    id: "pet14",
    src: "/pet/pet14.png",
    label: "吃餅乾",
    mood: "hungry",
  },

  pet15: {
    id: "pet15",
    src: "/pet/pet15.png",
    label: "讀書",
    mood: "studying",
  },

  pet16: {
    id: "pet16",
    src: "/pet/pet16.png",
    label: "看手機",
    mood: "social",
  },

  pet17: {
    id: "pet17",
    src: "/pet/pet17.png",
    label: "戴耳機",
    mood: "music",
  },

  pet18: {
    id: "pet18",
    src: "/pet/pet18.png",
    label: "睡覺",
    mood: "sleepy",
  },

  pet19: {
    id: "pet19",
    src: "/pet/pet19.png",
    label: "偷偷探頭",
    mood: "hiding",
  },

  pet20: {
    id: "pet20",
    src: "/pet/pet20.png",
    label: "笑到翻滾",
    mood: "playful",
  },

  pet21: {
    id: "pet21",
    src: "/pet/pet21.png",
    label: "累趴",
    mood: "exhausted",
  },

  pet22: {
    id: "pet22",
    src: "/pet/pet22.png",
    label: "抱著食物",
    mood: "hungry",
  },

  pet23: {
    id: "pet23",
    src: "/pet/pet23.png",
    label: "閃亮開心",
    mood: "happy",
  },
} as const satisfies Record<
  PetExpressionId,
  PetExpressionDefinition
>;


/**
 * 同一種情緒可以有多張圖片。
 *
 * 萌蛋因此不會每次 happy 都固定只出現一張。
 */
export const PET_EXPRESSION_GROUPS = {
  idle: [
    "pet00",
    "pet01",
    "pet19",
  ],

  happy: [
    "pet00",
    "pet01",
    "pet04",
    "pet23",
  ],

  excited: [
    "pet03",
    "pet04",
    "pet05",
    "pet20",
    "pet23",
  ],

  loving: [
    "pet02",
    "pet03",
  ],

  playful: [
    "pet01",
    "pet05",
    "pet20",
  ],

  confused: [
    "pet06",
    "pet07",
  ],

  thinking: [
    "pet07",
  ],

  surprised: [
    "pet08",
  ],

  sad: [
    "pet09",
    "pet11",
  ],

  angry: [
    "pet10",
  ],

  sleepy: [
    "pet11",
    "pet18",
  ],

  exhausted: [
    "pet11",
    "pet18",
    "pet21",
  ],

  working: [
    "pet12",
    "pet15",
  ],

  studying: [
    "pet12",
    "pet15",
  ],

  relaxed: [
    "pet13",
    "pet17",
  ],

  hungry: [
    "pet14",
    "pet22",
  ],

  social: [
    "pet16",
  ],

  music: [
    "pet05",
    "pet17",
  ],

  hiding: [
    "pet19",
  ],
} as const satisfies Record<
  PetExpressionMood,
  readonly PetExpressionId[]
>;


function hashString(value: string) {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}


/**
 * 從某個情緒群組挑出一張圖片。
 *
 * seed 相同 → 會選到同一張。
 * 這比 Math.random() 適合 React / Next.js SSR。
 */
export function pickPetExpression(
  mood: PetExpressionMood,
  seed: string | number = 0,
): PetExpressionDefinition {
  const candidates = PET_EXPRESSION_GROUPS[mood];

  const numericSeed =
    typeof seed === "number"
      ? Math.abs(Math.floor(seed))
      : hashString(seed);

  const index =
    numericSeed % candidates.length;

  const id = candidates[index];

  return PET_EXPRESSIONS[id];
}


export function getPetExpressionById(
  id: PetExpressionId,
): PetExpressionDefinition {
  return PET_EXPRESSIONS[id];
}


export function getPetExpressionSrc(
  id: PetExpressionId,
) {
  return PET_EXPRESSIONS[id].src;
}
