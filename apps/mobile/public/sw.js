// Service worker: app shell cache so the second open is instant and works
// offline, plus web push for the daily reminder.
const CACHE = 'fitlens-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function scopePath() {
  return new URL(self.registration.scope).pathname;
}

function isStatic(pathname) {
  return pathname.includes('/_expo/static/') || pathname.includes('/assets/') || pathname.includes('/icons/') || pathname.endsWith('.webmanifest') || pathname.endsWith('.ttf') || pathname.endsWith('.woff2');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const scope = scopePath();
  if (!url.pathname.startsWith(scope)) return;

  // Any route: the page from the network, the cached page when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(scope, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(scope).then((hit) => hit || Response.error())),
    );
    return;
  }

  // Hashed bundles, fonts and icons never change under the same name: cache first.
  if (isStatic(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          }),
      ),
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'FitLens', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'FitLens';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'fitlens-reminder',
      renotify: true,
      data: { url: data.url || './' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          if ('navigate' in client) client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
