import "server-only";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import type {
  BackgroundJob,
} from "@/lib/jobs/types";

const DEFAULT_RECOVERY_LIMIT = 50;
const MAX_RECOVERY_LIMIT = 50;

export type RecoverStaleJobsInput = {
  /*
   * How long a running job may remain without
   * completing before we consider its worker
   * to have disappeared.
   *
   * Example:
   *
   * 15 * 60 * 1000
   * = 15 minutes
   */
  staleForMs: number;

  limit?: number;
};

export type RecoverStaleJobsResult = {
  cutoff: string;

  recovered: number;
  requeued: number;
  dead: number;

  jobs: BackgroundJob[];
};

function validateStaleForMs(
  staleForMs: number,
) {
  if (
    !Number.isFinite(staleForMs) ||
    !Number.isInteger(staleForMs) ||
    staleForMs <= 0
  ) {
    throw new Error(
      "staleForMs must be a positive integer.",
    );
  }

  return staleForMs;
}

function validateLimit(
  limit: number,
) {
  if (
    !Number.isInteger(limit) ||
    limit <= 0 ||
    limit > MAX_RECOVERY_LIMIT
  ) {
    throw new Error(
      `Stale job recovery limit must be an integer between 1 and ${MAX_RECOVERY_LIMIT}.`,
    );
  }

  return limit;
}

export async function recoverStaleJobs({
  staleForMs,
  limit = DEFAULT_RECOVERY_LIMIT,
}: RecoverStaleJobsInput): Promise<
  RecoverStaleJobsResult
> {
  validateStaleForMs(
    staleForMs,
  );

  validateLimit(
    limit,
  );

  const cutoff =
    new Date(
      Date.now() - staleForMs,
    ).toISOString();

  const supabase =
    createAdminClient();

  const {
    data,
    error,
  } = await supabase.rpc(
    "recover_stale_background_jobs",
    {
      p_stale_before:
        cutoff,

      p_limit:
        limit,
    },
  );

  if (error) {
    throw new Error(
      `Failed to recover stale background jobs: ${error.message}`,
    );
  }

  const jobs =
    data ?? [];

  const requeued =
    jobs.filter(
      (job) =>
        job.status === "pending",
    ).length;

  const dead =
    jobs.filter(
      (job) =>
        job.status === "dead",
    ).length;

  return {
    cutoff,

    recovered:
      jobs.length,

    requeued,

    dead,

    jobs,
  };
}
