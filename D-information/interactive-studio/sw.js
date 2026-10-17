// オフラインで使えるように、スタジオのファイルをすべて端末にキャッシュする（外部への通信はしない）
const CACHE = "istudio-v7";
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon.svg",
  "css/style.css",
  "../eduit-info.js",
  "../../shared/eduit-frame.css",
  "../../shared/eduit-frame.js",
  "js/ui.js",
  "js/lang.js",
  "js/interp.js",
  "js/runner.js",
  "js/blockmodel.js",
  "js/server.js",
  "js/store.js",
  "js/samples.js",
  "js/bundle.js",
  "js/stage.js",
  "js/blocks.js",
  "js/app.js",
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
