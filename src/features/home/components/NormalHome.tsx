import Image from "next/image";
import Link from "next/link";

import HomeNextUpAction from "@/features/home/components/HomeNextUpAction";

import {
  getHomeNextUpHref,
  getHomeNextUpActionLabel,
} from "@/features/home/lib/home-next-up-navigation";

import { getHomePendingDateRecaps } from "@/features/home/lib/get-home-pending-date-recaps";

import AppShell from "@/components/layout/AppShell";

import {
  getHomeDashboard,
  type HomeDateSummary,
  type HomeScheduleItem,
  type HomeUrgentItem,
} from "@/features/home/lib/get-home-dashboard";

import type { TodayItem } from "@/features/today/types";

const TIME_ZONE = "Asia/Taipei";

const quickLinks = [
  {
    href: "/eat",
    title: "Eat",
    description: "今天要吃什麼",
  },
  {
    href: "/places",
    title: "Places",
    description: "一起想去的地方",
  },
  {
    href: "/memories",
    title: "Memories",
    description: "照片與回憶",
  },
  {
    href: "/journal",
    title: "Journal",
    description: "寫下想留下的事",
  },
] as const;

const itemKindLabels: Record<HomeScheduleItem["kind"], string> = {
  date: "Date",
  personal: "Personal",
  study: "Study",
  google_calendar: "Google",
  pet_task: "Pet Task",
  pet_recurring_schedule: "固定行程",
};

const dateKindLabels: Record<string, string> = {
  meal: "一起吃飯",
  date: "約會",
  half_day: "半日約會",
  day: "一日約會",
  trip: "小旅行",
};

function getGreeting(now: number) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(now)),
  );

  if (hour < 12) {
    return "早安";
  }

  if (hour < 18) {
    return "下午好";
  }

  return "晚上好";
}

function formatToday(now: number) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: TIME_ZONE,
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(now));
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: TIME_ZONE,
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: TIME_ZONE,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function getItemTime(item: HomeScheduleItem) {
  if (item.startAt === null) {
    return "今天";
  }

  if (item.timing === "deadline") {
    return `截止 ${formatTime(item.startAt)}`;
  }

  return formatTime(item.startAt);
}

function SectionHeader({
  eyebrow,
  title,
  actionHref,
  actionLabel,
}: {
  eyebrow: string;
  title: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
          {eyebrow}
        </p>

        <h2 className="font-story mt-2 text-2xl font-semibold sm:text-3xl">
          {title}
        </h2>
      </div>

      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="shrink-0 text-xs font-medium text-[var(--accent)] sm:text-sm"
        >
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}

function NextUpCard({
  item,
  untimedItems,
}: {
  item: HomeScheduleItem | null;
  untimedItems: HomeScheduleItem[];
}) {
  const compactItems = untimedItems.slice(0, 5);

  const remainingCount = Math.max(0, untimedItems.length - compactItems.length);

  return (
    <HomeNextUpAction
      kind={item?.kind ?? null}
      itemId={item?.id ?? null}
      href={getHomeNextUpHref(item)}
      className="
        group
        mt-6
        block
        overflow-hidden
        rounded-[var(--radius-lg)]
        border
        border-[var(--border)]
        bg-[var(--surface)]
        transition
        hover:-translate-y-0.5
        hover:border-[var(--foreground)]
      "
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
            Next up
          </p>

          <span
            aria-hidden="true"
            className="text-lg text-[var(--muted)] transition-transform group-hover:translate-x-1"
          >
            →
          </span>
        </div>

        <div
          className={
            untimedItems.length > 0
              ? "mt-6 grid gap-8 sm:grid-cols-[minmax(0,1fr)_15rem]"
              : "mt-6"
          }
        >
          <div className="min-w-0">
            {item ? (
              <>
                <p className="text-sm font-medium text-[var(--accent)]">
                  {getItemTime(item)}
                </p>

                <h2 className="font-story mt-2 text-3xl font-semibold sm:text-4xl">
                  {item.title}
                </h2>

                {item.subtitle && (
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    {item.subtitle}
                  </p>
                )}

                <div className="mt-7">
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--accent)]">
                    {itemKindLabels[item.kind]}
                  </span>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-story text-3xl font-semibold sm:text-4xl">
                  {untimedItems.length > 0
                    ? "今天沒有下一個定時行程"
                    : "今天暫時沒有下一件事"}
                </h2>

                <p className="mt-3 text-sm text-[var(--muted)]">
                  {untimedItems.length > 0
                    ? "今天還有一些沒有指定時間的事項。"
                    : "有空可以慢慢來。"}
                </p>
              </>
            )}
          </div>

          {untimedItems.length > 0 && (
            <aside
              className="
                border-t
                border-[var(--border)]
                pt-5
                sm:border-l
                sm:border-t-0
                sm:pl-6
                sm:pt-0
              "
            >
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                今天還有
              </p>

              <div className="mt-3 space-y-2">
                {compactItems.map((compactItem) => (
                  <p
                    key={compactItem.id}
                    className="text-[11px] leading-5 text-[var(--muted)]"
                  >
                    <span className="font-medium text-[var(--foreground)]">
                      {itemKindLabels[compactItem.kind]}
                    </span>
                    {" · "}
                    {compactItem.title}
                  </p>
                ))}

                {remainingCount > 0 && (
                  <p className="text-[10px] text-[var(--muted)]">
                    還有 {remainingCount} 件
                  </p>
                )}
              </div>
            </aside>
          )}
        </div>

        <p className="mt-8 text-xs font-medium text-[var(--accent)]">
          {getHomeNextUpActionLabel(item)}
        </p>
      </div>
    </HomeNextUpAction>
  );
}

function UrgentRow({ item }: { item: HomeUrgentItem }) {
  const label =
    item.kind === "study_due_soon"
      ? "作業即將截止"
      : "待辦即將截止";

  return (
    <Link
      href={item.href}
      className="
        flex
        items-start
        justify-between
        gap-4
        rounded-2xl
        border
        border-[var(--border)]
        bg-[var(--surface)]
        px-4
        py-4
        transition
        hover:border-[var(--foreground)]
      "
    >
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
          {label}
        </p>

        <p className="mt-1 text-sm font-medium">{item.title}</p>

        <p className="mt-1 text-xs text-[var(--muted)]">{item.subtitle}</p>

        {item.timestamp !== null && (
          <p className="mt-1 text-xs text-[var(--muted)]">
            {formatDateTime(item.timestamp)}
          </p>
        )}
      </div>

      <span aria-hidden="true" className="shrink-0 text-sm text-[var(--muted)]">
        →
      </span>
    </Link>
  );
}

function StudyRow({ item }: { item: TodayItem }) {
  const content = (
    <div
      className="
        flex
        items-start
        justify-between
        gap-4
        rounded-xl
        px-3
        py-3
        transition
        hover:bg-[var(--surface-soft)]
      "
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{item.title}</p>

        {item.subtitle && (
          <p className="mt-1 text-xs text-[var(--muted)]">{item.subtitle}</p>
        )}

        {item.startAt !== null && (
          <p className="mt-1 text-xs text-[var(--accent)]">
            {formatDateTime(item.startAt)}
          </p>
        )}
      </div>

      {item.href && <span className="text-xs text-[var(--muted)]">→</span>}
    </div>
  );

  if (!item.href) {
    return content;
  }

  return <Link href={item.href}>{content}</Link>;
}

function DateCard({ date }: { date: HomeDateSummary | null }) {
  if (!date) {
    return (
      <div className="mt-6">
        <h3 className="font-story text-2xl font-semibold">下一次要去哪？</h3>

        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          現在還沒有下一個已確認的 Date。
        </p>

        <Link
          href="/dates/new"
          className="mt-6 inline-block text-sm font-medium text-[var(--accent)]"
        >
          約下一次 →
        </Link>
      </div>
    );
  }

  return (
    <Link href={`/dates/${date.id}`} className="group mt-6 block">
      <p className="text-xs text-[var(--accent)]">
        {dateKindLabels[date.kind] ?? date.kind}
      </p>

      <h3 className="font-story mt-2 text-2xl font-semibold sm:text-3xl">
        {date.title}
      </h3>

      <p className="mt-3 text-sm text-[var(--muted)]">
        {formatDate(date.startDate)}

        {date.endDate !== date.startDate && ` – ${formatDate(date.endDate)}`}
      </p>

      {date.description && (
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
          {date.description}
        </p>
      )}

      <p className="mt-6 text-sm font-medium text-[var(--accent)]">
        打開 Date →
      </p>
    </Link>
  );
}

export default async function NormalHome() {
  const [dashboard, pendingDateRecaps] = await Promise.all([
    getHomeDashboard(),
    getHomePendingDateRecaps(),
  ]);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        {/* Identity */}

        <header className="mb-10 sm:mb-12">
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
            Our little place
          </p>

          <h1 className="font-story mt-3 text-4xl font-semibold sm:text-5xl">
            An & Yao
          </h1>

          <p className="mt-3 text-sm text-[var(--muted)]">給安的生日禮物。</p>

          <p className="mt-5 text-xs text-[var(--muted)]">
            {formatToday(dashboard.now)}
            {" · "}
            {getGreeting(dashboard.now)}，{dashboard.profile.displayName}
          </p>
        </header>

        {/* Date recap reminder */}

        {pendingDateRecaps.length > 0 ? (
          <section
            aria-label="等待完成的約會回憶"
            className="mb-10 rounded-[var(--radius-lg)] border border-[var(--accent)] bg-[var(--surface)] p-5 sm:p-7"
          >
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
              Our memories
            </p>

            <h2 className="font-story mt-2 text-2xl font-semibold sm:text-3xl">
              約會回憶
            </h2>

            <p className="mt-2 text-sm text-[var(--muted)]">放些照片打些字。</p>

            <div className="mt-5 space-y-3">
              {pendingDateRecaps.map((recap) => (
                <Link
                  key={recap.id}
                  href={`/dates/${recap.id}/recap`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] px-4 py-4 transition hover:border-[var(--foreground)]"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">
                      {recap.title}
                    </p>

                    <p className="mt-1 text-xs text-[var(--muted)]">
                      期限：{recap.deadline}
                    </p>
                  </div>

                  <span className="shrink-0 text-xs font-medium text-[var(--accent)]">
                    留下回憶 →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* Next Up */}

        <section>
          <SectionHeader
            eyebrow="Today"
            title="下一件事"
            actionHref="/calendar"
            actionLabel="Calendar"
          />

          <NextUpCard
            item={dashboard.nextUp}
            untimedItems={dashboard.todayUntimed}
          />
        </section>

        {/* Attention */}

        {dashboard.urgent.length > 0 && (
          <section className="mt-14">
            <SectionHeader eyebrow="Attention" title="三天內截止" />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {dashboard.urgent.map((item) => (
                <UrgentRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* Date + Study */}

        <section className="mt-14 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7">
            <SectionHeader
              eyebrow="Together"
              title="Date"
              actionHref="/dates"
              actionLabel="所有 Dates"
            />

            <DateCard date={dashboard.nextDate} />
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7">
            <SectionHeader
              eyebrow="NTU"
              title="Study"
              actionHref="/study"
              actionLabel="打開 Study"
            />

            <div className="mt-5">
              {dashboard.study.overdueCount > 0 && (
                <Link
                  href="/study"
                  className="
                    mb-3
                    block
                    rounded-xl
                    bg-[var(--accent-soft)]
                    px-4
                    py-3
                    text-sm
                    font-medium
                    text-[var(--accent)]
                  "
                >
                  {dashboard.study.overdueCount} 件作業已超過期限
                </Link>
              )}

              {dashboard.study.assignments.slice(0, 3).map((item) => (
                <StudyRow key={item.id} item={item} />
              ))}

              {dashboard.study.announcement && (
                <StudyRow item={dashboard.study.announcement} />
              )}

              {dashboard.study.mail && <StudyRow item={dashboard.study.mail} />}

              {dashboard.study.assignments.length === 0 &&
                dashboard.study.overdueCount === 0 &&
                !dashboard.study.announcement &&
                !dashboard.study.mail && (
                  <p className="py-8 text-sm text-[var(--muted)]">
                    最近沒有需要注意的 Study 項目。
                  </p>
                )}
            </div>
          </div>
        </section>

        {/* Pet */}

        <section className="mt-14 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
          <Link href="/pet" className="group grid sm:grid-cols-[1fr_14rem]">
            <div className="p-6 sm:p-8">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
                Pet
              </p>

              <h2 className="font-story mt-2 text-3xl font-semibold">
                {dashboard.pet.name}
              </h2>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                陪你聊天、記住重要的事情，也能幫你管理自己的待辦。 萌蛋還會整理
                Date、Study 和近期事項，每天提供一份簡短的生活報告。
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-xs text-[var(--muted)]">
                  聊天與記憶
                </span>

                <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-xs text-[var(--muted)]">
                  個人待辦
                </span>

                <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-xs text-[var(--muted)]">
                  每日報告
                </span>
              </div>

              <p className="mt-6 text-sm font-medium text-[var(--accent)]">
                去找萌蛋 →
              </p>
            </div>

            <div className="relative min-h-48 border-t border-[var(--border)] sm:min-h-56 sm:border-l sm:border-t-0">
              <Image
                src="/pet/pet00.png"
                alt={dashboard.pet.name}
                fill
                sizes="(max-width: 640px) 100vw, 224px"
                className="object-contain p-5 transition duration-300 group-hover:scale-[1.03]"
              />
            </div>
          </Link>
        </section>

        {/* Quick access */}

        <section className="mt-14">
          <SectionHeader eyebrow="Quick access" title="其他地方" />

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="
                    group
                    rounded-2xl
                    border
                    border-[var(--border)]
                    bg-[var(--surface)]
                    p-4
                    transition
                    hover:-translate-y-0.5
                    hover:border-[var(--foreground)]
                  "
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-story text-lg font-semibold">
                    {item.title}
                  </p>

                  <span
                    aria-hidden="true"
                    className="text-xs text-[var(--muted)] transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </div>

                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                  {item.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <footer className="mt-16 border-t border-[var(--border)] py-8 text-center">
          <p className="text-xs text-[var(--muted)]">An & Yao</p>
        </footer>
      </main>
    </AppShell>
  );
}
