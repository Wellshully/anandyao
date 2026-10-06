import "server-only";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  getRetryDelayMs,
} from "@/lib/jobs/retry-policy";

import type {
  BackgroundJob,
} from "@/lib/jobs/types";

const MAX_ERROR_LENGTH = 4000;

export type FailJobInput = {
  job: BackgroundJob;
  workerId: string;
  cause: unknown;
};

export type FailJobResult = {
  job: BackgroundJob;

  willRetry: boolean;

  retryAt: string | null;
};

function getErrorMessage(
  cause: unknown,
) {
  const message =
    cause instanceof Error
      ? cause.stack ||
        cause.message
      : String(cause);

  return message.slice(
    0,
    MAX_ERROR_LENGTH,
  );
}

export async function failJob({
  job,
  workerId,
  cause,
}: FailJobInput): Promise<
  FailJobResult
> {
  const normalizedWorkerId =
    workerId.trim();

  if (!normalizedWorkerId) {
    throw new Error(
      "Worker ID must not be empty.",
    );
  }

  if (job.status !== "running") {
    throw new Error(
      "Only a running job can fail.",
    );
  }

  if (
    job.locked_by !==
    normalizedWorkerId
  ) {
    throw new Error(
      "Background job is not owned by this worker.",
    );
  }

  const now = new Date();

  const exhausted =
    job.attempts >=
    job.max_attempts;

  const retryAt =
    exhausted
      ? null
      : new Date(
          now.getTime() +
            getRetryDelayMs(
              job.attempts,
            ),
        ).toISOString();

  const supabase =
    createAdminClient();

  const {
    data,
    error,
  } = await supabase
    .from("background_jobs")
    .update(
      exhausted
        ? {
            status: "dead",

            finished_at:
              now.toISOString(),

            locked_at: null,
            locked_by: null,

            last_error:
              getErrorMessage(
                cause,
              ),

            updated_at:
              now.toISOString(),
          }
        : {
            status: "pending",

            run_at:
              retryAt!,

            /*
             * The previous attempt has ended.
             *
             * A future claim will set a new
             * started_at value.
             */
            started_at: null,
            finished_at: null,

            locked_at: null,
            locked_by: null,

            last_error:
              getErrorMessage(
                cause,
              ),

            updated_at:
              now.toISOString(),
          },
    )
    .eq(
      "id",
      job.id,
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
      `Failed to update failed background job: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      "Background job failure could not be recorded because it is no longer owned by this worker.",
    );
  }

  return {
    job: data,

    willRetry:
      !exhausted,

    retryAt,
  };
}
