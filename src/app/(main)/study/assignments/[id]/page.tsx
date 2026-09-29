import Link from "next/link";

import { notFound } from "next/navigation";

import { getStudyAssignmentDetail } from "@/features/study/lib/get-study-assignment-detail";

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

export default async function StudyAssignmentPage({ params }: PageProps) {
  const { id } = await params;

  const assignment = await getStudyAssignmentDetail(id);

  if (!assignment) {
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
        href="/study?tab=assignments"
        className="
          text-sm
          text-[var(--muted)]
          hover:text-[var(--foreground)]
        "
      >
        ← Assignments
      </Link>

      <header className="mt-8">
        <p
          className="
            text-sm
            text-[var(--muted)]
          "
        >
          {assignment.courseName}
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
          {assignment.title}
        </h1>

        <div
          className="
            mt-5
            flex
            flex-wrap
            gap-x-5
            gap-y-2
            text-sm
          "
        >
          {assignment.dueAt && (
            <span
              className="
                text-[var(--muted)]
              "
            >
              截止 {dateFormatter.format(new Date(assignment.dueAt))}
            </span>
          )}

          <span
            className={
              assignment.submitted
                ? "text-[var(--muted)]"
                : assignment.missing
                  ? "text-[var(--danger)]"
                  : "text-[var(--accent)]"
            }
          >
            {assignment.submitted
              ? "已提交"
              : assignment.missing
                ? "未提交 · 已逾期"
                : "未提交"}
          </span>
        </div>

        {assignment.pointsPossible !== null && (
          <p
            className="
              mt-3
              text-sm
              text-[var(--muted)]
            "
          >
            滿分 {assignment.pointsPossible} 分
          </p>
        )}
      </header>

      <section
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
        <h2
          className="
            font-story
            text-xl
            font-semibold
          "
        >
          作業說明
        </h2>

        {assignment.descriptionHtml ? (
          <div
            className="
              mt-6
              break-words
              text-sm
              leading-7

              [&_a]:text-[var(--accent)]
              [&_a]:underline

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
              [&_img]:rounded-lg

              [&_li]:my-1

              [&_ol]:my-4
              [&_ol]:list-decimal
              [&_ol]:pl-6

              [&_p]:my-4

              [&_table]:my-5
              [&_table]:w-full
              [&_table]:border-collapse

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
              __html: assignment.descriptionHtml,
            }}
          />
        ) : (
          <p
            className="
              mt-5
              text-sm
              text-[var(--muted)]
            "
          >
            這份作業沒有額外說明。
          </p>
        )}
      </section>

      <a
        href={assignment.htmlUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="
          mt-6
          inline-flex
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
        前往 NTU COOL
      </a>
    </main>
  );
}
