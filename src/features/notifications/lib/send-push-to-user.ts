import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  getWebPushStatusCode,
  sendWebPush,
} from "@/features/notifications/lib/send-web-push";

import type { PushPayload } from "@/features/notifications/lib/send-web-push";

export type SendPushToUserResult = {
  sent: number;
  removed: number;
  failed: number;
};

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<SendPushToUserResult> {
  if (!userId) {
    throw new Error("Push target user ID is required.");
  }

  const supabase = createAdminClient();

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select(
      `
          id,
          endpoint,
          p256dh,
          auth_key
        `,
    )
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to load push subscriptions: ${error.message}`);
  }

  let sent = 0;

  let removed = 0;

  let failed = 0;

  for (const subscription of subscriptions ?? []) {
    try {
      await sendWebPush(
        {
          endpoint: subscription.endpoint,

          p256dh: subscription.p256dh,

          authKey: subscription.auth_key,
        },
        payload,
      );

      sent += 1;
    } catch (cause) {
      const statusCode = getWebPushStatusCode(cause);

      /*
       * Browser / Push Service no longer
       * recognises this subscription.
       *
       * Remove it so future notifications
       * don't keep retrying a dead device.
       */
      if (statusCode === 404 || statusCode === 410) {
        const { error: deleteError } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("id", subscription.id);

        if (deleteError) {
          console.warn(
            "Failed to remove stale push subscription:",
            deleteError.message,
          );

          failed += 1;

          continue;
        }

        removed += 1;

        continue;
      }

      /*
       * One broken device must not stop
       * notifications going to the user's
       * other devices.
       *
       * Do not log endpoint or encryption
       * keys here.
       */
      console.warn("Push delivery failed:", statusCode ?? "unknown");

      failed += 1;
    }
  }

  return {
    sent,
    removed,
    failed,
  };
}
