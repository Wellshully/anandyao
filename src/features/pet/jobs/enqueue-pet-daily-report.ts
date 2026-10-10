import "server-only";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  enqueueJob,
} from "@/lib/jobs/enqueue-job";

import {
  getDuePetReportSlot,
  getPetReportJobKey,
  type PetReportSlot,
} from "./pet-daily-report-job-policy";

export async function enqueueDuePetDailyReportJobs(
  now = new Date(),
) {
  const supabase = createAdminClient();

  const { data: settings, error } =
    await supabase
      .from("pet_report_settings")
      .select(
        "user_id, report_time, time_zone",
      )
      .eq("enabled", true);

  if (error) {
    throw new Error(
      `Failed to load Pet report settings: ${error.message}`,
    );
  }

  /*
   * The existing report and delivery tables
   * enforce one report per user per local date.
   *
   * Keep the Queue at the same granularity.
   */
  const dueUsers = new Map<
    string,
    PetReportSlot
  >();

  for (const setting of settings ?? []) {
    const slot = getDuePetReportSlot(
      now,
      setting.time_zone ?? "Asia/Taipei",
      setting.report_time,
    );

    if (!slot) {
      continue;
    }

    if (!dueUsers.has(setting.user_id)) {
      dueUsers.set(setting.user_id, slot);
    }
  }

  const jobs = [];

  for (const [userId, slot] of dueUsers) {
    const result = await enqueueJob({
      jobType: "pet.daily-report",

      payload: {
        userId,
        reportDate: slot.reportDate,
        timeZone: slot.timeZone,
      },

      maxAttempts: 5,

      idempotencyKey: getPetReportJobKey(
        userId,
        slot,
      ),
    });

    jobs.push({
      userId,
      reportDate: slot.reportDate,
      jobId: result.job.id,
      status: result.job.status,
      created: result.created,
    });
  }

  return {
    checked: settings?.length ?? 0,
    due: dueUsers.size,
    queued: jobs.filter(
      (job) => job.created,
    ).length,
    jobs,
  };
}
