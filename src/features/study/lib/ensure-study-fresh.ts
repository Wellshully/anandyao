import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireUser } from "@/lib/auth/require-user";

import { syncNtuCool } from "@/features/study/lib/sync-ntu-cool";
import { syncNtuMail } from "@/features/study/mail/sync-ntu-mail";

const COOL_MAX_AGE =
  6 * 60 * 60 * 1000;

const MAIL_MAX_AGE =
  1 * 60 * 60 * 1000;

function isStale(
  syncedAt: string | null | undefined,
  maxAge: number,
  now: number,
) {
  if (!syncedAt) {
    return true;
  }

  const synced =
    new Date(syncedAt).getTime();

  if (!Number.isFinite(synced)) {
    return true;
  }

  return now - synced >= maxAge;
}

function getErrorMessage(
  cause: unknown,
) {
  return cause instanceof Error
    ? cause.message
    : String(cause);
}

export async function ensureStudyFresh() {
  const [supabase, user] =
    await Promise.all([
      createClient(),
      requireUser(),
    ]);

  /*
   * Freshness belongs to the synchronization job,
   * not to individual data rows.
   *
   * This remains meaningful when:
   *
   * - COOL returns zero courses.
   * - Mailbox is empty.
   * - Every mail is filtered out.
   */
  const {
    data: syncState,
    error: syncStateError,
  } = await supabase
    .from("study_sync_state")
    .select(
      `
        cool_last_synced_at,
        mail_last_synced_at
      `,
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (syncStateError) {
    /*
     * A freshness-state failure must not make
     * Study unavailable.
     *
     * Avoid starting uncontrolled external syncs
     * when we cannot reliably determine freshness.
     */
    console.warn(
      "Unable to check Study sync freshness:",
      syncStateError.message,
    );

    return;
  }

  const now = Date.now();

  const shouldSyncCool =
    isStale(
      syncState?.cool_last_synced_at,
      COOL_MAX_AGE,
      now,
    );

  const shouldSyncMail =
    isStale(
      syncState?.mail_last_synced_at,
      MAIL_MAX_AGE,
      now,
    );

  const tasks: Promise<void>[] = [];

  if (shouldSyncCool) {
    tasks.push(
      (async () => {
        try {
          await syncNtuCool();
        } catch (cause) {
          /*
           * Existing Supabase data remains usable
           * if COOL is temporarily unavailable.
           */
          console.warn(
            "Automatic NTU COOL sync failed:",
            getErrorMessage(cause),
          );
        }
      })(),
    );
  }

  if (shouldSyncMail) {
    tasks.push(
      (async () => {
        try {
          await syncNtuMail();
        } catch (cause) {
          /*
           * Same fallback rule for POP3.
           */
          console.warn(
            "Automatic NTU Mail sync failed:",
            getErrorMessage(cause),
          );
        }
      })(),
    );
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}
