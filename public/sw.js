self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "An & Yao",
    body: "你有一則新的通知。",
    url: "/",
  };

  if (event.data) {
    try {
      data = {
        ...data,
        ...event.data.json(),
      };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,

      icon: "/favicon.ico",

      badge: "/favicon.ico",

      data: {
        url: data.url ?? "/",
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url ?? "/";

  /*
   * Always convert the notification route
   * into an absolute same-origin URL.
   *
   * Examples:
   *
   * /dates/123
   * ->
   * https://anandyao.vercel.app/dates/123
   */
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: "window",

        includeUncontrolled: true,
      });

      /*
       * Reuse the existing An & Yao window
       * if the PWA/browser is already open.
       *
       * IMPORTANT:
       * await navigate() before focus().
       *
       * This forces an actual navigation,
       * so Next.js gets fresh server data
       * instead of simply showing the old
       * screen that was sitting in memory.
       */
      for (const client of windowClients) {
        try {
          const clientUrl = new URL(client.url);

          if (clientUrl.origin !== self.location.origin) {
            continue;
          }

          const navigatedClient = await client.navigate(targetUrl);

          if (navigatedClient) {
            await navigatedClient.focus();

            return;
          }
        } catch (error) {
          console.warn("Failed to navigate existing window:", error);
        }
      }

      /*
       * No existing app window:
       * launch a new one directly at
       * the notification destination.
       */
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
