import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const DELIVERY_LEASE_SECONDS = 10 * 60;

export async function claimPetReportDelivery({
  userId,
  reportDate,
}: {
  userId: string;
  reportDate: string;
}) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc(
    "claim_pet_report_delivery",
    {
      p_user_id: userId,
      p_report_date: reportDate,
      p_lease_seconds: DELIVERY_LEASE_SECONDS,
    },
  );

  if (error) {
    throw new Error(
      `Failed to claim Daily Report delivery: ${error.message}`,
    );
  }

  /*
   * null means:
   *
   * - today's report was already delivered, or
   * - another worker currently owns
   *   an unexpired delivery lease.
   */
  return data;
}

export async function completePetReportDelivery({
  userId,
  reportDate,
  claimToken,
}: {
  userId: string;
  reportDate: string;
  claimToken: string;
}) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc(
    "complete_pet_report_delivery",
    {
      p_user_id: userId,
      p_report_date: reportDate,
      p_claim_token: claimToken,
    },
  );

  if (error) {
    throw new Error(
      `Failed to complete Daily Report delivery: ${error.message}`,
    );
  }

  return data === true;
}

export async function releasePetReportDeliveryClaim({
  userId,
  reportDate,
  claimToken,
}: {
  userId: string;
  reportDate: string;
  claimToken: string;
}) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc(
    "release_pet_report_delivery_claim",
    {
      p_user_id: userId,
      p_report_date: reportDate,
      p_claim_token: claimToken,
    },
  );

  if (error) {
    console.warn(
      "Failed to release Daily Report delivery claim:",
      error.message,
    );

    return false;
  }

  return data === true;
}
