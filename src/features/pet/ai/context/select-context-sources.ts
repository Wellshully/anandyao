import type { AppContextSource } from "./types";

const PLACE_KEYWORDS = [
  "地方",
  "地點",
  "景點",
  "哪裡",
  "去哪",
  "去過",
  "想去",
  "再去",
  "地址",
  "place",
  "places",
  "location",
  "spot",
];

const DATE_KEYWORDS = [
  "約會",
  "行程",
  "安排",
  "週末",
  "周末",
  "旅行",
  "旅遊",
  "出遊",
  "幾天",
  "哪天",
  "日期",
  "date",
  "dates",
  "trip",
  "itinerary",
];

const STUDY_KEYWORDS = [
  "作業",
  "功課",
  "課程",
  "上課",
  "課業",
  "考試",
  "報告",
  "deadline",
  "assignment",
  "assignments",
  "study",
  "course",
  "homework",
];

const RECURRING_SCHEDULE_KEYWORDS = [
  "固定行程",
  "固定",
  "週期",
  "例行",
  "每週",
  "每周",
  "每星期",
  "每禮拜",
  "隔週",
  "隔周",
  "每兩週",
  "每2週",

  "週一",
  "週二",
  "週三",
  "週四",
  "週五",
  "週六",
  "週日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
  "星期日",

  "取消",
  "不要了",
  "不用了",
  "改成",
  "改到",
  "改在",
];

const DAILY_PLAN_KEYWORDS = [
  "今天要幹嘛",
  "今天要幹麻",
  "今天要做什麼",
  "今天做什麼",
  "今天有什麼事",
  "今天有什麼事情",
  "今天有什麼安排",
  "今天有什麼行程",
  "今天忙嗎",
  "今天要忙什麼",
];

function containsAny(message: string, keywords: string[]) {
  return keywords.some((keyword) => message.includes(keyword));
}

export function selectContextSources(message: string): AppContextSource[] {
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  const sources = new Set<AppContextSource>();

  /*
   * 「今天要幹嘛？」是一個跨模組問題。
   *
   * Dates：共同 Date / 行程
   * Study：目前登入者的作業
   */
  if (containsAny(normalized, DAILY_PLAN_KEYWORDS)) {
    sources.add("dates");
    sources.add("study");
    sources.add("recurringSchedules");
  }

  if (containsAny(normalized, PLACE_KEYWORDS)) {
    sources.add("places");
  }

  if (containsAny(normalized, DATE_KEYWORDS)) {
    sources.add("dates");
  }

  if (containsAny(normalized, STUDY_KEYWORDS)) {
    sources.add("study");
  }

  if (
    containsAny(
      normalized,
      RECURRING_SCHEDULE_KEYWORDS,
    )
  ) {
    sources.add(
      "recurringSchedules",
    );
  }

  /*
   * 「約會去了哪裡」這類問題需要：
   *
   * Dates：知道是哪一次約會
   * Places：知道系統中儲存的地點資訊
   */
  if (
    sources.has("dates") &&
    containsAny(normalized, ["哪裡", "去哪", "地點", "地方"])
  ) {
    sources.add("places");
  }

  if (
    /(?:今天|明天|後天|這週|本週|下週|週末|周末)/u.test(
      normalized,
    ) &&
    /(?:行程|安排|有什麼事|要做什麼|要幹嘛)/u.test(
      normalized,
    )
  ) {
    sources.add("recurringSchedules");
  }

  return [...sources];
}
