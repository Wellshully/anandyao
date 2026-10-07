import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/require-user";

import { runNotificationReminders } from "@/features/notifications/lib/run-notification-reminders";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not Found", {
      status: 404,
    });
  }


  try {
    const user = await requireUser();

    const result = await runNotificationReminders({
      userId: user.id,
    });

    return NextResponse.json({
      success: true,

      result,
    });
  } catch (cause) {
    console.error("Reminder test route failed:", cause);

    return NextResponse.json(
      {
        success: false,

        error: cause instanceof Error ? cause.message : "Unknown error",
      },
      {
        status: 500,
      },
    );
  }
}
