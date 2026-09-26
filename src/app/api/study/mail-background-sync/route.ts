import { NextRequest, NextResponse } from "next/server";

import { syncAllConfiguredNtuMailAccounts } from "@/features/study/mail/sync-ntu-mail";

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
    const results = await syncAllConfiguredNtuMailAccounts();

    if (results.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No Study Mail accounts are configured.",
          results,
        },
        {
          status: 500,
        },
      );
    }

    const successCount = results.filter((result) => result.success).length;

    const failedCount = results.length - successCount;

    /*
     * If at least one account succeeds,
     * return 200 so one broken NTU account
     * does not make the whole cron run fail.
     */
    return NextResponse.json(
      {
        success: successCount > 0,

        accounts: results.length,

        successCount,

        failedCount,

        results,
      },
      {
        status: successCount === 0 ? 500 : 200,
      },
    );
  } catch (cause) {
    console.error(
      "Mail background sync route failed:",
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
