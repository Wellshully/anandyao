"use client";

import {
  useState,
  useTransition,
  type FormEvent,
} from "react";

import { useRouter } from "next/navigation";

import type {
  CalendarRecurringSeries,
} from "@/features/calendar/lib/get-calendar-recurring-series";

import {
  WEEKDAYS,
  parseCalendarWeeklyRule,
  type Weekday,
} from "@/features/calendar/lib/calendar-weekly-series";

import {
  updateCalendarRecurringSeries,
} from "@/features/calendar/recurring-series-actions";

type Props = {
  series: CalendarRecurringSeries;
};

const DAY_LABELS: Record<Weekday, string> = {
  MO: "一",
  TU: "二",
  WE: "三",
  TH: "四",
  FR: "五",
  SA: "六",
  SU: "日",
};

export function CalendarRecurringSeriesEditor({
  series,
}: Props) {
  const router = useRouter();
  const initial = parseCalendarWeeklyRule(
    series.recurrenceRule,
  );

  const initialPrecision =
    series.timePrecision === "exact" ||
    series.timePrecision === "daypart"
      ? series.timePrecision
      : "none";

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(series.title);
  const [interval, setInterval] = useState(initial?.interval ?? 1);
  const [days, setDays] = useState<Weekday[]>(initial?.days ?? []);
  const [precision, setPrecision] = useState<
    "none" | "daypart" | "exact"
  >(initialPrecision);
  const [time, setTime] = useState(
    series.startTime?.slice(0, 5) ?? "",
  );
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ruleChanged = initial
    ? interval !== initial.interval ||
      WEEKDAYS.filter((day) => days.includes(day)).join(",") !==
        initial.days.join(",")
    : false;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!initial) {
      setError("目前不支援編輯此重複規則。");
      return;
    }

    if (days.length === 0) {
      setError("至少需要選擇一天。");
      return;
    }

    if (ruleChanged && !confirmed) {
      setError("請先確認變更重複規則的影響。");
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateCalendarRecurringSeries({
          scheduleId: series.id,
          expectedUpdatedAt: series.updatedAt,
          title,
          interval,
          days,
          timePrecision: precision,
          startTime: precision === "exact" ? time : null,
          confirmRuleChange: ruleChanged && confirmed,
        });

        if (!result.success) {
          setError(result.error);
          return;
        }

        setEditing(false);
        router.refresh();
      } catch {
        setError("無法儲存，請重新整理後再試。");
      }
    });
  }

  if (!initial) {
    return (
      <p className="mt-4 text-xs text-[var(--muted)]">
        此系列的重複規則暫不支援直接編輯。
      </p>
    );
  }

  if (!editing) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium"
        >
          修改整個固定系列
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={save}
      className="mt-4 space-y-4 rounded-xl border border-[var(--border)] p-4"
    >
      <div>
        <h3 className="text-sm font-semibold">
          修改整個固定系列
        </h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          會更新整個系列，而不是只有選取的日期。
        </p>
      </div>

      <label className="block space-y-1 text-sm">
        <span>系列名稱</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={120}
          disabled={pending}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span>每隔幾週重複</span>
        <input
          type="number"
          min={1}
          max={12}
          value={interval}
          disabled={pending}
          onChange={(event) => {
            setInterval(Number(event.target.value));
            setConfirmed(false);
          }}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm">重複星期</legend>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((day) => (
            <label
              key={day}
              className="flex items-center gap-1 text-sm"
            >
              <input
                type="checkbox"
                checked={days.includes(day)}
                disabled={pending}
                onChange={(event) => {
                  setDays((current) =>
                    event.target.checked
                      ? [...current, day]
                      : current.filter((item) => item !== day),
                  );
                  setConfirmed(false);
                }}
              />
              {DAY_LABELS[day]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1 text-sm">
        <span>時間模式</span>
        <select
          value={precision}
          disabled={pending}
          onChange={(event) =>
            setPrecision(
              event.target.value as
                "none" | "daypart" | "exact",
            )
          }
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2"
        >
          <option value="none">全天／不指定時間</option>
          <option value="exact">指定時間</option>
          {series.timePrecision === "daypart" ? (
            <option value="daypart">保留原本時段</option>
          ) : null}
        </select>
      </label>

      {precision === "exact" ? (
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

      {ruleChanged ? (
        <label className="flex items-start gap-2 rounded-xl border border-[var(--border)] p-3 text-xs">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={pending}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>
            我了解重複星期或間隔變更後，包含過去日期在內的整個系列都會重新計算。
            既有的單次修改、取消紀錄不會自動移到新的日期。
          </span>
        </label>
      ) : null}

      <p className="text-xs text-[var(--muted)]">
        已單獨修改時間的日期仍會優先套用單次設定。
      </p>

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
          {pending ? "儲存中..." : "儲存整個系列"}
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
