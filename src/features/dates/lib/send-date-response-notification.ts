import "server-only";

import { sendPushToUser } from "@/features/notifications/lib/send-push-to-user";

type DateInvitationResponse = "accepted" | "declined";

type SendDateResponseNotificationInput = {
  organizerUserId: string;
  responderName: string;
  dateId: string;
  title?: string | null;
  response: DateInvitationResponse;
};

export async function sendDateResponseNotification({
  organizerUserId,
  responderName,
  dateId,
  title,
  response,
}: SendDateResponseNotificationInput) {
  try {
    const trimmedTitle = title?.trim();

    let body: string;

    if (response === "accepted") {
      body = trimmedTitle
        ? `${responderName} 接受了「${trimmedTitle}」的邀請`
        : `${responderName} 接受了這次 Date 的邀請`;
    } else {
      body = trimmedTitle
        ? `${responderName} 拒絕了「${trimmedTitle}」的邀請`
        : `${responderName} 拒絕了這次 Date 的邀請`;
    }

    const result = await sendPushToUser(organizerUserId, {
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
     * Invitation response already succeeded.
     * Push is best-effort and must never make
     * the Date response appear to have failed.
     */
    console.warn(
      "Date response push failed:",
      cause instanceof Error ? cause.message : String(cause),
    );

    return {
      success: false as const,
    };
  }
}
