"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  CalendarEvent,
} from "@/features/calendar/types";

import {
  updateCalendarPetTask,
} from "@/features/calendar/actions";

import {
  getCalendarViewHref,
} from "@/features/calendar/lib/calendar-event-navigation";

type Props = {
  event: CalendarEvent;
  view: "month" | "day";
};

function getInitialDateTime(event: CalendarEvent) {
  if (!event.startAt) {
    return {
      date: event.startDate ?? "",
      time: "",
    };
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(event.startAt));

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: event.allDay
      ? ""
      : `${value("hour")}:${value("minute")}`,
  };
}

export function CalendarPetTaskEditor({
  event,
  view,
}: Props) {
  const router = useRouter();
  const initial = getInitialDateTime(event);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [hasTime, setHasTime] = useState(!event.allDay);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(eventSubmit: React.FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateCalendarPetTask({
        taskId: event.sourceId,
        title,
        date,
        time: hasTime ? time : "",
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setEditing(false);

      router.replace(
        getCalendarViewHref({
          month: date.slice(0, 7),
          date,
          view,
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
          編輯待辦
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={save}
      className="mt-5 space-y-4 border-t border-[var(--border)] pt-4"
    >
      <h3 className="text-sm font-semibold">
        編輯 Pet Task
      </h3>

      <label className="block space-y-1 text-sm">
        <span>標題</span>
        <input
          type="text"
          value={title}
          maxLength={200}
          required
          disabled={pending}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span>日期</span>
        <input
          type="date"
          value={date}
          required
          disabled={pending}
          onChange={(event) => setDate(event.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasTime}
          disabled={pending}
          onChange={(event) => setHasTime(event.target.checked)}
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
            onChange={(event) => setTime(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2"
          />
        </label>
      ) : null}

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
          {pending ? "儲存中..." : "儲存變更"}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
        >
          取消編輯
        </button>
      </div>
    </form>
  );
}
