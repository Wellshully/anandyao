import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireUser } from "@/lib/auth/require-user";

import { syncNtuCool } from "@/features/study/lib/sync-ntu-cool";

import { syncNtuMail } from "@/features/study/mail/sync-ntu-mail";

const COOL_MAX_AGE = 6 * 60 * 60 * 1000;

const MAIL_MAX_AGE = 1 * 60 * 60 * 1000;

function isStale(
  syncedAt: string | null | undefined,
  maxAge: number,
  now: number,
) {
  if (!syncedAt) {
    return true;
  }

  const synced = new Date(syncedAt).getTime();

  if (!Number.isFinite(synced)) {
    return true;
  }

  return now - synced >= maxAge;
}

function getErrorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

export async function ensureStudyFresh() {
  const [supabase, user] = await Promise.all([createClient(), requireUser()]);

  const [coolState, mailState] = await Promise.all([
    supabase
      .from("study_courses")
      .select("synced_at")
      .eq("user_id", user.id)
      .order("synced_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("study_mail_messages")
      .select("synced_at")
      .eq("user_id", user.id)
      .order("synced_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle(),
  ]);

  if (coolState.error) {
    console.warn("Unable to check COOL freshness:", coolState.error.message);
  }

  if (mailState.error) {
    console.warn(
      "Unable to check NTU Mail freshness:",
      mailState.error.message,
    );
  }

  const now = Date.now();

  const shouldSyncCool =
    !coolState.error && isStale(coolState.data?.synced_at, COOL_MAX_AGE, now);

  const shouldSyncMail =
    !mailState.error && isStale(mailState.data?.synced_at, MAIL_MAX_AGE, now);

  const tasks: Promise<void>[] = [];

  if (shouldSyncCool) {
    tasks.push(
      (async () => {
        try {
          await syncNtuCool();
        } catch (cause) {
          /*
           * Automatic sync must never make
           * the rest of An & Yao unavailable.
           *
           * Existing Supabase data remains
           * usable even if COOL is down or
           * the token expired.
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
           * Same principle for POP3:
           * fall back to previously synced mail.
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
