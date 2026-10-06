import type {
  Database,
  Json,
} from "@/types/database";

export type BackgroundJob =
  Database["public"]["Tables"]["background_jobs"]["Row"];

export type BackgroundJobInsert =
  Database["public"]["Tables"]["background_jobs"]["Insert"];

export type BackgroundJobStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "dead"
  | "cancelled";

export type EnqueueJobInput = {
  jobType: string;

  payload?: Json;

  priority?: number;

  /*
   * Earliest time this job may run.
   *
   * If omitted, PostgreSQL's default now()
   * is used.
   */
  runAt?: Date | string;

  maxAttempts?: number;

  /*
   * Same logical operation should use the
   * same key.
   *
   * Example:
   * study-sync:2026-10-02T18
   */
  idempotencyKey?: string;
};

export type EnqueueJobResult = {
  job: BackgroundJob;

  /*
   * false means a job with the same
   * idempotency key already existed.
   */
  created: boolean;
};
