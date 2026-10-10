import "server-only";

import {
  syncNtuCoolForUser,
} from "@/features/study/lib/sync-ntu-cool";

import {
  syncNtuMailForUser,
} from "@/features/study/mail/sync-ntu-mail";

import type {
  BackgroundJob,
} from "@/lib/jobs/types";

export type JobHandler = (
  job: BackgroundJob,
) => Promise<void>;

function sleep(
  milliseconds: number,
) {
  return new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

function getPayloadString(
  job: BackgroundJob,
  field: string,
) {
  const payload =
    job.payload;

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new Error(
      `Job "${job.job_type}" requires an object payload.`,
    );
  }

  const value =
    payload[field];

  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `Job "${job.job_type}" requires payload.${field}.`,
    );
  }

  return value.trim();
}


/*
 * =========================================================
 * Infrastructure test handlers
 * =========================================================
 */

async function handleSystemTest(
  job: BackgroundJob,
) {
  if (job.attempts < 3) {
    throw new Error(
      `Intentional system.test failure on attempt ${job.attempts}.`,
    );
  }

  console.info(
    `[jobs] system.test succeeded on attempt ${job.attempts}`,
  );
}

async function handleSystemSlowTest(
  job: BackgroundJob,
) {
  console.info(
    `[jobs] system.slow-test started: ${job.id}`,
  );

  await sleep(
    10 * 1000,
  );

  console.info(
    `[jobs] system.slow-test finished: ${job.id}`,
  );
}


/*
 * =========================================================
 * Study
 * =========================================================
 */

async function handleStudyCoolSync(
  job: BackgroundJob,
) {
  const userId =
    getPayloadString(
      job,
      "userId",
    );

  console.info(
    `[jobs] Study COOL sync started for ${userId}`,
  );

  const result =
    await syncNtuCoolForUser(
      userId,
      "background",
    );

  console.info(
    "[jobs] Study COOL sync completed:",
    {
      userId,
      courses:
        result.courses,
      assignments:
        result.assignments,
      announcements:
        result.announcements,
    },
  );
}


async function handleStudyMailSync(
  job: BackgroundJob,
) {
  const userId = getPayloadString(
    job,
    "userId",
  );

  console.info(
    `[jobs] Study Mail sync started: ${job.id}`,
  );

  const result = await syncNtuMailForUser(
    userId,
    {
      notify: true,
    },
  );

  console.info(
    "[jobs] Study Mail sync completed:",
    {
      jobId: job.id,
      userId,
      ...result,
    },
  );
}

const handlers = new Map<
  string,
  JobHandler
>([
  [
    "system.test",
    handleSystemTest,
  ],
  [
    "system.slow-test",
    handleSystemSlowTest,
  ],
  [
    "study.cool-sync",
    handleStudyCoolSync,
  ],
  [
    "study.mail-sync",
    handleStudyMailSync,
  ],
]);

export function getJobHandler(
  jobType: string,
): JobHandler {
  const handler =
    handlers.get(jobType);

  if (!handler) {
    throw new Error(
      `No background job handler registered for "${jobType}".`,
    );
  }

  return handler;
}
