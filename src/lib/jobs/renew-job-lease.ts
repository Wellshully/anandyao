import "server-only";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import type {
  BackgroundJob,
} from "@/lib/jobs/types";

export type RenewJobLeaseInput = {
  jobId: string;
  workerId: string;
};

/*
 * Refresh the lease of a running job.
 *
 * locked_at is treated as the worker's latest
 * heartbeat timestamp.
 *
 * The update succeeds only while this exact
 * worker still owns the job.
 */
export async function renewJobLease({
  jobId,
  workerId,
}: RenewJobLeaseInput): Promise<
  BackgroundJob
> {
  const normalizedJobId =
    jobId.trim();

  const normalizedWorkerId =
    workerId.trim();

  if (!normalizedJobId) {
    throw new Error(
      "Job ID must not be empty.",
    );
  }

  if (!normalizedWorkerId) {
    throw new Error(
      "Worker ID must not be empty.",
    );
  }

  const now =
    new Date().toISOString();

  const supabase =
    createAdminClient();

  const {
    data,
    error,
  } = await supabase
    .from("background_jobs")
    .update({
      locked_at: now,
      updated_at: now,
    })
    .eq(
      "id",
      normalizedJobId,
    )
    .eq(
      "status",
      "running",
    )
    .eq(
      "locked_by",
      normalizedWorkerId,
    )
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to renew background job lease: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      "Background job lease could not be renewed because it is no longer owned by this worker.",
    );
  }

  return data;
}
