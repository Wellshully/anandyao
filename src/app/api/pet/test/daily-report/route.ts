import {
  NextResponse,
} from "next/server";

import {
  requireUser,
} from "@/lib/auth/require-user";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  getPetDailyReportContext,
} from "@/features/pet/report/get-daily-report-context";

import {
  generatePetDailyReport,
} from "@/features/pet/report/generate-daily-report";

import {
  sendPushToUser,
} from "@/features/notifications/lib/send-push-to-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildPushBody(
  content: string,
) {
  const normalized =
    content
      .replace(/\s+/g, " ")
      .trim();

  if (normalized.length <= 100) {
    return normalized;
  }

  return `${normalized.slice(0, 99).trimEnd()}…`;
}

export async function POST() {
  if (
    process.env.NODE_ENV !==
    "development"
  ) {
    return NextResponse.json(
      {
        error: "Not found.",
      },
      {
        status: 404,
      },
    );
  }

  try {
    const user =
      await requireUser();

    const supabase =
      await createClient();

    const {
      data: setting,
      error: settingError,
    } = await supabase
      .from("pet_report_settings")
      .select(`
        pet_id,
        enabled
      `)
      .eq("user_id", user.id)
      .eq("enabled", true)
      .maybeSingle();

    if (settingError) {
      throw new Error(
        `Failed to load Daily Report settings: ${settingError.message}`,
      );
    }

    if (!setting) {
      return NextResponse.json(
        {
          success: false,
          error:
            "目前沒有啟用每日報告的萌蛋。",
        },
        {
          status: 400,
        },
      );
    }

    const context =
      await getPetDailyReportContext({
        userId:
          user.id,

        petId:
          setting.pet_id,
      });

    const report =
      await generatePetDailyReport(
        context,
      );

    const push =
      await sendPushToUser(
        user.id,
        {
          title:
            "萌蛋的每日報告（測試）",

          body:
            buildPushBody(
              report.content,
            ),

          url:
            "/pet?view=report#pet-daily-report",
        },
      );

    return NextResponse.json({
      success: true,
      report,
      push,
    });
  } catch (cause) {
    console.error(
      "Daily Report test failed:",
      cause,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          cause instanceof Error
            ? cause.message
            : "Unknown error.",
      },
      {
        status: 500,
      },
    );
  }
}
