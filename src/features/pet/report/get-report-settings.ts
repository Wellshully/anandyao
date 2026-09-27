import "server-only";

import { siteConfig } from "@/config/site";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

import type { PetReportSettings } from "@/features/pet/report/types";

const DEFAULT_REPORT_TIME = "08:00";

export async function getPetReportSettings(
  petId: string,
): Promise<PetReportSettings> {
  const [supabase, user] = await Promise.all([createClient(), requireUser()]);

  const { data, error } = await supabase
    .from("pet_report_settings")
    .select(
      `
        enabled,
        report_time,
        time_zone
      `,
    )
    .eq("user_id", user.id)
    .eq("pet_id", petId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load pet report settings: ${error.message}`);
  }

  if (!data) {
    return {
      enabled: false,
      reportTime: DEFAULT_REPORT_TIME,
      timeZone: siteConfig.timeZone,
    };
  }

  return {
    enabled: data.enabled,
    reportTime: data.report_time.slice(0, 5),
    timeZone: data.time_zone,
  };
}
