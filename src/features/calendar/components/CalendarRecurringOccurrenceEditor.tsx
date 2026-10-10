"use client";

import {
  useState,
  useTransition,
  type FormEvent,
} from "react";

import {
  useRouter,
} from "next/navigation";

import type {
  CalendarEvent,
} from "@/features/calendar/types";

import {
  updateCalendarRecurringOccurrence,
} from "@/features/calendar/actions";

import {
  getCalendarRecurringOccurrenceDate,
} from "@/features/calendar/lib/calendar-recurring-occurrence";

import {
  getCalendarViewHref,
} from "@/features/calendar/lib/calendar-event-navigation";

type Props = {
  event: CalendarEvent;
  view: "month" | "day";
};

function getTaipeiTime(iso: string | null) {
  if (!iso) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));

  const hour =
    parts.find((part) => part.type === "hour")?.value ?? "";

  const minute =
    parts.find((part) => part.type === "minute")?.value ?? "";

  return `${hour}:${minute}`;
}

export function CalendarRecurringOccurrenceEditor({
  event,
  view,
}: Props) {
  const router = useRouter();

  const occurrenceDate =
    getCalendarRecurringOccurrenceDate(event);

  const initialTime =
    getTaipeiTime(event.startAt);

  const initiallyTimed = !event.allDay;

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [hasTime, setHasTime] = useState(initiallyTimed);
  const [time, setTime] = useState(initialTime);

  const [error, setError] =
    useState<string | null>(null);

  const [pending, startTransition] =
    useTransition();

  if (!occurrenceDate) {
    return null;
  }

  function save(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setError(null);

    const nextTitle = title.trim();

    const titleChanged =
      nextTitle !== event.title;

    const timeChanged =
      hasTime !== initiallyTimed ||
      (hasTime && time !== initialTime);

    if (!titleChanged && !timeChanged) {
      setError("請先修改標題或時間。");
      return;
    }

    if (!nextTitle || nextTitle.length > 120) {
      setError("標題必須介於 1 至 120 個字元。");
      return;
    }

    if (
      hasTime &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    ) {
      setError("請填入有效的時間。");
      return;
    }

    startTransition(async () => {
      if (!occurrenceDate) {
        setError("無法辨識這次固定行程的日期。");
        return;
      }

      const result =
        await updateCalendarRecurringOccurrence({
          action: "override",
          scheduleId: event.sourceId,
          occurrenceDate,
          titleOverride: titleChanged ? nextTitle : null,
          noteOverride: null,
          timePrecisionOverride: timeChanged
            ? hasTime
              ? "exact"
              : "none"
            : null,
          startTimeOverride:
            timeChanged && hasTime ? time : null,
        });

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.replace(
        getCalendarViewHref({
          month: occurrenceDate.slice(0, 7),
          view,
          date: occurrenceDate,
        }),
      );

      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium"
        >
          只修改這一次
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={save}
      className="mt-5 space-y-4 border-t border-[var(--border)] pt-4"
    >
      <div>
        <h3 className="text-sm font-semibold">
          修改單次固定行程
        </h3>

        <p className="mt-1 text-xs text-[var(--muted)]">
          {occurrenceDate}，其他日期不受影響。
        </p>
      </div>

      <label className="block space-y-1 text-sm">
        <span>行程標題</span>

        <input
          type="text"
          value={title}
          maxLength={120}
          required
          disabled={pending}
          onChange={(changeEvent) =>
            setTitle(changeEvent.target.value)
          }
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasTime}
          disabled={pending}
          onChange={(changeEvent) =>
            setHasTime(changeEvent.target.checked)
          }
        />
        指定時間
      </label>

      {hasTime ? (
        <label className="block space-y-1 text-sm">
          <span>時間（台北時間）</span>

          <input
            type="time"
            value={time}
            required
            disabled={pending}
            onChange={(changeEvent) =>
              setTime(changeEvent.target.value)
            }
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2"
          />
        </label>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          這次行程將顯示為全天。
        </p>
      )}

      {error ? (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] disabled:opacity-50"
        >
          {pending ? "儲存中..." : "儲存此次變更"}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setEditing(false);
            setError(null);
            setTitle(event.title);
            setHasTime(initiallyTimed);
            setTime(initialTime);
          }}
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
        >
          取消編輯
        </button>
      </div>
    </form>
  );
}
