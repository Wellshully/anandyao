import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type StudySyncProvider =
  | "cool"
  | "mail";

export async function markStudySyncSuccess(
  userId: string,
  provider: StudySyncProvider,
) {
  const supabase = createAdminClient();

  const now =
    new Date().toISOString();

  const providerState =
    provider === "cool"
      ? {
          cool_last_synced_at: now,
        }
      : {
          mail_last_synced_at: now,
        };

  const { error } = await supabase
    .from("study_sync_state")
    .upsert(
      {
        user_id: userId,

        /*
         * Keep updating the legacy column during
         * the transition so older deployments do
         * not observe an increasingly stale value.
         */
        last_synced_at: now,

        ...providerState,
      },
      {
        onConflict: "user_id",
      },
    );

  if (error) {
    throw new Error(
      `Failed to update ${provider} sync state: ${error.message}`,
    );
  }

  return now;
}
