// オフラインで使えるように、教材のファイルをすべて端末にキャッシュする（外部への通信はしない）
const CACHE = "vcpu-v7";
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon.svg",
  "css/style.css",
  "../eduit-info.js",
  "../../shared/eduit-frame.css",
  "../../shared/eduit-frame.js",
  "js/app.js",
  "js/ui.js",
  "js/data.js",
  "js/store.js",
  "js/vm.js",
  "js/sim.js",
  "js/diagram.js",
  "js/tasks.js",
  "js/auto.js",
  "js/records.js",
  "data/isa.json",
  "data/tasks.json",
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
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    })),
  );
});
