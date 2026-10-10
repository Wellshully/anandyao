import "server-only";

import {
  getConfiguredStudyUserIds,
} from "@/features/study/lib/get-study-credentials";

import {
  enqueueJob,
} from "@/lib/jobs/enqueue-job";

import {
  getStudyMailSyncBucket,
  getStudyMailSyncIdempotencyKey,
} from "./mail-sync-job-policy";

export async function enqueueConfiguredStudyMailSyncJobs(
  now = new Date(),
) {
  const userIds = [
    ...new Set(getConfiguredStudyUserIds()),
  ];

  const bucket = getStudyMailSyncBucket(now);

  const jobs = [];

  for (const userId of userIds) {
    const result = await enqueueJob({
      jobType: "study.mail-sync",

      payload: {
        userId,
      },

      maxAttempts: 5,

      idempotencyKey:
        getStudyMailSyncIdempotencyKey(
          userId,
          now,
        ),
    });

    jobs.push({
      userId,
      jobId: result.job.id,
      status: result.job.status,
      created: result.created,
    });
  }

  return {
    bucket,
    jobs,
  };
}
