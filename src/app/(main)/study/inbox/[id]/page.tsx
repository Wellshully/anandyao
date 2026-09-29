import Link from "next/link";

import { notFound } from "next/navigation";

import { getStudyMailDetail } from "@/features/study/mail/get-study-mail-detail";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",

  year: "numeric",

  month: "numeric",

  day: "numeric",

  hour: "2-digit",

  minute: "2-digit",

  hour12: false,
});

export default async function StudyMailPage({ params }: PageProps) {
  const { id } = await params;

  const mail = await getStudyMailDetail(id);

  if (!mail) {
    notFound();
  }

  const sender = mail.fromName || mail.fromAddress || "Unknown sender";

  return (
    <main
      className="
        mx-auto
        w-full
        max-w-3xl
        px-4
        py-8
        sm:px-6
        sm:py-12
      "
    >
      <Link
        href="/study/inbox"
        className="
          text-sm
          text-[var(--muted)]
          transition
          hover:text-[var(--foreground)]
        "
      >
        ← Inbox
      </Link>

      <header className="mt-8">
        <p
          className="
            text-sm
            text-[var(--muted)]
          "
        >
          {sender}
        </p>

        {mail.fromName && mail.fromAddress && (
          <p
            className="
                mt-1
                text-xs
                text-[var(--muted)]
              "
          >
            {mail.fromAddress}
          </p>
        )}

        <h1
          className="
            font-story
            mt-4
            text-3xl
            font-semibold
            leading-tight
            sm:text-4xl
          "
        >
          {mail.subject}
        </h1>

        {mail.sentAt && (
          <p
            className="
              mt-4
              text-sm
              text-[var(--muted)]
            "
          >
            {dateFormatter.format(new Date(mail.sentAt))}
          </p>
        )}
      </header>

      <article
        className="
          mt-10
          rounded-[var(--radius-lg)]
          border
          border-[var(--border)]
          bg-[var(--surface)]
          p-5
          sm:p-7
        "
      >
        {!mail.detailAvailable ? (
          <div>
            <p
              className="
                font-medium
              "
            >
              {mail.unavailableReason === "not_on_server"
                ? "這封信已不在 NTU Mail Server 上"
                : "暫時無法連線 NTU Mail"}
            </p>

            <p
              className="
                mt-2
                text-sm
                leading-6
                text-[var(--muted)]
              "
            >
              已同步的寄件者、主旨與日期仍然保留， 但目前無法取得信件全文。
            </p>
          </div>
        ) : mail.html ? (
          <div
            className="
              break-words
              text-sm
              leading-7

              [&_a]:text-[var(--accent)]
              [&_a]:underline
              [&_a]:underline-offset-2

              [&_blockquote]:my-4
              [&_blockquote]:border-l-2
              [&_blockquote]:border-[var(--border)]
              [&_blockquote]:pl-4

              [&_h1]:my-4
              [&_h1]:text-xl
              [&_h1]:font-semibold

              [&_h2]:my-4
              [&_h2]:text-lg
              [&_h2]:font-semibold

              [&_h3]:my-3
              [&_h3]:font-semibold

              [&_img]:my-5
              [&_img]:h-auto
              [&_img]:max-w-full

              [&_li]:my-1

              [&_ol]:my-4
              [&_ol]:list-decimal
              [&_ol]:pl-6

              [&_p]:my-4

              [&_table]:my-5
              [&_table]:block
              [&_table]:w-full
              [&_table]:overflow-x-auto

              [&_td]:border
              [&_td]:border-[var(--border)]
              [&_td]:p-2

              [&_th]:border
              [&_th]:border-[var(--border)]
              [&_th]:p-2

              [&_ul]:my-4
              [&_ul]:list-disc
              [&_ul]:pl-6
            "
            dangerouslySetInnerHTML={{
              __html: mail.html,
            }}
          />
        ) : mail.text ? (
          <div
            className="
              whitespace-pre-wrap
              break-words
              text-sm
              leading-7
            "
          >
            {mail.text}
          </div>
        ) : (
          <p
            className="
              text-sm
              text-[var(--muted)]
            "
          >
            這封信沒有可顯示的文字內容。
          </p>
        )}
      </article>

      {mail.attachments.length > 0 && (
        <section className="mt-6">
          <p
            className="
              text-xs
              uppercase
              tracking-[0.2em]
              text-[var(--muted)]
            "
          >
            Attachments
          </p>

          <div
            className="
              mt-3
              space-y-2
            "
          >
            {mail.attachments.map((attachment, index) => (
              <div
                key={`${attachment.filename}-${index}`}
                className="
                    rounded-[var(--radius-md)]
                    border
                    border-[var(--border)]
                    bg-[var(--surface)]
                    px-4
                    py-3
                  "
              >
                <p
                  className="
                      break-all
                      text-sm
                    "
                >
                  {attachment.filename}
                </p>

                <p
                  className="
                      mt-1
                      text-xs
                      text-[var(--muted)]
                    "
                >
                  {attachment.mimeType}
                </p>
              </div>
            ))}
          </div>

          <p
            className="
              mt-3
              text-xs
              text-[var(--muted)]
            "
          >
            目前附件只顯示資訊，不會儲存到 An & Yao。
          </p>
        </section>
      )}

      <div
        className="
          mt-8
          flex
          flex-wrap
          gap-3
        "
      >
        <a
          href="https://webmail.ntu.edu.tw/"
          target="_blank"
          rel="noopener noreferrer"
          className="
            inline-flex
            items-center
            justify-center
            rounded-full
            bg-[var(--foreground)]
            px-5
            py-3
            text-sm
            text-[var(--on-foreground)]
            transition
            hover:opacity-85
          "
        >
          開啟 NTU WebMail
        </a>

        <Link
          href="/study/inbox"
          className="
            inline-flex
            items-center
            justify-center
            rounded-full
            border
            border-[var(--border)]
            px-5
            py-3
            text-sm
            text-[var(--muted)]
            transition
            hover:bg-[var(--surface-soft)]
            hover:text-[var(--foreground)]
          "
        >
          回到 Inbox
        </Link>
      </div>
    </main>
  );
}
