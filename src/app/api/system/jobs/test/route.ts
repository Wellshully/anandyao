import { randomUUID } from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireUser,
} from "@/lib/auth/require-user";

import {
  enqueueJob,
} from "@/lib/jobs/enqueue-job";

import {
  recoverStaleJobs,
} from "@/lib/jobs/recover-stale-jobs";

import {
  runWorker,
} from "@/lib/jobs/run-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TestAction =
  | "enqueue"
  | "run"
  | "recover"
  | "heartbeat-test";

function isTestAction(
  value: unknown,
): value is TestAction {
  return (
    value === "enqueue" ||
    value === "run" ||
    value === "recover" ||
    value === "heartbeat-test"
  );
}

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

export async function POST(
  request: NextRequest,
) {
  /*
   * Infrastructure testing endpoint.
   *
   * Never expose this in production.
   */
  if (
    process.env.NODE_ENV !==
    "development"
  ) {
    return NextResponse.json(
      {
        error: "Not found.",
      },
      {
        status: 404,
      },
    );
  }

  try {
    const user =
      await requireUser();

    const body: unknown =
      await request.json();

    const action =
      typeof body === "object" &&
      body !== null &&
      "action" in body
        ? body.action
        : null;

    if (!isTestAction(action)) {
      return NextResponse.json(
        {
          error:
            'Invalid test action.',
        },
        {
          status: 400,
        },
      );
    }

    if (action === "enqueue") {
      const testId =
        randomUUID();

      const result =
        await enqueueJob({
          jobType:
            "system.test",

          payload: {
            testId,
            requestedBy:
              user.id,
          },

          idempotencyKey:
            `system-test:${testId}`,
        });

      return NextResponse.json({
        action,
        ...result,
      });
    }

    if (action === "recover") {
      const result =
        await recoverStaleJobs({
          staleForMs:
            15 * 60 * 1000,

          limit: 50,
        });

      return NextResponse.json({
        action,
        result,
      });
    }

    if (
      action ===
      "heartbeat-test"
    ) {
      const testId =
        randomUUID();

      /*
       * Give this job high priority so the
       * test worker claims it even if old test
       * jobs remain pending.
       */
      const enqueued =
        await enqueueJob({
          jobType:
            "system.slow-test",

          payload: {
            testId,
            requestedBy:
              user.id,
          },

          priority:
            30_000,

          maxAttempts:
            1,

          idempotencyKey:
            `system-heartbeat-test:${testId}`,
        });

      const workerId =
        `heartbeat-test:${user.id}:${randomUUID()}`;

      /*
       * Start the worker without awaiting it.
       *
       * This lets us attempt stale recovery
       * while the slow handler is still
       * executing.
       */
      const workerPromise =
        runWorker({
          workerId,
          limit: 1,

          /*
           * Test interval only.
           *
           * Production stays at 60 seconds.
           */
          heartbeatIntervalMs:
            1000,
        });

      /*
       * By now the job should have been running
       * for several seconds.
       *
       * Without heartbeat its original lease
       * would be old enough to recover.
       */
      await sleep(
        5 * 1000,
      );

      const recovery =
        await recoverStaleJobs({
          /*
           * A lease older than 2.5 seconds is
           * considered stale for this test.
           *
           * Heartbeat runs every 1 second, so
           * a healthy worker should remain safe.
           */
          staleForMs:
            2500,

          limit: 50,
        });

      const recoveredTestJob =
        recovery.jobs.some(
          (job) =>
            job.id ===
            enqueued.job.id,
        );

      const worker =
        await workerPromise;

      return NextResponse.json({
        action,

        jobId:
          enqueued.job.id,

        recoveredTestJob,

        heartbeatProtected:
          !recoveredTestJob,

        recovery,

        worker,
      });
    }

    const workerId =
      `system-test:${user.id}:${randomUUID()}`;

    const result =
      await runWorker({
        workerId,
        limit: 1,
      });

    return NextResponse.json({
      action,
      result,
    });
  } catch (cause) {
    console.error(
      "[jobs] system test failed:",
      cause,
    );

    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Unknown error",
      },
      {
        status: 500,
      },
    );
  }
}
