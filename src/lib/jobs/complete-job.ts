import "server-only";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import type {
  BackgroundJob,
} from "@/lib/jobs/types";

export type CompleteJobInput = {
  jobId: string;
  workerId: string;
};

export async function completeJob({
  jobId,
  workerId,
}: CompleteJobInput): Promise<
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
      status: "succeeded",

      finished_at: now,

      locked_at: null,
      locked_by: null,

      last_error: null,

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
      `Failed to complete background job: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      "Background job could not be completed because it is no longer owned by this worker.",
    );
  }

  return data;
}
