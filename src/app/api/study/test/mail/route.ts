import { NextResponse } from "next/server";

import { syncNtuMail } from "@/features/study/mail/sync-ntu-mail";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json(
      {
        success: false,

        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const result = await syncNtuMail();

    return NextResponse.json({
      success: true,

      synced: result.synced,
    });
  } catch (cause) {
    console.error("NTU Mail sync failed:", cause);

    return NextResponse.json(
      {
        success: false,

        error: cause instanceof Error ? cause.message : "Mail sync failed.",
      },
      {
        status: 500,
      },
    );
  }
}
