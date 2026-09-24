import Link from "next/link";

import { notFound, redirect } from "next/navigation";
import DateRecapForm from "@/features/dates/recap/components/DateRecapForm";
import DateRecapPhotoUploader from "@/features/dates/recap/components/DateRecapPhotoUploader";

import { getDate } from "@/features/dates/lib/get-date";

import { getOrCreateDateRecap } from "@/features/dates/recap/lib/get-or-create-date-recap";

import { getDateRecapPhotos } from "@/features/dates/recap/lib/get-date-recap-photos";

import {
  getDateRecapDeadline,
  getDateRecapWindowState,
} from "@/features/dates/lib/date-recap-window";

import { getTaipeiToday } from "@/lib/time/get-taipei-today";

type DateRecapPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",

  year: "numeric",

  month: "long",

  day: "numeric",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00+08:00`));
}

export default async function DateRecapPage({ params }: DateRecapPageProps) {
  const { id } = await params;

  /*
   * Load the Date first.
   */
  const details = await getDate(id);

  if (!details) {
    notFound();
  }

  const today = getTaipeiToday();
  /*
   * Only an accepted Date can enter
   * the recap flow.
   *
   * Once completed, the Date becomes
   * status = completed and this page
   * should no longer be accessible.
   */
  if (details.date.status !== "accepted") {
    redirect(`/dates/${id}`);
  }

  /*
   * Check whether we're currently
   * inside the 7-day recap window.
   */
  const windowState = getDateRecapWindowState({
    endDate: details.date.end_date,

    today,
  });

  if (windowState === "not_ready" || windowState === "expired") {
    redirect(`/dates/${id}`);
  }

  /*
   * Opening this page creates the draft
   * recap if it doesn't exist yet.
   */
  const recap = await getOrCreateDateRecap(id);

  /*
   * Existing uploaded photos.
   *
   * They already live in the private
   * media bucket and will later be reused
   * directly when creating the Memory.
   */
  const photos = await getDateRecapPhotos(recap.id);

  const deadline = getDateRecapDeadline(details.date.end_date);

  return (
    <main
      className="
        mx-auto
        w-full
        max-w-2xl
        px-4
        py-8
        sm:px-6
        sm:py-12
      "
    >
      <Link
        href={`/dates/${id}`}
        className="
          text-sm
          text-[var(--muted)]
        "
      >
        ← 回到 Date
      </Link>

      <header className="mt-10">
        <p
          className="
            text-xs
            uppercase
            tracking-[0.25em]
            text-[var(--accent)]
          "
        >
          Date Recap
        </p>

        <h1
          className="
            font-story
            mt-3
            text-4xl
            font-semibold
            sm:text-5xl
          "
        >
          {details.date.title}
        </h1>

        <p
          className="
            mt-4
            text-sm
            text-[var(--muted)]
          "
        >
          {formatDate(details.date.start_date)}

          {details.date.end_date !== details.date.start_date &&
            ` – ${formatDate(details.date.end_date)}`}
        </p>

        <p
          className="
            mt-2
            text-xs
            text-[var(--muted)]
          "
        >
          可以回顧到 {formatDate(deadline)}
        </p>
      </header>

      <div className="mt-12">
        <DateRecapForm dateId={id} recap={recap} hasPhotos={photos.length > 0}>
          <DateRecapPhotoUploader
            recapId={recap.id}
            spaceId={recap.space_id}
            photos={photos}
          />
        </DateRecapForm>
      </div>
    </main>
  );
}
