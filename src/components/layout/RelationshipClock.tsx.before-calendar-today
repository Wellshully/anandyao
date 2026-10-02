"use client";

import Link from "next/link";

import type { FormEvent } from "react";

import { useEffect, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { siteConfig } from "@/config/site";

import { formatTaipeiTime, getRelationshipDay } from "@/lib/time/taipei-time";

import { useCurrentTime } from "@/lib/time/use-current-time";

import {
  createPersonalPlanAction,
  deletePersonalPlanAction,
  setPersonalPlanCompletedAction,
} from "@/features/today/actions";

import type { TodayItem } from "@/features/today/types";

type RelationshipClockProps = {
  items: TodayItem[];
};

const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  month: "long",
  day: "numeric",
  weekday: "short",
});

const itemTimeFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function getItemState(item: TodayItem, now: number) {
  if (item.kind === "personal") {
    if (item.completed) {
      return "completed";
    }

    return "personal";
  }

  if (item.startAt === null || item.endAt === null) {
    return "upcoming";
  }

  if (now >= item.endAt) {
    return "past";
  }

  if (now >= item.startAt && now < item.endAt) {
    return "current";
  }

  return "upcoming";
}

function getRelativeLabel(item: TodayItem, now: number) {
  if (item.kind === "study_assignment" && item.startAt !== null) {
    const diff = item.startAt - now;

    if (diff <= 0) {
      return "已截止";
    }

    const minutes = Math.ceil(diff / 60_000);

    if (minutes <= 60) {
      return minutes <= 1 ? "即將截止" : `還有 ${minutes} 分鐘`;
    }

    const hours = Math.ceil(diff / 3_600_000);

    if (hours <= 24) {
      return `還有 ${hours} 小時`;
    }

    const days = Math.ceil(diff / 86_400_000);

    return `${days} 天後截止`;
  }

  if (item.startAt === null) {
    return null;
  }

  const state = getItemState(item, now);

  if (state === "current") {
    return "現在";
  }

  if (state === "past") {
    return "已結束";
  }

  if (state === "completed") {
    return "完成";
  }

  const minutes = Math.ceil((item.startAt - now) / 60_000);

  if (minutes > 0 && minutes <= 60) {
    return minutes <= 1 ? "即將開始" : `還有 ${minutes} 分鐘`;
  }

  return null;
}

function getItemSideLabel(item: TodayItem) {
  if (item.kind === "study_assignment" || item.kind === "study_announcement") {
    return "Study";
  }

  if (item.kind === "study_mail") {
    return "Mail";
  }

  if (item.startAt !== null) {
    return itemTimeFormatter.format(new Date(item.startAt));
  }

  return "Today";
}

export default function RelationshipClock({ items }: RelationshipClockProps) {
  const router = useRouter();

  const now = useCurrentTime();

  const containerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);

  const [error, setError] = useState("");

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closePanel() {
      setIsOpen(false);
      setShowAddForm(false);
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (containerRef.current && !containerRef.current.contains(target)) {
        closePanel();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePanel();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!now) {
    return (
      <div className="text-right">
        <p className="font-medium tabular-nums">--:--</p>

        <p className="mt-0.5 text-[11px] text-[var(--muted)]">An & Yao</p>
      </div>
    );
  }

  const relationshipDay = getRelationshipDay(
    now,
    siteConfig.relationship.startedAt,
  );

  const attentionCount = items.filter((item) => {
    if (item.kind === "personal") {
      return !item.completed;
    }

    if (item.endAt === null) {
      return true;
    }

    return item.endAt > now;
  }).length;

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    const data = new FormData(form);

    setError("");

    startTransition(async () => {
      const result = await createPersonalPlanAction({
        title: String(data.get("title") ?? ""),
        startTime: String(data.get("startTime") ?? "") || undefined,
        durationMinutes: Number(data.get("durationMinutes") ?? 30),
      });

      if (!result.success) {
        setError(result.error);

        return;
      }

      form.reset();

      setShowAddForm(false);

      router.refresh();
    });
  }

  function togglePlan(item: TodayItem) {
    if (item.kind !== "personal") {
      return;
    }

    setError("");

    startTransition(async () => {
      const result = await setPersonalPlanCompletedAction(
        item.id,
        !item.completed,
      );

      if (!result.success) {
        setError(result.error);

        return;
      }

      router.refresh();
    });
  }

  function removePlan(item: TodayItem) {
    if (item.kind !== "personal") {
      return;
    }

    const confirmed = window.confirm("確定刪除這個計畫嗎？");

    if (!confirmed) {
      return;
    }

    setError("");

    startTransition(async () => {
      const result = await deletePersonalPlanAction(item.id);

      if (!result.success) {
        setError(result.error);

        return;
      }

      router.refresh();
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="
          relative
          rounded-xl
          px-2
          py-1
          text-right
          transition
          hover:bg-[var(--surface-soft)]
        "
        aria-expanded={isOpen}
      >
        <div className="flex items-start gap-2">
          <div>
            <p
              className="
                text-sm
                font-medium
                tabular-nums
                sm:text-base
              "
            >
              {formatTaipeiTime(now)}
            </p>

            <p
              className="
                mt-1
                whitespace-nowrap
                text-[10px]
                text-[var(--muted)]
                sm:text-[11px]
              "
            >
              在一起第 {relationshipDay} 天
            </p>
          </div>

          {attentionCount > 0 && (
            <span
              className="
                mt-0.5
                flex
                min-h-5
                min-w-5
                items-center
                justify-center
                rounded-full
                bg-[var(--accent)]
                px-1.5
                text-[10px]
                font-medium
                text-[var(--on-accent)]
              "
            >
              {attentionCount}
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <div
          className="
            fixed
            left-4
            right-4
            top-[4.75rem]
            z-50

            max-h-[calc(100dvh-6rem)]

            overflow-hidden
            rounded-[var(--radius-lg)]
            border
            border-[var(--border)]
            bg-[var(--surface)]
            shadow-[0_20px_60px_rgba(38,35,31,0.12)]

            sm:absolute
            sm:left-auto
            sm:right-0
            sm:top-[calc(100%+0.75rem)]
            sm:max-h-[min(560px,calc(100dvh-6rem))]
            sm:w-[360px]
          "
        >
          <div className="border-b border-[var(--border)] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
              Today
            </p>

            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <h3 className="font-story text-2xl font-semibold">今天</h3>

                <p className="mt-1 text-xs text-[var(--muted)]">
                  {dateFormatter.format(new Date(now))}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddForm((value) => !value)}
                className="
                  shrink-0
                  rounded-lg
                  border
                  border-[var(--border)]
                  px-3
                  py-2
                  text-xs
                  transition
                  hover:border-[var(--foreground)]
                "
              >
                + 計畫
              </button>
            </div>

            {showAddForm && (
              <form onSubmit={handleCreate} className="mt-5 space-y-3">
                <input
                  name="title"
                  required
                  autoFocus
                  placeholder="今天要記得什麼？"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[var(--border)]
                    bg-[var(--background)]
                    px-3
                    py-2.5
                    text-sm
                    outline-none
                  "
                />
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-[10px] text-[var(--muted)]">
                      時間（可不填）
                    </span>

                    <input
                      type="time"
                      name="startTime"
                      className="
                        mt-1
                        block
                        w-36
                        max-w-full
                        rounded-xl
                        border
                        border-[var(--border)]
                        bg-[var(--background)]
                        px-3
                        py-2
                        text-sm
                      "
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] text-[var(--muted)]">
                      預計多久
                    </span>

                    <select
                      name="durationMinutes"
                      defaultValue="30"
                      className="
                        mt-1
                        block
                        w-36
                        max-w-full
                        rounded-xl
                        border
                        border-[var(--border)]
                        bg-[var(--background)]
                        px-3
                        py-2
                        text-sm
                      "
                    >
                      <option value="15">15 分鐘</option>
                      <option value="30">30 分鐘</option>
                      <option value="60">1 小時</option>
                      <option value="90">1.5 小時</option>
                      <option value="120">2 小時</option>
                    </select>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="
                    rounded-xl
                    bg-[var(--foreground)]
                    px-4
                    py-2
                    text-xs
                    font-medium
                    text-[var(--on-foreground)]
                    disabled:opacity-50
                  "
                >
                  {isPending ? "Adding..." : "加入今天"}
                </button>
              </form>
            )}
          </div>

          <div
            className="
              max-h-[calc(100dvh-18rem)]
              overflow-y-auto
              overscroll-contain

              sm:max-h-[420px]
            "
          >
            {items.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-story text-lg">今天還沒有安排。</p>

                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                  可以新增自己的計畫， 或從 Dates 安排今天的約會。
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {items.map((item) => {
                  const state = getItemState(item, now);

                  const relativeLabel = getRelativeLabel(item, now);

                  const content = (
                    <div
                      className={`
                        flex
                        gap-3
                        p-4
                        transition

                        ${
                          state === "past" || state === "completed"
                            ? "opacity-45"
                            : ""
                        }

                        ${state === "current" ? "bg-[var(--accent-soft)]" : ""}
                      `}
                    >
                      <div className="w-12 shrink-0 pt-0.5">
                        <p className="text-xs font-medium tabular-nums">
                          {getItemSideLabel(item)}
                        </p>

                        {relativeLabel && (
                          <p
                            className={`
                              mt-1
                              text-[9px]
                              leading-3

                              ${
                                state === "current"
                                  ? "text-[var(--accent)]"
                                  : item.kind === "study_assignment"
                                    ? "text-[var(--accent)]"
                                    : "text-[var(--muted)]"
                              }
                            `}
                          >
                            {relativeLabel}
                          </p>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`
                            text-sm
                            font-medium
                            leading-5

                            ${state === "completed" ? "line-through" : ""}
                          `}
                        >
                          {item.title}
                        </p>

                        {item.subtitle && (
                          <p className="mt-1 truncate text-[10px] text-[var(--muted)]">
                            {item.subtitle}
                          </p>
                        )}
                      </div>

                      {item.kind === "personal" && (
                        <div className="flex shrink-0 items-start gap-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => togglePlan(item)}
                            className="
                              flex
                              h-6
                              w-6
                              items-center
                              justify-center
                              rounded-full
                              border
                              border-[var(--border)]
                              text-[10px]
                              disabled:opacity-50
                            "
                            aria-label={item.completed ? "取消完成" : "完成"}
                          >
                            {item.completed ? "✓" : ""}
                          </button>

                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => removePlan(item)}
                            className="
                              text-xs
                              text-[var(--muted)]
                              hover:text-[var(--danger)]
                            "
                            aria-label="刪除"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  );

                  if (item.href) {
                    return (
                      <Link
                        key={`${item.kind}-${item.id}`}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className="block hover:bg-[var(--surface-soft)]"
                      >
                        {content}
                      </Link>
                    );
                  }

                  return <div key={`${item.kind}-${item.id}`}>{content}</div>;
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="border-t border-[var(--border)] px-5 py-3">
              <p className="text-xs text-[var(--danger)]">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
