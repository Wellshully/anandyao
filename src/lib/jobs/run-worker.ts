import "server-only";

import {
  claimJobs,
} from "@/lib/jobs/claim-jobs";

import {
  completeJob,
} from "@/lib/jobs/complete-job";

import {
  failJob,
} from "@/lib/jobs/fail-job";

import {
  getJobHandler,
} from "@/lib/jobs/job-handlers";

import {
  startJobHeartbeat,
} from "@/lib/jobs/job-heartbeat";

export type RunWorkerInput = {
  workerId: string;
  limit?: number;

  /*
   * Production default is controlled by
   * startJobHeartbeat().
   *
   * Keeping this configurable also lets our
   * development tests use a shorter interval.
   */
  heartbeatIntervalMs?: number;
};

export type WorkerJobResult = {
  jobId: string;
  jobType: string;

  outcome:
    | "succeeded"
    | "retrying"
    | "dead";

  attempts: number;

  retryAt?: string;
};

export type RunWorkerResult = {
  workerId: string;

  claimed: number;
  succeeded: number;
  retrying: number;
  dead: number;

  jobs: WorkerJobResult[];
};

export async function runWorker({
  workerId,
  /*
   * Until we have more production experience
   * with the queue, claim conservatively.
   */
  limit = 1,

  heartbeatIntervalMs,
}: RunWorkerInput): Promise<
  RunWorkerResult
> {
  const normalizedWorkerId =
    workerId.trim();

  if (!normalizedWorkerId) {
    throw new Error(
      "Worker ID must not be empty.",
    );
  }

  const jobs =
    await claimJobs({
      workerId:
        normalizedWorkerId,

      limit,
    });

  const result: RunWorkerResult = {
    workerId:
      normalizedWorkerId,

    claimed:
      jobs.length,

    succeeded: 0,
    retrying: 0,
    dead: 0,

    jobs: [],
  };

  for (const job of jobs) {
    const stopHeartbeat =
      startJobHeartbeat({
        jobId:
          job.id,

        workerId:
          normalizedWorkerId,

        ...(heartbeatIntervalMs !==
        undefined
          ? {
              intervalMs:
                heartbeatIntervalMs,
            }
          : {}),
      });

    let handlerFailed =
      false;

    let handlerCause:
      unknown = null;

    try {
      const handler =
        getJobHandler(
          job.job_type,
        );

      await handler(job);
    } catch (cause) {
      handlerFailed = true;
      handlerCause = cause;
    }

    /*
     * Stop lease renewal before changing the
     * terminal/retry state.
     *
     * This prevents an unnecessary heartbeat
     * from racing with completeJob/failJob.
     */
    await stopHeartbeat();

    if (!handlerFailed) {
      await completeJob({
        jobId:
          job.id,

        workerId:
          normalizedWorkerId,
      });

      result.succeeded += 1;

      result.jobs.push({
        jobId:
          job.id,

        jobType:
          job.job_type,

        outcome:
          "succeeded",

        attempts:
          job.attempts,
      });

      continue;
    }

    const failed =
      await failJob({
        job,

        workerId:
          normalizedWorkerId,

        cause:
          handlerCause,
      });

    if (
      failed.willRetry &&
      failed.retryAt
    ) {
      result.retrying += 1;

      result.jobs.push({
        jobId:
          job.id,

        jobType:
          job.job_type,

        outcome:
          "retrying",

        attempts:
          job.attempts,

        retryAt:
          failed.retryAt,
      });

      continue;
    }

    result.dead += 1;

    result.jobs.push({
      jobId:
        job.id,

      jobType:
        job.job_type,

      outcome:
        "dead",

      attempts:
        job.attempts,
    });
  }

  return result;
}
