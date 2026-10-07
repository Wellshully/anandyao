import Link from "next/link";

import {
  getJobQueueOverview,
} from "@/lib/jobs/get-job-queue-overview";

import {
  StudySyncSystemPanel,
} from "@/features/study/components/StudySyncSystemPanel";

import {
  ProjectUsageSystemPanel,
} from "@/features/profile/components/ProjectUsageSystemPanel";

export const dynamic =
  "force-dynamic";

const WORKER_STALE_MS =
  3 * 60 * 1000;

const WORKER_STUCK_MS =
  15 * 60 * 1000;

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

function formatAge(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  const ageMs =
    Date.now() -
    new Date(value).getTime();

  if (ageMs < 0) {
    return "剛剛";
  }

  const seconds =
    Math.floor(
      ageMs / 1000,
    );

  if (seconds < 60) {
    return `${seconds} 秒前`;
  }

  const minutes =
    Math.floor(
      seconds / 60,
    );

  if (minutes < 60) {
    return `${minutes} 分鐘前`;
  }

  const hours =
    Math.floor(
      minutes / 60,
    );

  return `${hours} 小時前`;
}

type WorkerStatus =
  | "healthy"
  | "running"
  | "stale"
  | "stuck"
  | "error"
  | "unknown";

function getWorkerStatus(
  health:
    | Awaited<
        ReturnType<
          typeof getJobQueueOverview
        >
      >["workerHealth"]
    | null,
): WorkerStatus {
  if (!health) {
    return "unknown";
  }

  const startedAt =
    health.lastStartedAt
      ? new Date(
          health.lastStartedAt,
        ).getTime()
      : null;

  const finishedAt =
    health.lastFinishedAt
      ? new Date(
          health.lastFinishedAt,
        ).getTime()
      : null;

  const running =
    startedAt !== null &&
    (finishedAt === null ||
      startedAt >
        finishedAt);

  if (running) {
    const age =
      Date.now() -
      startedAt;

    if (
      age >
      WORKER_STUCK_MS
    ) {
      return "stuck";
    }

    return "running";
  }

  if (health.lastError) {
    return "error";
  }

  if (!health.lastSuccessAt) {
    return "unknown";
  }

  const successAge =
    Date.now() -
    new Date(
      health.lastSuccessAt,
    ).getTime();

  if (
    successAge >
    WORKER_STALE_MS
  ) {
    return "stale";
  }

  return "healthy";
}

const statusLabels:
  Record<
    WorkerStatus,
    string
  > = {
  healthy: "Healthy",
  running: "Running",
  stale: "Stale",
  stuck: "Stuck",
  error: "Error",
  unknown: "Unknown",
};

const statusStyles:
  Record<
    WorkerStatus,
    string
  > = {
  healthy:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",

  running:
    "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",

  stale:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",

  stuck:
    "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",

  error:
    "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",

  unknown:
    "border-border bg-muted/40",
};

export default async function SystemPage() {
  const overview =
    await getJobQueueOverview();

  const workerStatus =
    getWorkerStatus(
      overview.workerHealth,
    );

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

      <ProjectUsageSystemPanel />

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">
            Worker Health
          </h2>

          <span
            className={`rounded-full border px-3 py-1 text-sm font-medium ${statusStyles[workerStatus]}`}
          >
            {
              statusLabels[
                workerStatus
              ]
            }
          </span>
        </div>

        {overview.workerHealth ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border p-4">
              <div className="text-sm opacity-70">
                Last success
              </div>

              <div className="mt-2 font-medium">
                {formatAge(
                  overview
                    .workerHealth
                    .lastSuccessAt,
                )}
              </div>

              <div className="mt-1 text-xs opacity-60">
                {formatTime(
                  overview
                    .workerHealth
                    .lastSuccessAt,
                )}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-sm opacity-70">
                Last run
              </div>

              <div className="mt-2 font-medium">
                {
                  overview
                    .workerHealth
                    .lastClaimed
                }{" "}
                claimed
              </div>

              <div className="mt-1 text-xs opacity-60">
                {
                  overview
                    .workerHealth
                    .lastSucceeded
                }{" "}
                succeeded ·{" "}
                {
                  overview
                    .workerHealth
                    .lastRetrying
                }{" "}
                retrying ·{" "}
                {
                  overview
                    .workerHealth
                    .lastDead
                }{" "}
                dead
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-sm opacity-70">
                Recovery
              </div>

              <div className="mt-2 font-medium">
                {
                  overview
                    .workerHealth
                    .lastRecovered
                }{" "}
                recovered
              </div>

              <div className="mt-1 text-xs opacity-60">
                {
                  overview
                    .workerHealth
                    .lastRequeued
                }{" "}
                requeued ·{" "}
                {
                  overview
                    .workerHealth
                    .lastRecoveryDead
                }{" "}
                dead
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-sm opacity-70">
                Worker
              </div>

              <div className="mt-2 break-all font-mono text-xs">
                {overview
                  .workerHealth
                  .lastWorkerId ??
                  "—"}
              </div>

              <div className="mt-2 text-xs opacity-60">
                Started{" "}
                {formatTime(
                  overview
                    .workerHealth
                    .lastStartedAt,
                )}
              </div>

              <div className="text-xs opacity-60">
                Finished{" "}
                {formatTime(
                  overview
                    .workerHealth
                    .lastFinishedAt,
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border p-4 text-sm opacity-70">
            Worker health data is not
            available yet.
          </div>
        )}

        {overview.workerHealth
          ?.lastError && (
          <div className="mt-3 rounded-xl border border-red-500/30 p-4">
            <div className="text-sm font-medium">
              Last worker error
            </div>

            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs">
              {
                overview
                  .workerHealth
                  .lastError
              }
            </pre>
          </div>
        )}
      </section>

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

      <StudySyncSystemPanel />

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
                        {
                          job.jobType
                        }
                      </div>

                      <div className="font-mono text-xs opacity-60">
                        {job.id}
                      </div>
                    </td>

                    <td className="p-3">
                      {job.status}
                    </td>

                    <td className="p-3">
                      {
                        job.attempts
                      }
                      {" / "}
                      {
                        job.maxAttempts
                      }
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
                          {
                            job.lastError
                          }
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ),
              )}

              {overview
                .recentJobs
                .length ===
                0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-6 text-center opacity-60"
                  >
                    No background jobs
                    yet.
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
