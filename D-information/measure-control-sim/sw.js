// オフラインで使えるように、教材のファイルをすべて端末にキャッシュする（外部への通信はしない）
const CACHE = "mcsim-v13";
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon.svg",
  "../d-common.css",
  "css/style.css",
  "../eduit-info.js",
  "../../shared/eduit-frame.css",
  "../../shared/eduit-frame.js",
  "js/app.js",
  "js/ui.js",
  "js/store.js",
  "js/data.js",
  "js/lang.js",
  "js/interp.js",
  "js/models.js",
  "js/sim.js",
  "js/blocks.js",
  "js/flow.js",
  "js/chart.js",
  "js/autosave.js",
  "data/scenarios.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // 外部へのリクエストは扱わない（そもそも発生しない設計）
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    })),
  );
});
