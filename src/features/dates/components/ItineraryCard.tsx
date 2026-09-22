import ItineraryActions from "@/features/dates/components/ItineraryActions";

import type { DateItineraryItem } from "@/features/dates/types";

type ItineraryCardProps = {
  dateId: string;

  item: DateItineraryItem;

  scheduledTime?: string;

  hasConflict?: boolean;
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
}: ItineraryCardProps) {
  return (
    <article
      className={`
        rounded-[var(--radius-md)]
        border
        bg-[var(--surface)]
        p-5
        transition

        ${hasConflict ? "border-[var(--danger)]" : "border-[var(--border)]"}
      `}
    >
      <div className="flex gap-4">
        <div
          className="
            flex
            w-5
            shrink-0
            cursor-grab
            items-start
            justify-center
            pt-1
            text-[var(--muted)]
            active:cursor-grabbing
          "
          aria-hidden="true"
        >
          ⋮⋮
        </div>

        <div className="w-16 shrink-0">
          <p className="font-medium">{scheduledTime ?? "—"}</p>

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

            <ItineraryActions dateId={dateId} itemId={item.id} />
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

          {item.google_maps_url && (
            <a
              href={item.google_maps_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-sm text-[var(--accent)]"
            >
              Google Maps ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
