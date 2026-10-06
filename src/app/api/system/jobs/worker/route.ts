import { randomUUID } from "node:crypto";

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
    console.error(
      "CRON_SECRET is not configured.",
    );

    return false;
  }

  return (
    request.headers.get(
      "authorization",
    ) === `Bearer ${secret}`
  );
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
    [
      "cron-worker",
      process.env.VERCEL_REGION ??
        "local",
      randomUUID(),
    ].join(":");

  try {
    /*
     * First recover jobs whose previous worker
     * stopped renewing its lease.
     */
    const recovery =
      await recoverStaleJobs({
        staleForMs:
          STALE_JOB_MS,

        limit: 50,
      });

    /*
     * Claim conservatively.
     *
     * runWorker currently processes claimed
     * jobs sequentially and starts heartbeat
     * when each job begins execution.
     *
     * Claiming more than one here would leave
     * later claimed jobs waiting without a
     * heartbeat, so keep this at one.
     */
    const worker =
      await runWorker({
        workerId,
        limit: 1,
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
    console.error(
      "[jobs] worker run failed:",
      cause,
    );

    return NextResponse.json(
      {
        success: false,

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
