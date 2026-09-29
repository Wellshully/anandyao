import Link from "next/link";

import { notFound } from "next/navigation";

import { getStudyAnnouncementDetail } from "@/features/study/lib/get-study-announcement-detail";

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

export default async function StudyAnnouncementPage({ params }: PageProps) {
  const { id } = await params;

  const announcement = await getStudyAnnouncementDetail(id);

  if (!announcement) {
    notFound();
  }

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
        href="/study?tab=announcements"
        className="
          text-sm
          text-[var(--muted)]
          transition
          hover:text-[var(--foreground)]
        "
      >
        ← Announcements
      </Link>

      <header className="mt-8">
        <p
          className="
            text-sm
            text-[var(--muted)]
          "
        >
          {announcement.courseName}
        </p>

        <h1
          className="
            font-story
            mt-3
            text-3xl
            font-semibold
            leading-tight
            sm:text-4xl
          "
        >
          {announcement.title}
        </h1>

        <div
          className="
            mt-4
            flex
            flex-wrap
            items-center
            gap-3
            text-sm
            text-[var(--muted)]
          "
        >
          {announcement.postedAt && (
            <span>{dateFormatter.format(new Date(announcement.postedAt))}</span>
          )}

          <span
            className={`
              inline-flex
              items-center
              gap-1.5

              ${
                announcement.readState === "unread"
                  ? "text-[var(--accent)]"
                  : ""
              }
            `}
          >
            <span
              className={`
                h-1.5
                w-1.5
                rounded-full

                ${
                  announcement.readState === "unread"
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--border)]"
                }
              `}
            />

            {announcement.readState === "unread" ? "COOL 未讀" : "COOL 已讀"}
          </span>
        </div>
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
        {!announcement.detailAvailable ? (
          <div>
            <p
              className="
                font-medium
                text-[var(--foreground)]
              "
            >
              {announcement.unavailableReason === "auth_expired"
                ? "NTU COOL 授權已過期"
                : "暫時無法連線 NTU COOL"}
            </p>

            <p
              className="
                mt-2
                text-sm
                leading-6
                text-[var(--muted)]
              "
            >
              公告的課程、標題與發布時間仍可瀏覽， 但目前無法取得完整公告內容。
            </p>

            {announcement.unavailableReason === "auth_expired" && (
              <p
                className="
                  mt-3
                  text-xs
                  leading-5
                  text-[var(--muted)]
                "
              >
                更新 NTU COOL Access Token 後即可恢復全文閱讀。
              </p>
            )}
          </div>
        ) : announcement.messageHtml ? (
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
              [&_blockquote]:text-[var(--muted)]

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
              [&_img]:rounded-lg

              [&_li]:my-1

              [&_ol]:my-4
              [&_ol]:list-decimal
              [&_ol]:pl-6

              [&_p]:my-4

              [&_table]:my-5
              [&_table]:block
              [&_table]:w-full
              [&_table]:overflow-x-auto
              [&_table]:border-collapse

              [&_td]:border
              [&_td]:border-[var(--border)]
              [&_td]:p-2
              [&_td]:align-top

              [&_th]:border
              [&_th]:border-[var(--border)]
              [&_th]:p-2
              [&_th]:text-left
              [&_th]:align-top

              [&_ul]:my-4
              [&_ul]:list-disc
              [&_ul]:pl-6

              [&_pre]:my-4
              [&_pre]:overflow-x-auto
              [&_pre]:rounded-lg
              [&_pre]:bg-[var(--surface-soft)]
              [&_pre]:p-4

              [&_code]:break-words
            "
            dangerouslySetInnerHTML={{
              __html: announcement.messageHtml,
            }}
          />
        ) : (
          <p
            className="
              text-sm
              text-[var(--muted)]
            "
          >
            這則公告沒有內容。
          </p>
        )}
      </article>

      <div
        className="
          mt-6
          flex
          flex-wrap
          gap-3
        "
      >
        <a
          href={announcement.htmlUrl}
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
          在 NTU COOL 開啟
        </a>

        <Link
          href="/study?tab=announcements"
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
          回到公告
        </Link>
      </div>
    </main>
  );
}
