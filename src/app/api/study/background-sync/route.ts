import { NextRequest, NextResponse } from "next/server";

import { syncAllConfiguredNtuCoolAccounts } from "@/features/study/lib/sync-ntu-cool";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("CRON_SECRET is not configured.");

    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
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
    const accounts = await syncAllConfiguredNtuCoolAccounts();

    const failed = accounts.filter((account) => !account.success);

    return NextResponse.json(
      {
        success: failed.length === 0,

        accounts,
      },
      {
        status: failed.length === accounts.length ? 500 : 200,
      },
    );
  } catch (cause) {
    console.error("Background COOL sync worker failed:", cause);

    return NextResponse.json(
      {
        success: false,

        error: "Background COOL sync failed.",
      },
      {
        status: 500,
      },
    );
  }
}
