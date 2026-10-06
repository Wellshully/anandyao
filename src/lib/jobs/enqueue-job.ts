import "server-only";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import type {
  BackgroundJobInsert,
  EnqueueJobInput,
  EnqueueJobResult,
} from "@/lib/jobs/types";

function normalizeRunAt(
  value: Date | string,
) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "enqueueJob received an invalid runAt value.",
    );
  }

  return date.toISOString();
}

function validatePriority(
  priority: number,
) {
  if (
    !Number.isInteger(priority) ||
    priority < -32768 ||
    priority > 32767
  ) {
    throw new Error(
      "Job priority must be a valid PostgreSQL smallint.",
    );
  }
}

function validateMaxAttempts(
  maxAttempts: number,
) {
  if (
    !Number.isInteger(maxAttempts) ||
    maxAttempts <= 0
  ) {
    throw new Error(
      "Job maxAttempts must be a positive integer.",
    );
  }
}

export async function enqueueJob(
  input: EnqueueJobInput,
): Promise<EnqueueJobResult> {
  const jobType = input.jobType.trim();

  if (!jobType) {
    throw new Error(
      "Job type must not be empty.",
    );
  }

  const priority =
    input.priority ?? 0;

  const maxAttempts =
    input.maxAttempts ?? 5;

  validatePriority(priority);
  validateMaxAttempts(maxAttempts);

  const idempotencyKey =
    input.idempotencyKey?.trim();

  if (
    input.idempotencyKey !== undefined &&
    !idempotencyKey
  ) {
    throw new Error(
      "Job idempotency key must not be empty.",
    );
  }

  const row: BackgroundJobInsert = {
    job_type: jobType,

    payload: input.payload ?? {},

    priority,

    max_attempts: maxAttempts,

    ...(input.runAt
      ? {
          run_at:
            normalizeRunAt(
              input.runAt,
            ),
        }
      : {}),

    ...(idempotencyKey
      ? {
          idempotency_key:
            idempotencyKey,
        }
      : {}),
  };

  const supabase =
    createAdminClient();

  const {
    data,
    error,
  } = await supabase
    .from("background_jobs")
    .insert(row)
    .select("*")
    .single();

  if (!error) {
    return {
      job: data,
      created: true,
    };
  }

  /*
   * PostgreSQL unique violation.
   *
   * When an idempotency key already exists,
   * this is not an application failure.
   *
   * Return the existing durable job instead.
   */
  if (
    error.code === "23505" &&
    idempotencyKey
  ) {
    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from("background_jobs")
      .select("*")
      .eq(
        "idempotency_key",
        idempotencyKey,
      )
      .maybeSingle();

    if (existingError) {
      throw new Error(
        `Failed to load existing background job: ${existingError.message}`,
      );
    }

    if (!existing) {
      /*
       * This should be extremely unusual.
       *
       * We received a uniqueness conflict but
       * could not observe the conflicting row.
       */
      throw new Error(
        "Background job idempotency conflict occurred, but the existing job could not be loaded.",
      );
    }

    return {
      job: existing,
      created: false,
    };
  }

  throw new Error(
    `Failed to enqueue background job: ${error.message}`,
  );
}
