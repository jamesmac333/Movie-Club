// Keeps a copy of the site on the phone, so the Home Screen app opens straight away and
// still shows the schedule, reviews and recaps without a signal. Every request still tries
// the network first; the saved copy is only used when the network is slow or missing.

const SHELL = "movie-club-shell-v1";
const DATA = "movie-club-data-v1";
const NETWORK_WAIT_MS = 3500;

// Club data anyone can read. Anything that needs a sign-in is never saved on the device.
const SAVED_DATA = ["/api/nights", "/api/reviews", "/api/overviews", "/api/users"];
const SAVED_IMAGES = [/^\/api\/users\/[^/]+\/avatar$/, /^\/api\/overviews\/[^/]+\/image$/];

self.addEventListener("install", (event) => {
  event.waitUntil(saveAppShell().catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Other sites (posters, fonts) are left to the browser's own cache
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  let handled;
  if (request.mode === "navigate") {
    handled = networkFirst(request, SHELL, "/", (response) => pruneOldAssets(response.clone()));
  } else if (url.pathname.startsWith("/assets/")) {
    // Built files have a fingerprint in their name, so a saved copy never goes stale
    handled = cacheFirst(request, SHELL);
  } else if (SAVED_DATA.includes(url.pathname)) {
    handled = networkFirst(request, DATA, url.pathname);
  } else if (SAVED_IMAGES.some((pattern) => pattern.test(url.pathname))) {
    handled = networkFirst(request, DATA, url.pathname + url.search);
  } else if (!url.pathname.startsWith("/api/")) {
    // Icons, the manifest and other files in public/
    handled = networkFirst(request, SHELL, url.pathname);
  }
  // If the device won't let us use its storage (private browsing, storage full), just use the network
  if (handled) event.respondWith(handled.catch(() => fetch(request)));
});

// Saves the page and the built files it loads, so the first offline open works
async function saveAppShell() {
  const response = await fetch("/", { cache: "no-store" });
  if (!response.ok) return;
  const cache = await caches.open(SHELL);
  await cache.put("/", response.clone());
  const html = await response.text();
  await cache.addAll(assetPaths(html));
}

function assetPaths(html) {
  return [...new Set(html.match(/\/assets\/[^"'\s)]+/g) || [])];
}

// After a new version is published, drops built files the new page no longer uses
async function pruneOldAssets(response) {
  const keep = new Set(assetPaths(await response.text()));
  if (!keep.size) return;
  const cache = await caches.open(SHELL);
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/assets/") && !keep.has(path)) await cache.delete(request);
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone()).catch(() => {});
  return response;
}

// Uses the network when it answers in time; otherwise the saved copy, while the network
// carries on in the background to refresh it for next time
async function networkFirst(request, cacheName, key, afterSave) {
  const cache = await caches.open(cacheName);
  const fromNetwork = fetch(request).then(async (response) => {
    if (response.ok) {
      try {
        await cache.put(key, response.clone());
        if (afterSave) await afterSave(response);
      } catch {}
    }
    return response;
  });

  const saved = await cache.match(key);
  if (!saved) return fromNetwork;
  fromNetwork.catch(() => {});

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NETWORK_WAIT_MS));
  try {
    return (await Promise.race([fromNetwork, timeout])) || saved;
  } catch {
    return saved;
  }
}
