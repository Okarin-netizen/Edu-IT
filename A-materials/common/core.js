/*
 * 技術分野アプリ 共通基盤 core.js
 * - classic script(file:// でも動く)。グローバル G に機能をまとめる。
 * - 外部通信なし。保存は IndexedDB(使えない環境では localStorage)。
 * 使い方は common/README.md を参照。
 */
(function () {
  'use strict';
  var G = (window.G = window.G || {});
  G.version = '2.7.0';  // A-materials/eduit-info.js の version と合わせる
  // 作成者の表示は共通の枠(shared/eduit-frame.js)のフッターが受け持つ。ここは枠がないときの予備
  G.CREDIT = '羽生市立南中学校　技術　岡田';
  G.CREDIT_RUBY = '{羽生|はにゅう}{市立|しりつ}{南|みなみ}{中学校|ちゅうがっこう}　{技術|ぎじゅつ}　{岡田|おかだ}';
  // 「このアプリのデータを消す」で一緒に消す localStorage のキーの頭(設定 gijutsu.settings は消さない)
  G.LS_PREFIX = {
    'material-navi': ['material-navi.'], 'wood-lab': ['a2.'], 'structure-lab': ['structure-lab.'],
    'drawing-trainer': ['drawing-trainer.'], 'kidori': ['kidori.'], 'tool-safety': ['tool-safety.'], 'solid-maker': ['solid-maker.'], 'mondai-note': ['mondai-note.']
  };

  /* ---------- DOM ヘルパー ---------- */
  G.$ = function (sel, root) { return (root || document).querySelector(sel); };
  G.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // G.h('button', {class:'btn', onclick: fn}, 'ラベル', childNode, [配列も可])
  G.h = function (tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  };
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  G.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  G.uid = function (prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  };
  G.clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  // 入力値を安全な数値にする(負数・0・過大値・空欄に強い)
  G.num = function (v, def, lo, hi) {
    var n = parseFloat(String(v).replace(/[０-９．]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
    }));
    if (!isFinite(n)) n = def;
    if (lo !== undefined) n = Math.max(lo, n);
    if (hi !== undefined) n = Math.min(hi, n);
    return n;
  };
  G.fmt = function (n, digits) {
    if (!isFinite(n)) return '—';
    var d = digits === undefined ? 1 : digits;
    return Number(n.toFixed(d)).toLocaleString('ja-JP', { maximumFractionDigits: d });
  };

  /* ---------- 設定(ルビ・文字サイズ。全アプリ共通) ---------- */
  var SKEY = 'gijutsu.settings';
  G.settings = {
    all: function () {
      try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { return G.settings._mem || {}; }
    },
    get: function (k, def) { var a = G.settings.all(); return a[k] === undefined ? def : a[k]; },
    set: function (k, v) {
      var a = G.settings.all(); a[k] = v;
      try { localStorage.setItem(SKEY, JSON.stringify(a)); } catch (e) { G.settings._mem = a; }
      G.applySettings();
    }
  };
  G.applySettings = function () {
    var root = document.documentElement;
    // ふりがなは、はじめはなし(4分野で同じ)。ボタンで出す
    root.classList.toggle('ruby-off', !G.settings.get('ruby', false));
    root.setAttribute('data-size', G.settings.get('size', 'm'));
    root.classList.toggle('high-contrast', !!G.settings.get('contrast', false));
    G.$$('[data-g-setting]').forEach(function (b) {
      var k = b.getAttribute('data-g-setting');
      if (k === 'ruby') b.setAttribute('aria-pressed', String(G.settings.get('ruby', false)));
      if (k === 'contrast') b.setAttribute('aria-pressed', String(!!G.settings.get('contrast', false)));
      if (k === 'size') { b.setAttribute('data-value', G.settings.get('size', 'm')); if (G._sizeUpd) G._sizeUpd(); }
    });
  };

  /* ---------- ルビ(総ルビ/なし切替) ----------
   * 読みはデータ側(common/ruby-dict.js の RUBY_DICT、または各アプリが G.ruby.add で追加)に持つ。
   * 文章は普通の日本語で書けば、辞書にある語に自動で <ruby> が付く。
   * 個別指定したいときは本文に {漢字|かんじ} と書く。
   * ルビを付けたくない要素には data-noruby を付ける。
   */
  G.ruby = (function () {
    var dict = {};
    var re = null;
    var KANJI = /[㐀-鿿々〆ヶ々〆ヶ]/;
    var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, RUBY: 1, RT: 1, RP: 1, CODE: 1, PRE: 1, CANVAS: 1, svg: 1, SVG: 1, TITLE: 1 };
    function add(obj) {
      Object.keys(obj).forEach(function (w) { if (KANJI.test(w)) dict[w] = obj[w]; });
      re = null;
    }
    function build() {
      var keys = Object.keys(dict).sort(function (a, b) { return b.length - a.length; });
      if (!keys.length) { re = /\{([^{}|]+)\|([^{}]+)\}/g; return; }
      re = new RegExp('\\{([^{}|]+)\\|([^{}]+)\\}|(' + keys.map(function (k) {
        return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('|') + ')', 'g');
    }
    // 語と読みを、かな部分でそろえて漢字部分だけにルビを付ける
    function rubyNodes(word, reading) {
      var parts = word.match(/[぀-ゟ゠-ヿーー]+|[^぀-ゟ゠-ヿーー]+/g) || [word];
      var pat = '^' + parts.map(function (p) {
        return /^[぀-ゟ゠-ヿーー]+$/.test(p) ? '(' + p + ')' : '(.+?)';
      }).join('') + '$';
      var m = new RegExp(pat).exec(reading);
      var frag = document.createDocumentFragment();
      if (!m) { frag.appendChild(mk(word, reading)); return frag; }
      parts.forEach(function (p, i) {
        if (/^[぀-ゟ゠-ヿーー]+$/.test(p)) frag.appendChild(document.createTextNode(p));
        else frag.appendChild(mk(p, m[i + 1]));
      });
      return frag;
    }
    function mk(base, rt) {
      var r = document.createElement('ruby');
      r.appendChild(document.createTextNode(base));
      var rp1 = document.createElement('rp'); rp1.textContent = '(';
      var t = document.createElement('rt'); t.textContent = rt;
      var rp2 = document.createElement('rp'); rp2.textContent = ')';
      r.appendChild(rp1); r.appendChild(t); r.appendChild(rp2);
      return r;
    }
    function skipped(node) {
      for (var p = node.parentNode; p && p !== document; p = p.parentNode) {
        if (p.nodeType !== 1) continue;
        if (SKIP[p.nodeName] || p.namespaceURI === 'http://www.w3.org/2000/svg') return true;
        if (p.hasAttribute('data-noruby') || p.isContentEditable) return true;
      }
      return false;
    }
    function processText(node) {
      var text = node.nodeValue;
      if (!text || (!KANJI.test(text) && text.indexOf('{') < 0)) return;
      if (skipped(node)) return;
      if (!re) build();
      re.lastIndex = 0;
      var m, last = 0, frag = null;
      while ((m = re.exec(text))) {
        if (!frag) frag = document.createDocumentFragment();
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        if (m[1]) frag.appendChild(rubyNodes(m[1], m[2]));
        else frag.appendChild(rubyNodes(m[3], dict[m[3]]));
        last = re.lastIndex;
      }
      if (!frag) return;
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      // 1つの span にまとめる(flex や grid の中で、文字がばらばらの項目にならないように)
      var wrap = document.createElement('span');
      wrap.className = 'g-rb';
      wrap.appendChild(frag);
      node.parentNode.replaceChild(wrap, node);
    }
    function apply(root) {
      root = root || document.body;
      if (!root) return;
      if (root.nodeType === 3) { processText(root); return; }
      if (root.nodeType !== 1 && root.nodeType !== 11) return;
      if (root.nodeType === 1 && (SKIP[root.nodeName] || root.namespaceURI === 'http://www.w3.org/2000/svg')) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var list = [], n;
      while ((n = walker.nextNode())) list.push(n);
      list.forEach(processText);
    }
    var observer = null;
    function observe() {
      if (observer || !window.MutationObserver) return;
      observer = new MutationObserver(function (muts) {
        observer.disconnect();
        muts.forEach(function (mu) {
          if (mu.type === 'characterData') processText(mu.target);
          else mu.addedNodes.forEach(function (nd) { if (nd.isConnected) apply(nd); });
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    // ルビ付きの要素から、ふりがなを除いた文字列を取り出す
    function plain(el) {
      var c = el.cloneNode(true);
      G.$$('rt,rp', c).forEach(function (x) { x.remove(); });
      return c.textContent;
    }
    // 文字列 → ルビ付き HTML(innerHTML で使いたいとき)
    function html(text) {
      var d = document.createElement('span');
      d.textContent = text;
      apply(d);
      return d.innerHTML;
    }
    if (window.RUBY_DICT) add(window.RUBY_DICT);
    return { add: add, apply: apply, observe: observe, plain: plain, html: html, dict: dict };
  })();

  /* ---------- 保存(IndexedDB + JSON 入出力) ----------
   * 共通スキーマ artifact:
   * { schema:'gijutsu-artifact/1', id, app, kind, title, createdAt, updatedAt, data:{...} }
   */
  G.SCHEMA = 'gijutsu-artifact/1';
  G.newArtifact = function (app, title, data, kind) {
    var now = new Date().toISOString();
    return { schema: G.SCHEMA, id: G.uid(app), app: app, kind: kind || 'work', title: title || '無題', createdAt: now, updatedAt: now, data: data || {} };
  };
  G.store = (function () {
    var DB = 'gijutsu', STORE = 'artifacts', dbp = null, LSK = 'gijutsu.artifacts';
    function open() {
      if (dbp) return dbp;
      dbp = new Promise(function (res, rej) {
        if (!window.indexedDB) { rej(new Error('no idb')); return; }
        var rq;
        try { rq = indexedDB.open(DB, 1); } catch (e) { rej(e); return; }
        rq.onupgradeneeded = function () {
          var os = rq.result.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('app', 'app');
        };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { rej(rq.error); };
      }).catch(function (e) { console.warn('IndexedDB が使えないため localStorage に保存します', e); return null; });
      return dbp;
    }
    function lsAll() { try { return JSON.parse(localStorage.getItem(LSK)) || {}; } catch (e) { return {}; } }
    function lsSave(all) { localStorage.setItem(LSK, JSON.stringify(all)); }
    function tx(mode, fn) {
      return open().then(function (db) {
        if (!db) return fn(null);
        return new Promise(function (res, rej) {
          var t = db.transaction(STORE, mode), os = t.objectStore(STORE), out;
          var r = fn(os);
          if (r && 'onsuccess' in r) r.onsuccess = function () { out = r.result; };
          t.oncomplete = function () { res(out); };
          t.onerror = function () { rej(t.error); };
        });
      });
    }
    return {
      put: function (a) {
        if (!a || !a.id || !a.app) return Promise.reject(new Error('artifact に id と app が必要です'));
        a.schema = G.SCHEMA;
        a.updatedAt = new Date().toISOString();
        var copy = JSON.parse(JSON.stringify(a));
        return tx('readwrite', function (os) {
          if (!os) { var all = lsAll(); all[copy.id] = copy; lsSave(all); return null; }
          return os.put(copy);
        }).then(function () { return copy; });
      },
      get: function (id) {
        return open().then(function (db) {
          if (!db) return lsAll()[id] || null;
          return new Promise(function (res, rej) {
            var rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
            rq.onsuccess = function () { res(rq.result || null); };
            rq.onerror = function () { rej(rq.error); };
          });
        });
      },
      list: function (app) {
        return open().then(function (db) {
          if (!db) {
            var all = lsAll();
            return Object.keys(all).map(function (k) { return all[k]; }).filter(function (a) { return !app || a.app === app; });
          }
          return new Promise(function (res, rej) {
            var t = db.transaction(STORE, 'readonly'), os = t.objectStore(STORE);
            var rq = app ? os.index('app').getAll(app) : os.getAll();
            rq.onsuccess = function () { res(rq.result); };
            rq.onerror = function () { rej(rq.error); };
          });
        }).then(function (list) {
          return list.sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
        });
      },
      del: function (id) {
        return tx('readwrite', function (os) {
          if (!os) { var all = lsAll(); delete all[id]; lsSave(all); return null; }
          return os.delete(id);
        });
      }
    };
  })();

  // メニューで入れた組・番号・名前(先生用の振り返り一覧で、だれのファイルか分かるように書き出しに入れる)
  G.profile = function () {
    try {
      var p = JSON.parse(localStorage.getItem('gijutsu.profile')) || {};
      return { class: String(p.class || ''), no: String(p.no || ''), name: String(p.name || '') };
    } catch (e) { return { class: '', no: '', name: '' }; }
  };
  // JSON をファイルとして書き出す(作品・記録には、組・番号・名前が入っていればそれも入れる)
  G.exportJSON = function (obj, filename) {
    var st = G.profile();
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && !obj.student && (st.class || st.no || st.name)) {
      obj = Object.assign({}, obj, { student: st });  // 保存している作品そのものは変えない
    }
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    G.download(blob, filename || 'gijutsu.json');
  };
  G.download = function (blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  // ファイルを選ばせて JSON を読み込む → Promise<object>
  G.pickJSON = function () {
    return new Promise(function (res, rej) {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.json,application/json';
      inp.onchange = function () {
        var f = inp.files[0];
        if (!f) { rej(new Error('ファイルが選ばれていません')); return; }
        var rd = new FileReader();
        rd.onload = function () {
          try { res(JSON.parse(rd.result)); } catch (e) { rej(new Error('JSON として読めませんでした')); }
        };
        rd.onerror = function () { rej(rd.error); };
        rd.readAsText(f);
      };
      inp.click();
    });
  };
  // 読み込んだ JSON を artifact の配列に正規化する(単体・配列・{artifacts:[]} に対応)
  G.normalizeImport = function (obj, app) {
    var list = Array.isArray(obj) ? obj : obj && Array.isArray(obj.artifacts) ? obj.artifacts : [obj];
    return list.filter(function (a) {
      return a && typeof a === 'object' && a.data && (!app || a.app === app);
    }).map(function (a) {
      var c = JSON.parse(JSON.stringify(a));
      c.schema = G.SCHEMA;
      if (!c.id) c.id = G.uid(c.app || app || 'x');
      return c;
    });
  };

  /* ---------- 小さな UI 部品 ---------- */
  G.toast = function (msg, ms) {
    var box = G.$('#g-toast');
    if (!box) { box = G.h('div', { id: 'g-toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(box); }
    var t = G.h('div', { class: 'g-toast-item' }, msg);
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, ms || 2600);
  };

  // タブ: <div data-g-tabs> 内の [role=tab][data-tab=X] と [data-panel=X] を結ぶ
  // 振り返りを隠す設定(EduitFrame.furikaeri === false)のときは、data-ef-reflect の付いたタブは選ばない
  G.furikaeriOff = function () { return !!(window.EduitFrame && EduitFrame.furikaeri === false); };
  G.tabs = function (root, onChange) {
    var tabs = G.$$('[role=tab]', root);
    function usable(t) { return !(G.furikaeriOff() && t.hasAttribute('data-ef-reflect')); }
    function show(name, focus) {
      var want = G.$('[role=tab][data-tab="' + name + '"]', root);
      if (want && !usable(want)) {
        var alt = tabs.filter(usable)[0];
        if (alt) name = alt.getAttribute('data-tab');
      }
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-tab') === name;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      G.$$('[data-panel]', root).forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== name; });
      try { sessionStorage.setItem('tab:' + (G.app || '') + location.pathname, name); } catch (e) {}
      if (onChange) onChange(name);
    }
    tabs.forEach(function (t) {
      var name = t.getAttribute('data-tab');
      var panel = G.$('[data-panel="' + name + '"]', root);
      t.id = t.id || 'tab-' + name;
      t.setAttribute('aria-controls', panel ? (panel.id = panel.id || 'panel-' + name) : '');
      if (panel) { panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', t.id); }
      t.addEventListener('click', function () { show(name); });
      t.addEventListener('keydown', function (e) {
        var vis = tabs.filter(usable), k = vis.indexOf(t);
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (e.key === 'Home') d = -k; if (e.key === 'End') d = vis.length - 1 - k;
        if (!d || k < 0) return;
        e.preventDefault();
        show(vis[(k + d + vis.length) % vis.length].getAttribute('data-tab'), true);
      });
    });
    var first = tabs[0] && tabs[0].getAttribute('data-tab'), saved = null;
    try { saved = sessionStorage.getItem('tab:' + (G.app || '') + location.pathname); } catch (e) {}
    show(saved && G.$('[data-tab="' + saved + '"]', root) ? saved : first);
    return { show: show };
  };

  // モーダル(<dialog>)。G.modal({title, body:Node, actions:[{label, value, primary}]}) → Promise<value>
  G.modal = function (opt) {
    return new Promise(function (res) {
      var dlg = G.h('dialog', { class: 'g-modal', 'aria-label': opt.title || '' });
      var form = G.h('form', { method: 'dialog' });
      if (opt.title) form.appendChild(G.h('h2', null, opt.title));
      if (opt.body) form.appendChild(typeof opt.body === 'string' ? G.h('p', null, opt.body) : opt.body);
      var acts = G.h('div', { class: 'g-row g-end' });
      (opt.actions || [{ label: '閉じる', value: 'close', primary: true }]).forEach(function (a) {
        acts.appendChild(G.h('button', { class: 'btn' + (a.primary ? ' primary' : ''), value: a.value }, a.label));
      });
      form.appendChild(acts);
      dlg.appendChild(form);
      document.body.appendChild(dlg);
      dlg.addEventListener('close', function () { res(dlg.returnValue); dlg.remove(); });
      dlg.showModal();
    });
  };
  G.confirm = function (msg, okLabel) {
    return G.modal({ title: '確認', body: msg, actions: [{ label: 'やめる', value: 'no' }, { label: okLabel || 'OK', value: 'yes', primary: true }] })
      .then(function (v) { return v === 'yes'; });
  };

  // 保存した作品の一覧を開く → Promise<artifact|null>
  G.openDialog = function (app) {
    return G.store.list(app).then(function (list) {
      return new Promise(function (res) {
        var chosen = null;
        var body = G.h('div', { class: 'g-filelist' });
        if (!list.length) body.appendChild(G.h('p', null, 'まだ保存された作品はありません。'));
        list.forEach(function (a) {
          var row = G.h('div', { class: 'g-filerow' },
            G.h('button', { class: 'btn link', type: 'button', onclick: function () { chosen = a; dlgClose(); } },
              a.title || '無題'),
            G.h('span', { class: 'g-muted' }, new Date(a.updatedAt).toLocaleString('ja-JP')),
            G.h('button', { class: 'btn small danger', type: 'button', 'aria-label': (a.title || '無題') + ' を削除', onclick: function () {
              G.confirm('「' + (a.title || '無題') + '」を削除します。もとに戻せません。', '削除する').then(function (ok) {
                if (ok) G.store.del(a.id).then(function () { row.remove(); });
              });
            } }, '削除'));
          body.appendChild(row);
        });
        var p = G.modal({ title: '保存した作品を開く', body: body, actions: [{ label: '閉じる', value: 'close' }] });
        function dlgClose() { var d = G.$('dialog.g-modal[open]'); if (d) d.close('pick'); }
        p.then(function () { res(chosen); });
      });
    });
  };


  /* ---------- 保存データの管理(1件ずつ削除・すべて削除) ----------
   * G.clearAppData(app) … そのアプリの作品と localStorage を消す(app を省くと全アプリ)
   * G.dataDialog(app)   … 一覧と削除ボタンのダイアログ。何か消したら閉じたときに画面を読み込み直す
   */
  G.clearLocal = function (app) {
    var heads = [];
    Object.keys(G.LS_PREFIX).forEach(function (k) { if (!app || k === app) heads = heads.concat(G.LS_PREFIX[k]); });
    if (!app) heads.push('gijutsu.artifacts', 'gijutsu.profile');
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      keys.forEach(function (k) {
        if (heads.some(function (h) { return k === h || k.indexOf(h) === 0; })) localStorage.removeItem(k);
      });
    } catch (e) {}
  };
  G.clearAppData = function (app) {
    return G.store.list(app).then(function (list) {
      return Promise.all(list.map(function (a) { return G.store.del(a.id); })).then(function () {
        G.clearLocal(app);
        return list.length;
      });
    });
  };
  G.dataDialog = function (app, appTitle) {
    var changed = false;
    return G.store.list(app).then(function (list) {
      var body = G.h('div', { class: 'g-filelist' });
      body.appendChild(G.h('p', null, (appTitle ? '「' + appTitle + '」で' : '') + 'この端末に保存されているデータです。消したデータはもとに戻せません。先生に出す前に消さないよう気をつけましょう。'));
      var listBox = G.h('div', null);
      function draw() {
        listBox.innerHTML = '';
        if (!list.length) listBox.appendChild(G.h('p', { class: 'g-muted' }, '保存されている作品・記録はありません。'));
        list.forEach(function (a) {
          var info = !app && G.APPS && G.APPS.filter(function (x) { return x.id === a.app; })[0];
          listBox.appendChild(G.h('div', { class: 'g-filerow' },
            G.h('span', null, info ? G.h('span', { class: 'badge' }, info.code) : null, info ? ' ' : null, a.title || '無題'),
            G.h('span', { class: 'g-muted' }, a.updatedAt ? new Date(a.updatedAt).toLocaleString('ja-JP') : ''),
            G.h('button', { class: 'btn small danger', type: 'button', 'aria-label': (a.title || '無題') + ' を削除', onclick: function () {
              G.confirm('「' + (a.title || '無題') + '」を削除します。もとに戻せません。', '削除する').then(function (ok) {
                if (!ok) return;
                G.store.del(a.id).then(function () { changed = true; list = list.filter(function (x) { return x !== a; }); G.toast('削除しました'); draw(); });
              });
            } }, '削除')));
        });
      }
      draw();
      body.appendChild(listBox);
      body.appendChild(G.h('div', { class: 'g-row', style: { marginTop: '.75rem' } },
        G.h('button', { class: 'btn danger', type: 'button', onclick: function () {
          G.confirm((appTitle ? '「' + appTitle + '」の' : 'すべてのアプリの') + 'データをすべて削除します。とちゅうの作業や記録も消えます。もとに戻せません。', 'すべて削除する').then(function (ok) {
            if (!ok) return;
            G.clearAppData(app).then(function () { changed = true; list = []; G.toast('すべて削除しました'); draw(); });
          });
        } }, 'すべて削除する')));
      return G.modal({ title: '保存データの管理', body: body, actions: [{ label: '閉じる', value: 'close', primary: true }] }).then(function () {
        if (changed) location.reload();
      });
    });
  };

  /* ---------- アプリ共通のヘッダー ----------
   * G.initApp({ app:'kidori', title:'木取り・構想シミュレータ', home:'../index.html', files:[...] })
   * - ヘッダー(メニューへ戻る/名前/ルビ/文字サイズ/コントラスト)を <header id="g-header"> に描く
   * - 名前の前に記号(A5 など)の印を出す。記号は common/apps.js(G.APPS)の app と同じ id の code。opt.code で上書き、opt.code: '' で出さない
   * - ルビの自動付与と Service Worker 登録を行う
   */
  G.initApp = function (opt) {
    opt = opt || {};
    G.app = opt.app;
    G.applySettings();
    var header = G.$('#g-header');
    if (!header) { header = G.h('header', { id: 'g-header' }); document.body.insertBefore(header, document.body.firstChild); }
    // 4分野共通の枠(shared/eduit-frame.css の .ef-header / .ef-btn)
    header.classList.add('g-header', 'ef-header');
    header.innerHTML = '';
    // 文字の大きさ: 4分野共通の「文字 中」ボタン(EduitFrame.sizeButton)。押すたびに 小 → 中 → 大 → 特大 → 小
    var sizeBtn = G.h('button', { class: 'ef-btn ef-size', type: 'button', 'data-g-setting': 'size' });
    var order = ['s', 'm', 'l', 'xl'];
    if (window.EduitFrame && window.EduitFrame.sizeButton) {
      G._sizeUpd = window.EduitFrame.sizeButton(sizeBtn, {
        steps: [[0, '小'], [1, '中'], [2, '大'], [3, '特大']],
        get: function () { return Math.max(0, order.indexOf(G.settings.get('size', 'm'))); },
        set: function (i) { G.settings.set('size', order[i]); }
      });
    }
    // 道具の並び: ふりがな → 文字の大きさ → くっきり(opt.contrast: false で出さない。メニューは4分野共通の4つだけにする) → 使い方(opt.help) → そのアプリだけのボタン(opt.tools)
    var help = null;
    if (typeof opt.help === 'function') help = G.h('button', { class: 'ef-btn', type: 'button', onclick: opt.help }, '使い方');
    else if (typeof opt.help === 'string') help = G.h('a', { class: 'ef-btn', href: opt.help }, '使い方');
    if (opt.home !== false) header.appendChild(G.h('a', { class: 'ef-btn ef-back g-home', href: opt.home || '../index.html' }, '◀ メニュー'));
    // 上のバーの名前: 「A2 木材の繊維・収縮ラボ」の形。記号は common/apps.js の code(opt.code で上書き)を .ef-code の印で出す
    var code = opt.code;
    if (code === undefined && opt.app) (G.APPS || []).forEach(function (a) { if (a.id === opt.app) code = a.code; });
    var title = G.h('h1', { class: 'ef-title g-title' },
      code ? G.h('span', { class: 'ef-code', 'data-noruby': true }, code) : null,
      code ? ' ' : null, opt.title || document.title);
    header.appendChild(title);
    header.appendChild(G.h('div', { class: 'ef-tools g-header-tools' },
      G.h('button', { class: 'ef-btn ef-toggle', type: 'button', 'data-g-setting': 'ruby', 'aria-pressed': 'true', title: 'ふりがなを表示する/しない', onclick: function () {
        G.settings.set('ruby', !G.settings.get('ruby', false));
      } }, G.h('span', { 'data-noruby': true }, 'ふりがな')),
      sizeBtn,
      opt.contrast === false ? null : G.h('button', { class: 'ef-btn ef-toggle', type: 'button', 'data-g-setting': 'contrast', 'aria-pressed': 'false', title: '色のコントラストを強くする', onclick: function () {
        G.settings.set('contrast', !G.settings.get('contrast', false));
      } }, 'くっきり'),
      help,
      opt.tools || null));
    G.applySettings();
    // 作成者の読みがな(フッターと「このアプリについて」で使う)
    G.ruby.add({ '羽生': 'はにゅう', '市立': 'しりつ', '南中学校': 'みなみちゅうがっこう', '岡田': 'おかだ', '作成': 'さくせい', '個人情報': 'こじんじょうほう' });
    if (!G.$('.g-footer')) {
      var dataBtn = opt.app && opt.app !== 'menu' && opt.data !== false
        ? G.h('button', { class: 'btn small ghost g-data-btn', type: 'button', onclick: function () { G.dataDialog(opt.app, opt.title); } }, '保存データの管理(削除)') : null;
      var foot;
      if (window.EduitFrame) {
        // 共通のフッター(作成者・版・安全と個人情報・ライセンス・更新履歴)。保存データの管理ボタンはその右に
        foot = G.h('div', { class: 'g-footer g-footer-ef', 'data-ef-footer': true });
      } else {
        foot = G.h('footer', { class: 'g-footer' },
          G.h('span', { class: 'g-credit' }, G.h('span', { 'data-noruby': true }, '作成: '), G.h('span', { 'data-credit': true }, G.CREDIT_RUBY)),
          dataBtn);
      }
      var addFoot = function () {
        document.body.appendChild(foot);
        if (window.EduitFrame) {
          // 枠がもう body の最後にフッターを出していたら、こちらへ移す(2つ出さない)
          var made = G.$('body > .ef-footer');
          if (made) foot.appendChild(made); else window.EduitFrame.mount();
          var ef = foot.querySelector('.ef-footer');
          if (ef && dataBtn) ef.appendChild(dataBtn);
        }
      };
      if (document.body) addFoot(); else document.addEventListener('DOMContentLoaded', addFoot);
    }
    // 一つのHTML版(build-single.py)の中で開かれているか
    if (window.parent !== window) {
      try { if (window.parent.GSingle) G.single = window.parent.GSingle; } catch (e) {}
    }
    // (リンクの付けかえは build-single.py が各ページに入れるスクリプトが行う)
    var start = function () {
      // タブの帯は、下へ読み進めると隠れ、上へ戻すと出る(shared/eduit-frame.js)
      Array.prototype.forEach.call(document.querySelectorAll('.g-tablist'), function (t) { t.setAttribute('data-ef-autohide', ''); });
      G.ruby.apply(document.body);
      G.ruby.observe();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    G.registerSW(opt.files || []);
  };

  /* ---------- オフライン(Service Worker) ----------
   * ルートの sw.js が common/ とメニューを先にキャッシュする。
   * 各アプリは自分のファイル一覧を渡すと、初回オープン時にまとめてキャッシュされる。
   * file:// で開いたときは Service Worker は使えない(ファイルはそのまま動く)。
   */
  G.registerSW = function (files) {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol) || G.single) return;
    var swUrl = new URL((G.basePath || '../') + 'sw.js', location.href);
    if (G.$('meta[name="g-root"]')) swUrl = new URL('sw.js', new URL(G.$('meta[name="g-root"]').content, location.href));
    navigator.serviceWorker.register(swUrl.href, { scope: new URL('./', swUrl).href }).then(function (reg) {
      var urls = (files || []).map(function (f) { return new URL(f, location.href).href; });
      urls.push(location.href.split('#')[0]);
      var send = function (w) { if (w) w.postMessage({ type: 'cache', urls: urls }); };
      send(reg.active || reg.waiting || reg.installing);
      navigator.serviceWorker.ready.then(function (r) { send(r.active); });
    }).catch(function (e) { console.warn('Service Worker を登録できませんでした', e); });
  };

  /* ---------- 問題解決の型(全アプリ共通の流れ) ---------- */
  G.PS_STEPS = [
    { id: 'find', label: '問題の発見' },
    { id: 'task', label: '課題の設定' },
    { id: 'plan', label: '構想' },
    { id: 'make', label: '製作' },
    { id: 'eval', label: '評価' },
    { id: 'improve', label: '改善' }
  ];
  // G.psCycle(el, ['plan']) … 今このアプリが受け持つ段階を強調して表示
  G.psCycle = function (el, active) {
    active = active || [];
    el.innerHTML = '';
    el.classList.add('g-ps');
    el.setAttribute('aria-label', '問題解決の流れ');
    var ol = G.h('ol', null);
    G.PS_STEPS.forEach(function (s) {
      var on = active.indexOf(s.id) >= 0;
      ol.appendChild(G.h('li', { class: on ? 'on' : '', 'aria-current': on ? 'step' : null }, s.label));
    });
    el.appendChild(ol);
    // 強調の意味を短く書く(色だけに頼らない)
    if (active.length) el.appendChild(G.h('p', { class: 'g-ps-note' }, '▶ = このアプリでとりくむ段階'));
    return el;
  };

  /* ---------- 技術の見方・考え方(観点) ---------- */
  G.VIEWPOINTS = [
    { id: 'society', label: '社会' },
    { id: 'environment', label: '環境' },
    { id: 'economy', label: '経済' },
    { id: 'safety', label: '安全' },
    { id: 'usability', label: '使いやすさ' },
    { id: 'function', label: '機能・性能' }
  ];

  // レーダーチャート(Canvas)。色だけに頼らず線種とマーカーでも区別する。
  // G.radar(canvas, { axes:['社会',...], max:5, series:[{label:'A案', values:[...]}] })
  G.RADAR_STYLES = [
    { color: '#1f6feb', dash: [], marker: 'circle' },
    { color: '#d1242f', dash: [8, 4], marker: 'square' },
    { color: '#1a7f37', dash: [2, 3], marker: 'triangle' },
    { color: '#8250df', dash: [10, 3, 2, 3], marker: 'diamond' }
  ];
  G.radar = function (canvas, cfg) {
    var dpr = window.devicePixelRatio || 1;
    var cssW = canvas.clientWidth || canvas.width, cssH = canvas.clientHeight || canvas.height;
    canvas.width = cssW * dpr; canvas.height = cssH * dpr;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    var axes = cfg.axes, n = axes.length, max = cfg.max || 5;
    var cx = cssW / 2, cy = cssH / 2 + 6, R = Math.min(cssW, cssH) / 2 - 46;
    var css = getComputedStyle(document.documentElement);
    var ink = css.getPropertyValue('--ink').trim() || '#222', line = css.getPropertyValue('--line').trim() || '#ccc';
    function pt(i, v) {
      var a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return [cx + Math.cos(a) * R * v / max, cy + Math.sin(a) * R * v / max];
    }
    ctx.strokeStyle = line; ctx.lineWidth = 1;
    for (var lv = 1; lv <= max; lv++) {
      ctx.beginPath();
      for (var i = 0; i < n; i++) { var p = pt(i, lv); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.closePath(); ctx.stroke();
    }
    ctx.fillStyle = ink; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (i = 0; i < n; i++) {
      var o = pt(i, max);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(o[0], o[1]); ctx.stroke();
      var lp = pt(i, max * 1.2);
      ctx.fillText(axes[i], lp[0], lp[1]);
    }
    (cfg.series || []).forEach(function (s, si) {
      var st = G.RADAR_STYLES[si % G.RADAR_STYLES.length];
      ctx.strokeStyle = st.color; ctx.fillStyle = st.color; ctx.lineWidth = 2.5; ctx.setLineDash(st.dash);
      ctx.beginPath();
      s.values.forEach(function (v, i) { var p = pt(i, G.clamp(v || 0, 0, max)); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
      ctx.closePath(); ctx.stroke();
      ctx.globalAlpha = 0.08; ctx.fill(); ctx.globalAlpha = 1; ctx.setLineDash([]);
      s.values.forEach(function (v, i) { var p = pt(i, G.clamp(v || 0, 0, max)); marker(ctx, st.marker, p[0], p[1], 4.5); });
    });
    return canvas;
  };
  function marker(ctx, kind, x, y, r) {
    ctx.beginPath();
    if (kind === 'square') ctx.rect(x - r, y - r, r * 2, r * 2);
    else if (kind === 'triangle') { ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.1, y + r * 0.8); ctx.lineTo(x - r * 1.1, y + r * 0.8); ctx.closePath(); }
    else if (kind === 'diamond') { ctx.moveTo(x, y - r * 1.3); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.3); ctx.lineTo(x - r, y); ctx.closePath(); }
    else ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  G.drawMarker = marker;
  // 凡例(HTML)。レーダーと同じ線種・マーカーを使う
  G.radarLegend = function (labels) {
    var shapes = { circle: '●', square: '■', triangle: '▲', diamond: '◆' };
    var dashes = { 0: '───', 1: '- - -', 2: '·····', 3: '-·-·-' };
    return G.h('ul', { class: 'g-legend' }, labels.map(function (l, i) {
      var st = G.RADAR_STYLES[i % G.RADAR_STYLES.length];
      return G.h('li', null, G.h('span', { style: { color: st.color }, 'aria-hidden': 'true' }, shapes[st.marker] + ' ' + dashes[i % 4] + ' '), l);
    }));
  };

  // 観点レーダーの自己評価フォーム(スライダー 0〜5)。onChange(values) が呼ばれる
  G.viewpointSliders = function (el, values, onChange) {
    el.innerHTML = '';
    values = values || {};
    G.VIEWPOINTS.forEach(function (v) {
      var id = 'vp-' + v.id + '-' + Math.random().toString(36).slice(2, 6);
      var out = G.h('output', { for: id }, String(values[v.id] || 0));
      var inp = G.h('input', { type: 'range', id: id, min: 0, max: 5, step: 1, value: values[v.id] || 0, oninput: function () {
        values[v.id] = +inp.value; out.textContent = inp.value; if (onChange) onChange(values);
      } });
      el.appendChild(G.h('div', { class: 'g-slider' }, G.h('label', { for: id }, v.label), inp, out));
    });
    return values;
  };

  /* ---------- 共通の注意書き ---------- */
  G.noteEstimate = function (text) {
    return G.h('p', { class: 'g-note' }, G.h('strong', null, '目安です。'), text || '数値は文献の代表値を丸めたものです。実際の材料は樹種・製品・含水率などで大きく変わるので、実物で確かめましょう。');
  };

  /* ---------- Canvas を高解像度で使うための準備 ---------- */
  G.setupCanvas = function (canvas, cssW, cssH) {
    var dpr = window.devicePixelRatio || 1;
    cssW = cssW || canvas.clientWidth; cssH = cssH || canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    canvas.style.height = cssH + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  };
  G.cssVar = function (name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };
})();
