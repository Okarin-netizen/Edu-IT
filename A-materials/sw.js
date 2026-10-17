/* 技術分野アプリ Service Worker(オフライン用)
 * - インストール時にメニューと common/ を先にキャッシュする
 * - 各アプリは G.initApp({files:[...]}) で自分のファイルをキャッシュ依頼する
 * - それ以外の同じオリジンのファイルも、一度開けばキャッシュされる(キャッシュ優先)
 * 内容を更新して配り直すときは VERSION を上げる。
 */
var VERSION = 'gijutsu-v17';
var CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './common/base.css',
  './common/core.js',
  './common/ruby-dict.js',
  './common/beam.js',
  './common/materials.js',
  './common/apps.js',
  './eduit-info.js',
  './docs/先生用ガイド.html'
];
// 4分野共通の枠(A-materials の1つ上の shared/)。置いていないときもインストールは止めない
var SHARED = ['../shared/eduit-frame.css', '../shared/eduit-frame.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(CORE).then(function () {
      return Promise.all(SHARED.map(function (u) { return c.add(u).catch(function () {}); }));
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('gijutsu-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type === 'cache' && Array.isArray(d.urls)) {
    var urls = d.urls.filter(function (u) { try { return new URL(u).origin === self.location.origin; } catch (x) { return false; } });
    e.waitUntil(caches.open(VERSION).then(function (c) {
      return Promise.all(urls.map(function (u) {
        return c.match(u, { ignoreSearch: true }).then(function (hit) {
          if (hit) return null;
          return fetch(u).then(function (r) { if (r.ok) return c.put(u, r); }).catch(function () {});
        });
      }));
    }));
  }
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (r) {
        if (r && r.ok && r.type === 'basic') c.put(req, r.clone());
        return r;
      });
      if (hit) { net.catch(function () {}); return hit; } // キャッシュ優先、裏で更新
      return net.catch(function () {
        if (req.mode === 'navigate') return c.match('./index.html');
        return new Response('オフラインのため読み込めません', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      });
    });
  }));
});
