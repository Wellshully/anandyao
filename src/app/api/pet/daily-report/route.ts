import { NextRequest, NextResponse } from "next/server";

import { runPetDailyReports } from "@/features/pet/report/run-daily-reports";

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
    const result = await runPetDailyReports();

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (cause) {
    console.error("Pet Daily Report worker failed:", cause);

    return NextResponse.json(
      {
        success: false,
        error: "Pet Daily Report worker failed.",
      },
      {
        status: 500,
      },
    );
  }
}
