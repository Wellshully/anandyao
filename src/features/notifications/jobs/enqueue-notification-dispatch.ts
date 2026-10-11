import "server-only";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  enqueueJob,
} from "@/lib/jobs/enqueue-job";

import {
  discoverNotificationReminderCandidates,
} from "@/features/notifications/lib/run-notification-reminders";

import {
  filterDeliveredNotificationCandidates,
  getLegacyNotificationKey,
  getNotificationDispatchKey,
  legacyDeliveryCoversSchedule,
  uniqueNotificationCandidates,
} from "./notification-dispatch-policy";

const QUERY_BATCH_SIZE = 100;

function chunks<T>(
  items: readonly T[],
  size: number,
): T[][] {
  const result: T[][] = [];

  for (
    let index = 0;
    index < items.length;
    index += size
  ) {
    result.push(
      items.slice(
        index,
        index + size,
      ),
    );
  }

  return result;
}

/**
 * Discover eligible reminders without sending Push.
 *
 * Only queue reminders which:
 * 1. Are still within their eligibility window.
 * 2. Have not already been delivered.
 * 3. Have at least one push subscription.
 *
 * Existing pending/claimed deliveries are not
 * considered delivered; the worker's delivery
 * lease handles concurrency.
 */
export async function enqueueDueNotificationDispatchJobs(
  now = new Date(),
) {
  const timestamp = now.getTime();

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      "Invalid notification dispatch timestamp.",
    );
  }

  const supabase = createAdminClient();

  const discovered =
    await discoverNotificationReminderCandidates(
      timestamp,
    );

  const candidates =
    uniqueNotificationCandidates(discovered);

  if (candidates.length === 0) {
    return {
      discovered: 0,
      alreadyDelivered: 0,
      withoutSubscription: 0,
      eligible: 0,
      created: 0,
      jobs: [],
    };
  }

  // --------------------------------------------
  // Find delivery rows already marked delivered.
  // --------------------------------------------

  const byUser = new Map<
    string,
    string[]
  >();

  for (const candidate of candidates) {
    const keys =
      byUser.get(candidate.userId) ?? [];

    keys.push(candidate.notificationKey);

    const legacyKey = getLegacyNotificationKey(
      candidate.notificationKey,
    );

    if (legacyKey) {
      keys.push(legacyKey);
    }

    byUser.set(candidate.userId, keys);
  }

  const deliveredJobKeys = new Set<string>();

  for (const [userId, keys] of byUser) {
    for (
      const keyBatch of chunks(
        keys,
        QUERY_BATCH_SIZE,
      )
    ) {
      const { data, error } =
        await supabase
          .from("notification_deliveries")
          .select("notification_key,sent_at")
          .eq("user_id", userId)
          .eq("status", "delivered")
          .in(
            "notification_key",
            keyBatch,
          );

      if (error) {
        throw new Error(
          `Failed to check delivered notifications: ${error.message}`,
        );
      }

      for (const delivery of data ?? []) {
        deliveredJobKeys.add(
          getNotificationDispatchKey({
            userId,
            notificationKey:
              delivery.notification_key,
          }),
        );

        // Match legacy delivery records against
        // the current scheduled reminder window.
        for (const candidate of candidates) {
          if (candidate.userId !== userId) {
            continue;
          }

          const legacyKey =
            getLegacyNotificationKey(
              candidate.notificationKey,
            );

          if (
            legacyKey === delivery.notification_key &&
            legacyDeliveryCoversSchedule(
              candidate.notificationKey,
              delivery.sent_at,
            )
          ) {
            deliveredJobKeys.add(
              getNotificationDispatchKey(candidate),
            );
          }
        }
      }
    }
  }

  const undelivered =
    filterDeliveredNotificationCandidates(
      candidates,
      deliveredJobKeys,
    );

  // --------------------------------------------
  // Avoid queuing users without push devices.
  //
  // If a user subscribes later, the next Cron
  // scan can enqueue their still-due reminder.
  // --------------------------------------------

  const userIds = [
    ...new Set(
      undelivered.map(
        (candidate) => candidate.userId,
      ),
    ),
  ];

  const subscribedUsers = new Set<string>();

  for (
    const userBatch of chunks(
      userIds,
      QUERY_BATCH_SIZE,
    )
  ) {
    const { data, error } =
      await supabase
        .from("push_subscriptions")
        .select("user_id")
        .in("user_id", userBatch);

    if (error) {
      throw new Error(
        `Failed to check push subscriptions: ${error.message}`,
      );
    }

    for (const subscription of data ?? []) {
      subscribedUsers.add(
        subscription.user_id,
      );
    }
  }

  const eligible = undelivered.filter(
    (candidate) =>
      subscribedUsers.has(candidate.userId),
  );

  // All eligibility checks have completed
  // before creating any jobs.

  const jobs = [];

  for (const candidate of eligible) {
    const result = await enqueueJob({
      jobType: "notification.dispatch",

      // Prioritize time-sensitive reminders over
      // routine background synchronization.
      priority: 1000,

      payload: {
        userId: candidate.userId,
        notificationKey:
          candidate.notificationKey,
        notificationType:
          candidate.notificationType,
        sourceId: candidate.sourceId,
      },

      maxAttempts: 5,

      idempotencyKey:
        getNotificationDispatchKey(
          candidate,
        ),
    });

    jobs.push({
      jobId: result.job.id,
      status: result.job.status,
      created: result.created,
    });
  }

  return {
    discovered: candidates.length,

    alreadyDelivered:
      candidates.length -
      undelivered.length,

    withoutSubscription:
      undelivered.length -
      eligible.length,

    eligible: eligible.length,

    created: jobs.filter(
      (job) => job.created,
    ).length,

    jobs,
  };
}
