import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  claimNotificationDelivery,
  completeNotificationDelivery,
  releaseNotificationDeliveryClaim,
} from "@/features/notifications/lib/notification-delivery-lease";

import { sendPushToUser } from "@/features/notifications/lib/send-push-to-user";

import {
  buildScheduledNotificationKey,
  getLegacyNotificationKey,
  legacyDeliveryCoversSchedule,
  matchesNotificationDispatchKey,
  shouldRunNotificationCategory,
  type ReminderCandidate,
} from "@/features/notifications/jobs/notification-dispatch-policy";

const PERSONAL_WINDOW_MS = 10 * 60 * 1000;

const ASSIGNMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

const DATE_WINDOW_MS = 60 * 60 * 1000;

type ReminderStats = {
  personal: number;
  assignments: number;
  dates: number;
};

type RunNotificationRemindersOptions = {
  now?: number;
  strict?: boolean;
  onCandidate?: (candidate: ReminderCandidate) => void;
  onlyNotificationKey?: string;
  strictDelivery?: boolean;

  /*
   * For manual testing we can limit the
   * worker to the currently signed-in user.
   *
   * Cron will later omit this and process
   * both users.
   */
  userId?: string;
};

function getTaipeiDateKey(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",

    year: "numeric",

    month: "2-digit",

    day: "2-digit",
  }).format(new Date(timestamp));
}

function buildTaipeiTimestamp(date: string, time: string) {
  return new Date(`${date}T${time.slice(0, 8)}+08:00`).getTime();
}

async function deliverOnce({
  userId,
  notificationKey,
  notificationType,
  sourceId,
  title,
  body,
  url,
  strictDelivery = false,
}: {
  userId: string;
  notificationKey: string;
  notificationType: string;
  sourceId: string;
  title: string;
  body: string;
  url: string;
  strictDelivery?: boolean;
}) {
  const legacyKey =
    getLegacyNotificationKey(notificationKey);

  if (legacyKey) {
    const { data: previous, error } =
      await createAdminClient()
        .from("notification_deliveries")
        .select("status,sent_at")
        .eq("user_id", userId)
        .eq("notification_key", legacyKey)
        .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to check legacy notification delivery: ${error.message}`,
      );
    }

    if (
      previous?.status === "delivered" &&
      legacyDeliveryCoversSchedule(
        notificationKey,
        previous.sent_at,
      )
    ) {
      return false;
    }
  }

  const claimToken =
    await claimNotificationDelivery({
      userId,
      notificationKey,
      notificationType,
      sourceId,
    });

  if (!claimToken) {
    if (strictDelivery) {
      const { data: existing, error } =
        await createAdminClient()
          .from("notification_deliveries")
          .select("status")
          .eq("user_id", userId)
          .eq("notification_key", notificationKey)
          .maybeSingle();

      if (error) {
        throw new Error(
          `Failed to inspect notification delivery: ${error.message}`,
        );
      }

      if (existing?.status !== "delivered") {
        throw new Error(
          `Notification delivery is still claimed: ${notificationKey}`,
        );
      }
    }

    return false;
  }

  /*
   * Once at least one device has actually
   * received the Push, do not release the
   * claim on later bookkeeping errors.
   *
   * Releasing after a successful Push could
   * cause an immediate duplicate notification.
   */
  let pushDelivered = false;
  let claimReleased = false;

  try {
    const result = await sendPushToUser(
      userId,
      {
        title,
        body,
        url,
      },
    );

    if (result.sent === 0) {
      const released =
        await releaseNotificationDeliveryClaim({
          userId,
          notificationKey,
          claimToken,
        });

      claimReleased = true;

      if (strictDelivery) {
        throw new Error(
          `No device received notification (failed=${result.failed}, removed=${result.removed}, released=${released}).`,
        );
      }

      return false;
    }

    pushDelivered = true;

    let completed = false;

    try {
      completed = await completeNotificationDelivery({
        userId,
        notificationKey,
        claimToken,
      });
    } catch (cause) {
      /*
       * At least one Push request succeeded.
       * Replaying after a receipt-write failure
       * may result in duplicate notifications.
       *
       * Leave the delivery claim untouched and
       * flag the record for manual reconciliation.
       */
      console.error(
        "Push sent, but its delivery record could not be completed; manual reconciliation needed:",
        notificationKey,
        cause instanceof Error
          ? cause.message
          : String(cause),
      );

      return true;
    }

    if (!completed) {
      /*
       * This should normally only happen if
       * the lease expired and another worker
       * reclaimed it.
       *
       * Push was already delivered, so never
       * delete another worker's claim.
       */
      console.warn(
        "Notification was pushed but its delivery lease could not be completed; manual reconciliation needed.",
      );
    }

    return true;
  } catch (cause) {
    if (!pushDelivered && !claimReleased) {
      await releaseNotificationDeliveryClaim({
        userId,
        notificationKey,
        claimToken,
      });
    }

    console.warn(
      "Reminder delivery failed:",
      cause instanceof Error
        ? cause.message
        : String(cause),
    );

    if (strictDelivery) {
      throw cause;
    }

    return false;
  }
}

async function runPersonalReminders(
  now: number,
  userId?: string,
  onCandidate?: (candidate: ReminderCandidate) => void,
  onlyNotificationKey?: string,
  strictDelivery = false,
) {
  const supabase = createAdminClient();

  const end = now + PERSONAL_WINDOW_MS;

  /*
   * Include both date keys because the
   * 10-minute window can cross midnight.
   */
  const dateKeys = Array.from(
    new Set([getTaipeiDateKey(now), getTaipeiDateKey(end)]),
  );

  let query = supabase
    .from("personal_plans")
    .select(
      `
          id,
          user_id,
          title,
          plan_date,
          start_time,
          completed_at
        `,
    )
    .in("plan_date", dateKeys)
    .is("completed_at", null)
    .not("start_time", "is", null);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load Personal reminders: ${error.message}`);
  }

  let sent = 0;

  for (const plan of data ?? []) {
    if (!plan.start_time) {
      continue;
    }

    const startAt = buildTaipeiTimestamp(plan.plan_date, plan.start_time);

    /*
     * Send the first time the plan enters
     * the upcoming 10-minute window.
     */
    if (startAt <= now || startAt > end) {
      continue;
    }

    const reminderKey = buildScheduledNotificationKey(
      `personal:${plan.id}:10m`,
      startAt,
    );

    if (
      !matchesNotificationDispatchKey(
        reminderKey,
        onlyNotificationKey,
      )
    ) {
      continue;
    }

    if (onCandidate) {
      onCandidate({
        userId: plan.user_id,
        notificationKey: reminderKey,
        notificationType: "personal_10m",
        sourceId: plan.id,
      });
      continue;
    }

    const delivered = await deliverOnce({
      strictDelivery,
      userId: plan.user_id,

      notificationKey: reminderKey,

      notificationType: "personal_10m",

      sourceId: plan.id,

      title: "An & Yao",

      body: `「${plan.title}」快要開始了`,

      url: "/",
    });

    if (delivered) {
      sent += 1;
    }
  }

  return sent;
}

async function runAssignmentReminders(
  now: number,
  userId?: string,
  onCandidate?: (candidate: ReminderCandidate) => void,
  onlyNotificationKey?: string,
  strictDelivery = false,
) {
  const supabase = createAdminClient();

  const nowIso = new Date(now).toISOString();

  const endIso = new Date(now + ASSIGNMENT_WINDOW_MS).toISOString();

  let query = supabase
    .from("study_assignments")
    .select(
      `
          id,
          user_id,
          title,
          course_name,
          due_at
        `,
    )
    .eq("submitted", false)
    .not("due_at", "is", null)
    .gt("due_at", nowIso)
    .lte("due_at", endIso);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load Assignment reminders: ${error.message}`);
  }

  let sent = 0;

  for (const assignment of data ?? []) {
    if (!assignment.due_at) {
      continue;
    }

    const scheduledAt = Date.parse(assignment.due_at);

    if (!Number.isFinite(scheduledAt)) {
      continue;
    }

    const reminderKey = buildScheduledNotificationKey(
      `assignment:${assignment.id}:24h`,
      scheduledAt,
    );

    if (
      !matchesNotificationDispatchKey(
        reminderKey,
        onlyNotificationKey,
      )
    ) {
      continue;
    }

    if (onCandidate) {
      onCandidate({
        userId: assignment.user_id,
        notificationKey: reminderKey,
        notificationType: "assignment_24h",
        sourceId: assignment.id,
      });
      continue;
    }

    const delivered = await deliverOnce({
      strictDelivery,
      userId: assignment.user_id,

      notificationKey: reminderKey,

      notificationType: "assignment_24h",

      sourceId: assignment.id,

      title: "An & Yao · Study",

      body: `${assignment.course_name}：${assignment.title} 將在 24 小時內截止`,

      url: `/study/assignments/${assignment.id}`,
    });

    if (delivered) {
      sent += 1;
    }
  }

  return sent;
}

async function runDateReminders(
  now: number,
  userId?: string,
  onCandidate?: (candidate: ReminderCandidate) => void,
  onlyNotificationKey?: string,
  strictDelivery = false,
) {
  const supabase = createAdminClient();

  const end = now + DATE_WINDOW_MS;

  const dateKeys = Array.from(
    new Set([getTaipeiDateKey(now), getTaipeiDateKey(end)]),
  );

  const { data: days, error: daysError } = await supabase
    .from("date_days")
    .select(
      `
          id,
          date_id,
          date,
          planning_start_time
        `,
    )
    .in("date", dateKeys);

  if (daysError) {
    throw new Error(`Failed to load Date reminder days: ${daysError.message}`);
  }

  if (!days || days.length === 0) {
    return 0;
  }

  const candidateDays = days.filter((day) => {
    const startAt = buildTaipeiTimestamp(day.date, day.planning_start_time);

    return startAt > now && startAt <= end;
  });

  if (candidateDays.length === 0) {
    return 0;
  }

  const dateIds = Array.from(new Set(candidateDays.map((day) => day.date_id)));

  const [datesResult, participantsResult] = await Promise.all([
    supabase
      .from("dates")
      .select(
        `
            id,
            title,
            status
          `,
      )
      .in("id", dateIds)
      .eq("status", "accepted"),

    supabase
      .from("date_participants")
      .select(
        `
            date_id,
            user_id,
            status
          `,
      )
      .in("date_id", dateIds)
      .eq("status", "accepted"),
  ]);

  if (datesResult.error) {
    throw new Error(`Failed to load Dates: ${datesResult.error.message}`);
  }

  if (participantsResult.error) {
    throw new Error(
      `Failed to load Date participants: ${participantsResult.error.message}`,
    );
  }

  const dates = new Map(
    (datesResult.data ?? []).map((date) => [date.id, date]),
  );

  let sent = 0;

  for (const day of candidateDays) {
    const date = dates.get(day.date_id);

    if (!date) {
      continue;
    }

    const participants = (participantsResult.data ?? []).filter(
      (participant) =>
        participant.date_id === date.id &&
        (!userId || participant.user_id === userId),
    );

    for (const participant of participants) {
      const scheduledAt = buildTaipeiTimestamp(
        day.date,
        day.planning_start_time,
      );

      const reminderKey = buildScheduledNotificationKey(
        `date:${date.id}:${day.id}:1h`,
        scheduledAt,
      );

      if (
        !matchesNotificationDispatchKey(
          reminderKey,
          onlyNotificationKey,
        )
      ) {
        continue;
      }

      if (onCandidate) {
        onCandidate({
          userId: participant.user_id,
          notificationKey: reminderKey,
          notificationType: "date_1h",
          sourceId: day.id,
        });
        continue;
      }

      const delivered = await deliverOnce({
        strictDelivery,
        userId: participant.user_id,

        /*
         * Include date_day ID because a
         * multi-day Date should be able to
         * remind once for each day.
         */
        notificationKey: reminderKey,

        notificationType: "date_1h",

        sourceId: day.id,

        title: "An & Yao · Date",

        body: `「${date.title}」1 小時內就要開始了`,

        url: `/dates/${date.id}`,
      });

      if (delivered) {
        sent += 1;
      }
    }
  }

  return sent;
}

async function runReminderCategory(
  category: keyof ReminderStats,
  worker: () => Promise<number>,
  strict = false,
) {
  try {
    return await worker();
  } catch (cause) {
    /*
     * Reminder categories are independent.
     *
     * A database/query failure in one category
     * must never prevent the remaining categories
     * from being processed during this Cron run.
     */
    console.error(
      `Notification reminder category failed: ${category}`,
      cause instanceof Error
        ? cause.message
        : String(cause),
    );

    if (strict) {
      throw cause;
    }

    return 0;
  }
}

export async function runNotificationReminders(
  options: RunNotificationRemindersOptions = {},
): Promise<ReminderStats> {
  const now = options.now ?? Date.now();

  if (!Number.isFinite(now)) {
    throw new Error(
      "Invalid notification reminder time.",
    );
  }

  /*
   * Keep execution sequential to avoid suddenly
   * increasing database / Push concurrency, while
   * isolating each category's failures.
   */
  const personal =
    shouldRunNotificationCategory(
      "personal",
      options.onlyNotificationKey,
    )
      ? await runReminderCategory(
          "personal",
          () =>
            runPersonalReminders(
              now,
              options.userId,
              options.onCandidate,
              options.onlyNotificationKey,
              options.strictDelivery,
            ),
          options.strict,
        )
      : 0;

  const assignments =
    shouldRunNotificationCategory(
      "assignments",
      options.onlyNotificationKey,
    )
      ? await runReminderCategory(
          "assignments",
          () =>
            runAssignmentReminders(
              now,
              options.userId,
              options.onCandidate,
              options.onlyNotificationKey,
              options.strictDelivery,
            ),
          options.strict,
        )
      : 0;

  const dates =
    shouldRunNotificationCategory(
      "dates",
      options.onlyNotificationKey,
    )
      ? await runReminderCategory(
          "dates",
          () =>
            runDateReminders(
              now,
              options.userId,
              options.onCandidate,
              options.onlyNotificationKey,
              options.strictDelivery,
            ),
          options.strict,
        )
      : 0;

  return {
    personal,
    assignments,
    dates,
  };
}

/**
 * Enumerate eligible reminders without claiming
 * deliveries or sending Push.
 *
 * Results may contain already-delivered reminders.
 * The Queue producer must exclude them before
 * enqueuing Jobs.
 */
export async function discoverNotificationReminderCandidates(
  now = Date.now(),
): Promise<ReminderCandidate[]> {
  const candidates: ReminderCandidate[] = [];

  await runNotificationReminders({
    now,
    strict: true,
    onCandidate: (candidate) => {
      candidates.push(candidate);
    },
  });

  return candidates;
}
