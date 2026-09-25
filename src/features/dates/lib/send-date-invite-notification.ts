import "server-only";

import { sendPushToUser } from "@/features/notifications/lib/send-push-to-user";

type SendDateInviteNotificationInput = {
  inviteeUserId: string;
  organizerName: string;
  dateId: string;
  title?: string | null;
};

export async function sendDateInviteNotification({
  inviteeUserId,
  organizerName,
  dateId,
  title,
}: SendDateInviteNotificationInput) {
  try {
    const body = title?.trim()
      ? `${organizerName} 邀請你一起去「${title.trim()}」`
      : `${organizerName} 邀請你一起去約會`;

    const result = await sendPushToUser(inviteeUserId, {
      title: "An & Yao",
      body,
      url: `/dates/${dateId}`,
    });

    return {
      success: true as const,
      ...result,
    };
  } catch (cause) {
    /*
     * Push notification is best-effort.
     *
     * A temporary Apple / Mozilla Push
     * failure must never make Date creation
     * fail.
     */
    console.warn(
      "Date invitation push failed:",
      cause instanceof Error ? cause.message : String(cause),
    );

    return {
      success: false as const,
    };
  }
}
