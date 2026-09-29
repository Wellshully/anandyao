import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { getRecentNtuMailHeadersForUser } from "@/features/study/mail/ntu-webmail-client";

import { shouldIgnoreNtuMail } from "@/features/study/mail/mail-filter";

import { getConfiguredStudyUserIds } from "@/features/study/lib/get-study-credentials";
import { markStudySyncSuccess } from "@/features/study/lib/study-sync-state";

import {
  claimNotificationDelivery,
  completeNotificationDelivery,
  releaseNotificationDeliveryClaim,
} from "@/features/notifications/lib/notification-delivery-lease";

import { sendPushToUser } from "@/features/notifications/lib/send-push-to-user";

const MAIL_LIMIT = 50;

const MAIL_BASELINE_KEY = "mail:baseline:v1";

type SyncNtuMailOptions = {
  notify: boolean;
};

type SyncedMail = {
  id: string;
  uidl: string;
  subject: string;
  from_name: string | null;
  from_address: string | null;
};

async function hasMailNotificationBaseline(userId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("id")
    .eq("user_id", userId)
    .eq("notification_key", MAIL_BASELINE_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to check mail notification baseline: ${error.message}`,
    );
  }

  return Boolean(data);
}

async function createMailNotificationBaseline(
  userId: string,
  mails: SyncedMail[],
) {
  const supabase = createAdminClient();

  /*
   * Mark every currently known mail as already handled.
   *
   * This prevents the first background run from
   * suddenly pushing the existing inbox.
   */
  const deliveryRows = [
    ...mails.map((mail) => ({
      user_id: userId,

      notification_key: `mail:${mail.uidl}`,

      notification_type: "study_mail",

      source_id: mail.id,
    })),

    {
      user_id: userId,

      notification_key: MAIL_BASELINE_KEY,

      notification_type: "study_mail_baseline",

      source_id: "mail",
    },
  ];

  const { error } = await supabase
    .from("notification_deliveries")
    .upsert(deliveryRows, {
      onConflict: "user_id,notification_key",

      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error(
      `Failed to create mail notification baseline: ${error.message}`,
    );
  }
}

async function sendMailNotification(
  userId: string,
  mail: SyncedMail,
) {
  const notificationKey =
    `mail:${mail.uidl}`;

  const claimToken =
    await claimNotificationDelivery({
      userId,

      notificationKey,

      notificationType:
        "study_mail",

      sourceId: mail.id,
    });

  if (!claimToken) {
    return false;
  }

  /*
   * Once Push succeeds, never release the
   * claim merely because completion bookkeeping
   * later encounters an error.
   *
   * Otherwise the next worker could immediately
   * send the same mail notification again.
   */
  let pushDelivered = false;

  try {
    const sender =
      mail.from_name?.trim() ||
      mail.from_address?.trim() ||
      "寄件者";

    const result =
      await sendPushToUser(
        userId,
        {
          title: "新信件",

          body:
            `${sender}：${mail.subject}`,

          url:
            `/study/inbox/${mail.id}`,
        },
      );

    if (result.sent === 0) {
      await releaseNotificationDeliveryClaim({
        userId,
        notificationKey,
        claimToken,
      });

      return false;
    }

    pushDelivered = true;

    const completed =
      await completeNotificationDelivery({
        userId,
        notificationKey,
        claimToken,
      });

    if (!completed) {
      console.warn(
        "Mail notification was pushed but its delivery lease could not be completed.",
      );
    }

    return true;
  } catch (cause) {
    if (!pushDelivered) {
      await releaseNotificationDeliveryClaim({
        userId,
        notificationKey,
        claimToken,
      });
    }

    throw cause;
  }
}

export async function syncNtuMailForUser(
  userId: string,
  options: SyncNtuMailOptions = {
    notify: false,
  },
) {
  const supabase = createAdminClient();

  /*
   * POP3 background version does not
   * require a browser auth session.
   */
  const messages = await getRecentNtuMailHeadersForUser(userId, MAIL_LIMIT);

  const filteredMessages = messages.filter(
    (message) => !shouldIgnoreNtuMail(message.subject),
  );

  /*
   * Remove previously stored
   * "校內訊息" messages.
   */
  const { error: cleanupError } = await supabase
    .from("study_mail_messages")
    .delete()
    .eq("user_id", userId)
    .like("subject", "「校內訊息」%");

  if (cleanupError) {
    throw new Error(cleanupError.message);
  }

  if (filteredMessages.length === 0) {
    /*
     * A successful POP3 fetch is still a successful
     * sync even when the mailbox contains no relevant
     * messages.
     */
    await markStudySyncSuccess(
      userId,
      "mail",
    );

    /*
     * An empty mailbox still establishes a valid
     * notification baseline.
     *
     * Otherwise the first future mail would become
     * the "initial inbox" and its notification would
     * incorrectly be suppressed.
     */
    let baselineCreated = false;

    if (options.notify) {
      const hasBaseline =
        await hasMailNotificationBaseline(
          userId,
        );

      if (!hasBaseline) {
        await createMailNotificationBaseline(
          userId,
          [],
        );

        baselineCreated = true;
      }
    }

    return {
      synced: 0,
      notified: 0,
      baselineCreated,
    };
  }

  const now = new Date().toISOString();

  const rows = filteredMessages.map((message) => ({
    user_id: userId,

    uidl: message.uidl,

    subject: message.subject,

    from_name: message.fromName,

    from_address: message.fromAddress,

    sent_at: message.sentAt,

    message_id_header: message.messageId,

    synced_at: now,
  }));

  /*
   * seen_at is intentionally omitted,
   * so syncing never resets the app's
   * local read state.
   */
  const {
    data: syncedMails,

    error: syncError,
  } = await supabase
    .from("study_mail_messages")
    .upsert(rows, {
      onConflict: "user_id,uidl",
    })
    .select(
      `
        id,
        uidl,
        subject,
        from_name,
        from_address
      `,
    );

  if (syncError) {
    throw new Error(syncError.message);
  }

  /*
   * The provider synchronization itself is now
   * complete. Notification delivery is a separate
   * concern and must not define data freshness.
   */
  await markStudySyncSuccess(
    userId,
    "mail",
  );

  const mails = syncedMails ?? [];

  /*
   * App-triggered refreshes should sync
   * mail but should not send a push while
   * the user is already using the app.
   */
  if (!options.notify) {
    return {
      synced: rows.length,

      notified: 0,

      baselineCreated: false,
    };
  }

  /*
   * First background run:
   *
   * establish a baseline only.
   * Do NOT notify for the current inbox.
   */
  const hasBaseline = await hasMailNotificationBaseline(userId);

  if (!hasBaseline) {
    await createMailNotificationBaseline(userId, mails);

    return {
      synced: rows.length,

      notified: 0,

      baselineCreated: true,
    };
  }

  let notified = 0;

  /*
   * Every mail is checked against
   * notification_deliveries.
   *
   * Existing keys are skipped.
   * Missing keys are new / retryable.
   */
  for (const mail of mails) {
    try {
      const sent = await sendMailNotification(userId, mail);

      if (sent) {
        notified += 1;
      }
    } catch (cause) {
      /*
       * One bad push must not stop
       * the rest of the mailbox.
       */
      console.warn(
        "Mail push notification failed:",
        cause instanceof Error ? cause.message : cause,
      );
    }
  }

  return {
    synced: rows.length,

    notified,

    baselineCreated: false,
  };
}

/*
 * Existing app-facing sync.
 *
 * Authenticate the current browser user,
 * then reuse the shared sync logic.
 */
export async function syncNtuMail() {
  const supabase = await createClient();

  const {
    data: authData,

    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("Not authenticated.");
  }

  return syncNtuMailForUser(authData.user.id, {
    notify: false,
  });
}

/*
 * Cron-facing sync.
 *
 * Run accounts sequentially so we do not
 * unnecessarily open multiple POP3
 * connections at the same time.
 */
export async function syncAllConfiguredNtuMailAccounts() {
  const userIds = getConfiguredStudyUserIds();

  const results: Array<{
    userId: string;
    success: boolean;
    synced?: number;
    notified?: number;
    baselineCreated?: boolean;
    error?: string;
  }> = [];

  for (const userId of userIds) {
    try {
      const result = await syncNtuMailForUser(userId, {
        notify: true,
      });

      results.push({
        userId,
        success: true,
        ...result,
      });
    } catch (cause) {
      console.error("Background NTU Mail sync failed:", {
        userId,
        error: cause instanceof Error ? cause.message : String(cause),
      });

      results.push({
        userId,
        success: false,

        error:
          cause instanceof Error ? cause.message : "Unknown mail sync error.",
      });
    }
  }

  return results;
}
