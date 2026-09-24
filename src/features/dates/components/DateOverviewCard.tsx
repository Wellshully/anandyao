import Link from "next/link";

import InvitationActions from "@/features/dates/components/InvitationActions";
import DeleteArchivedDateButton from "@/features/dates/components/DeleteArchivedDateButton";

import type { DateListItem } from "@/features/dates/types";

type DateOverviewCardProps = {
  item: DateListItem;

  mode: "invitation" | "upcoming" | "waiting" | "recap" | "archive";

  archiveLabel?: string;

  showPermanentDelete?: boolean;
};

const KIND_LABELS: Record<string, string> = {
  meal: "一起吃飯",

  date: "約會",

  half_day: "半日約會",

  day: "一日約會",

  trip: "小旅行",
};

const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",

  month: "long",

  day: "numeric",

  weekday: "short",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00+08:00`));
}

export default function DateOverviewCard({
  item,
  mode,
  archiveLabel,
  showPermanentDelete = false,
}: DateOverviewCardProps) {
  const { date } = item;

  return (
    <article
      className={`
        rounded-[var(--radius-lg)]
        border
        bg-[var(--surface)]
        p-5
        sm:p-6

        ${
          mode === "recap" ? "border-[var(--accent)]" : "border-[var(--border)]"
        }

        ${mode === "archive" ? "opacity-75" : ""}
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-[var(--accent)]">
            {KIND_LABELS[date.kind] ?? date.kind}
          </p>

          <h3 className="font-story mt-2 text-2xl font-semibold">
            {date.title}
          </h3>
        </div>

        {mode === "recap" && (
          <span
            className="
              shrink-0
              rounded-full
              bg-[var(--accent-soft)]
              px-3
              py-1
              text-[10px]
              text-[var(--accent)]
            "
          >
            待回顧
          </span>
        )}

        {mode === "archive" && archiveLabel && (
          <span
            className="
                shrink-0
                rounded-full
                bg-[var(--surface-soft)]
                px-3
                py-1
                text-[10px]
                text-[var(--muted)]
              "
          >
            {archiveLabel}
          </span>
        )}
      </div>

      <p className="mt-4 text-sm text-[var(--muted)]">
        {formatDate(date.start_date)}

        {date.end_date !== date.start_date && ` – ${formatDate(date.end_date)}`}
      </p>

      {date.description && (
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
          {date.description}
        </p>
      )}

      {mode === "recap" && (
        <p className="mt-4 text-sm text-[var(--muted)]">
          趁還記得的時候，留幾句話和幾張照片吧。
        </p>
      )}

      {mode === "invitation" && (
        <div className="mt-6">
          <InvitationActions dateId={date.id} />
        </div>
      )}

      {mode !== "invitation" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={
              mode === "recap" ? `/dates/${date.id}/recap` : `/dates/${date.id}`
            }
            className="text-sm font-medium text-[var(--accent)]"
          >
            {mode === "recap"
              ? "留下這次回憶 →"
              : mode === "archive"
                ? "查看紀錄 →"
                : mode === "waiting"
                  ? "查看邀請 →"
                  : "打開計畫 →"}
          </Link>

          {mode === "archive" && showPermanentDelete && (
            <DeleteArchivedDateButton dateId={date.id} />
          )}
        </div>
      )}
    </article>
  );
}
