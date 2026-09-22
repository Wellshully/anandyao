import Link from "next/link";

import { notFound } from "next/navigation";

import DatePlanner from "@/features/dates/components/DatePlanner";

import { getDate } from "@/features/dates/lib/get-date";

type DateDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const formatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",

  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatDate(value: string) {
  return formatter.format(new Date(`${value}T00:00:00+08:00`));
}

const KIND_LABELS: Record<string, string> = {
  meal: "一起吃飯",
  date: "約會",
  half_day: "半日約會",
  day: "一日約會",
  trip: "小旅行",
};

export default async function DateDetailPage({ params }: DateDetailPageProps) {
  const { id } = await params;

  const details = await getDate(id);

  if (!details) {
    notFound();
  }

  const { date, participants } = details;

  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-10">
      <Link href="/dates" className="text-sm text-[var(--muted)]">
        ← Dates
      </Link>

      <header className="mt-8">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
            {KIND_LABELS[date.kind] ?? date.kind}
          </p>

          <span
            className="
              rounded-full
              bg-[var(--surface-soft)]
              px-3
              py-1
              text-xs
              text-[var(--muted)]
            "
          >
            {date.status}
          </span>
        </div>

        <h1 className="font-story mt-4 text-4xl font-semibold sm:text-5xl">
          {date.title}
        </h1>

        <p className="mt-4 text-[var(--muted)]">
          {formatDate(date.start_date)}

          {date.end_date !== date.start_date &&
            ` – ${formatDate(date.end_date)}`}
        </p>

        <p className="mt-2 text-sm text-[var(--muted)]">
          {participants
            .map((participant) => participant.displayName)
            .join(" × ")}
        </p>

        {date.description && (
          <p className="mt-6 max-w-2xl whitespace-pre-line leading-7 text-[var(--muted)]">
            {date.description}
          </p>
        )}
      </header>

      <div className="my-10 border-t border-[var(--border)]" />

      <DatePlanner details={details} />
    </div>
  );
}
