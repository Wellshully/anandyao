import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { sendPushToUser } from "@/features/notifications/lib/send-push-to-user";

import {
  claimPetReportDelivery,
  completePetReportDelivery,
  releasePetReportDeliveryClaim,
} from "@/features/pet/report/report-delivery-lease";

import { getPetDailyReportContext } from "@/features/pet/report/get-daily-report-context";
import { generatePetDailyReport } from "@/features/pet/report/generate-daily-report";

type DailyReportStats = {
  checked: number;
  due: number;

  generated: number;
  reused: number;

  notified: number;
  noDevice: number;

  skipped: number;
  failed: number;
};

type RunPetDailyReportsOptions = {
  userId?: string;
  force?: boolean;
};

type LocalDateTime = {
  date: string;
  time: string;
};

function getLocalDateTime(
  timestamp: number,
  timeZone: string,
): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,

    year: "numeric",
    month: "2-digit",
    day: "2-digit",

    hour: "2-digit",
    minute: "2-digit",

    hour12: false,
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));

  const year = parts.find((part) => part.type === "year")?.value;

  const month = parts.find((part) => part.type === "month")?.value;

  const day = parts.find((part) => part.type === "day")?.value;

  const hour = parts.find((part) => part.type === "hour")?.value;

  const minute = parts.find((part) => part.type === "minute")?.value;

  if (!year || !month || !day || !hour || !minute) {
    throw new Error("Failed to calculate Daily Report local time.");
  }

  return {
    date: `${year}-${month}-${day}`,

    time: `${hour}:${minute}`,
  };
}

function normalizeReportTime(reportTime: string) {
  return reportTime.slice(0, 5);
}

function buildPushBody(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= 100) {
    return normalized;
  }

  return `${normalized.slice(0, 99).trimEnd()}…`;
}

async function getOrCreateDailyReport({
  userId,
  petId,
  reportDate,
}: {
  userId: string;
  petId: string;
  reportDate: string;
}) {
  const supabase = createAdminClient();

  /*
   * A report may already exist when:
   *
   * - Report generation succeeded
   * - Push delivery failed
   *
   * In that case the next Cron run should only
   * retry the push, not pay for another LLM call.
   */
  const { data: existing, error: existingError } = await supabase
    .from("pet_daily_reports")
    .select(
      `
        id,
        content,
        pose
      `,
    )
    .eq("user_id", userId)
    .eq("report_date", reportDate)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Failed to load existing Daily Report: ${existingError.message}`,
    );
  }

  if (existing) {
    return {
      report: existing,
      generated: false,
    };
  }

  const context = await getPetDailyReportContext({
    userId,
    petId,
  });

  const generated = await generatePetDailyReport(context);

  const { data: created, error: createError } = await supabase
    .from("pet_daily_reports")
    .insert({
      user_id: userId,

      pet_id: petId,

      report_date: reportDate,

      content: generated.content,

      pose: generated.pose,
    })
    .select(
      `
        id,
        content,
        pose
      `,
    )
    .single();

  /*
   * In the unlikely case that two workers generated
   * the same user's report simultaneously, the
   * unique user_id + report_date constraint decides
   * which one wins.
   *
   * Load the winner instead of failing the whole run.
   */
  if (createError?.code === "23505") {
    const { data: winner, error: winnerError } = await supabase
      .from("pet_daily_reports")
      .select(
        `
          id,
          content,
          pose
        `,
      )
      .eq("user_id", userId)
      .eq("report_date", reportDate)
      .single();

    if (winnerError) {
      throw new Error(
        `Failed to load concurrent Daily Report: ${winnerError.message}`,
      );
    }

    return {
      report: winner,
      generated: false,
    };
  }

  if (createError || !created) {
    throw new Error(
      createError?.message ?? "Failed to create Daily Report.",
    );
  }

  return {
    report: created,
    generated: true,
  };
}

export async function runPetDailyReports(
  options: RunPetDailyReportsOptions = {},
): Promise<DailyReportStats> {
  const supabase = createAdminClient();

  const now = Date.now();

  let settingsQuery = supabase
    .from("pet_report_settings")
    .select(
      `
        user_id,
        pet_id,
        enabled,
        report_time,
        time_zone
      `,
    )
    .eq("enabled", true);

  if (options.userId) {
    settingsQuery =
      settingsQuery.eq(
        "user_id",
        options.userId,
      );
  }

  const {
    data: settings,
    error,
  } = await settingsQuery;

  if (error) {
    throw new Error(
      `Failed to load Daily Report settings: ${error.message}`,
    );
  }

  const stats: DailyReportStats = {
    checked: settings?.length ?? 0,
    due: 0,

    generated: 0,
    reused: 0,

    notified: 0,
    noDevice: 0,

    skipped: 0,
    failed: 0,
  };

  for (const setting of settings ?? []) {
    try {
      const local = getLocalDateTime(
        now,
        setting.time_zone,
      );

      const reportTime = normalizeReportTime(
        setting.report_time,
      );

      /*
       * Do not require exact minute equality.
       *
       * Example:
       * report_time = 08:00
       *
       * If the 08:00 Cron request fails, the 08:01
       * run can still create / deliver today's report.
       *
       * pet_report_deliveries prevents duplicates.
       */
      if (
        !options.force &&
        local.time < reportTime
      ) {
        continue;
      }

      stats.due += 1;

      const claimToken =
        await claimPetReportDelivery({
          userId: setting.user_id,
          reportDate: local.date,
        });

      if (!claimToken) {
        stats.skipped += 1;

        continue;
      }

      try {
        const { report, generated } =
          await getOrCreateDailyReport({
            userId: setting.user_id,

            petId: setting.pet_id,

            reportDate: local.date,
          });

        if (generated) {
          stats.generated += 1;
        } else {
          stats.reused += 1;
        }

        let pushDelivered = false;

        try {
          const pushResult =
            await sendPushToUser(
              setting.user_id,
              {
                title: "萌蛋的每日報告",

                body:
                  buildPushBody(
                    report.content,
                  ),

                url:
                  "/pet?view=report#pet-daily-report",
              },
            );

          /*
           * Report generation and Push delivery are
           * deliberately separate states.
           *
           * The report is already stored safely.
           * If no device received the Push, release
           * only the temporary delivery lease.
           */
          if (pushResult.sent === 0) {
            await releasePetReportDeliveryClaim({
              userId:
                setting.user_id,

              reportDate:
                local.date,

              claimToken,
            });

            stats.noDevice += 1;

            continue;
          }

          pushDelivered = true;

          const completed =
            await completePetReportDelivery({
              userId:
                setting.user_id,

              reportDate:
                local.date,

              claimToken,
            });

          if (!completed) {
            /*
             * Push already succeeded.
             *
             * Do not release here because the lease
             * may have expired and been reclaimed by
             * another worker.
             */
            console.warn(
              "Daily Report was pushed but its delivery lease could not be completed.",
            );
          }

          stats.notified += 1;
        } catch (cause) {
          /*
           * Only release before Push success.
           *
           * If the Push succeeded but bookkeeping
           * failed afterwards, deleting the claim
           * could create an immediate duplicate Push.
           */
          if (!pushDelivered) {
            await releasePetReportDeliveryClaim({
              userId:
                setting.user_id,

              reportDate:
                local.date,

              claimToken,
            });
          }

          throw cause;
        }
      } catch (cause) {
        throw cause;
      }
    } catch (cause) {
      console.warn(
        "Daily Report processing failed:",
        cause instanceof Error
          ? cause.message
          : String(cause),
      );

      stats.failed += 1;
    }
  }

  return stats;
}
