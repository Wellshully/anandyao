import Link from "next/link";

import InvitationActions from "@/features/dates/components/InvitationActions";

import { getDates } from "@/features/dates/lib/get-dates";

import { getTaipeiToday } from "@/lib/time/get-taipei-today";
const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",

  month: "long",

  day: "numeric",

  weekday: "short",
});

const KIND_LABELS: Record<string, string> = {
  meal: "一起吃飯",

  date: "約會",

  half_day: "半日約會",

  day: "一日約會",

  trip: "小旅行",
};

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00+08:00`));
}

export default async function HomeDateHero() {
  const dates = await getDates();
  const today = getTaipeiToday();
  /*
   * 1. Incoming invitation
   */

  const invitation = dates.find(
    (item) =>
      item.currentUserParticipant?.role === "invitee" &&
      item.currentUserParticipant.status === "pending",
  );

  if (invitation) {
    const organizer = invitation.participants.find(
      (participant) => participant.role === "organizer",
    );

    return (
      <section
        className="
          overflow-hidden
          rounded-[var(--radius-lg)]
          border
          border-[var(--accent)]
          bg-[var(--accent-soft)]
          p-6
          sm:p-8
        "
      >
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
          Invitation
        </p>

        <p className="mt-5 text-sm text-[var(--muted)]">
          {organizer?.displayName ?? "對方"} 想約你出去。
        </p>

        <h1 className="font-story mt-2 text-3xl font-semibold sm:text-4xl">
          {invitation.date.title}
        </h1>

        <p className="mt-4 text-sm text-[var(--muted)]">
          {formatDate(invitation.date.start_date)}

          {invitation.date.end_date !== invitation.date.start_date &&
            ` – ${formatDate(invitation.date.end_date)}`}
        </p>

        {invitation.date.description && (
          <p className="mt-5 max-w-xl whitespace-pre-line leading-7 text-[var(--muted)]">
            {invitation.date.description}
          </p>
        )}

        <div className="mt-7">
          <InvitationActions dateId={invitation.date.id} />
        </div>
      </section>
    );
  }

  /*
   * 2. Next accepted date
   */

  const nextDate = dates
    .filter(
      (item) => item.date.status === "accepted" && item.date.end_date >= today,
    )
    .sort((a, b) => a.date.start_date.localeCompare(b.date.start_date))[0];

  if (nextDate) {
    return (
      <section
        className="
          relative
          overflow-hidden
          rounded-[var(--radius-lg)]
          border
          border-[var(--border)]
          bg-[var(--surface)]
          p-6
          sm:p-9
        "
      >
        <div
          className="
            absolute
            right-0
            top-0
            h-40
            w-40
            translate-x-1/3
            -translate-y-1/3
            rounded-full
            bg-[var(--accent-soft)]
            opacity-70
          "
        />

        <div className="relative">
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
            Our next date
          </p>

          <p className="mt-6 text-sm text-[var(--muted)]">
            {KIND_LABELS[nextDate.date.kind] ?? nextDate.date.kind}
          </p>

          <h1 className="font-story mt-2 max-w-2xl text-4xl font-semibold sm:text-5xl">
            {nextDate.date.title}
          </h1>

          <p className="mt-5 text-sm text-[var(--muted)]">
            {formatDate(nextDate.date.start_date)}

            {nextDate.date.end_date !== nextDate.date.start_date &&
              ` – ${formatDate(nextDate.date.end_date)}`}
          </p>

          {nextDate.date.description && (
            <p className="mt-5 max-w-xl whitespace-pre-line leading-7 text-[var(--muted)]">
              {nextDate.date.description}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/dates/${nextDate.date.id}`}
              className="
                rounded-xl
                bg-[var(--foreground)]
                px-5
                py-3
                text-sm
                font-medium
                text-white
              "
            >
              打開計畫 →
            </Link>

            <Link
              href="/dates/new"
              className="
                rounded-xl
                border
                border-[var(--border)]
                px-5
                py-3
                text-sm
              "
            >
              再約一次
            </Link>
          </div>
        </div>
      </section>
    );
  }

  /*
   * 3. Waiting for reply
   */

  const waiting = dates.find(
    (item) =>
      item.currentUserParticipant?.role === "organizer" &&
      item.date.status === "pending",
  );

  if (waiting) {
    const invitee = waiting.participants.find(
      (participant) => participant.role === "invitee",
    );

    return (
      <section
        className="
          rounded-[var(--radius-lg)]
          border
          border-[var(--border)]
          bg-[var(--surface)]
          p-6
          sm:p-8
        "
      >
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
          Waiting
        </p>

        <h1 className="font-story mt-5 text-3xl font-semibold sm:text-4xl">
          {waiting.date.title}
        </h1>

        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          邀請已經送給 {invitee?.displayName ?? "對方"}
          ，現在等他回覆。
        </p>

        <p className="mt-3 text-sm text-[var(--muted)]">
          {formatDate(waiting.date.start_date)}
        </p>

        <Link
          href="/dates"
          className="mt-6 inline-block text-sm font-medium text-[var(--accent)]"
        >
          查看 Dates →
        </Link>
      </section>
    );
  }

  /*
   * 4. Nothing planned
   */

  return (
    <section
      className="
        rounded-[var(--radius-lg)]
        border
        border-[var(--border)]
        bg-[var(--surface)]
        p-6
        sm:p-9
      "
    >
      <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
        Our next date
      </p>

      <h1 className="font-story mt-5 max-w-xl text-4xl font-semibold sm:text-5xl">
        下一次要去哪？
      </h1>

      <p className="mt-5 max-w-lg leading-7 text-[var(--muted)]">
        一頓飯，或是一個小旅行。
      </p>

      <Link
        href="/dates/new"
        className="
          mt-8
          inline-block
          rounded-xl
          bg-[var(--foreground)]
          px-5
          py-3
          text-sm
          font-medium
          text-white
        "
      >
        邀請他去約會 →
      </Link>
    </section>
  );
}
