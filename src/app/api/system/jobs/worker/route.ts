import {
  randomUUID,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  recoverStaleJobs,
} from "@/lib/jobs/recover-stale-jobs";

import {
  runWorker,
} from "@/lib/jobs/run-worker";

import {
  markWorkerFailed,
  markWorkerStarted,
  markWorkerSucceeded,
} from "@/lib/jobs/worker-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_JOB_MS =
  15 * 60 * 1000;

function isAuthorized(
  request: NextRequest,
) {
  const secret =
    process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return (
    request.headers.get(
      "authorization",
    ) === `Bearer ${secret}`
  );
}

async function recordWorkerStart(
  workerId: string,
) {
  try {
    await markWorkerStarted(
      workerId,
    );
  } catch (cause) {
    console.warn(
      "Failed to record worker start:",
      cause instanceof Error
        ? cause.message
        : String(cause),
    );
  }
}

async function recordWorkerSuccess({
  workerId,
  recovery,
  worker,
}: {
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
}) {
  try {
    await markWorkerSucceeded({
      workerId,
      recovery,
      worker,
    });
  } catch (cause) {
    console.warn(
      "Failed to record worker success:",
      cause instanceof Error
        ? cause.message
        : String(cause),
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  const workerId =
    `cron-worker:${
      process.env.VERCEL_REGION ??
      "local"
    }:${randomUUID()}`;

  await recordWorkerStart(
    workerId,
  );

  try {
    const recovery =
      await recoverStaleJobs({
        staleForMs:
          STALE_JOB_MS,

        limit: 50,
      });

    const worker =
      await runWorker({
        workerId,
        limit: 1,
      });

    await recordWorkerSuccess({
      workerId,

      recovery: {
        recovered:
          recovery.recovered,

        requeued:
          recovery.requeued,

        dead:
          recovery.dead,
      },

      worker: {
        claimed:
          worker.claimed,

        succeeded:
          worker.succeeded,

        retrying:
          worker.retrying,

        dead:
          worker.dead,
      },
    });

    return NextResponse.json({
      success: true,

      recovery: {
        recovered:
          recovery.recovered,

        requeued:
          recovery.requeued,

        dead:
          recovery.dead,
      },

      worker,
    });
  } catch (cause) {
    await markWorkerFailed({
      workerId,
      cause,
    });

    console.error(
      "Background worker failed:",
      cause,
    );

    return NextResponse.json(
      {
        success: false,

        workerId,

        error:
          cause instanceof Error
            ? cause.message
            : "Unknown worker error.",
      },
      {
        status: 500,
      },
    );
  }
}
