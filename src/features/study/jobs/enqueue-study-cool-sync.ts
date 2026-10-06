import "server-only";

import {
  getConfiguredStudyUserIds,
} from "@/features/study/lib/get-study-credentials";

import {
  enqueueJob,
} from "@/lib/jobs/enqueue-job";

const COOL_SYNC_BUCKET_MS =
  6 * 60 * 60 * 1000;

function getSyncBucket(
  now: Date,
) {
  const timestamp =
    Math.floor(
      now.getTime() /
        COOL_SYNC_BUCKET_MS,
    ) *
    COOL_SYNC_BUCKET_MS;

  return new Date(
    timestamp,
  ).toISOString();
}

export async function enqueueConfiguredStudyCoolSyncJobs(
  now = new Date(),
) {
  const userIds =
    getConfiguredStudyUserIds();

  const bucket =
    getSyncBucket(now);

  const jobs = [];

  for (const userId of userIds) {
    const result =
      await enqueueJob({
        jobType:
          "study.cool-sync",

        payload: {
          userId,
        },

        /*
         * External services can temporarily
         * fail, so COOL sync benefits from the
         * normal queue retry policy.
         */
        maxAttempts: 5,

        /*
         * One logical sync per user per
         * six-hour cron window.
         *
         * Repeated HTTP requests in the same
         * window therefore do not create
         * duplicate sync jobs.
         */
        idempotencyKey:
          [
            "study.cool-sync",
            userId,
            bucket,
          ].join(":"),
      });

    jobs.push({
      userId,

      jobId:
        result.job.id,

      status:
        result.job.status,

      created:
        result.created,
    });
  }

  return {
    bucket,
    jobs,
  };
}
