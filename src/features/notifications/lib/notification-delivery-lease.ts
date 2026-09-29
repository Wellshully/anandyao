import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const DELIVERY_LEASE_SECONDS = 10 * 60;

type ClaimNotificationDeliveryInput = {
  userId: string;
  notificationKey: string;
  notificationType: string;
  sourceId: string;
};

export async function claimNotificationDelivery({
  userId,
  notificationKey,
  notificationType,
  sourceId,
}: ClaimNotificationDeliveryInput) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc(
    "claim_notification_delivery",
    {
      p_user_id: userId,
      p_notification_key: notificationKey,
      p_notification_type: notificationType,
      p_source_id: sourceId,
      p_lease_seconds: DELIVERY_LEASE_SECONDS,
    },
  );

  if (error) {
    throw new Error(
      `Failed to claim notification delivery: ${error.message}`,
    );
  }

  /*
   * null means:
   *
   * - already delivered, or
   * - another worker currently owns
   *   an unexpired lease.
   */
  return data;
}

export async function completeNotificationDelivery({
  userId,
  notificationKey,
  claimToken,
}: {
  userId: string;
  notificationKey: string;
  claimToken: string;
}) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc(
    "complete_notification_delivery",
    {
      p_user_id: userId,
      p_notification_key: notificationKey,
      p_claim_token: claimToken,
    },
  );

  if (error) {
    throw new Error(
      `Failed to complete notification delivery: ${error.message}`,
    );
  }

  return data === true;
}

export async function releaseNotificationDeliveryClaim({
  userId,
  notificationKey,
  claimToken,
}: {
  userId: string;
  notificationKey: string;
  claimToken: string;
}) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc(
    "release_notification_delivery_claim",
    {
      p_user_id: userId,
      p_notification_key: notificationKey,
      p_claim_token: claimToken,
    },
  );

  if (error) {
    console.warn(
      "Failed to release notification delivery claim:",
      error.message,
    );

    return false;
  }

  return data === true;
}
