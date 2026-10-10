import { NextRequest, NextResponse } from "next/server";

import {
  enqueueConfiguredStudyMailSyncJobs,
} from "@/features/study/jobs/enqueue-study-mail-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured.");

    return NextResponse.json(
      {
        success: false,
        error: "Cron authentication is not configured.",
      },
      {
        status: 500,
      },
    );
  }

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${cronSecret}`) {
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
      await enqueueConfiguredStudyMailSyncJobs();

    if (result.jobs.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No Study Mail accounts are configured.",
          ...result,
        },
        {
          status: 500,
        },
      );
    }

    const createdCount = result.jobs.filter(
      (job) => job.created,
    ).length;

    return NextResponse.json(
      {
        success: true,
        queued: createdCount,
        ...result,
      },
      {
        status: createdCount > 0 ? 202 : 200,
      },
    );
  } catch (cause) {
    console.error(
      "Failed to enqueue Study Mail sync:",
      cause instanceof Error ? cause.message : cause,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          cause instanceof Error
            ? cause.message
            : "Unknown background mail sync error.",
      },
      {
        status: 500,
      },
    );
  }
}
