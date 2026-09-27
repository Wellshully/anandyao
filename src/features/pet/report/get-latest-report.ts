import "server-only";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

import type { PetPose } from "@/features/pet/ai/pet-reply";
import type { PetDailyReport } from "@/features/pet/report/types";

export async function getLatestPetDailyReport(
  petId: string,
): Promise<PetDailyReport | null> {
  const [supabase, user] = await Promise.all([
    createClient(),
    requireUser(),
  ]);

  const { data, error } = await supabase
    .from("pet_daily_reports")
    .select(
      `
        id,
        report_date,
        content,
        pose,
        created_at
      `,
    )
    .eq("user_id", user.id)
    .eq("pet_id", petId)
    .order("report_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load latest Pet Daily Report: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,

    reportDate: data.report_date,

    content: data.content,

    pose: data.pose as PetPose,

    createdAt: data.created_at,
  };
}
