import type { ReactNode } from "react";

import Link from "next/link";

import StudySyncButton from "@/features/study/components/StudySyncButton";

import { getStudyBrowser } from "@/features/study/lib/get-study-browser";

import { getTaipeiToday } from "@/lib/time/get-taipei-today";

export const dynamic = "force-dynamic";

type StudyPageProps = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

type StudyTab = "overview" | "courses" | "assignments" | "announcements";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",

  month: "numeric",

  day: "numeric",

  hour: "2-digit",

  minute: "2-digit",

  hour12: false,
});

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",

  year: "numeric",

  month: "2-digit",

  day: "2-digit",
});

function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  return dateTimeFormatter.format(new Date(value));
}

function getDateKey(value: string) {
  return dateKeyFormatter.format(new Date(value));
}

function getTab(value: string | undefined): StudyTab {
  if (
    value === "courses" ||
    value === "assignments" ||
    value === "announcements"
  ) {
    return value;
  }

  return "overview";
}

function getDueState(dueAt: string | null, submitted: boolean, today: string) {
  if (submitted) {
    return {
      label: "已提交",

      className: "text-[var(--muted)]",
    };
  }

  if (!dueAt) {
    return {
      label: "未提交",

      className: "text-[var(--accent)]",
    };
  }

  const dueDate = getDateKey(dueAt);

  if (dueDate < today) {
    return {
      label: "已逾期",

      className: "text-[var(--danger)]",
    };
  }

  const due = new Date(`${dueDate}T00:00:00+08:00`).getTime();

  const current = new Date(`${today}T00:00:00+08:00`).getTime();

  const oneDay = 24 * 60 * 60 * 1000;

  const days = Math.round((due - current) / oneDay);

  if (days <= 1) {
    return {
      label: days === 0 ? "今天截止" : "明天截止",

      className: "text-[var(--danger)]",
    };
  }

  if (days <= 7) {
    return {
      label: `${days} 天後截止`,

      className: "text-[var(--accent)]",
    };
  }

  return {
    label: "未提交",

    className: "text-[var(--muted)]",
  };
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;

  active: boolean;

  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`
        shrink-0
        rounded-full
        px-4
        py-2
        text-sm
        transition

        ${
          active
            ? `
              bg-[var(--foreground)]
              text-white
            `
            : `
              bg-[var(--surface-soft)]
              text-[var(--muted)]
              hover:text-[var(--foreground)]
            `
        }
      `}
    >
      {children}
    </Link>
  );
}

export default async function StudyPage({ searchParams }: StudyPageProps) {
  const today = await getTaipeiToday();

  const params = await searchParams;

  const tab = getTab(params.tab);

  const data = await getStudyBrowser();

  const pendingAssignments = data.assignments.filter(
    (assignment) => !assignment.submitted,
  );

  const submittedAssignments = data.assignments.filter(
    (assignment) => assignment.submitted,
  );

  const unreadAnnouncements = data.announcements.filter(
    (announcement) => !announcement.seenAt,
  );
  const upcomingAssignments = pendingAssignments
    .filter((assignment) => {
      if (!assignment.dueAt) {
        return false;
      }

      const dueDate = getDateKey(assignment.dueAt);

      return dueDate >= today;
    })
    .slice(0, 5);

  return (
    <main
      className="
        mx-auto
        w-full
        max-w-5xl
        px-4
        py-8
        sm:px-6
        sm:py-12
      "
    >
      <header
        className="
          flex
          flex-wrap
          items-end
          justify-between
          gap-5
        "
      >
        <div>
          <p
            className="
              text-xs
              uppercase
              tracking-[0.25em]
              text-[var(--accent)]
            "
          >
            Study
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
            我的課程
          </h1>

          <p
            className="
              mt-3
              text-sm
              text-[var(--muted)]
            "
          >
            NTU COOL
          </p>
        </div>

        <StudySyncButton />
      </header>

      <nav
        className="
          mt-8
          flex
          gap-2
          overflow-x-auto
          pb-1
        "
      >
        <TabLink href="/study" active={tab === "overview"}>
          Overview
        </TabLink>

        <TabLink href="/study?tab=courses" active={tab === "courses"}>
          Courses
        </TabLink>

        <TabLink href="/study?tab=assignments" active={tab === "assignments"}>
          Assignments
        </TabLink>

        <TabLink
          href="/study?tab=announcements"
          active={tab === "announcements"}
        >
          Announcements
        </TabLink>
        <Link
          href="/study/inbox"
          className="
            shrink-0
            rounded-full
            bg-[var(--surface-soft)]
            px-4
            py-2
            text-sm
            text-[var(--muted)]
            transition
            hover:text-[var(--foreground)]
          "
        >
          Inbox
        </Link>
      </nav>

      {tab === "overview" && (
        <div className="mt-10">
          <section
            className="
              grid
              grid-cols-3
              gap-3
            "
          >
            <Link
              href="/study?tab=courses"
              className="
                rounded-[var(--radius-md)]
                border
                border-[var(--border)]
                bg-[var(--surface)]
                p-4
                transition
                hover:border-[var(--accent)]
              "
            >
              <p
                className="
                  text-xs
                  text-[var(--muted)]
                "
              >
                Courses
              </p>

              <p
                className="
                  mt-2
                  text-2xl
                  font-semibold
                "
              >
                {data.courses.length}
              </p>
            </Link>

            <Link
              href="/study?tab=assignments"
              className="
                rounded-[var(--radius-md)]
                border
                border-[var(--border)]
                bg-[var(--surface)]
                p-4
                transition
                hover:border-[var(--accent)]
              "
            >
              <p
                className="
                  text-xs
                  text-[var(--muted)]
                "
              >
                To do
              </p>

              <p
                className="
                  mt-2
                  text-2xl
                  font-semibold
                "
              >
                {pendingAssignments.length}
              </p>
            </Link>

            <Link
              href="/study?tab=announcements"
              className="
                rounded-[var(--radius-md)]
                border
                border-[var(--border)]
                bg-[var(--surface)]
                p-4
                transition
                hover:border-[var(--accent)]
              "
            >
              <p
                className="
                  text-xs
                  text-[var(--muted)]
                "
              >
                New
              </p>

              <p
                className="
                  mt-2
                  text-2xl
                  font-semibold
                "
              >
                {unreadAnnouncements.length}
              </p>
            </Link>
          </section>

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
                  Due soon
                </p>

                <h2
                  className="
                    font-story
                    mt-2
                    text-2xl
                    font-semibold
                  "
                >
                  接下來的作業
                </h2>
              </div>

              <Link
                href="/study?tab=assignments"
                className="
                  text-xs
                  text-[var(--muted)]
                  hover:text-[var(--foreground)]
                "
              >
                全部 →
              </Link>
            </div>

            {upcomingAssignments.length > 0 ? (
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
                {upcomingAssignments.map((assignment) => {
                  const state = getDueState(
                    assignment.dueAt,
                    assignment.submitted,
                    today,
                  );

                  return (
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
                      <p
                        className="
                            text-xs
                            text-[var(--muted)]
                          "
                      >
                        {assignment.courseName}
                      </p>

                      <h3
                        className="
                            mt-2
                            font-medium
                            leading-6
                          "
                      >
                        {assignment.title}
                      </h3>

                      <div
                        className="
                            mt-3
                            flex
                            flex-wrap
                            items-center
                            gap-x-3
                            gap-y-1
                            text-xs
                          "
                      >
                        {assignment.dueAt && (
                          <span
                            className="
                                text-[var(--muted)]
                              "
                          >
                            {formatDateTime(assignment.dueAt)}
                          </span>
                        )}

                        <span className={state.className}>{state.label}</span>
                      </div>
                    </Link>
                  );
                })}
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
                目前沒有待交作業。
              </div>
            )}
          </section>

          {unreadAnnouncements.length > 0 && (
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
                    新公告
                  </h2>
                </div>

                <Link
                  href="/study?tab=announcements"
                  className="
                    text-xs
                    text-[var(--muted)]
                    hover:text-[var(--foreground)]
                  "
                >
                  全部 →
                </Link>
              </div>

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
                {unreadAnnouncements.slice(0, 4).map((announcement) => (
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
                        className="
                              mt-1.5
                              h-2
                              w-2
                              shrink-0
                              rounded-full
                              bg-[var(--accent)]
                            "
                      />

                      <div
                        className="
                              min-w-0
                            "
                      >
                        <p
                          className="
                                text-xs
                                text-[var(--muted)]
                              "
                        >
                          {announcement.courseName}
                        </p>

                        <p
                          className="
                                mt-1
                                font-medium
                                leading-6
                              "
                        >
                          {announcement.title}
                        </p>

                        {announcement.postedAt && (
                          <p
                            className="
                                  mt-2
                                  text-xs
                                  text-[var(--muted)]
                                "
                          >
                            {formatDateTime(announcement.postedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === "courses" && (
        <section className="mt-10">
          <h2
            className="
              font-story
              text-3xl
              font-semibold
            "
          >
            Courses
          </h2>

          <p
            className="
              mt-2
              text-sm
              text-[var(--muted)]
            "
          >
            {data.courses.length} 門課程
          </p>

          <div
            className="
              mt-6
              grid
              gap-4
              sm:grid-cols-2
            "
          >
            {data.courses.map((course) => {
              const assignments = data.assignments.filter(
                (assignment) => assignment.coolCourseId === course.coolCourseId,
              );

              const pending = assignments.filter(
                (assignment) => !assignment.submitted,
              ).length;

              const announcements = data.announcements.filter(
                (announcement) =>
                  announcement.coolCourseId === course.coolCourseId,
              );

              const unread = announcements.filter(
                (announcement) => announcement.readState === "unread",
              ).length;
              return (
                <Link
                  key={course.id}
                  href={`/study/courses/${course.coolCourseId}`}
                  className="
      block
      rounded-[var(--radius-lg)]
      border
      border-[var(--border)]
      bg-[var(--surface)]
      p-5
      transition
      hover:border-[var(--accent)]
      hover:bg-[var(--surface-soft)]
      sm:p-6
    "
                >
                  <p
                    className="
        text-xs
        text-[var(--muted)]
      "
                  >
                    {course.courseCode ?? "NTU COOL"}
                  </p>

                  <h3
                    className="
        font-story
        mt-2
        text-xl
        font-semibold
        leading-7
      "
                  >
                    {course.name}
                  </h3>

                  <div
                    className="
        mt-5
        flex
        gap-4
        text-xs
        text-[var(--muted)]
      "
                  >
                    <span>{pending} 待交</span>

                    <span>{unread} 新公告</span>
                  </div>

                  <p
                    className="
        mt-5
        text-xs
        text-[var(--accent)]
      "
                  >
                    查看課程 →
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {tab === "assignments" && (
        <section className="mt-10">
          <h2
            className="
              font-story
              text-3xl
              font-semibold
            "
          >
            Assignments
          </h2>

          <div className="mt-8">
            <p
              className="
                text-xs
                uppercase
                tracking-[0.2em]
                text-[var(--accent)]
              "
            >
              To do
            </p>

            {pendingAssignments.length > 0 ? (
              <div
                className="
                  mt-4
                  divide-y
                  divide-[var(--border)]
                  overflow-hidden
                  rounded-[var(--radius-lg)]
                  border
                  border-[var(--border)]
                  bg-[var(--surface)]
                "
              >
                {pendingAssignments.map((assignment) => {
                  const state = getDueState(
                    assignment.dueAt,
                    assignment.submitted,
                    today,
                  );

                  return (
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
                      <p
                        className="
                            text-xs
                            text-[var(--muted)]
                          "
                      >
                        {assignment.courseName}
                      </p>

                      <h3
                        className="
                            mt-2
                            font-medium
                            leading-6
                          "
                      >
                        {assignment.title}
                      </h3>

                      <div
                        className="
                            mt-3
                            flex
                            flex-wrap
                            gap-3
                            text-xs
                          "
                      >
                        {assignment.dueAt && (
                          <span
                            className="
                                text-[var(--muted)]
                              "
                          >
                            {formatDateTime(assignment.dueAt)}
                          </span>
                        )}

                        <span className={state.className}>{state.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p
                className="
                  mt-4
                  text-sm
                  text-[var(--muted)]
                "
              >
                沒有待交作業。
              </p>
            )}
          </div>

          {submittedAssignments.length > 0 && (
            <div className="mt-12">
              <p
                className="
                  text-xs
                  uppercase
                  tracking-[0.2em]
                  text-[var(--muted)]
                "
              >
                Submitted
              </p>

              <div
                className="
                  mt-4
                  divide-y
                  divide-[var(--border)]
                  overflow-hidden
                  rounded-[var(--radius-lg)]
                  border
                  border-[var(--border)]
                  bg-[var(--surface)]
                "
              >
                {submittedAssignments.map((assignment) => (
                  <Link
                    key={assignment.id}
                    href={`/study/assignments/${assignment.id}`}
                    className="
                        block
                        p-5
                        opacity-65
                        transition
                        hover:bg-[var(--surface-soft)]
                        hover:opacity-100
                        sm:p-6
                      "
                  >
                    <p
                      className="
                          text-xs
                          text-[var(--muted)]
                        "
                    >
                      {assignment.courseName}
                    </p>

                    <h3
                      className="
                          mt-2
                          font-medium
                          leading-6
                        "
                    >
                      {assignment.title}
                    </h3>

                    <p
                      className="
                          mt-3
                          text-xs
                          text-[var(--muted)]
                        "
                    >
                      已提交
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "announcements" && (
        <section className="mt-10">
          <div
            className="
              flex
              items-end
              justify-between
              gap-4
            "
          >
            <div>
              <h2
                className="
                  font-story
                  text-3xl
                  font-semibold
                "
              >
                Announcements
              </h2>

              <p
                className="
                  mt-2
                  text-sm
                  text-[var(--muted)]
                "
              >
                {unreadAnnouncements.length} 則未讀
              </p>
            </div>
          </div>

          {data.announcements.length > 0 ? (
            <div
              className="
                mt-6
                divide-y
                divide-[var(--border)]
                overflow-hidden
                rounded-[var(--radius-lg)]
                border
                border-[var(--border)]
                bg-[var(--surface)]
              "
            >
              {data.announcements.map((announcement) => (
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
                        mt-1.5
                        h-2
                        w-2
                        shrink-0
                        rounded-full

                        ${!announcement.seenAt ? "bg-[var(--accent)]" : "bg-[var(--border)]"}
                      `}
                    />
                    <div
                      className="
                          min-w-0
                        "
                    >
                      <p
                        className="
                            text-xs
                            text-[var(--muted)]
                          "
                      >
                        {announcement.courseName}
                      </p>

                      <h3
                        className="
                            mt-1
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
                          {formatDateTime(announcement.postedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p
              className="
                mt-6
                text-sm
                text-[var(--muted)]
              "
            >
              目前沒有公告。
            </p>
          )}
        </section>
      )}
    </main>
  );
}
