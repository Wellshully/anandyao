import InvitationActions from "@/features/dates/components/InvitationActions";

import type { DateListItem } from "@/features/dates/types";

import Link from "next/link";

type DateCardProps = {
  item: DateListItem;
};

const formatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",

  month: "short",
  day: "numeric",
});

function formatDate(value: string) {
  return formatter.format(new Date(`${value}T00:00:00+08:00`));
}

export default function DateCard({ item }: DateCardProps) {
  const { date, currentUserParticipant } = item;

  const isInvitation =
    currentUserParticipant?.role === "invitee" &&
    currentUserParticipant.status === "pending";

  return (
    <article
      className="
        rounded-[var(--radius-lg)]
        border
        border-[var(--border)]
        bg-[var(--surface)]
        p-6
      "
    >
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            {date.kind.replace("_", " ")}
          </p>

          <h2 className="font-story mt-2 text-2xl font-semibold">
            {date.title}
          </h2>

          <p className="mt-3 text-sm text-[var(--muted)]">
            {formatDate(date.start_date)}

            {date.end_date !== date.start_date &&
              ` – ${formatDate(date.end_date)}`}
          </p>
        </div>

        <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs text-[var(--muted)]">
          {date.status}
        </span>
      </div>

      {date.description && (
        <p className="mt-5 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">
          {date.description}
        </p>
      )}

      {isInvitation && (
        <div className="mt-6 border-t border-[var(--border)] pt-5">
          <p className="mb-4 text-sm">妳收到了一個約會邀請。</p>

          <InvitationActions dateId={date.id} />
        </div>
      )}

      {!isInvitation && date.status === "pending" && (
        <p className="mt-5 text-sm text-[var(--muted)]">等待對方回覆中。</p>
      )}
      {date.status === "accepted" && (
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <Link
            href={`/dates/${date.id}`}
            className="text-sm font-medium text-[var(--accent)]"
          >
            打開約會 →
          </Link>
        </div>
      )}
    </article>
  );
}
