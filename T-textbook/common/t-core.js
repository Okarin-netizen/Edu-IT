/* 教科書順コースと、M 身の回りの技術さがし・F これからの技術ラボ・Z 学習を終えて で使う共通の部品。
 * もとは G-guidance/index.html の中の部品(保存・ふりがな・表示の設定・タブ・クイズ・えらぶボタン・自己評価・書き出し)。
 * 使い方(classic script。file:// でも動く。build.py がページの中に入れる):
 *   <link rel="stylesheet" href="../../shared/eduit-frame.css">  <link rel="stylesheet" href="../common/t-core.css">
 *   <script src="eduit-info.js"></script> <script>EDUIT_INFO.app = { name: 'M 身の回りの技術さがし' };</script>
 *   <script src="../../shared/eduit-frame.js"></script> <script src="../common/t-ruby.js"></script> <script src="../common/t-core.js"></script>
 *   var T = TCore.init({ key: 'eduit.m.v1', blank: function () { return {…}; } });
 *   … T.quiz(…)・T.picker(…)・T.self(…) で中身を作り …
 *   T.start({ status: function (S) { return { intro: true, … }; }, prog: [[タブ, 名前, 点数の関数], …], exp: { code, title, file, score } });
 * ページの形: <div id="tapp" class="t-noruby"> の中に、上のバー(.t-top: ふりがな #t-ruby・文字 #t-size・使い方 #t-howto)、
 *   タブ(.t-tabs [data-tab])、ページ(.t-sec[data-sec])。書く欄は data-k="t1.memo" のように S の中の場所を書く。
 *   記録のページには #t-prog・#t-export・#t-print・#t-reset・#t-export-msg を置く。
 */
(function () {
  'use strict';
  var PREF = 'eduit.t.prefs';  // ふりがな・文字の大きさ(コースと M・F・Z で同じ)

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  // 保存していた中身を blank() に重ねる。形のちがう値(配列のはずが文字など)は入れない(こわれた保存で止まらないように)
  function merge(a, b) {
    for (var k in b) {
      if (k === '__proto__') continue;
      var av = a[k], bv = b[k];
      if (isObj(av) && isObj(bv)) merge(av, bv);
      else if (av === undefined || (typeof av === typeof bv && Array.isArray(av) === Array.isArray(bv))) a[k] = bv;
    }
    return a;
  }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function filled(v) { return String(v || '').trim().length > 0; }
  // 毎回同じ順にまぜる(答えがいつも同じ場所にならないように)
  function seeded(n, seed) {
    var a = [], s = seed;
    for (var i = 0; i < n; i++) a.push(i);
    for (var j = n - 1; j > 0; j--) { s = (s * 9301 + 49297) % 233280; var k = Math.floor(s / 233280 * (j + 1)); var t = a[j]; a[j] = a[k]; a[k] = t; }
    return a;
  }

  function init(opts) {
    var $ = function (id) { return document.getElementById(id); };
    var root = $('tapp');
    var KEY = opts.key;
    var S = opts.blank();
    if (KEY) try { var raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (raw && typeof raw === 'object') S = merge(opts.blank(), raw); } catch (e) {}
    var onSave = [];
    function save() { if (KEY) try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} onSave.forEach(function (f) { f(); }); }
    function getK(path) { return path.split('.').reduce(function (o, k) { return o == null ? '' : o[k]; }, S); }
    function setK(path, v) {
      var ks = path.split('.'), o = S;
      for (var i = 0; i < ks.length - 1; i++) { if (!isObj(o[ks[i]])) o[ks[i]] = {}; o = o[ks[i]]; }
      o[ks[ks.length - 1]] = v;
    }

    // ---------- ふりがな(t-ruby.js の読み。長い言葉が先に当たる) ----------
    var RUBY = window.T_RUBY || {};
    var RUBY_RE = new RegExp(Object.keys(RUBY).sort(function (a, b) { return b.length - a.length; }).map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') || '(?!)', 'g');
    var SKIP = /^(RUBY|RT|RP|SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION)$/;
    function ruby(node) {
      var top = node || root;
      var walker = document.createTreeWalker(top, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          for (var p = n.parentNode; p && p !== root.parentNode; p = p.parentNode) if (SKIP.test(p.nodeName) || (p.hasAttribute && p.hasAttribute('data-noruby'))) return NodeFilter.FILTER_REJECT;
          return /[一-鿿]/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      });
      var list = [];
      while (walker.nextNode()) list.push(walker.currentNode);
      list.forEach(function (n) {
        var s = n.nodeValue, f = document.createDocumentFragment(), last = 0, m;
        RUBY_RE.lastIndex = 0;
        while ((m = RUBY_RE.exec(s))) {
          if (m.index > last) f.appendChild(document.createTextNode(s.slice(last, m.index)));
          var r = document.createElement('ruby');
          r.appendChild(document.createTextNode(m[0]));
          var rt = document.createElement('rt'); rt.textContent = RUBY[m[0]];
          r.appendChild(rt); f.appendChild(r);
          last = m.index + m[0].length;
        }
        if (last === 0) return;
        if (last < s.length) f.appendChild(document.createTextNode(s.slice(last)));
        n.parentNode.replaceChild(f, n);
      });
    }
    // 文を入れかえてからふりがなを付ける(説明・点数など、あとから変わる文に使う)
    function text(node, s) { node.textContent = s; ruby(node); }

    // ---------- 表示の設定(ふりがな・文字の大きさ) ----------
    var FS_STEPS = [[0.9, '小'], [1, '中'], [1.15, '大'], [1.3, '特大']];
    var prefs = { ruby: false, fs: 1 };
    try {
      var pr = JSON.parse(localStorage.getItem(PREF) || 'null');
      if (pr) {
        prefs.ruby = !!pr.ruby;
        var fs = +pr.fs;  // 段の範囲の外(こわれた値)は「中」にもどす
        prefs.fs = fs >= FS_STEPS[0][0] && fs <= FS_STEPS[FS_STEPS.length - 1][0] ? fs : 1;
      }
    } catch (e) {}
    function savePrefs() { try { localStorage.setItem(PREF, JSON.stringify(prefs)); } catch (e) {} }
    function applyPrefs() {
      root.classList.toggle('t-noruby', !prefs.ruby);
      $('t-ruby').setAttribute('aria-pressed', String(prefs.ruby));
      root.style.setProperty('--t-fs', prefs.fs);
    }
    $('t-ruby').addEventListener('click', function () { prefs.ruby = !prefs.ruby; savePrefs(); applyPrefs(); });
    EduitFrame.sizeButton($('t-size'), {
      steps: FS_STEPS,
      get: function () { return prefs.fs; },
      set: function (v) { prefs.fs = v; savePrefs(); applyPrefs(); }
    });
    if (opts.howto) $('t-howto').addEventListener('click', function () {
      EduitFrame.howto(opts.howto, { onOpen: function (box) { if (prefs.ruby) ruby(box); } });
    });

    // ---------- 書く欄(data-k)は自動で保存 ----------
    function fields(box) {
      Array.prototype.forEach.call((box || root).querySelectorAll('[data-k]'), function (f) {
        if (f._tk) return;
        f._tk = 1;
        var k = f.getAttribute('data-k');
        f.value = getK(k) || '';
        f.addEventListener('input', function () { setK(k, f.value); save(); });
      });
    }

    // ---------- 選ぶクイズ ----------
    // items: [{ t: 文, a: 正解の番号, x: 説明, c: この問いだけの選択肢 }], choices: 選択肢, store: 答えを入れる S の中のオブジェクトを返す関数
    // opts.mix: 数(seed)を渡すと、問いごとに選択肢の順をまぜて出す(答えの番号は元の順のまま保存する)
    function quiz(box, score, choices, items, store, qopts) {
      qopts = qopts || {};
      if (typeof box === 'string') box = $(box);
      if (typeof score === 'string') score = $(score);
      function paintScore() {
        if (!score) return;
        var st = store(), ok = 0, n = 0;
        items.forEach(function (it, i) { if (st[i] != null) { n++; if (+st[i] === it.a) ok++; } });
        text(score, n ? '(' + ok + ' / ' + items.length + ' 正解' + (n < items.length ? '・のこり ' + (items.length - n) : '') + ')' : '');
      }
      items.forEach(function (it, i) {
        var cs = it.c || choices;
        var order = cs.map(function (c, j) { return j; });
        if (qopts.mix != null) {  // まぜたうえで、さらに数でずらす(選択肢が少ないと、まぜても元の順のままのことがあるので)
          var mx = seeded(cs.length, qopts.mix + i * 7), sh = (qopts.mix + i) % cs.length;
          order = mx.slice(sh).concat(mx.slice(0, sh));
        }
        var ex = el('p', { class: 't-explain', hidden: '' });
        var btns = [];
        order.forEach(function (j) {
          var b = el('button', { type: 'button', class: 't-choice', text: cs[j] });
          b._j = j;
          b.addEventListener('click', function () { store()[i] = j; save(); paint(); paintScore(); });
          btns.push(b);
        });
        function paint() {
          var v = store()[i];
          btns.forEach(function (b) {
            var j = b._j;
            b.classList.toggle('is-ok', v != null && j === it.a && +v === j);
            b.classList.toggle('is-ng', v != null && +v === j && j !== it.a);
            b.setAttribute('aria-pressed', String(v != null && +v === j));
          });
          if (v != null) {
            text(ex, (+v === it.a ? '正解! ' : 'ざんねん。正しくは「' + cs[it.a] + '」。 ') + (it.x || ''));
            ex.hidden = false;
          } else ex.hidden = true;
        }
        box.appendChild(el('li', { class: 't-q' }, [el('p', { class: 't-q-text', text: it.t }), el('div', { class: 't-choices' }, btns), ex]));
        paint();
      });
      paintScore();
    }
    function quizDone(items, st) { return items.every(function (it, i) { return st[i] != null; }); }
    function quizOk(items, st) { return items.filter(function (it, i) { return st[i] != null && +st[i] === it.a; }).length; }

    // 1つだけ・いくつでも えらぶボタン(options: 文字か { id, label })。onChange は押したあとに呼ぶ。もどり値の関数で、表示を今の値に合わせる
    function picker(box, options, get, set, multi, onChange) {
      if (typeof box === 'string') box = $(box);
      var bs = options.map(function (o) {
        var id = o.id || o;
        var b = el('button', { type: 'button', class: 't-choice t-pick', text: o.label || o });
        b.addEventListener('click', function () {
          if (multi) { var a = get(), i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else a.push(id); }
          else set(id);
          save(); paint();
          if (onChange) onChange();
        });
        box.appendChild(b);
        return { b: b, id: id };
      });
      function paint() {
        var v = get();
        bs.forEach(function (x) { x.b.setAttribute('aria-pressed', String(multi ? v.indexOf(x.id) >= 0 : v === x.id)); });
      }
      paint();
      return paint;
    }

    // 自己評価の表(◎○△)。items: [[キー, 文], …]、store: 評価を入れる S の中のオブジェクトを返す関数
    var LV = [['3', 'できた', '◎'], ['2', 'だいたい', '○'], ['1', 'もう少し', '△']];
    function self(tbody, items, store, name) {
      if (typeof tbody === 'string') tbody = $(tbody);
      items.forEach(function (s) {
        var tr = el('tr', null, [el('th', { scope: 'row', text: s[1] })]);
        LV.forEach(function (l) {
          var inp = el('input', { type: 'radio', name: (name || 't-self') + '-' + s[0], value: l[0] });
          inp.checked = store()[s[0]] === l[0];
          inp.addEventListener('change', function () { if (inp.checked) { store()[s[0]] = l[0]; save(); } });
          tr.appendChild(el('td', null, [el('label', null, [inp, el('span', { text: l[2] }), el('span', { class: 't-sr', text: l[1] })])]));
        });
        tbody.appendChild(tr);
      });
    }
    function selfDone(items, st) { return items.every(function (s) { return st[s[0]]; }); }

    // ---------- タブ ----------
    var TABS = Array.prototype.slice.call(document.querySelectorAll('.t-tabs [data-tab]'));
    var SECS = Array.prototype.slice.call(document.querySelectorAll('.t-sec'));
    var onShow = {};
    function visibleTabs() { return TABS.filter(function (t) { return EduitFrame.furikaeri || !t.hasAttribute('data-ef-reflect'); }); }
    function select(name, scroll) {
      if (!SECS.length) return;  // タブのないページ(教科書順コース)
      if (!EduitFrame.furikaeri && name === 'refl') name = 'rec';
      if (!SECS.some(function (s) { return s.getAttribute('data-sec') === name; })) name = SECS[0].getAttribute('data-sec');
      TABS.forEach(function (t) { var on = t.getAttribute('data-tab') === name; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      SECS.forEach(function (s) { s.hidden = s.getAttribute('data-sec') !== name; });
      if (onShow[name]) onShow[name]();
      if (scroll) window.scrollTo(0, 0);
      // Claude のプレビューなど about:srcdoc で開くとアドレスを書きかえられないので、失敗しても止めない
      try { if (location.hash.slice(1) !== name) history.replaceState(null, '', location.pathname + location.search + '#' + name); } catch (e) {}
      if (KEY) try { localStorage.setItem(KEY + '.tab', name); } catch (e) {}
    }
    TABS.forEach(function (t) {
      t.setAttribute('aria-controls', 't-' + t.getAttribute('data-tab'));
      t.addEventListener('click', function () { select(t.getAttribute('data-tab'), true); });
      t.addEventListener('keydown', function (e) {
        var v = visibleTabs(), j = v.indexOf(t);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var n = v[(j + (e.key === 'ArrowRight' ? 1 : v.length - 1)) % v.length];
          n.focus(); n.click();
        }
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-goto]'), function (b) {
      b.addEventListener('click', function () { select(b.getAttribute('data-goto'), true); });
    });
    window.addEventListener('hashchange', function () { select(location.hash.slice(1)); });

    // ---------- 進み具合・書き出し・はじめから(T.start で始める) ----------
    function start(o) {
      function marks() {
        var st = o.status(S);
        TABS.forEach(function (t) { t.classList.toggle('t-done', !!st[t.getAttribute('data-tab')]); });
      }
      onSave.push(marks);
      function progress() {
        var st = o.status(S), ul = $('t-prog');
        if (!ul) return;
        ul.innerHTML = '';
        o.prog.forEach(function (p) {
          if (p[0] === 'refl' && !EduitFrame.furikaeri) return;
          ul.appendChild(el('li', null, [el('span', { class: st[p[0]] ? 'ok' : 'no', text: st[p[0]] ? '✓ できた ' : '・ まだ ' }), p[1], p[2] ? '(' + p[2]() + ')' : '']));
        });
        ruby(ul);
      }
      var prevRec = onShow.rec;
      onShow.rec = function () { if (prevRec) prevRec(); progress(); };
      // 書き出し(振り返り一覧 teacher-tools/furikaeri-ichiran で読める)
      function exportObj() {
        var EI = window.EDUIT_INFO || {}, data = S;
        if (!EduitFrame.furikaeri && o.exp.noRefl) data = o.exp.noRefl(JSON.parse(JSON.stringify(S)));
        return {
          schema: 'eduit-textbook/1', app: o.exp.code, title: o.exp.title, version: EI.version || '', exported: new Date().toISOString(),
          student: { cls: S.who.cls, no: S.who.no, name: S.who.name }, score: o.exp.score ? o.exp.score(S) : {}, data: data
        };
      }
      if ($('t-export')) $('t-export').addEventListener('click', function () {
        // ファイル名に使えない文字(/ : * など)は組・番号・名前から除く
        var safe = function (v) { return String(v || '').replace(/[\\/:*?"<>|\s]/g, ''); };
        var who = [safe(S.who.cls), safe(S.who.no)].filter(Boolean).join('-');
        var d = new Date(), ds = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
        var name = o.exp.file + '_' + (who ? who + '_' : '') + (safe(S.who.name) ? safe(S.who.name) + '_' : '') + ds + '.json';
        try {
          var blob = new Blob([JSON.stringify(exportObj(), null, 2)], { type: 'application/json' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = name;
          document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
          text($('t-export-msg'), '「' + name + '」を作りました。' + (S.who.name || S.who.no ? '' : '(組・番号・名前が空です。先生に言われたら入れて、もう一度書き出してください)'));
        } catch (e) {
          text($('t-export-msg'), 'ファイルを作れませんでした。先生に聞いてください。');
        }
      });
      if ($('t-print')) $('t-print').addEventListener('click', function () { window.print(); });
      if ($('t-reset')) $('t-reset').addEventListener('click', function () {
        if (!confirm('この教材で書いたこと・答えを全部消して、はじめからにします。よいですか?')) return;
        try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '.tab'); } catch (e) {}
        location.reload();
      });
      fields();
      applyPrefs();
      ruby(root);
      marks();
      var first = location.hash.slice(1);
      if (!first && KEY) try { first = localStorage.getItem(KEY + '.tab') || ''; } catch (e) {}
      select(first || SECS[0].getAttribute('data-sec'));
      return { marks: marks };
    }

    return {
      S: S, $: $, el: el, root: root, save: save, ruby: ruby, text: text, filled: filled, seeded: seeded, fields: fields,
      quiz: quiz, quizDone: quizDone, quizOk: quizOk, picker: picker, self: self, selfDone: selfDone,
      select: select, onShow: onShow, onSave: onSave, start: start, prefs: prefs, applyPrefs: applyPrefs
    };
  }

  window.TCore = { init: init };
})();
