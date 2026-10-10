"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  useRouter,
} from "next/navigation";

import type {
  CalendarEvent,
} from "@/features/calendar/types";

import {
  cancelCalendarRecurringOccurrence,
  cancelCalendarRecurringSeries,
} from "@/features/calendar/recurring-cancel-actions";

import {
  getCalendarRecurringOccurrenceDate,
} from "@/features/calendar/lib/calendar-recurring-occurrence";

import {
  getCalendarViewHref,
} from "@/features/calendar/lib/calendar-event-navigation";

type CancelMode = "occurrence" | "series";

type Props = {
  event: CalendarEvent;
  view: "month" | "day";
  seriesTitle: string | null;
};

export function CalendarRecurringCancelControls({
  event,
  view,
  seriesTitle,
}: Props) {
  const router = useRouter();

  const occurrenceDate =
    getCalendarRecurringOccurrenceDate(event);

  const [mode, setMode] =
    useState<CancelMode | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [pending, startTransition] =
    useTransition();

  if (!occurrenceDate) {
    return null;
  }

  function selectMode(nextMode: CancelMode | null) {
    setMode(nextMode);
    setError(null);
  }

  function confirmCancellation() {
    const selectedMode = mode;
    const targetDate = occurrenceDate;

    if (!selectedMode || !targetDate) {
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const result =
          selectedMode === "occurrence"
            ? await cancelCalendarRecurringOccurrence({
                scheduleId: event.sourceId,
                occurrenceDate: targetDate,
              })
            : await cancelCalendarRecurringSeries({
                scheduleId: event.sourceId,
              });

        if (!result.success) {
          setError(result.error);
          return;
        }

        // Close the deleted event's detail view.
        router.replace(
          getCalendarViewHref({
            month: targetDate.slice(0, 7),
            date: targetDate,
            view,
          }),
        );

        router.refresh();
      } catch {
        setError("取消失敗，請重新整理後再試。");
      }
    });
  }

  return (
    <section className="mt-5 border-t border-[var(--border)] pt-4">
      <h3 className="text-sm font-semibold">
        取消固定行程
      </h3>

      {!mode ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => selectMode("occurrence")}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
          >
            只取消這一次
          </button>

          {seriesTitle !== null ? (
            <button
              type="button"
              onClick={() => selectMode("series")}
              className="rounded-xl border border-red-500/50 px-4 py-2 text-sm text-red-600"
            >
              取消整個固定系列
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-3 rounded-xl border border-[var(--border)] p-4">
          {mode === "occurrence" ? (
            <>
              <p className="text-sm font-medium">
                確定取消 {targetLabel(event.title)}？
              </p>

              <p className="text-xs text-[var(--muted)]">
                只取消 {occurrenceDate} 這一天。
                其他日期的固定行程不受影響。
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-red-600">
                確定取消整個「{seriesTitle}」系列？
              </p>

              <p className="text-xs text-[var(--muted)]">
                這會停止整個固定系列在 Calendar 顯示，
                不只是 {occurrenceDate}。
                資料庫仍會保留取消紀錄。
              </p>

            </>
          )}

          {error ? (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={confirmCancellation}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending
                ? "取消中..."
                : mode === "series"
                  ? "確認取消整個系列"
                  : "確認取消這一次"}
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() => selectMode(null)}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
            >
              保留行程
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function targetLabel(title: string) {
  return `「${title}」這次行程`;
}
