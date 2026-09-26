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

function containsAny(message: string, keywords: string[]) {
  return keywords.some((keyword) => message.includes(keyword));
}

export function selectContextSources(message: string): AppContextSource[] {
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  const sources = new Set<AppContextSource>();

  if (containsAny(normalized, PLACE_KEYWORDS)) {
    sources.add("places");
  }

  if (containsAny(normalized, DATE_KEYWORDS)) {
    sources.add("dates");
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

  return [...sources];
}
