import type { PointerEventHandler } from "react";

import Link from "next/link";

import ItineraryActions from "@/features/dates/components/ItineraryActions";

import type { DateItineraryItem } from "@/features/dates/types";

import type { ItineraryTimeState } from "@/features/dates/lib/get-itinerary-time-state";

type ItineraryCardProps = {
  dateId: string;

  item: DateItineraryItem;

  scheduledTime?: string;

  hasConflict?: boolean;

  timeState?: ItineraryTimeState;

  isSoon?: boolean;

  minutesUntilStart?: number | null;

  canEdit?: boolean;

  dragDisabled?: boolean;

  onDragHandlePointerDown?: PointerEventHandler<HTMLButtonElement>;
};

const TYPE_LABELS: Record<string, string> = {
  place: "景點",

  restaurant: "餐廳",

  transport: "交通",

  hotel: "住宿",

  activity: "活動",

  note: "備註",
};

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} 分鐘`;
  }

  const hours = Math.floor(minutes / 60);

  const remaining = minutes % 60;

  if (!remaining) {
    return `${hours} 小時`;
  }

  return `${hours} 小時 ${remaining} 分鐘`;
}

export default function ItineraryCard({
  dateId,
  item,
  scheduledTime,
  hasConflict = false,
  timeState,
  isSoon = false,
  minutesUntilStart,
  canEdit = true,
  dragDisabled = false,
  onDragHandlePointerDown,
}: ItineraryCardProps) {
  const borderClass = hasConflict
    ? "border-[var(--danger)]"
    : timeState === "current" || isSoon
      ? "border-[var(--accent)]"
      : "border-[var(--border)]";

  const stateClass =
    timeState === "past"
      ? `
          bg-[var(--surface-soft)]
          opacity-55
        `
      : timeState === "current"
        ? `
            bg-[var(--accent-soft)]
            shadow-[0_8px_30px_rgba(38,35,31,0.05)]
          `
        : `
            bg-[var(--surface)]
          `;

  return (
    <article
      className={`
        rounded-[var(--radius-md)]
        border
        p-5
        transition
        ${borderClass}
        ${stateClass}
      `}
    >
      <div className="flex gap-4">
        {canEdit ? (
          <button
            type="button"
            disabled={dragDisabled || !onDragHandlePointerDown}
            onPointerDown={onDragHandlePointerDown}
            aria-label="按住拖曳調整行程順序"
            title="按住拖曳調整行程順序"
            className="
              -ml-2
              flex
              h-8
              w-8
              shrink-0
              touch-none
              select-none
              items-start
              justify-center
              rounded-lg
              pt-1
              text-[var(--muted)]
              transition
              hover:bg-[var(--surface-soft)]
              hover:text-[var(--foreground)]
              active:cursor-grabbing
              disabled:cursor-default
              disabled:opacity-40
              enabled:cursor-grab
            "
          >
            <span aria-hidden="true">⋮⋮</span>
          </button>
        ) : (
          <div className="w-1 shrink-0" />
        )}

        <div className="w-20 shrink-0">
          <p className="font-medium tabular-nums">{scheduledTime ?? "—"}</p>

          {timeState === "current" && (
            <p className="mt-1 text-xs font-medium text-[var(--accent)]">
              現在
            </p>
          )}

          {isSoon &&
            minutesUntilStart !== null &&
            minutesUntilStart !== undefined && (
              <p className="mt-1 text-[10px] leading-4 text-[var(--accent)]">
                {minutesUntilStart <= 1
                  ? "即將開始"
                  : `還有 ${minutesUntilStart} 分鐘`}
              </p>
            )}

          {timeState === "past" && (
            <p className="mt-1 text-[10px] text-[var(--muted)]">已結束</p>
          )}

          <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">
            {item.timing_type === "fixed" ? "fixed" : "auto"}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[var(--accent)]">
                {TYPE_LABELS[item.item_type] ?? item.item_type}
              </p>

              <h4 className="font-story mt-1 text-xl font-semibold">
                {item.title}
              </h4>
            </div>

            {canEdit && <ItineraryActions dateId={dateId} itemId={item.id} />}
          </div>

          <p className="mt-2 text-xs text-[var(--muted)]">
            {formatDuration(item.duration_minutes)}
          </p>

          {hasConflict && (
            <p className="mt-3 text-xs text-[var(--danger)]">
              這個固定時間與前面的行程發生衝突。
            </p>
          )}

          {item.location_name && (
            <p className="mt-3 text-sm text-[var(--muted)]">
              {item.location_name}
            </p>
          )}

          {item.address && (
            <p className="mt-1 text-sm text-[var(--muted)]">{item.address}</p>
          )}

          {item.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">
              {item.description}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {item.restaurant_id && (
              <Link
                href={`/eat/${item.restaurant_id}`}
                className="text-sm text-[var(--accent)]"
              >
                查看餐廳 →
              </Link>
            )}

            {item.google_maps_url && (
              <a
                href={item.google_maps_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[var(--accent)]"
              >
                Google Maps ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
