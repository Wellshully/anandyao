import "server-only";

import webPush from "web-push";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  authKey: string;
};

function getVapidDetails() {
  const subject = process.env.VAPID_SUBJECT;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    throw new Error("VAPID configuration is incomplete.");
  }

  return {
    subject,
    publicKey,
    privateKey,
  };
}

export async function sendWebPush(
  subscription: StoredPushSubscription,
  payload: PushPayload,
) {
  const vapid = getVapidDetails();

  return webPush.sendNotification(
    {
      endpoint: subscription.endpoint,

      keys: {
        p256dh: subscription.p256dh,

        auth: subscription.authKey,
      },
    },

    JSON.stringify({
      title: payload.title,

      body: payload.body,

      url: payload.url ?? "/",
    }),

    {
      TTL: 60,

      urgency: "normal",

      vapidDetails: {
        subject: vapid.subject,

        publicKey: vapid.publicKey,

        privateKey: vapid.privateKey,
      },
    },
  );
}

export function getWebPushStatusCode(cause: unknown) {
  if (typeof cause !== "object" || cause === null || !("statusCode" in cause)) {
    return null;
  }

  const statusCode = (
    cause as {
      statusCode?: unknown;
    }
  ).statusCode;

  return typeof statusCode === "number" ? statusCode : null;
}
