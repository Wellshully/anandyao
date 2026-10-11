import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

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
  const supabase = createAdminClient();

  for (const userId of userIds) {
    /*
     * A periodic poll needs at most one outstanding
     * Mail sync job per user.
     *
     * Do not enqueue another poll while an older
     * poll is still pending or running.
     */
    const { data: existing, error: existingError } =
      await supabase
        .from("background_jobs")
        .select("id")
        .eq("job_type", "study.mail-sync")
        .in("status", ["pending", "running"])
        .contains("payload", { userId })
        .limit(1);

    if (existingError) {
      throw new Error(
        `Failed to inspect pending Mail sync jobs: ${existingError.message}`,
      );
    }

    if (existing && existing.length > 0) {
      continue;
    }

    const result = await enqueueJob({
      jobType: "study.mail-sync",

      payload: {
        userId,
      },

      /*
       * Cron polls again every five minutes.
       * Retrying this poll five times would
       * amplify intermittent POP3 timeouts.
       */
      maxAttempts: 1,

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
