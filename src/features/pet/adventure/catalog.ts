export type QuestAction = "feed" | "pet" | "play";
export type RewardKind = "decor" | "room";

export const QUESTS: ReadonlyArray<{
  action: QuestAction;
  goal: number;
  title: string;
  story: string;
}> = [
  { action: "feed", goal: 1, title: "萌蛋的下午茶", story: "萌蛋想準備一場小小的茶會，先陪牠吃點東西吧。" },
  { action: "feed", goal: 2, title: "今天要吃飽飽", story: "萌蛋今天的胃口特別好，想要兩次美味補給。" },
  { action: "pet", goal: 2, title: "摸摸充電計畫", story: "萌蛋想要你多陪陪牠，摸摸牠兩次吧。" },
  { action: "pet", goal: 3, title: "給萌蛋一點安心感", story: "今天需要三次溫柔的摸摸，讓萌蛋安心。" },
  { action: "play", goal: 1, title: "一起動一動", story: "萌蛋突然想運動了！陪牠玩一次吧。" },
  { action: "play", goal: 2, title: "玩耍小冠軍", story: "萌蛋發起了遊戲挑戰，陪牠玩兩次吧。" },
];

export const ACTION_LABELS: Record<QuestAction, string> = {
  feed: "餵食", pet: "摸摸", play: "玩耍",
};

export const DECORATIONS = [
  { title: "小星星夜燈", emoji: "🌟", story: "萌蛋說這樣夜晚就不會太黑了。" },
  { title: "粉紅蝴蝶結", emoji: "🎀", story: "萌蛋偷偷挑了最可愛的配色。" },
  { title: "軟綿綿抱枕", emoji: "🧸", story: "一個適合一起打盹的好朋友。" },
  { title: "魔法小盆栽", emoji: "🪴", story: "每天看著它，心情就會變好。" },
  { title: "草莓點心", emoji: "🍓", story: "萌蛋把今天的快樂藏在草莓裡。" },
  { title: "彩虹小禮物", emoji: "🎁", story: "打開之後，好像還有更多驚喜。" },
  { title: "月亮擺飾", emoji: "🌙", story: "萌蛋想送你一個安靜的夜晚。" },
  { title: "玻璃雪球", emoji: "❄️", story: "小小的雪景裡藏著今天的回憶。" },
] as const;

export const ROOMS = [
  { title: "奶油小屋", emoji: "🏠", story: "柔軟奶油色的家，適合窩在一起。", bg: "linear-gradient(160deg,#fff1d4 0%,#ffe0c0 64%,#c98b65 100%)" },
  { title: "星空小屋", emoji: "🌌", story: "在星光底下，萌蛋也有一個溫暖的家。", bg: "linear-gradient(160deg,#20295f 0%,#6658a9 65%,#d4abe9 100%)" },
  { title: "森林樹屋", emoji: "🌲", story: "可以聽見樹葉和小鳥聲的秘密基地。", bg: "linear-gradient(160deg,#bbebd1 0%,#7abf9a 65%,#44745b 100%)" },
  { title: "海邊玻璃屋", emoji: "🌊", story: "每天都能看見藍色海浪與夕陽。", bg: "linear-gradient(160deg,#a9eaf0 0%,#7cc7f0 60%,#ffe6b8 100%)" },
] as const;

export function pickQuest(index: number) {
  return QUESTS[((index % QUESTS.length) + QUESTS.length) % QUESTS.length];
}

export function rewardAppearance(kind: "room", variant: number): (typeof ROOMS)[number];
export function rewardAppearance(kind: "decor", variant: number): (typeof DECORATIONS)[number];
export function rewardAppearance(kind: RewardKind, variant: number): (typeof ROOMS)[number] | (typeof DECORATIONS)[number];
export function rewardAppearance(kind: RewardKind, variant: number) {
  if (kind === "room") {
    return ROOMS[((variant % ROOMS.length) + ROOMS.length) % ROOMS.length];
  }
  return DECORATIONS[((variant % DECORATIONS.length) + DECORATIONS.length) % DECORATIONS.length];
}

export function taipeiDateKey(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export const REWARD_WAIT_MS = 60 * 1000;
