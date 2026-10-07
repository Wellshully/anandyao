
import {
  requireSystemOwner,
} from "@/lib/system/require-system-owner";

import "server-only";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export type JobQueueOverview = {
  counts: {
    pending: number;
    due: number;
    retrying: number;
    running: number;
    succeeded: number;
    dead: number;
    cancelled: number;
  };

  workerHealth: {
    workerName: string;

    lastStartedAt: string | null;
    lastFinishedAt: string | null;
    lastSuccessAt: string | null;

    lastWorkerId: string | null;

    lastRecovered: number;
    lastRequeued: number;
    lastRecoveryDead: number;

    lastClaimed: number;
    lastSucceeded: number;
    lastRetrying: number;
    lastDead: number;

    lastError: string | null;

    updatedAt: string;
  } | null;

  recentJobs: Array<{
    id: string;
    jobType: string;
    status: string;

    attempts: number;
    maxAttempts: number;

    runAt: string;

    lockedBy: string | null;

    startedAt: string | null;
    finishedAt: string | null;

    lastError: string | null;

    createdAt: string;
    updatedAt: string;
  }>;
};

export async function getJobQueueOverview(): Promise<
  JobQueueOverview
> {
  await requireSystemOwner();

  const supabase =
    createAdminClient();

  const now =
    new Date().toISOString();

  const [
    pending,
    due,
    retrying,
    running,
    succeeded,
    dead,
    cancelled,
    health,
    recent,
  ] = await Promise.all([
    supabase
      .from("background_jobs")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "pending"),

    supabase
      .from("background_jobs")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "pending")
      .lte("run_at", now),

    supabase
      .from("background_jobs")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "pending")
      .gt("attempts", 0),

    supabase
      .from("background_jobs")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "running"),

    supabase
      .from("background_jobs")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "succeeded"),

    supabase
      .from("background_jobs")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "dead"),

    supabase
      .from("background_jobs")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "cancelled"),

    supabase
      .from("background_worker_health")
      .select("*")
      .eq(
        "worker_name",
        "background-job-worker",
      )
      .maybeSingle(),

    supabase
      .from("background_jobs")
      .select(`
        id,
        job_type,
        status,
        attempts,
        max_attempts,
        run_at,
        locked_by,
        started_at,
        finished_at,
        last_error,
        created_at,
        updated_at
      `)
      .order("created_at", {
        ascending: false,
      })
      .limit(50),
  ]);

  const queries = [
    pending,
    due,
    retrying,
    running,
    succeeded,
    dead,
    cancelled,
    health,
    recent,
  ];

  const failed =
    queries.find(
      (query) => query.error,
    );

  if (failed?.error) {
    throw new Error(
      `Failed to read background job system state: ${failed.error.message}`,
    );
  }

  return {
    counts: {
      pending:
        pending.count ?? 0,

      due:
        due.count ?? 0,

      retrying:
        retrying.count ?? 0,

      running:
        running.count ?? 0,

      succeeded:
        succeeded.count ?? 0,

      dead:
        dead.count ?? 0,

      cancelled:
        cancelled.count ?? 0,
    },

    workerHealth:
      health.data
        ? {
            workerName:
              health.data.worker_name,

            lastStartedAt:
              health.data.last_started_at,

            lastFinishedAt:
              health.data.last_finished_at,

            lastSuccessAt:
              health.data.last_success_at,

            lastWorkerId:
              health.data.last_worker_id,

            lastRecovered:
              health.data.last_recovered,

            lastRequeued:
              health.data.last_requeued,

            lastRecoveryDead:
              health.data.last_recovery_dead,

            lastClaimed:
              health.data.last_claimed,

            lastSucceeded:
              health.data.last_succeeded,

            lastRetrying:
              health.data.last_retrying,

            lastDead:
              health.data.last_dead,

            lastError:
              health.data.last_error,

            updatedAt:
              health.data.updated_at,
          }
        : null,

    recentJobs:
      (recent.data ?? []).map(
        (job) => ({
          id:
            job.id,

          jobType:
            job.job_type,

          status:
            job.status,

          attempts:
            job.attempts,

          maxAttempts:
            job.max_attempts,

          runAt:
            job.run_at,

          lockedBy:
            job.locked_by,

          startedAt:
            job.started_at,

          finishedAt:
            job.finished_at,

          lastError:
            job.last_error,

          createdAt:
            job.created_at,

          updatedAt:
            job.updated_at,
        }),
      ),
  };
}
