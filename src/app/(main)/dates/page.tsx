import Link from "next/link";

import DateOverviewCard from "@/features/dates/components/DateOverviewCard";

import { getDates } from "@/features/dates/lib/get-dates";

import { getDateRecapStatuses } from "@/features/dates/recap/lib/get-date-recap-statuses";

import { getDateRecapWindowState } from "@/features/dates/lib/date-recap-window";

import { getTaipeiToday } from "@/lib/time/get-taipei-today";

import type { DateListItem } from "@/features/dates/types";

import type { DateRecapStatus } from "@/features/dates/recap/types";

export const dynamic = "force-dynamic";

function getRecapState(
  item: DateListItem,
  today: string,
  recapStatus?: DateRecapStatus,
) {
  if (item.date.status !== "accepted") {
    return null;
  }

  return getDateRecapWindowState({
    endDate: item.date.end_date,

    today,

    recapStatus,
  });
}

function isArchive(
  item: DateListItem,
  today: string,
  recapStatus?: DateRecapStatus,
) {
  if (
    item.date.status === "cancelled" ||
    item.date.status === "completed" ||
    item.date.status === "declined"
  ) {
    return true;
  }

  if (item.date.status === "accepted") {
    const state = getRecapState(item, today, recapStatus);

    return state === "expired" || state === "completed";
  }

  return false;
}

function getArchiveLabel(
  item: DateListItem,
  today: string,
  recapStatus?: DateRecapStatus,
) {
  if (item.date.status === "cancelled") {
    return "已取消";
  }

  if (item.date.status === "completed" || recapStatus === "completed") {
    return "已完成";
  }

  if (item.date.status === "declined") {
    return "已婉拒";
  }

  if (item.date.end_date < today) {
    return "日期已過";
  }

  return "Archive";
}

export default async function DatesPage() {
  const today = getTaipeiToday();

  const [dates, recapStatuses] = await Promise.all([
    getDates(),
    getDateRecapStatuses(),
  ]);

  const toRemember = dates
    .filter(
      (item) =>
        getRecapState(item, today, recapStatuses[item.date.id]) === "available",
    )
    .sort((a, b) => b.date.end_date.localeCompare(a.date.end_date));

  const archive = dates
    .filter((item) => isArchive(item, today, recapStatuses[item.date.id]))
    .sort((a, b) => b.date.start_date.localeCompare(a.date.start_date));

  const activeDates = dates.filter((item) => {
    const recapState = getRecapState(item, today, recapStatuses[item.date.id]);

    return (
      !isArchive(item, today, recapStatuses[item.date.id]) &&
      recapState !== "available"
    );
  });

  const invitations = activeDates.filter(
    (item) =>
      item.date.status === "pending" &&
      item.currentUserParticipant?.role === "invitee" &&
      item.currentUserParticipant?.status === "pending",
  );

  const comingUp = activeDates
    .filter((item) => item.date.status === "accepted")
    .sort((a, b) => a.date.start_date.localeCompare(b.date.start_date));

  const waiting = activeDates.filter(
    (item) =>
      item.date.status === "pending" &&
      item.currentUserParticipant?.role === "organizer",
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex items-end justify-between gap-5">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
            Dates
          </p>

          <h1 className="font-story mt-3 text-4xl font-semibold sm:text-5xl">
            我們的 Dates
          </h1>
        </div>

        <Link
          href="/dates/new"
          className="
            shrink-0
            rounded-xl
            bg-[var(--foreground)]
            px-4
            py-3
            text-sm
            font-medium
            text-[var(--on-foreground)]
          "
        >
          + New Date
        </Link>
      </div>

      {invitations.length > 0 && (
        <section className="mt-12">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            Invitations
          </p>

          <h2 className="font-story mt-2 text-2xl font-semibold">等你回覆</h2>

          <div className="mt-5 grid gap-4">
            {invitations.map((item) => (
              <DateOverviewCard
                key={item.date.id}
                item={item}
                mode="invitation"
              />
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
          Coming up
        </p>

        <h2 className="font-story mt-2 text-2xl font-semibold">接下來</h2>

        {comingUp.length > 0 ? (
          <div className="mt-5 grid gap-4">
            {comingUp.map((item) => (
              <DateOverviewCard
                key={item.date.id}
                item={item}
                mode="upcoming"
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-7">
            <p className="text-sm text-[var(--muted)]">目前沒有排好的 Date。</p>
          </div>
        )}
      </section>

      {waiting.length > 0 && (
        <section className="mt-12">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Waiting
          </p>

          <h2 className="font-story mt-2 text-2xl font-semibold">等對方回覆</h2>

          <div className="mt-5 grid gap-4">
            {waiting.map((item) => (
              <DateOverviewCard key={item.date.id} item={item} mode="waiting" />
            ))}
          </div>
        </section>
      )}

      {toRemember.length > 0 && (
        <section className="mt-16 border-t border-[var(--border)] pt-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            To remember
          </p>

          <h2 className="font-story mt-2 text-2xl font-semibold">
            留下這次回憶
          </h2>

          <p className="mt-2 text-sm text-[var(--muted)]">
            Date 結束後七天內，可以留幾句話和照片。
          </p>

          <div className="mt-5 grid gap-4">
            {toRemember.map((item) => (
              <DateOverviewCard key={item.date.id} item={item} mode="recap" />
            ))}
          </div>
        </section>
      )}

      {archive.length > 0 && (
        <section className="mt-16 border-t border-[var(--border)] pt-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Archive
          </p>

          <h2 className="font-story mt-2 text-2xl font-semibold">
            之前的 Dates
          </h2>

          <div className="mt-5 grid gap-4">
            {archive.map((item) => (
              <DateOverviewCard
                key={item.date.id}
                item={item}
                mode="archive"
                archiveLabel={getArchiveLabel(
                  item,
                  today,
                  recapStatuses[item.date.id],
                )}
                showPermanentDelete={
                  item.currentUserParticipant?.role === "organizer"
                }
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
