"use client";

import { useEffect, useState } from "react";

import {
  savePushSubscriptionAction,
  sendTestPushAction,
} from "@/features/notifications/actions";
type NotificationState =
  | "loading"
  | "unsupported"
  | "default"
  | "granted-unsubscribed"
  | "subscribed"
  | "denied"
  | "error";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((character) => character.charCodeAt(0)),
  );
}

async function saveSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();

  const endpoint = json.endpoint;

  const p256dh = json.keys?.p256dh;

  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Push subscription 缺少必要金鑰。");
  }

  const result = await savePushSubscriptionAction({
    endpoint,
    p256dh,
    auth,
    userAgent: navigator.userAgent,
  });

  if (!result.success) {
    throw new Error(result.error);
  }
}

export default function NotificationSettings() {
  const [state, setState] = useState<NotificationState>("loading");

  const [error, setError] = useState("");

  const [isSendingTest, setIsSendingTest] = useState(false);

  const [testMessage, setTestMessage] = useState("");
  useEffect(() => {
    async function setup() {
      if (
        !("serviceWorker" in navigator) ||
        !("Notification" in window) ||
        !("PushManager" in window)
      ) {
        setState("unsupported");

        return;
      }

      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        if (Notification.permission === "denied") {
          setState("denied");

          return;
        }

        if (Notification.permission !== "granted") {
          setState("default");

          return;
        }

        const registration = await navigator.serviceWorker.ready;

        const subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          setState("granted-unsubscribed");

          return;
        }

        /*
         * Important for our current migration:
         *
         * Firefox already has a subscription from
         * the previous step, but it has not yet
         * been saved to Supabase.
         *
         * Therefore an existing subscription is
         * automatically synced to the server.
         */
        await saveSubscription(subscription);

        setState("subscribed");
      } catch (cause) {
        console.error("Notification setup failed:", cause);

        setState("error");

        setError(cause instanceof Error ? cause.message : "無法啟用通知服務。");
      }
    }

    void setup();
  }, []);
  async function sendTestNotification() {
    setIsSendingTest(true);
    setTestMessage("");

    try {
      const result = await sendTestPushAction();

      if (!result.success) {
        setTestMessage(result.error);

        return;
      }

      setTestMessage(`測試通知已送出${result.sent ? ` (${result.sent})` : ""}`);
    } finally {
      setIsSendingTest(false);
    }
  }
  async function createPushSubscription() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!publicKey) {
      throw new Error("VAPID public key is not configured.");
    }

    const registration = await navigator.serviceWorker.ready;

    const existing = await registration.pushManager.getSubscription();

    if (existing) {
      return existing;
    }

    return registration.pushManager.subscribe({
      userVisibleOnly: true,

      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  async function enableNotifications() {
    setError("");

    if (
      !("serviceWorker" in navigator) ||
      !("Notification" in window) ||
      !("PushManager" in window)
    ) {
      setState("unsupported");

      return;
    }

    try {
      let permission = Notification.permission;

      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission === "denied") {
        setState("denied");

        return;
      }

      if (permission !== "granted") {
        setState("default");

        return;
      }

      const subscription = await createPushSubscription();

      /*
       * Creating the browser subscription is
       * only half the job. Save it for the
       * currently authenticated An & Yao user.
       */
      await saveSubscription(subscription);

      setState("subscribed");
    } catch (cause) {
      console.error("Push subscription failed:", cause);

      setState("error");

      setError(cause instanceof Error ? cause.message : "無法建立通知訂閱。");
    }
  }

  if (state === "loading") {
    return <p className="text-xs text-[var(--muted)]">Checking...</p>;
  }

  if (state === "unsupported") {
    return (
      <p className="text-xs leading-5 text-[var(--muted)]">
        這個瀏覽器目前不支援 Push 通知。 如果是 iPhone，請先把 An & Yao
        加到主畫面，再從主畫面開啟。
      </p>
    );
  }

  if (state === "subscribed") {
    return (
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">裝置通知</p>

            <p className="mt-1 text-[10px] text-[var(--muted)]">已啟用 Push</p>
          </div>

          <span className="text-sm text-[var(--accent)]">✓</span>
        </div>

        <button
          type="button"
          disabled={isSendingTest}
          onClick={sendTestNotification}
          className="
          mt-3
          w-full
          rounded-xl
          border
          border-[var(--border)]
          px-3
          py-2
          text-xs
          transition
          hover:border-[var(--foreground)]
          disabled:opacity-50
        "
        >
          {isSendingTest ? "Sending..." : "發送測試通知"}
        </button>

        {testMessage && (
          <p className="mt-2 text-[10px] text-[var(--muted)]">{testMessage}</p>
        )}
      </div>
    );
  }
  if (state === "denied") {
    return (
      <div>
        <p className="text-sm font-medium">裝置通知</p>

        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          通知已被關閉，需要到瀏覽器或系統設定重新允許 An & Yao 的通知。
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">裝置通知</p>

          <p className="mt-1 text-[10px] text-[var(--muted)]">
            Personal、Study、Dates 提醒
          </p>
        </div>

        <button
          type="button"
          onClick={enableNotifications}
          className="
            shrink-0
            rounded-xl
            border
            border-[var(--border)]
            px-3
            py-2
            text-xs
            transition
            hover:border-[var(--foreground)]
          "
        >
          {state === "granted-unsubscribed" ? "完成啟用" : "開啟通知"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
