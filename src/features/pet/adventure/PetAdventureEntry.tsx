"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getPetAdventureStateAction,
  type PetAdventureState,
} from "@/features/pet/adventure/actions";

type Props = { refreshSignal: number };

function summary(data: PetAdventureState, now: number) {
  if (!data.quest.completedAt) {
    return `今日任務：${data.quest.actionLabel} ${data.quest.progress}/${data.quest.goal}`;
  }

  const reward = data.rewards.find((item) => item.isToday);

  if (!reward) return "今日任務已完成";
  if (reward.choice === "accepted") return "今日任務完成 · 禮物已收藏";
  if (reward.choice === "discarded") return "今日任務完成 · 禮物已放棄";
  if (now < Date.parse(reward.availableAt)) return "今日任務完成 · 禮物準備中";
  return "今日任務完成 · 禮物可開箱";
}

export default function PetAdventureEntry({ refreshSignal }: Props) {
  const [data, setData] = useState<PetAdventureState | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const result = await getPetAdventureStateAction();
        if (!active) return;
        setData(result);
        setNow(Date.now());
        setError(false);
      } catch {
        if (!active) return;
        setError(true);
      }
    }

    void refresh();
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, 60_000);

    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, [refreshSignal]);

  const description = error
    ? "冒險資訊暫時無法取得，點擊查看"
    : data
      ? summary(data, now)
      : "正在讀取今日任務…";

  return (
    <section className="mx-auto mt-6 max-w-2xl">
      <Link
        href="/pet/adventure"
        className="group flex min-h-20 items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4 transition hover:border-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        aria-label={`進入萌蛋的每日冒險。${description}`}
      >
        <span className="min-w-0 space-y-1">
          <span className="block font-story text-base font-semibold">萌蛋的每日冒險</span>
          <span className="block text-xs text-[var(--muted)]" aria-live="polite">
            {description}
          </span>
        </span>
        <span className="shrink-0 text-sm font-medium text-[var(--muted)] transition group-hover:text-[var(--foreground)]">
          前往冒險 →
        </span>
      </Link>
    </section>
  );
}
