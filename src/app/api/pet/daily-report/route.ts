import { NextRequest, NextResponse } from "next/server";

import {
  enqueueDuePetDailyReportJobs,
} from "@/features/pet/jobs/enqueue-pet-daily-report";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("CRON_SECRET is not configured.");

    return false;
  }

  const authorization = request.headers.get("authorization");

  return authorization === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
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
    const result = await enqueueDuePetDailyReportJobs();

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (cause) {
    console.error("Failed to enqueue Pet Daily Reports:", cause);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to enqueue Pet Daily Reports.",
      },
      {
        status: 500,
      },
    );
  }
}
