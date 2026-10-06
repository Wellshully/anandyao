import Link from "next/link";

import {
  getJobQueueOverview,
} from "@/lib/jobs/get-job-queue-overview";

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
      timeZone:
        "Asia/Taipei",

      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    },
  ).format(
    new Date(value),
  );
}

export default async function SystemPage() {
  const overview =
    await getJobQueueOverview();

  const metrics = [
    [
      "Pending",
      overview.counts.pending,
    ],
    [
      "Due now",
      overview.counts.due,
    ],
    [
      "Retrying",
      overview.counts.retrying,
    ],
    [
      "Running",
      overview.counts.running,
    ],
    [
      "Succeeded",
      overview.counts.succeeded,
    ],
    [
      "Dead",
      overview.counts.dead,
    ],
  ] as const;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          System
        </h1>

        <p className="mt-2 text-sm opacity-70">
          Background jobs and system
          observability.
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold">
          Job Queue
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(
            ([label, value]) => (
              <div
                key={label}
                className="rounded-xl border p-4"
              >
                <div className="text-sm opacity-70">
                  {label}
                </div>

                <div className="mt-2 text-2xl font-semibold">
                  {value}
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">
            Recent jobs
          </h2>

          <Link
            href="/study/sync-history"
            className="text-sm underline"
          >
            Study sync history
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b">
              <tr>
                <th className="p-3">
                  Job
                </th>

                <th className="p-3">
                  Status
                </th>

                <th className="p-3">
                  Attempts
                </th>

                <th className="p-3">
                  Run at
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
              {overview.recentJobs.map(
                (job) => (
                  <tr
                    key={job.id}
                    className="border-b last:border-b-0"
                  >
                    <td className="p-3">
                      <div className="font-medium">
                        {job.jobType}
                      </div>

                      <div className="font-mono text-xs opacity-60">
                        {job.id}
                      </div>
                    </td>

                    <td className="p-3">
                      {job.status}
                    </td>

                    <td className="p-3">
                      {job.attempts}
                      {" / "}
                      {job.maxAttempts}
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      {formatTime(
                        job.runAt,
                      )}
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      {formatTime(
                        job.startedAt,
                      )}
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      {formatTime(
                        job.finishedAt,
                      )}
                    </td>

                    <td className="max-w-md p-3">
                      {job.lastError ? (
                        <span className="break-words">
                          {job.lastError}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ),
              )}

              {overview.recentJobs.length ===
                0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-6 text-center opacity-60"
                  >
                    No background jobs yet.
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
