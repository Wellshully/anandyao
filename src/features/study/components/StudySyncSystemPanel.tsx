
import {
  requireSystemOwner,
} from "@/lib/system/require-system-owner";

import "server-only";

import Link from "next/link";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

function formatTime(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "zh-TW",
    {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    },
  ).format(new Date(value));
}

export async function StudySyncSystemPanel() {
  await requireSystemOwner();

  const supabase =
    createAdminClient();

  const {
    data: runs,
    error,
  } = await supabase
    .from("study_sync_runs")
    .select(`
      id,
      user_id,
      provider,
      trigger_source,
      status,
      courses_count,
      assignments_count,
      announcements_count,
      started_at,
      finished_at,
      error_message
    `)
    .order("started_at", {
      ascending: false,
    })
    .limit(20);

  if (error) {
    throw new Error(
      `Failed to load Study sync history: ${error.message}`,
    );
  }

  const userIds =
    Array.from(
      new Set(
        (runs ?? []).map(
          (run) => run.user_id,
        ),
      ),
    );

  const profileMap =
    new Map<
      string,
      string
    >();

  if (userIds.length > 0) {
    const {
      data: profiles,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(`
        id,
        display_name
      `)
      .in("id", userIds);

    if (profileError) {
      throw new Error(
        `Failed to load Study sync profiles: ${profileError.message}`,
      );
    }

    for (
      const profile of
      profiles ?? []
    ) {
      profileMap.set(
        profile.id,
        profile.display_name ??
          profile.id,
      );
    }
  }

  const successCount =
    (runs ?? []).filter(
      (run) =>
        run.status ===
        "success",
    ).length;

  const errorCount =
    (runs ?? []).filter(
      (run) =>
        run.status ===
        "error",
    ).length;

  const runningCount =
    (runs ?? []).filter(
      (run) =>
        run.status ===
        "running",
    ).length;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">
          Study Sync
        </h2>

        <Link
          href="/system/study-sync"
          className="text-sm underline"
        >
          Full history
        </Link>
      </div>

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <div className="text-sm opacity-70">
            Recent success
          </div>

          <div className="mt-2 text-2xl font-semibold">
            {successCount}
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="text-sm opacity-70">
            Recent errors
          </div>

          <div className="mt-2 text-2xl font-semibold">
            {errorCount}
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="text-sm opacity-70">
            Running
          </div>

          <div className="mt-2 text-2xl font-semibold">
            {runningCount}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b">
              <tr>
                <th className="p-3">
                  User
                </th>

                <th className="p-3">
                  Provider
                </th>

                <th className="p-3">
                  Trigger
                </th>

                <th className="p-3">
                  Status
                </th>

                <th className="p-3">
                  Courses
                </th>

                <th className="p-3">
                  Assignments
                </th>

                <th className="p-3">
                  Announcements
                </th>

                <th className="p-3">
                  Started
                </th>

                <th className="p-3">
                  Finished
                </th>

                <th className="p-3">
                  Error
                </th>
              </tr>
            </thead>

            <tbody>
              {(runs ?? []).map(
                (run) => (
                  <tr
                    key={run.id}
                    className="border-b last:border-b-0"
                  >
                    <td className="p-3">
                      {profileMap.get(
                        run.user_id,
                      ) ??
                        run.user_id}
                    </td>

                    <td className="p-3">
                      {run.provider}
                    </td>

                    <td className="p-3">
                      {
                        run.trigger_source
                      }
                    </td>

                    <td className="p-3">
                      {run.status}
                    </td>

                    <td className="p-3">
                      {
                        run.courses_count
                      }
                    </td>

                    <td className="p-3">
                      {
                        run.assignments_count
                      }
                    </td>

                    <td className="p-3">
                      {
                        run.announcements_count
                      }
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      {formatTime(
                        run.started_at,
                      )}
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      {formatTime(
                        run.finished_at,
                      )}
                    </td>

                    <td className="max-w-md p-3">
                      {run.error_message ? (
                        <span className="break-words">
                          {
                            run.error_message
                          }
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ),
              )}

              {(runs ?? []).length ===
                0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="p-6 text-center opacity-60"
                  >
                    No Study sync runs
                    yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
