import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import { requireUser } from "@/lib/auth/require-user";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",

  year: "numeric",

  month: "2-digit",

  day: "2-digit",

  hour: "2-digit",

  minute: "2-digit",

  second: "2-digit",

  hour12: false,
});

function getAccountName(userId: string) {
  if (userId === process.env.STUDY_YAO_USER_ID) {
    return "堯";
  }

  if (userId === process.env.STUDY_AN_USER_ID) {
    return "安";
  }

  return "Unknown";
}

function getTriggerLabel(trigger: string) {
  if (trigger === "background") {
    return "背景同步";
  }

  return "App 同步";
}

function getStatusLabel(status: string) {
  if (status === "success") {
    return "成功";
  }

  if (status === "error") {
    return "失敗";
  }

  return "進行中";
}

export default async function StudySyncHistoryPage() {
  const [supabase, user, space] = await Promise.all([
    createClient(),
    requireUser(),
    requireSpace(),
  ]);

  const {
    data: membership,

    error: membershipError,
  } = await supabase
    .from("space_members")
    .select("role")
    .eq("space_id", space.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || membership?.role !== "owner") {
    notFound();
  }

  const {
    data: runs,

    error,
  } = await supabase
    .from("study_sync_runs")
    .select(
      `
          id,
          user_id,
          trigger_source,
          status,
          courses_count,
          assignments_count,
          announcements_count,
          error_message,
          started_at,
          finished_at
        `,
    )
    .eq("provider", "cool")
    .order("started_at", {
      ascending: false,
    })
    .limit(100);

  if (error) {
    throw new Error(`Failed to load COOL sync history: ${error.message}`);
  }

  return (
    <div className="mx-auto w-full max-w-4xl py-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
          Study
        </p>

        <h1 className="mt-2 font-story text-3xl font-semibold">
          COOL Sync History
        </h1>

        <p className="mt-2 text-sm text-[var(--muted)]">
          最近 100 次 COOL 同步紀錄。
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
        {runs.length === 0 ? (
          <div className="p-8 text-sm text-[var(--muted)]">
            還沒有同步紀錄。
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {runs.map((run) => (
              <div key={run.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {getAccountName(run.user_id)}
                      </p>

                      <span className="text-xs text-[var(--muted)]">
                        {getTriggerLabel(run.trigger_source)}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {dateTimeFormatter.format(new Date(run.started_at))}
                    </p>
                  </div>

                  <span className="text-xs font-medium">
                    {getStatusLabel(run.status)}
                  </span>
                </div>

                {run.status === "success" && (
                  <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-[var(--muted)]">Courses</p>

                      <p className="mt-1 font-medium">{run.courses_count}</p>
                    </div>

                    <div>
                      <p className="text-[var(--muted)]">Assignments</p>

                      <p className="mt-1 font-medium">
                        {run.assignments_count}
                      </p>
                    </div>

                    <div>
                      <p className="text-[var(--muted)]">Announcements</p>

                      <p className="mt-1 font-medium">
                        {run.announcements_count}
                      </p>
                    </div>
                  </div>
                )}

                {run.error_message && (
                  <p className="mt-4 break-words rounded-xl bg-[var(--surface-soft)] p-3 text-xs text-[var(--danger)]">
                    {run.error_message}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
