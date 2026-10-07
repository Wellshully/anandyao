
import {
  requireSystemOwner,
} from "@/lib/system/require-system-owner";

import Link from "next/link";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const dynamic =
  "force-dynamic";

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

export default async function SystemStudySyncPage() {
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
    .limit(100);

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
    new Map<string, string>();

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

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <Link
          href="/system"
          className="text-sm underline"
        >
          ← System
        </Link>

        <h1 className="mt-4 text-2xl font-semibold">
          Study Sync History
        </h1>

        <p className="mt-2 text-sm opacity-70">
          Recent NTU COOL synchronization
          attempts and results.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-sm">
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

                    <td className="max-w-lg p-3">
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
                    No Study sync history.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
