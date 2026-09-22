import Link from "next/link";

import DateCard from "@/features/dates/components/DateCard";

import { getDates } from "@/features/dates/lib/get-dates";

export default async function DatesPage() {
  const dates = await getDates();

  const invitations = dates.filter(
    (item) =>
      item.currentUserParticipant?.role === "invitee" &&
      item.currentUserParticipant.status === "pending",
  );

  const activeDates = dates.filter((item) => item.date.status === "accepted");

  const pendingSent = dates.filter(
    (item) =>
      item.currentUserParticipant?.role === "organizer" &&
      item.date.status === "pending",
  );

  return (
    <div className="py-4 sm:py-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
            Us, somewhere
          </p>

          <h1 className="font-story mt-3 text-4xl font-semibold sm:text-5xl">
            Dates
          </h1>

          <p className="mt-4 max-w-xl leading-7 text-[var(--muted)]">
            從下一頓飯， 到下一次旅行。
          </p>
        </div>

        <Link
          href="/dates/new"
          className="
            shrink-0
            rounded-xl
            bg-[var(--foreground)]
            px-4
            py-2.5
            text-sm
            font-medium
            text-white
          "
        >
          New date
        </Link>
      </div>

      {invitations.length > 0 && (
        <section className="mt-12">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            Invitations
          </p>

          <h2 className="font-story mt-2 text-2xl font-semibold">等妳回覆</h2>

          <div className="mt-5 grid gap-4">
            {invitations.map((item) => (
              <DateCard key={item.date.id} item={item} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Coming up
        </p>

        <h2 className="font-story mt-2 text-2xl font-semibold">
          我們接下來的約會
        </h2>

        {activeDates.length === 0 ? (
          <div className="mt-5 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] p-8">
            <p className="text-sm text-[var(--muted)]">還沒有已確認的約會。</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {activeDates.map((item) => (
              <DateCard key={item.date.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {pendingSent.length > 0 && (
        <section className="mt-12">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Waiting
          </p>

          <h2 className="font-story mt-2 text-2xl font-semibold">等待回覆</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {pendingSent.map((item) => (
              <DateCard key={item.date.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
