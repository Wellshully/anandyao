import Link from "next/link";

import { notFound } from "next/navigation";

import { getStudyCourseDetail } from "@/features/study/lib/get-study-course-detail";

type PageProps = {
  params: Promise<{
    coolCourseId: string;
  }>;
};

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
    return null;
  }

  return dateFormatter.format(new Date(value));
}

export default async function StudyCoursePage({ params }: PageProps) {
  const { coolCourseId: rawCourseId } = await params;

  const coolCourseId = Number(rawCourseId);

  if (!Number.isFinite(coolCourseId) || coolCourseId <= 0) {
    notFound();
  }

  const detail = await getStudyCourseDetail(coolCourseId);

  if (!detail) {
    notFound();
  }

  const { course, assignments, announcements } = detail;

  const pendingAssignments = assignments.filter(
    (assignment) => !assignment.submitted,
  );

  const submittedAssignments = assignments.filter(
    (assignment) => assignment.submitted,
  );

  const unseenAnnouncements = announcements.filter(
    (announcement) => !announcement.seenAt,
  );

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
        href="/study?tab=courses"
        className="
          text-sm
          text-[var(--muted)]
          transition
          hover:text-[var(--foreground)]
        "
      >
        ← Courses
      </Link>

      <header className="mt-8">
        <p
          className="
            text-xs
            uppercase
            tracking-[0.2em]
            text-[var(--accent)]
          "
        >
          Course
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
          {course.name}
        </h1>

        {course.courseCode && (
          <p
            className="
              mt-3
              text-sm
              text-[var(--muted)]
            "
          >
            {course.courseCode}
          </p>
        )}

        <div
          className="
            mt-6
            flex
            flex-wrap
            gap-3
            text-xs
            text-[var(--muted)]
          "
        >
          <span>{pendingAssignments.length} 待交</span>

          <span>{submittedAssignments.length} 已提交</span>

          <span>{unseenAnnouncements.length} 新公告</span>
        </div>
      </header>

      <section className="mt-12">
        <div
          className="
            flex
            items-end
            justify-between
            gap-4
          "
        >
          <div>
            <p
              className="
                text-xs
                uppercase
                tracking-[0.2em]
                text-[var(--accent)]
              "
            >
              Assignments
            </p>

            <h2
              className="
                font-story
                mt-2
                text-2xl
                font-semibold
              "
            >
              作業
            </h2>
          </div>
        </div>

        {assignments.length > 0 ? (
          <div
            className="
              mt-5
              divide-y
              divide-[var(--border)]
              overflow-hidden
              rounded-[var(--radius-lg)]
              border
              border-[var(--border)]
              bg-[var(--surface)]
            "
          >
            {assignments.map((assignment) => (
              <Link
                key={assignment.id}
                href={`/study/assignments/${assignment.id}`}
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
                      items-start
                      justify-between
                      gap-4
                    "
                >
                  <div
                    className="
                        min-w-0
                        flex-1
                      "
                  >
                    <h3
                      className="
                          font-medium
                          leading-6
                        "
                    >
                      {assignment.title}
                    </h3>

                    {assignment.dueAt && (
                      <p
                        className="
                            mt-2
                            text-xs
                            text-[var(--muted)]
                          "
                      >
                        截止 {formatDate(assignment.dueAt)}
                      </p>
                    )}
                  </div>

                  <span
                    className={`
                        shrink-0
                        text-xs

                        ${
                          assignment.submitted
                            ? "text-[var(--muted)]"
                            : assignment.missing
                              ? "text-[var(--danger)]"
                              : "text-[var(--accent)]"
                        }
                      `}
                  >
                    {assignment.submitted
                      ? "已提交"
                      : assignment.missing
                        ? "已逾期"
                        : "未提交"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div
            className="
              mt-5
              rounded-[var(--radius-lg)]
              border
              border-dashed
              border-[var(--border)]
              p-6
              text-sm
              text-[var(--muted)]
            "
          >
            這門課目前沒有同步到作業。
          </div>
        )}
      </section>

      <section className="mt-12">
        <div>
          <p
            className="
              text-xs
              uppercase
              tracking-[0.2em]
              text-[var(--accent)]
            "
          >
            Announcements
          </p>

          <h2
            className="
              font-story
              mt-2
              text-2xl
              font-semibold
            "
          >
            公告
          </h2>
        </div>

        {announcements.length > 0 ? (
          <div
            className="
              mt-5
              divide-y
              divide-[var(--border)]
              overflow-hidden
              rounded-[var(--radius-lg)]
              border
              border-[var(--border)]
              bg-[var(--surface)]
            "
          >
            {announcements.map((announcement) => (
              <Link
                key={announcement.id}
                href={`/study/announcements/${announcement.id}`}
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

                        ${
                          !announcement.seenAt
                            ? "bg-[var(--accent)]"
                            : "bg-[var(--border)]"
                        }
                      `}
                  />

                  <div
                    className="
                        min-w-0
                      "
                  >
                    <h3
                      className="
                          font-medium
                          leading-6
                        "
                    >
                      {announcement.title}
                    </h3>

                    {announcement.postedAt && (
                      <p
                        className="
                            mt-2
                            text-xs
                            text-[var(--muted)]
                          "
                      >
                        {formatDate(announcement.postedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div
            className="
              mt-5
              rounded-[var(--radius-lg)]
              border
              border-dashed
              border-[var(--border)]
              p-6
              text-sm
              text-[var(--muted)]
            "
          >
            這門課目前沒有同步到公告。
          </div>
        )}
      </section>

      <a
        href={`https://cool.ntu.edu.tw/courses/${course.coolCourseId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="
          mt-10
          inline-flex
          items-center
          justify-center
          rounded-full
          bg-[var(--foreground)]
          px-5
          py-3
          text-sm
          text-white
          transition
          hover:opacity-85
        "
      >
        在 NTU COOL 開啟
      </a>
    </main>
  );
}
