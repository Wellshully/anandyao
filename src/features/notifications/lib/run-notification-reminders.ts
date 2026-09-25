import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { sendPushToUser } from "@/features/notifications/lib/send-push-to-user";

const PERSONAL_WINDOW_MS = 10 * 60 * 1000;

const ASSIGNMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

const DATE_WINDOW_MS = 60 * 60 * 1000;

type ReminderStats = {
  personal: number;
  assignments: number;
  dates: number;
};

type RunNotificationRemindersOptions = {
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

async function claimNotification(
  userId: string,
  notificationKey: string,
  notificationType: string,
  sourceId: string,
) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("notification_deliveries").insert({
    user_id: userId,

    notification_key: notificationKey,

    notification_type: notificationType,

    source_id: sourceId,
  });

  if (!error) {
    return true;
  }

  /*
   * PostgreSQL unique violation.
   *
   * Means this exact reminder was already
   * claimed / delivered.
   */
  if (error.code === "23505") {
    return false;
  }

  throw new Error(`Failed to claim notification: ${error.message}`);
}

async function releaseNotification(userId: string, notificationKey: string) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("notification_deliveries")
    .delete()
    .eq("user_id", userId)
    .eq("notification_key", notificationKey);

  if (error) {
    console.warn("Failed to release notification claim:", error.message);
  }
}

async function deliverOnce({
  userId,
  notificationKey,
  notificationType,
  sourceId,
  title,
  body,
  url,
}: {
  userId: string;
  notificationKey: string;
  notificationType: string;
  sourceId: string;
  title: string;
  body: string;
  url: string;
}) {
  const claimed = await claimNotification(
    userId,
    notificationKey,
    notificationType,
    sourceId,
  );

  if (!claimed) {
    return false;
  }

  try {
    const result = await sendPushToUser(userId, {
      title,
      body,
      url,
    });

    /*
     * No device actually received the push.
     *
     * Remove the delivery claim so a future
     * run can retry after the user enables a
     * device again.
     */
    if (result.sent === 0) {
      await releaseNotification(userId, notificationKey);

      return false;
    }

    return true;
  } catch (cause) {
    await releaseNotification(userId, notificationKey);

    console.warn(
      "Reminder delivery failed:",
      cause instanceof Error ? cause.message : String(cause),
    );

    return false;
  }
}

async function runPersonalReminders(now: number, userId?: string) {
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

    const delivered = await deliverOnce({
      userId: plan.user_id,

      notificationKey: `personal:${plan.id}:10m`,

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

async function runAssignmentReminders(now: number, userId?: string) {
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
    const delivered = await deliverOnce({
      userId: assignment.user_id,

      notificationKey: `assignment:${assignment.id}:24h`,

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

async function runDateReminders(now: number, userId?: string) {
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
      const delivered = await deliverOnce({
        userId: participant.user_id,

        /*
         * Include date_day ID because a
         * multi-day Date should be able to
         * remind once for each day.
         */
        notificationKey: `date:${date.id}:${day.id}:1h`,

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

export async function runNotificationReminders(
  options: RunNotificationRemindersOptions = {},
): Promise<ReminderStats> {
  const now = Date.now();

  /*
   * Keep these separate so one reminder
   * category failing does not silently hide
   * which query caused the problem.
   */
  const personal = await runPersonalReminders(now, options.userId);

  const assignments = await runAssignmentReminders(now, options.userId);

  const dates = await runDateReminders(now, options.userId);

  return {
    personal,
    assignments,
    dates,
  };
}
