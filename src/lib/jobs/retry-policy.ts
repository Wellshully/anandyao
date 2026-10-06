const RETRY_DELAYS_MS = [
  5 * 1000,
  30 * 1000,
  2 * 60 * 1000,
  10 * 60 * 1000,
  30 * 60 * 1000,
] as const;

/*
 * attempts is incremented when a worker claims
 * a job.
 *
 * attempt 1 failure -> 5 seconds
 * attempt 2 failure -> 30 seconds
 * attempt 3 failure -> 2 minutes
 * attempt 4 failure -> 10 minutes
 * attempt 5+       -> 30 minutes
 *
 * Usually max_attempts will stop the job before
 * the final fallback is needed.
 */
export function getRetryDelayMs(
  attempts: number,
) {
  if (
    !Number.isInteger(attempts) ||
    attempts <= 0
  ) {
    throw new Error(
      "Job attempts must be a positive integer.",
    );
  }

  const index = Math.min(
    attempts - 1,
    RETRY_DELAYS_MS.length - 1,
  );

  return RETRY_DELAYS_MS[index];
}
