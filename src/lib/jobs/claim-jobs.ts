import "server-only";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import type {
  BackgroundJob,
} from "@/lib/jobs/types";

const DEFAULT_CLAIM_LIMIT = 10;
const MAX_CLAIM_LIMIT = 50;

export type ClaimJobsInput = {
  workerId: string;
  limit?: number;
};

function validateWorkerId(
  workerId: string,
) {
  const normalized =
    workerId.trim();

  if (!normalized) {
    throw new Error(
      "Worker ID must not be empty.",
    );
  }

  return normalized;
}

function validateLimit(
  limit: number,
) {
  if (
    !Number.isInteger(limit) ||
    limit <= 0 ||
    limit > MAX_CLAIM_LIMIT
  ) {
    throw new Error(
      `Job claim limit must be an integer between 1 and ${MAX_CLAIM_LIMIT}.`,
    );
  }

  return limit;
}

export async function claimJobs({
  workerId,
  limit = DEFAULT_CLAIM_LIMIT,
}: ClaimJobsInput): Promise<
  BackgroundJob[]
> {
  const normalizedWorkerId =
    validateWorkerId(workerId);

  validateLimit(limit);

  const supabase =
    createAdminClient();

  const {
    data,
    error,
  } = await supabase.rpc(
    "claim_background_jobs",
    {
      p_worker_id:
        normalizedWorkerId,

      p_limit:
        limit,
    },
  );

  if (error) {
    throw new Error(
      `Failed to claim background jobs: ${error.message}`,
    );
  }

  return data ?? [];
}
