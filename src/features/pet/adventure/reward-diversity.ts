import type { RewardSpec } from "./reward-spec";

export type RecentRewardSummary = {
  rewardType: "decor" | "room";
  title: string;
  story: string;
  appearancePrompt: string | null;
  themeTags?: string[];
  createdAt: string;
};

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function bigrams(value: string): Set<string> {
  const chars = Array.from(normalize(value));
  const result = new Set<string>();

  for (let i = 0; i < chars.length - 1; i++) {
    result.add(chars[i] + chars[i + 1]);
  }

  return result;
}

function titleSimilarity(
  first: string,
  second: string,
): number {
  const a = normalize(first);
  const b = normalize(second);

  if (!a || !b) return 0;
  if (a === b) return 1;

  if (
    Math.min(Array.from(a).length, Array.from(b).length) >= 4 &&
    (a.includes(b) || b.includes(a))
  ) {
    return 1;
  }

  const left = bigrams(first);
  const right = bigrams(second);

  const intersection = [...left].filter(
    (token) => right.has(token),
  ).length;

  const union = new Set([...left, ...right]).size;

  return union > 0 ? intersection / union : 0;
}

function sharedThemeCount(
  first: string[],
  second: string[],
): number {
  const left = new Set(first.map(normalize).filter(Boolean));
  const right = new Set(second.map(normalize).filter(Boolean));

  return [...left].filter((tag) => right.has(tag)).length;
}

export function isRewardTooSimilar(
  candidate: Pick<RewardSpec, "title" | "themeTags">,
  history: RecentRewardSummary[],
): boolean {
  return history.slice(0, 20).some((previous) => {
    const similarity = titleSimilarity(
      candidate.title,
      previous.title,
    );

    if (similarity >= 0.65) {
      return true;
    }

    const themes = sharedThemeCount(
      candidate.themeTags,
      previous.themeTags ?? [],
    );

    if (themes >= 2) {
      return true;
    }

    return themes >= 1 && similarity >= 0.3;
  });
}
