import "server-only";

import {
  renewJobLease,
} from "@/lib/jobs/renew-job-lease";

const DEFAULT_HEARTBEAT_INTERVAL_MS =
  60 * 1000;

export type StartJobHeartbeatInput = {
  jobId: string;
  workerId: string;
  intervalMs?: number;
};

function validateHeartbeatInterval(
  intervalMs: number,
) {
  if (
    !Number.isInteger(intervalMs) ||
    intervalMs <= 0
  ) {
    throw new Error(
      "Job heartbeat interval must be a positive integer.",
    );
  }
}

/*
 * Start periodically renewing a running job's
 * lease.
 *
 * Only one heartbeat request may be in flight
 * at a time. This avoids overlapping renewals
 * if the database is temporarily slow.
 *
 * Heartbeat failures are logged rather than
 * thrown from the timer callback.
 *
 * Ownership is still enforced by
 * renewJobLease().
 */
export function startJobHeartbeat({
  jobId,
  workerId,
  intervalMs =
    DEFAULT_HEARTBEAT_INTERVAL_MS,
}: StartJobHeartbeatInput) {
  validateHeartbeatInterval(
    intervalMs,
  );

  let stopped = false;

  let inFlight:
    | Promise<void>
    | null = null;

  function heartbeat() {
    if (
      stopped ||
      inFlight
    ) {
      return;
    }

    inFlight =
      renewJobLease({
        jobId,
        workerId,
      })
        .then(() => {
          console.debug(
            `[jobs] lease renewed for ${jobId} by ${workerId}`,
          );
        })
        .catch((cause) => {
          console.warn(
            `[jobs] failed to renew lease for ${jobId}:`,
            cause instanceof Error
              ? cause.message
              : String(cause),
          );
        })
        .finally(() => {
          inFlight = null;
        });
  }

  const timer =
    setInterval(
      heartbeat,
      intervalMs,
    );

  /*
   * Stop future heartbeats and wait for any
   * renewal already in progress.
   *
   * Waiting here prevents a heartbeat request
   * from racing unnecessarily with
   * completeJob() / failJob().
   */
  return async function stopHeartbeat() {
    stopped = true;

    clearInterval(timer);

    if (inFlight) {
      await inFlight;
    }
  };
}
