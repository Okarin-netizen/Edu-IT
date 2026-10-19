/* A2 木材の繊維・収縮ラボ — 基本機能(ルビ・保存・キャンバス補助)
 * 共通基盤 window.G があればそれを使い、なければ単体で動く。 */
(function () {
  'use strict';
  var A2 = (window.A2 = window.A2 || {});
  A2.labs = {};
  A2.rubyOn = true;

  /* ---------- ルビ ---------- */
  var RUBY_RE = /\{([^|{}]+)\|([^{}]+)\}/g;
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  A2.esc = esc;
  /** "{漢字|かんじ}" 記法 → <ruby> を含むHTML(記法以外のHTMLはそのまま通す:アプリ内の固定文のみ) */
  A2.rb = function (s) {
    return String(s).replace(RUBY_RE, function (m, base, yomi) {
      return '<ruby>' + base + '<rp>(</rp><rt>' + yomi + '</rt><rp>)</rp></ruby>';
    });
  };
  /** 読みを外した文字列 */
  A2.plain = function (s) {
    return String(s).replace(RUBY_RE, '$1').replace(/<[^>]+>/g, '');
  };
  /** option など ruby が使えない所向け: ルビありなら「漢字(かんじ)」 */
  A2.paren = function (s) {
    if (!A2.rubyOn) return A2.plain(s);
    return String(s).replace(RUBY_RE, '$1($2)').replace(/<[^>]+>/g, '');
  };
  /** 記法をパーツに分ける [{t:'漢字', r:'かんじ'}, {t:'の'}] */
  A2.segments = function (s) {
    var out = [], last = 0, m;
    s = String(s);
    RUBY_RE.lastIndex = 0;
    while ((m = RUBY_RE.exec(s))) {
      if (m.index > last) out.push({ t: s.slice(last, m.index) });
      out.push({ t: m[1], r: m[2] });
      last = m.index + m[0].length;
    }
    if (last < s.length) out.push({ t: s.slice(last) });
    return out;
  };
  /** ルビの表示状態を html.ruby-off から読み取り、option の文字を更新する。
   *  共通基盤 G がないときは本文の {漢字|かんじ} 記法も自分で変換する。 */
  A2.applyRuby = function (root) {
    A2.rubyOn = !document.documentElement.classList.contains('ruby-off');
    root = root || document.body;
    root.querySelectorAll('option[data-r]').forEach(function (el) { el.textContent = A2.paren(el.getAttribute('data-r')); });
    if (window.G && G.ruby) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), list = [], n;
    while ((n = walker.nextNode())) if (n.nodeValue.indexOf('{') >= 0 && !/^(SCRIPT|STYLE|TEXTAREA|OPTION)$/.test(n.parentNode.nodeName)) list.push(n);
    list.forEach(function (t) {
      var span = document.createElement('span');
      span.innerHTML = A2.rb(A2.esc(t.nodeValue));
      while (span.firstChild) t.parentNode.insertBefore(span.firstChild, t);
      t.remove();
    });
  };
  /** 要素にルビ付きの文を入れる */
  A2.setR = function (el, src) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return;
    el.setAttribute('data-r', src);
    el.innerHTML = A2.rb(src);
  };

  A2.isHC = function () { return document.documentElement.classList.contains('high-contrast'); };
  /* ---------- 色(CSS変数から) ---------- */
  var colCache = null;
  A2.col = function (name) {
    if (!colCache) colCache = getComputedStyle(document.documentElement);
    return colCache.getPropertyValue('--' + name).trim() || '#000';
  };
  A2.resetColors = function () { colCache = null; A2.patterns = {}; };

  /* ---------- キャンバス ---------- */
  /** 論理サイズ(width/height属性)を保ったまま高解像度化。ctx を返す */
  A2.setupCanvas = function (cv) {
    if (!cv._w) { cv._w = cv.width; cv._h = cv.height; }
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssW = cv.clientWidth || cv._w;
    var scale = Math.max(1, (cssW / cv._w) * dpr);
    scale = Math.min(scale, 2.5);
    var W = Math.round(cv._w * scale), H = Math.round(cv._h * scale);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    var ctx = cv.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.W = cv._w; ctx.H = cv._h; ctx.scale_ = scale;
    return ctx;
  };

  /** ルビ記法つきの文字をキャンバスに描く */
  A2.text = function (ctx, src, x, y, o) {
    o = o || {};
    var size = o.size || 14;
    var segs = A2.segments(src);
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.font = (o.bold ? 'bold ' : '') + size + 'px ' + A2.FONT;
    var total = 0;
    segs.forEach(function (sg) { sg.w = ctx.measureText(sg.t).width; total += sg.w; });
    var sx = x;
    if (o.align === 'center') sx = x - total / 2;
    else if (o.align === 'right') sx = x - total;
    if (o.bg) {
      ctx.fillStyle = o.bg;
      var top = y - size * (A2.rubyOn && segs.some(function (s) { return s.r; }) ? 1.55 : 1.05);
      ctx.fillRect(sx - 4, top, total + 8, y - top + size * 0.35);
    }
    ctx.fillStyle = o.color || A2.col('ink');
    var cx = sx;
    segs.forEach(function (sg) {
      ctx.font = (o.bold ? 'bold ' : '') + size + 'px ' + A2.FONT;
      ctx.fillText(sg.t, cx, y);
      if (sg.r && A2.rubyOn) {
        var rs = Math.max(8, size * 0.5);
        ctx.font = rs + 'px ' + A2.FONT;
        var rw = ctx.measureText(sg.r).width;
        var fit = rw > sg.w ? sg.w / rw : 1;
        ctx.save();
        ctx.translate(cx + sg.w / 2, y - size * 0.98);
        ctx.scale(fit, 1);
        ctx.textAlign = 'center';
        ctx.fillText(sg.r, 0, 0);
        ctx.restore();
      }
      cx += sg.w;
    });
    ctx.restore();
    return total;
  };
  A2.FONT = '"BIZ UDPGothic","Hiragino Sans","Noto Sans JP","Meiryo",sans-serif';

  /** 色に頼らない区別のための模様 */
  A2.patterns = {};
  A2.pattern = function (ctx, kind) {
    var key = kind + (A2.isHC() ? '-hc' : '');
    if (A2.patterns[key]) return A2.patterns[key];
    var c = document.createElement('canvas');
    c.width = c.height = 10;
    var g = c.getContext('2d');
    g.strokeStyle = g.fillStyle = A2.col('pattern-ink');
    g.lineWidth = 1;
    if (kind === 'hatch') { g.beginPath(); g.moveTo(0, 10); g.lineTo(10, 0); g.moveTo(-5, 5); g.lineTo(5, -5); g.moveTo(5, 15); g.lineTo(15, 5); g.stroke(); }
    else if (kind === 'dots') { g.beginPath(); g.arc(2.5, 2.5, 0.9, 0, 7); g.arc(7.5, 7.5, 0.9, 0, 7); g.fill(); }
    else if (kind === 'cross') { g.beginPath(); g.moveTo(0, 5); g.lineTo(10, 5); g.moveTo(5, 0); g.lineTo(5, 10); g.stroke(); }
    else if (kind === 'stripe') { g.lineWidth = 3; g.beginPath(); g.moveTo(0, 10); g.lineTo(10, 0); g.stroke(); }
    var p = ctx.createPattern(c, 'repeat');
    A2.patterns[key] = p;
    return p;
  };

  /* ---------- 保存(IndexedDB) ---------- */
  var DB_NAME = 'a2-wood-lab', STORE = 'kv', dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('no idb'));
      var rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore(STORE); };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error); };
    });
    return dbp;
  }
  var memStore = {};
  A2.store = {
    get: function (key) {
      return db().then(function (d) {
        return new Promise(function (res, rej) {
          var rq = d.transaction(STORE).objectStore(STORE).get(key);
          rq.onsuccess = function () { res(rq.result); };
          rq.onerror = function () { rej(rq.error); };
        });
      }).catch(function () { return memStore[key]; });
    },
    set: function (key, val) {
      memStore[key] = val;
      return db().then(function (d) {
        return new Promise(function (res, rej) {
          var tx = d.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(val, key);
          tx.oncomplete = function () { res(); };
          tx.onerror = function () { rej(tx.error); };
        });
      }).catch(function () {});
    }
  };

  /* 記録は共通スキーマ artifact 1件(この端末の「木材ラボの記録」)として持つ。
   * 共通基盤 G があれば G.store(全アプリ共通の保存場所)に入れる。 */
  A2.APP = 'wood-lab';
  A2.RECORD_ID = 'wood-lab-record';
  A2.newRecord = function () {
    var now = new Date().toISOString();
    return { schema: 'gijutsu-artifact/1', id: A2.RECORD_ID, app: A2.APP, kind: 'record',
      title: '木材の繊維・収縮ラボの記録', createdAt: now, updatedAt: now, data: { notes: {}, quizLog: [] } };
  };
  function fixRecord(a) {
    if (!a) return A2.newRecord();
    a.data = a.data || {};
    a.data.notes = a.data.notes || {};
    a.data.quizLog = Array.isArray(a.data.quizLog) ? a.data.quizLog : [];
    return a;
  }
  A2.loadRecords = function () {
    var p = (window.G && G.store) ? G.store.get(A2.RECORD_ID) : A2.store.get('record');
    return p.then(fixRecord).catch(function () { return A2.newRecord(); });
  };
  A2.saveRecords = function (a) {
    a.updatedAt = new Date().toISOString();
    if (window.G && G.store) return G.store.put(a);
    return A2.store.set('record', a);
  };

  /* ---------- 設定(端末内の表示設定) ---------- */
  A2.pref = function (k, v) {
    try {
      if (v === undefined) return localStorage.getItem('a2.' + k);
      localStorage.setItem('a2.' + k, v);
    } catch (e) { return null; }
  };

  /* ---------- 小道具 ---------- */
  /** 割合を「−4.5%」「+1.0%」の形に。丸めて0になるときは符号を付けない(「−0.0%」を出さない) */
  A2.signedPct = function (v, d) {
    d = d == null ? 1 : d;
    var s = (Math.abs(v) * 100).toFixed(d);
    if (+s === 0) return (0).toFixed(d) + '%';
    return (v < 0 ? '−' : '+') + s + '%';
  };
  /** 縮んだ量(正の数)を「−4.5%」の形に。0なら「0.0%」 */
  A2.shrinkPct = function (v, d) { return A2.signedPct(-v, d); };
  A2.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  A2.lerp = function (a, b, t) { return a + (b - a) * t; };
  A2.ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  A2.reducedMotion = function () {
    return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  };
  /** 再描画を1フレームにまとめる */
  A2.scheduler = function (fn) {
    var pending = false;
    return function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; fn(); });
    };
  };
  /** t: 0→1 のアニメ。戻り値の関数で中止 */
  A2.animate = function (ms, step, done) {
    var start = null, stop = false;
    if (A2.reducedMotion()) ms = Math.min(ms, 200);
    function f(ts) {
      if (stop) return;
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / ms);
      step(t);
      if (t < 1) requestAnimationFrame(f);
      else if (done) done();
    }
    requestAnimationFrame(f);
    return function () { stop = true; };
  };
})();
