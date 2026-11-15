// DoseVoice service worker: shows reminder notifications and handles their buttons.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

async function tellPages(msg) {
  const pages = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  pages.forEach((p) => p.postMessage(msg));
  return pages;
}

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const d = n.data || {};
  n.close();

  event.waitUntil((async () => {
    if (event.action === "take" && !d.test) {
      try {
        await fetch("/api/doses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ medId: d.medId, date: d.date, time: d.time, status: "taken" }),
        });
        await tellPages({ type: "dv-dose-taken", medId: d.medId, time: d.time });
      } catch {
        await tellPages({ type: "dv-open-reminder", medId: d.medId, time: d.time });
      }
      return;
    }
    if (event.action === "take" && d.test) {
      await tellPages({ type: "dv-dose-taken", test: true });
      return;
    }
    if (event.action === "snooze") {
      await tellPages({ type: "dv-snooze", medId: d.medId, time: d.time, test: !!d.test });
      return;
    }
    // Plain click: bring DoseVoice to the front.
    const pages = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const page = pages[0];
    if (page) {
      await page.focus();
    } else {
      await self.clients.openWindow("/#today");
    }
  })());
});
