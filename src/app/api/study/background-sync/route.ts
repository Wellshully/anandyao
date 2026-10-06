import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  enqueueConfiguredStudyCoolSyncJobs,
} from "@/features/study/jobs/enqueue-study-cool-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  try {
    const result =
      await enqueueConfiguredStudyCoolSyncJobs();

    if (
      result.jobs.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No configured NTU COOL accounts.",
          ...result,
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,

      /*
       * This endpoint now acknowledges durable
       * queue insertion, not completion of the
       * actual COOL synchronization.
       */
      queued:
        result.jobs.length,

      ...result,
    });
  } catch (cause) {
    console.error(
      "Failed to enqueue background COOL sync:",
      cause,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          cause instanceof Error
            ? cause.message
            : "Failed to enqueue background COOL sync.",
      },
      {
        status: 500,
      },
    );
  }
}
