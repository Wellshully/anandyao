"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { siteConfig } from "@/config/site";

import { requireSpace } from "@/lib/space/require-space";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export type UpdatePetReportSettingsResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

type UpdatePetReportSettingsInput = {
  petId: string;
  enabled: boolean;
  reportTime: string;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function updatePetReportSettingsAction(
  input: UpdatePetReportSettingsInput,
): Promise<UpdatePetReportSettingsResult> {
  try {
    const [supabase, user, space] = await Promise.all([
      createClient(),
      requireUser(),
      requireSpace(),
    ]);

    if (!TIME_PATTERN.test(input.reportTime)) {
      return {
        success: false,
        error: "報告時間格式不正確。",
      };
    }

    /*
     * Never trust the petId coming from the browser.
     * Make sure this pet belongs to the current space.
     */
    const { data: pet, error: petError } = await supabase
      .from("pets")
      .select("id")
      .eq("id", input.petId)
      .eq("space_id", space.id)
      .maybeSingle();

    if (petError) {
      throw new Error(`Failed to verify pet: ${petError.message}`);
    }

    if (!pet) {
      return {
        success: false,
        error: "找不到萌蛋。",
      };
    }

    const now = new Date().toISOString();

    const { error } = await supabase.from("pet_report_settings").upsert(
      {
        user_id: user.id,
        pet_id: pet.id,
        enabled: input.enabled,
        report_time: `${input.reportTime}:00`,
        time_zone: siteConfig.timeZone,
        updated_at: now,
      },
      {
        onConflict: "user_id",
      },
    );

    if (error) {
      throw new Error(`Failed to update pet report settings: ${error.message}`);
    }

    revalidatePath("/pet");

    return {
      success: true,
    };
  } catch (cause) {
    unstable_rethrow(cause);

    console.error("updatePetReportSettingsAction error:", cause);

    return {
      success: false,
      error: cause instanceof Error ? cause.message : "儲存每日報告設定失敗。",
    };
  }
}
