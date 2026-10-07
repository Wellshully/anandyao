import {
  NextResponse,
} from "next/server";

import {
  requireUser,
} from "@/lib/auth/require-user";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  runPetDailyReports,
} from "@/features/pet/report/run-daily-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getLocalDate(
  date: Date,
  timeZone: string,
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(date);

  const year =
    parts.find(
      (part) =>
        part.type === "year",
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month",
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day",
    )?.value;

  if (!year || !month || !day) {
    throw new Error(
      "Failed to calculate Daily Report date.",
    );
  }

  return `${year}-${month}-${day}`;
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
      createAdminClient();

    const {
      data: setting,
      error: settingError,
    } = await supabase
      .from("pet_report_settings")
      .select(`
        pet_id,
        time_zone
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
            "目前沒有啟用每日報告。",
        },
        {
          status: 400,
        },
      );
    }

    const reportDate =
      getLocalDate(
        new Date(),
        setting.time_zone,
      );

    /*
     * Clear today's delivery claim first,
     * then remove today's generated report.
     *
     * The real Daily Report runner will
     * regenerate both.
     */
    const {
      error: deliveryError,
    } = await supabase
      .from("pet_report_deliveries")
      .delete()
      .eq("user_id", user.id)
      .eq(
        "report_date",
        reportDate,
      );

    if (deliveryError) {
      throw new Error(
        `Failed to reset Daily Report delivery: ${deliveryError.message}`,
      );
    }

    const {
      error: reportError,
    } = await supabase
      .from("pet_daily_reports")
      .delete()
      .eq("user_id", user.id)
      .eq(
        "report_date",
        reportDate,
      );

    if (reportError) {
      throw new Error(
        `Failed to reset Daily Report: ${reportError.message}`,
      );
    }

    const stats =
      await runPetDailyReports({
        userId: user.id,
        force: true,
      });

    const {
      data: report,
      error: reloadError,
    } = await supabase
      .from("pet_daily_reports")
      .select(`
        id,
        report_date,
        content,
        pose,
        created_at
      `)
      .eq("user_id", user.id)
      .eq(
        "report_date",
        reportDate,
      )
      .maybeSingle();

    if (reloadError) {
      throw new Error(
        `Failed to reload Daily Report: ${reloadError.message}`,
      );
    }

    return NextResponse.json({
      success: true,
      reportDate,
      stats,
      report,
    });
  } catch (cause) {
    console.error(
      "Force Daily Report failed:",
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
