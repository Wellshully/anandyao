import "server-only";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

const WORKER_NAME =
  "background-job-worker";

export async function markWorkerStarted(
  workerId: string,
) {
  const supabase =
    createAdminClient();

  const now =
    new Date().toISOString();

  const { error } =
    await supabase
      .from("background_worker_health")
      .upsert(
        {
          worker_name:
            WORKER_NAME,

          last_started_at:
            now,

          last_worker_id:
            workerId,

          updated_at:
            now,
        },
        {
          onConflict:
            "worker_name",
        },
      );

  if (error) {
    throw new Error(
      `Failed to mark worker start: ${error.message}`,
    );
  }
}

type MarkWorkerSucceededInput = {
  workerId: string;

  recovery: {
    recovered: number;
    requeued: number;
    dead: number;
  };

  worker: {
    claimed: number;
    succeeded: number;
    retrying: number;
    dead: number;
  };
};

export async function markWorkerSucceeded({
  workerId,
  recovery,
  worker,
}: MarkWorkerSucceededInput) {
  const supabase =
    createAdminClient();

  const now =
    new Date().toISOString();

  const { error } =
    await supabase
      .from("background_worker_health")
      .update({
        last_finished_at:
          now,

        last_success_at:
          now,

        last_worker_id:
          workerId,

        last_recovered:
          recovery.recovered,

        last_requeued:
          recovery.requeued,

        last_recovery_dead:
          recovery.dead,

        last_claimed:
          worker.claimed,

        last_succeeded:
          worker.succeeded,

        last_retrying:
          worker.retrying,

        last_dead:
          worker.dead,

        last_error:
          null,

        updated_at:
          now,
      })
      .eq(
        "worker_name",
        WORKER_NAME,
      );

  if (error) {
    throw new Error(
      `Failed to mark worker success: ${error.message}`,
    );
  }
}

export async function markWorkerFailed({
  workerId,
  cause,
}: {
  workerId: string;
  cause: unknown;
}) {
  const supabase =
    createAdminClient();

  const now =
    new Date().toISOString();

  const message =
    cause instanceof Error
      ? cause.stack ??
        cause.message
      : String(cause);

  const { error } =
    await supabase
      .from("background_worker_health")
      .update({
        last_finished_at:
          now,

        last_worker_id:
          workerId,

        last_error:
          message.slice(
            0,
            4000,
          ),

        updated_at:
          now,
      })
      .eq(
        "worker_name",
        WORKER_NAME,
      );

  if (error) {
    console.error(
      "Failed to persist worker failure:",
      error.message,
    );
  }
}
