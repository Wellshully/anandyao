import Link from "next/link";

import { getStudyMailList } from "@/features/study/mail/get-study-mail-list";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",

  month: "numeric",

  day: "numeric",

  hour: "2-digit",

  minute: "2-digit",

  hour12: false,
});

function formatDate(value: string | null) {
  if (!value) {
    return "";
  }

  return dateFormatter.format(new Date(value));
}

export default async function StudyInboxPage() {
  const mails = await getStudyMailList();

  const unseenCount = mails.filter((mail) => !mail.seenAt).length;

  return (
    <main
      className="
        mx-auto
        w-full
        max-w-4xl
        px-4
        py-8
        sm:px-6
        sm:py-12
      "
    >
      <Link
        href="/study"
        className="
          text-sm
          text-[var(--muted)]
          transition
          hover:text-[var(--foreground)]
        "
      >
        ← Study
      </Link>

      <header className="mt-8">
        <p
          className="
            text-xs
            uppercase
            tracking-[0.25em]
            text-[var(--accent)]
          "
        >
          Inbox
        </p>

        <h1
          className="
            font-story
            mt-3
            text-4xl
            font-semibold
          "
        >
          NTU Mail
        </h1>

        <p
          className="
            mt-3
            text-sm
            text-[var(--muted)]
          "
        >
          {unseenCount > 0 ? `${unseenCount} 封新信` : "沒有未讀的新信"}
        </p>
      </header>

      {mails.length > 0 ? (
        <section
          className="
            mt-8
            divide-y
            divide-[var(--border)]
            overflow-hidden
            rounded-[var(--radius-lg)]
            border
            border-[var(--border)]
            bg-[var(--surface)]
          "
        >
          {mails.map((mail) => {
            const unseen = !mail.seenAt;

            const sender =
              mail.fromName || mail.fromAddress || "Unknown sender";

            return (
              <Link
                key={mail.id}
                href={`/study/inbox/${mail.id}`}
                className="
                    block
                    p-5
                    transition
                    hover:bg-[var(--surface-soft)]
                    sm:p-6
                  "
              >
                <div
                  className="
                      flex
                      gap-3
                    "
                >
                  <span
                    className={`
                        mt-2
                        h-2
                        w-2
                        shrink-0
                        rounded-full

                        ${unseen ? "bg-[var(--accent)]" : "bg-[var(--border)]"}
                      `}
                  />

                  <div
                    className="
                        min-w-0
                        flex-1
                      "
                  >
                    <div
                      className="
                          flex
                          items-start
                          justify-between
                          gap-4
                        "
                    >
                      <p
                        className={`
                            truncate
                            text-sm

                            ${
                              unseen
                                ? "font-semibold text-[var(--foreground)]"
                                : "text-[var(--muted)]"
                            }
                          `}
                      >
                        {sender}
                      </p>

                      {mail.sentAt && (
                        <time
                          className="
                              shrink-0
                              text-xs
                              text-[var(--muted)]
                            "
                        >
                          {formatDate(mail.sentAt)}
                        </time>
                      )}
                    </div>

                    <p
                      className={`
                          mt-1
                          line-clamp-2
                          leading-6

                          ${unseen ? "font-medium" : "text-[var(--muted)]"}
                        `}
                    >
                      {mail.subject}
                    </p>

                    {mail.fromName && mail.fromAddress && (
                      <p
                        className="
                            mt-2
                            truncate
                            text-xs
                            text-[var(--muted)]
                          "
                      >
                        {mail.fromAddress}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      ) : (
        <div
          className="
            mt-8
            rounded-[var(--radius-lg)]
            border
            border-dashed
            border-[var(--border)]
            p-6
            text-sm
            text-[var(--muted)]
          "
        >
          目前沒有同步到信件。
        </div>
      )}
    </main>
  );
}
