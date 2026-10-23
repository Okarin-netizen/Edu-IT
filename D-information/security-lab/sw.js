// オフラインで使えるように、教材のファイルをすべて端末にキャッシュする（外部への通信はしない）
const CACHE = "seclab-v12";
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
  "js/store.js",
  "js/ui.js",
  "js/data.js",
  "js/cryptolib.js",
  "js/passwordlib.js",
  "js/settings.js",
  "js/branch.js",
  "js/consult.js",
  "js/catalog.js",
  "js/check.js",
  "js/records.js",
  "modules/protect.js",
  "modules/password.js",
  "modules/crypto.js",
  "modules/phishing.js",
  "modules/sns.js",
  "modules/tattoo.js",
  "modules/copyright.js",
  "modules/roleplay.js",
  "modules/declare.js",
  "data/config.json",
  "data/quiz.json",
  "data/ruby.json",
  "data/common-passwords.json",
  "data/passphrase-words.json",
  "data/crypto.json",
  "data/phishing.json",
  "data/copyright.json",
  "data/roleplay.json",
  "data/consult.json",
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
