import { NextRequest, NextResponse } from "next/server";

import {
  enqueueDueNotificationDispatchJobs,
} from "@/features/notifications/jobs/enqueue-notification-dispatch";

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
    const result = await enqueueDueNotificationDispatchJobs();

    return NextResponse.json({
      success: true,

      result,
    });
  } catch (cause) {
    console.error("Notification reminder worker failed:", cause);

    return NextResponse.json(
      {
        success: false,

        error: "Reminder worker failed.",
      },
      {
        status: 500,
      },
    );
  }
}
