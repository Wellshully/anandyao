import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const COOL_SYNC_LEASE_SECONDS =
  15 * 60;

export class CoolSyncAlreadyRunningError extends Error {
  constructor() {
    super(
      "NTU COOL synchronization is already running.",
    );

    this.name =
      "CoolSyncAlreadyRunningError";
  }
}

export async function claimCoolSyncLease(
  userId: string,
) {
  const supabase = createAdminClient();

  const { data, error } =
    await supabase.rpc(
      "claim_cool_sync_lease",
      {
        p_user_id: userId,
        p_lease_seconds:
          COOL_SYNC_LEASE_SECONDS,
      },
    );

  if (error) {
    throw new Error(
      `Failed to claim COOL sync lease: ${error.message}`,
    );
  }

  return data;
}

export async function renewCoolSyncLease({
  userId,
  claimToken,
}: {
  userId: string;
  claimToken: string;
}) {
  const supabase = createAdminClient();

  const { data, error } =
    await supabase.rpc(
      "renew_cool_sync_lease",
      {
        p_user_id: userId,
        p_claim_token: claimToken,
      },
    );

  if (error) {
    throw new Error(
      `Failed to renew COOL sync lease: ${error.message}`,
    );
  }

  return data === true;
}

export async function completeCoolSyncLease({
  userId,
  claimToken,
}: {
  userId: string;
  claimToken: string;
}) {
  const supabase = createAdminClient();

  const { data, error } =
    await supabase.rpc(
      "complete_cool_sync_lease",
      {
        p_user_id: userId,
        p_claim_token: claimToken,
      },
    );

  if (error) {
    throw new Error(
      `Failed to complete COOL sync lease: ${error.message}`,
    );
  }

  return data === true;
}

export async function releaseCoolSyncLease({
  userId,
  claimToken,
}: {
  userId: string;
  claimToken: string;
}) {
  const supabase = createAdminClient();

  const { data, error } =
    await supabase.rpc(
      "release_cool_sync_lease",
      {
        p_user_id: userId,
        p_claim_token: claimToken,
      },
    );

  if (error) {
    console.warn(
      "Failed to release COOL sync lease:",
      error.message,
    );

    return false;
  }

  return data === true;
}
