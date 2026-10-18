/* 問題解決ノート(4分野共通の本体)
 * 先に mondai-note-data.js を読む。見た目は mondai-note.css(4分野共通の枠 eduit-frame.css の --ef-* を使う)。
 * classic script。外部通信なし。分野ごとのちがい(例・観点・製品)はデータ(MondaiNote.DOMAINS)で持つ。
 *
 * 使い方(各分野のページ = 「アダプタ」が受け持つもの: 上のバー・タブの切りかえ・保存・ファイルの書き出し)
 *   var note = MondaiNote.mount({
 *     domain: EDUIT_INFO.domain,          // 'A' | 'B' | 'C' | 'D'
 *     data: 保存していた中身(なければ null → 新しいノート),
 *     panels: { intro, find, eval, opt, refl, rec },   // タブの中身を入れる要素(MondaiNote.TABS の id)
 *     onChange: function (data) { 保存する },          // 何か変わるたびに呼ばれる(アダプタで間をあけて保存する)
 *     go: function (tabId) { そのタブを開く },        // 「次へ」ボタンが使う
 *     recordTools: 要素 または function () { return 要素; },  // 記録タブに置く、書き出し・読み込みなどのボタン
 *     furikaeri: function () { return 振り返りを出すなら true }  // 省くと EduitFrame.furikaeri を見る
 *   });
 *   note.setData(data) … 読み込んだノートに入れかえる / note.data … 今の中身 / note.render(tabId) / note.print()
 * 画面のない所(node のテスト・振り返り一覧)では、下の「計算」の関数だけを使える。
 */
(function (root) {
  'use strict';
  var MN = (root.MondaiNote = root.MondaiNote || {});

  MN.VERSION = 1;
  // アプリの中のタブ(この順・この名前)。reflect は振り返り(data-ef-reflect を付ける)
  MN.TABS = [
    { id: 'intro', label: 'はじめに' },
    { id: 'find', num: '①', label: '問題の発見', level: 'basic' },
    { id: 'eval', num: '②', label: '評価、改善・修正', level: 'basic' },
    { id: 'opt', num: '③', label: '技術の最適化', level: 'advanced' },
    { id: 'refl', label: '振り返り', reflect: true },
    { id: 'rec', label: '記録' }
  ];
  MN.LEVEL_WORDS = ['', 'もう少し', 'やや足りない', 'ふつう', 'よい', 'とてもよい'];
  MN.WEIGHT_WORDS = ['気にしない', '少し', '大事', 'とても大事'];
  MN.LIMIT_CHIPS = ['時間', '費用', '材料・部品', '道具・機器', '大きさ', '場所', '安全'];
  MN.SELF = [
    { k: 'find', label: '身の回りから問題を見つけ、問題と課題を分けて書けた' },
    { k: 'eval', label: '観点を決めて評価し、改善・修正の方法を考えられた' },
    { k: 'opt', label: '技術は、いろいろな条件の折り合いをつけて最適化されていると分かった' }
  ];
  MN.SELF_LV = [['3', 'できた'], ['2', 'だいたいできた'], ['1', 'もう少し']];

  /* ================= 計算(画面がなくても使える) ================= */
  MN.dom = function (d) { return (MN.DOMAINS && (MN.DOMAINS[d] || MN.DOMAINS.A)) || null; };
  MN.critOf = function (dom, p) { return (p && p.crit) || dom.optCrit; };
  MN.presetsOf = function (dom, p) { return (p && p.presets) || dom.presets; };
  MN.product = function (dom, id) {
    for (var i = 0; i < dom.products.length; i++) if (dom.products[i].id === id) return dom.products[i];
    return dom.products[0];
  };
  function str(v) { return v == null ? '' : String(v); }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function arr(v) { return Array.isArray(v) ? v : []; }

  MN.defaults = function (domain) {
    var dom = MN.dom(domain);
    return {
      v: MN.VERSION, domain: domain || 'A',
      cards: [],
      quiz: { order: [], i: 0, ans: {}, last: null, best: null },
      task: { problem: '', who: '', goal: '', kadai: '', limits: [], limitNote: '', vp: [] },
      ev: { title: '', mode: 'res', res: {}, tgt: {}, process: {}, good: '', improve: '', newProblem: '' },
      opt: { product: dom ? dom.products[0].id : '', weights: {}, limits: {}, wins: {}, notice: '', compare: '' },
      refl: { self: {}, learned: '', next: '' },
      student: { cls: '', no: '', name: '' }
    };
  };
  // 読み込んだ中身の足りないところをうめる(こわれた値は直す)
  MN.normalize = function (data, domain) {
    var d = obj(data), base = MN.defaults(domain || d.domain);
    Object.keys(base).forEach(function (k) {
      var b = base[k];
      if (b && typeof b === 'object' && !Array.isArray(b)) {
        var cur = obj(d[k]);
        Object.keys(b).forEach(function (kk) { if (cur[kk] === undefined || (Array.isArray(b[kk]) && !Array.isArray(cur[kk]))) cur[kk] = b[kk]; });
        d[k] = cur;
      } else if (Array.isArray(b)) d[k] = arr(d[k]);
      else if (d[k] === undefined) d[k] = b;
    });
    d.domain = domain || d.domain || 'A';
    d.cards = d.cards.filter(function (c) { return c && typeof c === 'object'; }).map(function (c) {
      return { id: str(c.id) || uid(), text: str(c.text), vp: arr(c.vp).map(str), star: !!c.star };
    });
    return d;
  };
  function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  MN.uid = uid;

  // 重み(0〜3)。決めていない観点は 1
  MN.weightsOf = function (data, dom, p) {
    var w = obj(obj(data.opt).weights)[p.id] || {}, out = {};
    MN.critOf(dom, p).forEach(function (c) { var v = +w[c.k]; out[c.k] = isFinite(v) && w[c.k] !== undefined ? Math.max(0, Math.min(3, Math.round(v))) : 1; });
    return out;
  };
  // 点数(100点満点)と順位。limitsOn は使う制約条件の番号の配列
  MN.rank = function (dom, p, weights, limitsOn) {
    var crit = MN.critOf(dom, p), sumW = 0;
    crit.forEach(function (c) { sumW += weights[c.k] || 0; });
    var lim = arr(limitsOn).map(function (i) { return (p.limits || [])[i]; }).filter(Boolean);
    var list = p.options.map(function (o, idx) {
      var raw = 0;
      crit.forEach(function (c) { raw += (weights[c.k] || 0) * (o.s[c.k] || 0); });
      var fails = lim.filter(function (l) { return (o.s[l.k] || 0) < l.min; });
      return { id: o.id, idx: idx, name: o.name, opt: o, score: sumW ? Math.round(raw / (sumW * 5) * 100) : 0, raw: raw, ok: !fails.length, fails: fails };
    });
    list.sort(function (a, b) { return (b.ok - a.ok) || (b.raw - a.raw) || (a.idx - b.idx); });
    var top = list[0];
    // 1位がほかと同じ点(同点)なら「1位」は決まらない
    var tie = list.length > 1 && list[1].ok === top.ok && list[1].raw === top.raw;
    list.forEach(function (r, i) { r.rank = i + 1; });
    return { list: list, best: top.ok && sumW && !tie ? top.id : '', tie: tie && !!sumW, none: !top.ok, sumW: sumW };
  };

  // 記録・印刷・先生用の一覧に出す要約: [{ title, rows: [[見出し, 値]] }]
  MN.summary = function (data, domain) {
    var d = MN.normalize(JSON.parse(JSON.stringify(data || {})), domain || (data && data.domain));
    var dom = MN.dom(d.domain), out = [];
    var vpName = {}; MN.VP.forEach(function (v) { vpName[v.k] = v.label; });
    var q = d.quiz.last;
    out.push({ title: '① 問題の発見と課題の設定', rows: [
      ['集めた付箋', d.cards.length ? d.cards.map(function (c) { return (c.star ? '★' : '・') + c.text + (c.vp.length ? '(' + c.vp.map(function (k) { return vpName[k] || k; }).join('・') + ')' : ''); }).join('\n') : ''],
      ['問題?課題? クイズ', q ? q.score + ' / ' + q.total + (d.quiz.best != null ? '(最高 ' + d.quiz.best + ')' : '') : ''],
      ['問題', d.task.problem], ['困っている人', d.task.who], ['どうなれば解決するか', d.task.goal], ['課題', d.task.kadai],
      ['観点', d.task.vp.map(function (k) { return vpName[k] || k; }).join('・')],
      ['制約条件', d.task.limits.join('・') + (d.task.limitNote ? (d.task.limits.length ? '/' : '') + d.task.limitNote : '')]
    ] });
    var ev = d.ev;
    var sc = dom.evalCrit.map(function (c) {
      var r = ev.res[c.k], t = ev.tgt[c.k];
      return r || t ? c.label + ' ' + (r || '-') + (t ? '(目標 ' + t + ')' : '') : '';
    }).filter(Boolean).join('、');
    var pr = dom.process.filter(function (x, i) { return ev.process[i]; });
    out.push({ title: '② 評価、改善・修正', rows: [
      [dom.work, ev.title], ['観点ごとの評価(5段階)', sc],
      ['過程の評価', pr.length ? pr.join('\n') + '(' + pr.length + ' / ' + dom.process.length + ')' : ''],
      ['よかった点', ev.good], ['改善・修正の方法', ev.improve], ['新たに見つけた問題', ev.newProblem]
    ] });
    var tried = dom.products.filter(function (p) { return arr(d.opt.wins[p.id]).length || d.opt.weights[p.id]; });
    var optRows = tried.map(function (p) {
      var w = MN.weightsOf(d, dom, p), r = MN.rank(dom, p, w, d.opt.limits[p.id]);
      var crit = MN.critOf(dom, p);
      var won = arr(d.opt.wins[p.id]).map(function (id) { for (var i = 0; i < p.options.length; i++) if (p.options[i].id === id) return p.options[i].name; return id; });
      return [p.name, '重み: ' + crit.map(function (c) { return c.label + '×' + w[c.k]; }).join(' ') +
        '\n1位: ' + (r.best ? r.list[0].name + '(' + r.list[0].score + '点)' : r.tie ? '同点' : '-') +
        (won.length ? '\n1位にできた案: ' + won.join('・') + '(' + won.length + ' / ' + p.options.length + ')' : '')];
    });
    out.push({ title: '③ 技術の最適化', rows: optRows.concat([
      ['重みや制約条件を変えて気づいたこと', d.opt.notice], ['自分の問題解決と社会の問題解決', d.opt.compare]
    ]) });
    var self = MN.SELF.map(function (s) {
      var lv = MN.SELF_LV.filter(function (x) { return x[0] === d.refl.self[s.k]; })[0];
      return lv ? s.label + ': ' + lv[1] : '';
    }).filter(Boolean).join('\n');
    out.push({ title: '振り返り', reflect: true, rows: [['自己評価', self], ['分かったこと・できるようになったこと', d.refl.learned], ['これからの問題解決に生かしたいこと', d.refl.next]] });
    return out;
  };

  /* ---------- レーダーチャート(SVG の文字列。色・線の形・印の形で系列を区別する) ---------- */
  MN.SERIES = [
    { color: '#1f6feb', dash: '', marker: 'circle', mark: '●' },
    { color: '#c2410c', dash: '7 4', marker: 'square', mark: '■' },
    { color: '#15803d', dash: '2 4', marker: 'triangle', mark: '▲' }
  ];
  function esc(s) { return str(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  MN.esc = esc;
  MN.radarSVG = function (axes, series, opt) {
    opt = opt || {};
    var n = axes.length, max = opt.max || 5, R = 100, cx = 200, cy = 140, W = 400, H = 285;
    function pt(i, v) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * v / max, cy + Math.sin(a) * R * v / max]; }
    function poly(vals) { return vals.map(function (v, i) { var p = pt(i, Math.max(0, Math.min(max, +v || 0))); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
    var s = '<svg class="mn-radar" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.label || 'レーダーチャート') + '" xmlns="http://www.w3.org/2000/svg">';
    for (var lv = 1; lv <= max; lv++) {
      var ring = []; for (var i = 0; i < n; i++) ring.push(lv);
      s += '<polygon points="' + poly(ring) + '" fill="' + (lv === max ? '#fbfaf7' : 'none') + '" stroke="#d6d3cb" stroke-width="1"/>';
    }
    for (i = 0; i < n; i++) {
      var o = pt(i, max), lp = pt(i, max * 1.2), anchor = Math.abs(lp[0] - cx) < 8 ? 'middle' : lp[0] > cx ? 'start' : 'end';
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + o[0].toFixed(1) + '" y2="' + o[1].toFixed(1) + '" stroke="#d6d3cb"/>';
      s += '<text x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 5).toFixed(1) + '" text-anchor="' + anchor + '" font-size="14" fill="#1f2328">' + esc(axes[i]) + '</text>';
    }
    for (lv = 1; lv <= max; lv++) { var lb = pt(0, lv); s += '<text x="' + (lb[0] + 4) + '" y="' + (lb[1] + 4) + '" font-size="10" fill="#8a8f98">' + lv + '</text>'; }
    (series || []).forEach(function (se, si) {
      var st = MN.SERIES[(se.style != null ? se.style : si) % MN.SERIES.length];
      if (!se.values.some(function (v) { return +v > 0; })) return;
      s += '<polygon points="' + poly(se.values) + '" fill="' + st.color + '" fill-opacity="' + (se.fill != null ? se.fill : 0.1) + '" stroke="' + st.color + '" stroke-width="' + (se.bold ? 3.5 : 2.5) + '"' + (st.dash ? ' stroke-dasharray="' + st.dash + '"' : '') + ' stroke-linejoin="round"/>';
      se.values.forEach(function (v, i) {
        var p = pt(i, Math.max(0, Math.min(max, +v || 0))), x = p[0], y = p[1], r = 5;
        if (st.marker === 'square') s += '<rect x="' + (x - r) + '" y="' + (y - r) + '" width="' + 2 * r + '" height="' + 2 * r + '" fill="' + st.color + '"/>';
        else if (st.marker === 'triangle') s += '<polygon points="' + x + ',' + (y - r * 1.3) + ' ' + (x + r * 1.15) + ',' + (y + r * 0.8) + ' ' + (x - r * 1.15) + ',' + (y + r * 0.8) + '" fill="' + st.color + '"/>';
        else s += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + st.color + '"/>';
      });
    });
    return s + '</svg>';
  };

  if (typeof document === 'undefined') return;  // ここから下は画面の部品

  /* ================= 画面 ================= */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  MN.h = h;
  function btn(label, onclick, cls, attrs) {
    var a = { type: 'button', class: 'mn-btn' + (cls ? ' ' + cls : ''), onclick: onclick };
    if (attrs) Object.keys(attrs).forEach(function (k) { a[k] = attrs[k]; });
    return h('button', a, label);
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var seq = 0;

  MN.mount = function (opts) {
    var dom = MN.dom(opts.domain);
    var P = opts.panels || {};
    var D = MN.normalize(opts.data ? JSON.parse(JSON.stringify(opts.data)) : null, opts.domain);
    var api = { data: D };
    var idp = 'mn' + (++seq) + '-';
    var vpBy = {}; MN.VP.forEach(function (v) { vpBy[v.k] = v; });
    function reflOn() { if (opts.furikaeri) return !!opts.furikaeri(); return !(root.EduitFrame && root.EduitFrame.furikaeri === false); }
    function changed() { if (opts.onChange) opts.onChange(D); }
    function go(id) { if (opts.go) opts.go(id); }
    function tabName(id) { for (var i = 0; i < MN.TABS.length; i++) if (MN.TABS[i].id === id) return (MN.TABS[i].num ? MN.TABS[i].num + ' ' : '') + MN.TABS[i].label; return id; }
    function nextBar(id, label) {
      if (id === 'refl' && !reflOn()) id = 'rec';
      return h('div', { class: 'mn-next' }, btn((label || '次へ: ' + tabName(id)) + ' ▶', function () { go(id); scrollTop(); }, 'mn-btn-primary'));
    }
    function scrollTop() { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } }
    function field(label, key, objRef, o) {
      o = o || {};
      var id = idp + key + '-' + Math.random().toString(36).slice(2, 6);
      var inp = o.rows === 0
        ? h('input', { id: id, type: 'text', maxlength: o.max || 60, value: objRef[key] || '', placeholder: o.ph || null })
        : h('textarea', { id: id, rows: o.rows || 3, maxlength: o.max || 600, placeholder: o.ph || null });
      if (inp.tagName === 'TEXTAREA') inp.value = objRef[key] || '';
      inp.addEventListener('input', function () { objRef[key] = inp.value; changed(); if (o.oninput) o.oninput(); });
      return h('div', { class: 'mn-field' }, h('label', { for: id }, label), o.help ? h('p', { class: 'mn-help' }, o.help) : null, inp);
    }
    function card(title, lead) {
      var c = h('section', { class: 'mn-card' });
      if (title) c.appendChild(h('h2', null, title));
      if (lead) c.appendChild(h('p', { class: 'mn-lead' }, lead));
      for (var i = 2; i < arguments.length; i++) add(c, arguments[i]);
      return c;
    }
    function vpIcon(k, small) {
      var v = vpBy[k]; if (!v) return null;
      return h('span', { class: 'mn-vp mn-vp-' + k + (small ? ' mn-vp-s' : ''), title: v.hint }, h('span', { 'aria-hidden': 'true', class: 'mn-vp-i' }, v.icon), v.label);
    }

    /* ---------- はじめに ---------- */
    function renderIntro() {
      var el = P.intro; if (!el) return; el.innerHTML = '';
      var flow = [['問題の発見', 'find'], ['課題の設定', 'find'], ['構想', ''], [dom.make === '育てる' ? '育成' : '製作', ''], ['評価', 'eval'], ['改善・修正', 'eval']];
      el.appendChild(card('問題解決ノートで、すること',
        dom.name + 'で学んだことを生かして、自分の問題解決をノートにまとめます。最後に、社会の技術の問題解決とくらべます。',
        h('ol', { class: 'mn-flow', 'aria-label': '問題解決の流れ' }, flow.map(function (f, i) {
          return h('li', { class: f[1] ? 'on' : '' }, h('span', { class: 'mn-flow-n' }, (f[1] ? '▶ ' : '') + (i + 1)), ' ' + f[0]);
        })),
        h('p', { class: 'mn-help' }, '▶ = このノートでとりくむ段階(構想と' + (dom.make === '育てる' ? '育成' : '製作') + 'は、ほかの教材や実習でとりくみます)'),
        h('div', { class: 'mn-steps' },
          stepBox('①', '問題の発見', '「こうだったらいいのに」「不便だな」を付箋に書いて集め、問題と課題を分けて、自分の課題を1つ決めます。', 'find'),
          stepBox('②', '評価、改善・修正', '作った' + dom.work + 'を観点ごとに5段階で評価し、レーダーチャートにします。よかった点・改善点を書きます。', 'eval'),
          stepBox('③', '技術の最適化', '社会の製品をえらび、観点の重みを変えると「いちばんよい案」が入れかわることを試します。', 'opt'))));
      el.appendChild(card('問題と課題のちがい', null,
        h('div', { class: 'mn-two' },
          h('div', { class: 'mn-def mn-def-mondai' }, h('h3', null, '問題'), h('p', null, '生活の中で「こうだったらいいのにな」と思ったり、不便さを感じたりすること。'), h('p', { class: 'mn-eg' }, '例: ' + dom.quiz[0].text)),
          h('div', { class: 'mn-def mn-def-kadai' }, h('h3', null, '課題'), h('p', null, '問題を解決するために、何を、どのようにするかを具体的に決めたもの。'), h('p', { class: 'mn-eg' }, '例: ' + dom.quiz[1].text))),
        h('h3', null, '技術の見方・考え方の観点'),
        h('p', null, '問題を見つけるときや評価するときは、次の観点から考えます。付箋にもアイコンを付けます。'),
        h('ul', { class: 'mn-vplist' }, MN.VP.map(function (v) { return h('li', null, vpIcon(v.k), ' ', h('span', { class: 'mn-help' }, v.hint)); }))));
      el.appendChild(nextBar('find', '① 問題の発見から始める'));
    }
    function stepBox(n, title, text, tab) {
      return h('button', { type: 'button', class: 'mn-step', onclick: function () { go(tab); scrollTop(); } },
        h('span', { class: 'mn-step-n' }, n), h('b', null, title), h('span', { class: 'mn-step-t' }, text));
    }

    /* ---------- ① 問題の発見 ---------- */
    var findBoard = null, findPreview = null, quizBox = null, problemInput = null;
    function renderFind() {
      var el = P.find; if (!el) return; el.innerHTML = '';
      // 付箋を書く
      var txt = h('input', { type: 'text', id: idp + 'note', maxlength: 60, placeholder: '例: ' + dom.samples[0].text, class: 'mn-note-in' });
      var pick = [];
      var vpBtns = MN.VP.map(function (v) {
        var b = h('button', { type: 'button', class: 'mn-vpbtn mn-vp-' + v.k, 'aria-pressed': 'false', title: v.hint, onclick: function () {
          var i = pick.indexOf(v.k); if (i >= 0) pick.splice(i, 1); else pick.push(v.k);
          b.setAttribute('aria-pressed', String(pick.indexOf(v.k) >= 0));
        } }, h('span', { 'aria-hidden': 'true' }, v.icon), v.label);
        return b;
      });
      function addNote() {
        var t = txt.value.trim();
        if (!t) { txt.focus(); return; }
        D.cards.push({ id: uid(), text: t, vp: pick.slice(), star: false });
        txt.value = ''; pick.length = 0; vpBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        changed(); drawBoard(true); txt.focus();
      }
      txt.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); addNote(); } });
      var hints = h('div', { class: 'mn-chips' }, h('span', { class: 'mn-help' }, 'ヒント(押すと書く欄に入ります):'), dom.samples.map(function (s) {
        return h('button', { type: 'button', class: 'mn-chip', onclick: function () {
          txt.value = s.text; pick.length = 0; s.vp.forEach(function (k) { pick.push(k); });
          vpBtns.forEach(function (b, i) { b.setAttribute('aria-pressed', String(pick.indexOf(MN.VP[i].k) >= 0)); });
          txt.focus();
        } }, s.text);
      }));
      findBoard = h('div', { class: 'mn-board', 'aria-label': '集めた付箋' });
      el.appendChild(card('1. 「こうだったらいいのに」「不便だな」を集めよう', dom.lets,
        h('div', { class: 'mn-noteform' },
          h('label', { for: idp + 'note', class: 'mn-sr' }, '付箋に書くこと'), txt,
          h('div', { class: 'mn-vpbtns', role: 'group', 'aria-label': 'どの観点から見た問題か' }, h('span', { class: 'mn-help' }, '観点:'), vpBtns),
          btn('＋ 付箋をはる', addNote, 'mn-btn-primary')),
        hints,
        h('div', { class: 'mn-boardbar' },
          h('span', { class: 'mn-help', id: idp + 'count' }),
          btn('観点ごとに並べる', function () {
            var order = MN.VP.map(function (v) { return v.k; });
            var rank = function (c) { var r = c.vp.length ? Math.min.apply(null, c.vp.map(function (k) { var i = order.indexOf(k); return i < 0 ? 9 : i; })) : 9; return r; };
            D.cards = D.cards.map(function (c, i) { return [c, i]; }).sort(function (a, b) { return rank(a[0]) - rank(b[0]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
            changed(); drawBoard();
          }, 'mn-btn-s')),
        findBoard,
        h('p', { class: 'mn-help' }, '付箋はドラッグ(または ◀ ▶)で並べかえられます。観点のアイコンを押すと付けたり外したりできます。いちばん解決したい付箋に ★ を付けましょう。')));
      drawBoard();

      // 問題?課題? クイズ
      quizBox = h('div', { class: 'mn-quiz', 'aria-live': 'polite' });
      el.appendChild(card('2. これは問題? 課題? クイズ', '「問題」は不便さや「こうだったらいいのに」と思うこと、「課題」は問題を解決するために何をどうするかを決めたものです。', quizBox));
      drawQuiz();

      // 自分の課題を決める
      var T = D.task;
      findPreview = h('div', { class: 'mn-taskcard' });
      var pf = field('問題(★を付けた付箋が入ります。書きかえてもよい)', 'problem', T, { rows: 2, max: 200, oninput: drawPreview });
      problemInput = pf.querySelector('textarea');
      var kf = field('課題(何を、どのように' + dom.make + 'か)', 'kadai', T, { rows: 3, max: 300, ph: dom.kadaiHint, oninput: drawPreview });
      var kadaiInput = kf.querySelector('textarea');
      var tmpl = btn('文の形を入れる', function () {
        if (kadaiInput.value.trim() && !confirmAsk('今書いてある課題を、文の形に入れかえますか?')) return;
        kadaiInput.value = '(　　　)が(　　　)ように、(　　　)を' + dom.make + '。';
        T.kadai = kadaiInput.value; changed(); drawPreview(); kadaiInput.focus();
      }, 'mn-btn-s');
      var lim = h('div', { class: 'mn-chips', role: 'group', 'aria-label': '制約条件' }, MN.LIMIT_CHIPS.map(function (c) {
        var on = T.limits.indexOf(c) >= 0;
        var b = h('button', { type: 'button', class: 'mn-chip mn-toggle', 'aria-pressed': String(on), onclick: function () {
          var i = T.limits.indexOf(c); if (i >= 0) T.limits.splice(i, 1); else T.limits.push(c);
          b.setAttribute('aria-pressed', String(T.limits.indexOf(c) >= 0)); changed(); drawPreview();
        } }, c);
        return b;
      }));
      var vps = h('div', { class: 'mn-vpbtns', role: 'group', 'aria-label': '課題の観点' }, MN.VP.map(function (v) {
        var b = h('button', { type: 'button', class: 'mn-vpbtn mn-vp-' + v.k, 'aria-pressed': String(T.vp.indexOf(v.k) >= 0), title: v.hint, onclick: function () {
          var i = T.vp.indexOf(v.k); if (i >= 0) T.vp.splice(i, 1); else T.vp.push(v.k);
          b.setAttribute('aria-pressed', String(T.vp.indexOf(v.k) >= 0)); changed(); drawPreview();
        } }, h('span', { 'aria-hidden': 'true' }, v.icon), v.label);
        return b;
      }));
      el.appendChild(card('3. 自分の課題を1つ決めよう', '問題を感じている人に話を聞いたり、ようすを観察したりして、どうなれば解決するかを考えます。それから、何を、どのように' + dom.make + 'かを決めて、課題にします。',
        h('div', { class: 'mn-cols' },
          h('div', null, pf,
            field('困っている人(だれが)', 'who', T, { rows: 0, max: 60, ph: '例: 自分・家族・クラスのみんな', oninput: drawPreview }),
            field('どうなれば解決するか', 'goal', T, { rows: 2, max: 200, oninput: drawPreview }),
            kf, h('div', { class: 'mn-row' }, tmpl),
            h('div', { class: 'mn-field' }, h('span', { class: 'mn-label' }, '大事にしたい観点'), vps),
            h('div', { class: 'mn-field' }, h('span', { class: 'mn-label' }, '制約条件(守らなければならない条件)'), lim),
            field('制約条件のくわしいこと', 'limitNote', T, { rows: 0, max: 100, ph: '例: 費用は500円まで・授業4時間で作る', oninput: drawPreview })),
          h('div', null, h('h3', null, 'わたしの課題カード'), findPreview))));
      drawPreview();
      el.appendChild(nextBar('eval'));
    }
    function confirmAsk(msg) { try { return window.confirm(msg); } catch (e) { return true; } }
    function drawPreview() {
      if (!findPreview) return;
      var T = D.task; findPreview.innerHTML = '';
      var row = function (k, v) { return h('div', { class: 'mn-tc-row' }, h('span', { class: 'mn-tc-k' }, k), h('span', { class: 'mn-tc-v' + (v ? '' : ' mn-empty') }, v || 'まだ書いていません')); };
      add(findPreview, [row('問題', T.problem.trim()), row('だれが', T.who.trim()), row('解決したすがた', T.goal.trim()),
        h('div', { class: 'mn-tc-kadai' }, h('span', { class: 'mn-tc-k' }, '課題'), h('b', { class: T.kadai.trim() ? '' : 'mn-empty' }, T.kadai.trim() || 'まだ書いていません')),
        h('div', { class: 'mn-tc-row' }, h('span', { class: 'mn-tc-k' }, '観点'), h('span', { class: 'mn-tc-v' }, T.vp.length ? T.vp.map(function (k) { return vpIcon(k, true); }) : h('span', { class: 'mn-empty' }, 'えらんでいません'))),
        row('制約条件', T.limits.join('・') + (T.limitNote ? (T.limits.length ? '/' : '') + T.limitNote : ''))]);
    }
    var drag = null;
    function drawBoard(newLast) {
      if (!findBoard) return;
      findBoard.innerHTML = '';
      var cnt = document.getElementById(idp + 'count');
      if (cnt) cnt.textContent = '付箋 ' + D.cards.length + ' まい' + (D.cards.length < 3 ? '(3まい以上書いてみよう)' : '');
      if (!D.cards.length) { findBoard.appendChild(h('p', { class: 'mn-empty mn-board-empty' }, 'まだ付箋がありません。上の欄に書いて「付箋をはる」を押しましょう。')); return; }
      D.cards.forEach(function (c, i) {
        var main = c.vp[0] || 'none';
        var note = h('div', { class: 'mn-note mn-note-' + main + (c.star ? ' is-star' : '') + (newLast && i === D.cards.length - 1 ? ' is-new' : ''), 'data-id': c.id },
          h('div', { class: 'mn-note-vps' }, MN.VP.map(function (v) {
            var on = c.vp.indexOf(v.k) >= 0;
            return h('button', { type: 'button', class: 'mn-note-vp' + (on ? ' on' : ''), 'aria-pressed': String(on), title: v.label + '(' + v.hint + ')', 'aria-label': v.label, onclick: function () {
              var j = c.vp.indexOf(v.k); if (j >= 0) c.vp.splice(j, 1); else c.vp.push(v.k);
              changed(); drawBoard();
            } }, v.icon);
          })),
          h('p', { class: 'mn-note-t' }, c.text),
          h('div', { class: 'mn-note-bar' },
            h('button', { type: 'button', class: 'mn-note-b mn-star', 'aria-pressed': String(c.star), title: 'いちばん解決したい', onclick: function () { setStar(c); } }, c.star ? '★' : '☆'),
            h('span', { class: 'mn-grow' }),
            h('button', { type: 'button', class: 'mn-note-b', 'aria-label': '前へ', disabled: i === 0, onclick: function () { move(i, i - 1); } }, '◀'),
            h('button', { type: 'button', class: 'mn-note-b', 'aria-label': '後ろへ', disabled: i === D.cards.length - 1, onclick: function () { move(i, i + 1); } }, '▶'),
            h('button', { type: 'button', class: 'mn-note-b mn-del', 'aria-label': '付箋を消す', onclick: function () { D.cards.splice(i, 1); changed(); drawBoard(); } }, '✕')));
        note.addEventListener('pointerdown', function (e) { startDrag(e, note, c.id); });
        findBoard.appendChild(note);
      });
    }
    function setStar(c) {
      var was = c.star, prev = null;
      D.cards.forEach(function (x) { if (x.star) prev = x; x.star = false; });
      c.star = !was;
      // 問題の欄が空か、前の★の付箋のままなら、新しい★の付箋を入れる
      if (c.star && (!D.task.problem.trim() || (prev && D.task.problem === prev.text))) {
        D.task.problem = c.text;
        if (problemInput) problemInput.value = c.text;
        drawPreview();
      }
      changed(); drawBoard();
    }
    function move(from, to) {
      if (to < 0 || to >= D.cards.length) return;
      var c = D.cards.splice(from, 1)[0]; D.cards.splice(to, 0, c); changed(); drawBoard();
    }
    function startDrag(e, note, id) {
      if (e.button > 0 || (e.target.closest && e.target.closest('button'))) return;
      drag = { id: id, note: note, x: e.clientX, y: e.clientY, on: false, target: null, after: false };
      var moveH = function (ev) {
        if (!drag) return;
        var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
        if (!drag.on && Math.abs(dx) + Math.abs(dy) < 8) return;
        if (!drag.on) { drag.on = true; note.classList.add('is-drag'); try { note.setPointerCapture(ev.pointerId); } catch (x) {} }
        ev.preventDefault();
        note.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(2deg)';
        note.style.pointerEvents = 'none';
        var under = document.elementFromPoint(ev.clientX, ev.clientY);
        note.style.pointerEvents = '';
        var t = under && under.closest && under.closest('.mn-note');
        Array.prototype.forEach.call(findBoard.querySelectorAll('.mn-drop-b,.mn-drop-a'), function (n) { n.classList.remove('mn-drop-b', 'mn-drop-a'); });
        if (t && t !== note) {
          var r = t.getBoundingClientRect(); drag.after = ev.clientX > r.left + r.width / 2; drag.target = t.getAttribute('data-id');
          t.classList.add(drag.after ? 'mn-drop-a' : 'mn-drop-b');
        } else drag.target = null;
      };
      var up = function () {
        document.removeEventListener('pointermove', moveH); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        var d = drag; drag = null;
        if (!d || !d.on) return;
        note.style.transform = ''; note.classList.remove('is-drag');
        if (d.target) {
          var from = idx(d.id), c = D.cards.splice(from, 1)[0], to = idx(d.target) + (d.after ? 1 : 0);
          D.cards.splice(to, 0, c); changed();
        }
        drawBoard();
      };
      document.addEventListener('pointermove', moveH); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    }
    function idx(id) { for (var i = 0; i < D.cards.length; i++) if (D.cards[i].id === id) return i; return -1; }

    function drawQuiz() {
      if (!quizBox) return;
      var Q = D.quiz, items = dom.quiz;
      if (!Q.order.length || Q.order.length !== items.length) { Q.order = shuffle(items.map(function (x, i) { return i; })); Q.i = 0; Q.ans = {}; }
      quizBox.innerHTML = '';
      if (Q.i >= items.length) {
        var ok = Q.order.filter(function (k) { return Q.ans[k] === items[k].t; }).length;
        quizBox.appendChild(h('div', { class: 'mn-quiz-end' },
          h('p', { class: 'mn-big' }, ok === items.length ? '🎉 全問正解!' : ok + ' / ' + items.length + ' 問 正解'),
          h('p', null, '「問題」は困っていることや願い、「課題」はそれを解決するために何をどうするかを決めたもの。自分の付箋も、問題か課題かを見直してみましょう。'),
          btn('もう一度(順番が変わります)', function () { Q.order = []; changed(); drawQuiz(); })));
        return;
      }
      var k = Q.order[Q.i], it = items[k], ans = Q.ans[k];
      var choose = function (t) {
        if (Q.ans[k]) return;
        Q.ans[k] = t;
        if (Q.i === items.length - 1) {
          var ok2 = Q.order.filter(function (j) { return Q.ans[j] === items[j].t; }).length;
          Q.last = { score: ok2, total: items.length }; Q.best = Math.max(Q.best || 0, ok2);
        }
        changed(); drawQuiz();
      };
      var mk = function (t, label) {
        var cls = 'mn-qbtn mn-qbtn-' + t;
        if (ans) cls += t === it.t ? ' is-right' : ans === t ? ' is-wrong' : '';
        return h('button', { type: 'button', class: cls, disabled: !!ans, onclick: function () { choose(t); } }, label);
      };
      quizBox.appendChild(h('p', { class: 'mn-help' }, (Q.i + 1) + ' / ' + items.length + ' 問目'));
      quizBox.appendChild(h('p', { class: 'mn-qtext' }, '「' + it.text + '」'));
      quizBox.appendChild(h('div', { class: 'mn-qbtns' }, mk('mondai', '問題'), mk('kadai', '課題')));
      if (ans) {
        quizBox.appendChild(h('p', { class: 'mn-qfb ' + (ans === it.t ? 'is-right' : 'is-wrong') }, (ans === it.t ? '○ 正解! ' : '× ざんねん。 ') + it.why));
        quizBox.appendChild(btn(Q.i === items.length - 1 ? '結果を見る ▶' : '次の問題 ▶', function () { Q.i++; changed(); drawQuiz(); }, 'mn-btn-primary'));
      }
    }

    /* ---------- ② 評価、改善・修正 ---------- */
    var evRadar = null, evHints = null, evRows = {};
    function renderEval() {
      var el = P.eval; if (!el) return; el.innerHTML = '';
      var E = D.ev;
      var modeBtns = [['res', 'できあがり(評価)'], ['tgt', 'はじめの目標']].map(function (m) {
        return h('button', { type: 'button', class: 'mn-seg-b', 'aria-pressed': String(E.mode === m[0]), onclick: function () { E.mode = m[0]; changed(); renderEval(); } },
          h('span', { 'aria-hidden': 'true', style: 'color:' + MN.SERIES[m[0] === 'res' ? 0 : 1].color }, MN.SERIES[m[0] === 'res' ? 0 : 1].mark + ' '), m[1]);
      });
      var list = h('div', { class: 'mn-crit' });
      evRows = {};
      dom.evalCrit.forEach(function (c) {
        var cur = E[E.mode][c.k] || 0, other = E[E.mode === 'res' ? 'tgt' : 'res'][c.k];
        var btns = [1, 2, 3, 4, 5].map(function (n) {
          return h('button', { type: 'button', class: 'mn-lv' + (n <= cur ? ' fill' : ''), 'aria-pressed': String(n === cur), 'aria-label': c.label + ' ' + n + '(' + MN.LEVEL_WORDS[n] + ')', title: MN.LEVEL_WORDS[n], onclick: function () {
            E[E.mode][c.k] = E[E.mode][c.k] === n ? 0 : n; changed(); renderEval();
          } }, String(n));
        });
        list.appendChild(h('div', { class: 'mn-crit-row' },
          h('div', { class: 'mn-crit-l' }, h('b', null, c.label), h('span', { class: 'mn-help' }, c.hint)),
          h('div', { class: 'mn-crit-b' }, h('div', { class: 'mn-lvs', role: 'group', 'aria-label': c.label }, btns),
            h('span', { class: 'mn-crit-v' }, cur ? MN.LEVEL_WORDS[cur] : '—', other ? h('small', null, (E.mode === 'res' ? ' 目標 ' : ' 評価 ') + other) : null))));
      });
      evRadar = h('div', { class: 'mn-radar-wrap' });
      evHints = h('div', { class: 'mn-hints' });
      var good = field('よかった点', 'good', E, { rows: 3 }), imp = field('改善・修正の方法(どこを、どのように直すか)', 'improve', E, { rows: 3 });
      el.appendChild(card('1. ' + dom.work + 'を観点ごとに評価しよう', '設定した課題を達成できたか、問題を解決できたかを、観点ごとに 1〜5 の5段階で評価します。「はじめの目標」も入れると、目標とくらべられます。',
        field(dom.work + 'の名前', 'title', E, { rows: 0, max: 40, ph: dom.titleHint || '' }),
        h('div', { class: 'mn-seg', role: 'group', 'aria-label': '入れる点' }, h('span', { class: 'mn-help' }, '入れる点:'), modeBtns),
        h('div', { class: 'mn-evgrid' }, list, h('div', { class: 'mn-evside' }, evRadar, evHints))));
      drawEvalRadar();
      var pr = h('div', { class: 'mn-checks' }, dom.process.map(function (t, i) {
        var id = idp + 'pr' + i;
        var cb = h('input', { type: 'checkbox', id: id, onchange: function () { E.process[i] = cb.checked; changed(); } });
        cb.checked = !!E.process[i];
        return h('label', { class: 'mn-check', for: id }, cb, h('span', null, t));
      }));
      el.appendChild(card('2. ' + (dom.make === '育てる' ? '育成' : '製作') + 'の過程をふり返ろう', 'できあがりだけでなく、計画や作業の進め方が適切だったかも評価します。できたことにチェックを入れましょう。', pr));
      el.appendChild(card('3. よかった点と改善・修正の方法を書こう', '評価をもとに、構想したとおりにならなかったところや、よりよくしたいところを見つけて、改善・修正の方法を考えます。',
        h('div', { class: 'mn-cols' }, good, imp),
        field('新たに見つけた問題(次の問題解決につなげる)', 'newProblem', E, { rows: 2 })));
      el.appendChild(nextBar('opt'));
    }
    function drawEvalRadar() {
      if (!evRadar) return;
      var E = D.ev, axes = dom.evalCrit.map(function (c) { return c.label; });
      var res = dom.evalCrit.map(function (c) { return E.res[c.k] || 0; }), tgt = dom.evalCrit.map(function (c) { return E.tgt[c.k] || 0; });
      evRadar.innerHTML = MN.radarSVG(axes, [{ values: res, style: 0, bold: true }, { values: tgt, style: 1, fill: 0.03 }], { label: '評価のレーダーチャート' });
      evRadar.appendChild(legend([['できあがり(評価)', 0], ['はじめの目標', 1]]));
      evHints.innerHTML = '';
      var filled = dom.evalCrit.filter(function (c) { return E.res[c.k]; });
      if (filled.length < 2) { evHints.appendChild(h('p', { class: 'mn-help' }, '点を入れると、よかった点と改善点の候補がここに出ます。')); return; }
      var max = Math.max.apply(null, filled.map(function (c) { return E.res[c.k]; }));
      var min = Math.min.apply(null, filled.map(function (c) { return E.res[c.k]; }));
      var goodC = filled.filter(function (c) { return E.res[c.k] === max && max >= 3; });
      var badC = filled.filter(function (c) { return (E.res[c.k] === min && min < max) || (E.tgt[c.k] && E.res[c.k] < E.tgt[c.k]); });
      var addTo = function (key, list, label) {
        var cur = (D.ev[key] || '').trim();
        var line = list.map(function (c) { return c.label + ': '; }).join('\n');
        D.ev[key] = (cur ? cur + '\n' : '') + line;
        var ta = P.eval.querySelectorAll('textarea')[key === 'good' ? 0 : 1];
        if (ta) { ta.value = D.ev[key]; ta.focus(); }
        changed();
      };
      if (goodC.length) evHints.appendChild(h('p', { class: 'mn-hint mn-hint-good' }, '👍 よかった点の候補: ', h('b', null, goodC.map(function (c) { return c.label; }).join('・')), ' ',
        btn('書き足す', function () { addTo('good', goodC); }, 'mn-btn-s')));
      if (badC.length) evHints.appendChild(h('p', { class: 'mn-hint mn-hint-bad' }, '🔧 改善点の候補: ', h('b', null, badC.map(function (c) { return c.label + (E.tgt[c.k] && E.res[c.k] < E.tgt[c.k] ? '(目標より ' + (E.tgt[c.k] - E.res[c.k]) + ' 低い)' : ''); }).join('・')), ' ',
        btn('書き足す', function () { addTo('improve', badC); }, 'mn-btn-s')));
      var avg = filled.reduce(function (s, c) { return s + E.res[c.k]; }, 0) / filled.length;
      evHints.appendChild(h('p', { class: 'mn-help' }, '平均 ' + (Math.round(avg * 10) / 10) + ' 点(' + filled.length + ' / ' + dom.evalCrit.length + ' 観点)'));
    }
    function legend(items) {
      return h('ul', { class: 'mn-legend' }, items.map(function (it) {
        var st = MN.SERIES[it[1] % MN.SERIES.length];
        return h('li', null, h('span', { 'aria-hidden': 'true', class: 'mn-legend-m', style: 'color:' + st.color }, st.mark + (st.dash ? ' - - -' : ' ───')), ' ', it[0]);
      }));
    }

    /* ---------- ③ 技術の最適化 ---------- */
    var optRes = null, lastBest = {};
    function renderOpt() {
      var el = P.opt; if (!el) return; el.innerHTML = '';
      var O = D.opt, p = MN.product(dom, O.product), crit = MN.critOf(dom, p);
      var tabs = h('div', { class: 'mn-prods', role: 'group', 'aria-label': '社会の製品・技術をえらぶ' }, dom.products.map(function (q) {
        var won = arr(O.wins[q.id]).length;
        return h('button', { type: 'button', class: 'mn-prod', 'aria-pressed': String(q.id === p.id), onclick: function () { O.product = q.id; changed(); renderOpt(); } },
          h('span', { class: 'mn-prod-i', 'aria-hidden': 'true' }, q.icon), h('span', null, q.name), won ? h('small', null, '1位にできた案 ' + won + '/' + q.options.length) : null);
      }));
      if (!O.weights[p.id]) O.weights[p.id] = MN.weightsOf(D, dom, p);
      var W = O.weights[p.id];
      if (!Array.isArray(O.limits[p.id])) O.limits[p.id] = [];
      var sliders = h('div', { class: 'mn-weights' }, crit.map(function (c) {
        var id = idp + 'w-' + c.k;
        var out = h('output', { for: id, class: 'mn-w-out' }, MN.WEIGHT_WORDS[W[c.k]] + ' ×' + W[c.k]);
        var r = h('input', { type: 'range', id: id, min: 0, max: 3, step: 1, value: W[c.k] });
        r.addEventListener('input', function () { W[c.k] = +r.value; out.textContent = MN.WEIGHT_WORDS[W[c.k]] + ' ×' + W[c.k]; changed(); drawOpt(); });
        return h('div', { class: 'mn-w' }, h('label', { for: id }, c.label), r, out);
      }));
      var presets = h('div', { class: 'mn-chips', role: 'group', 'aria-label': '立場を決めて重みを入れる' }, h('span', { class: 'mn-help' }, 'だれの立場で考える?'), MN.presetsOf(dom, p).map(function (ps) {
        return h('button', { type: 'button', class: 'mn-chip', onclick: function () {
          crit.forEach(function (c) { W[c.k] = ps.w[c.k] != null ? ps.w[c.k] : 1; });
          changed(); renderOpt();
        } }, h('span', { 'aria-hidden': 'true' }, ps.icon + ' '), ps.label);
      }).concat([h('button', { type: 'button', class: 'mn-chip', onclick: function () { crit.forEach(function (c) { W[c.k] = 1; }); changed(); renderOpt(); } }, '⚖️ 同じ重み')]));
      var limits = (p.limits || []).length ? h('div', { class: 'mn-checks' }, h('span', { class: 'mn-label' }, '制約条件(これを守れない案は選べない)'), p.limits.map(function (l, i) {
        var id = idp + 'lim' + i;
        var cb = h('input', { type: 'checkbox', id: id, onchange: function () {
          var a = O.limits[p.id], j = a.indexOf(i); if (cb.checked && j < 0) a.push(i); if (!cb.checked && j >= 0) a.splice(j, 1);
          changed(); drawOpt();
        } });
        cb.checked = O.limits[p.id].indexOf(i) >= 0;
        return h('label', { class: 'mn-check', for: id }, cb, h('span', null, l.label));
      })) : null;
      optRes = h('div', { class: 'mn-optres' });
      el.appendChild(card('1. 社会の製品・技術をえらぼう', '社会の製品や技術も、いろいろな条件の折り合いをつけながら最適化されています。観点の重み(どれを大事にするか)を変えて、「いちばんよい案」がどう変わるか試しましょう。', tabs));
      el.appendChild(card(p.icon + ' ' + p.q, null,
        h('div', { class: 'mn-optgrid' },
          h('div', null, presets, h('h3', null, '観点の重み'), sliders, limits),
          optRes),
        h('p', { class: 'mn-help' }, '点は、授業で考えるための目安です。実際の製品の性能は、種類や使い方によって変わります。')));
      drawOpt();
      el.appendChild(card('2. 気づいたことをまとめよう', null,
        field('重みや制約条件を変えて気づいたこと(どこで折り合いをつけたか)', 'notice', O, { rows: 3 }),
        field('自分の問題解決と、社会の問題解決の共通点とちがい', 'compare', O, { rows: 3, help: '自分が' + dom.work + 'を' + dom.make + 'ときにも、時間や費用などの制約条件の中で、何かを大事にして何かをあきらめましたか。' })));
      el.appendChild(nextBar('refl'));
    }
    function drawOpt() {
      if (!optRes) return;
      var O = D.opt, p = MN.product(dom, O.product), crit = MN.critOf(dom, p), W = O.weights[p.id];
      var r = MN.rank(dom, p, W, O.limits[p.id]);
      var wins = O.wins[p.id] = arr(O.wins[p.id]);
      var newWin = r.best && wins.indexOf(r.best) < 0;
      if (newWin) { wins.push(r.best); changed(); }
      var swapped = lastBest[p.id] !== undefined && r.best && lastBest[p.id] !== r.best;
      lastBest[p.id] = r.best;
      optRes.innerHTML = '';
      var medals = ['🥇', '🥈', '🥉'];
      var head = r.sumW === 0 ? '重みをどれか1つ以上「少し」以上にしましょう'
        : r.none ? 'どの案も制約条件に合いません。条件を見直しましょう'
        : r.tie ? '1位が同点です。重みを変えてみましょう'
        : '今のいちばんよい案: ' + r.list[0].name;
      optRes.appendChild(h('p', { class: 'mn-opt-head' + (swapped ? ' is-swap' : ''), 'aria-live': 'polite' }, swapped ? '🔄 1位が入れかわった! ' : '', head));
      var ul = h('ol', { class: 'mn-rank' });
      r.list.forEach(function (it, i) {
        ul.appendChild(h('li', { class: 'mn-rank-i' + (it.ok ? '' : ' is-out') + (it.id === r.best ? ' is-best' : '') },
          h('span', { class: 'mn-rank-m', 'aria-hidden': 'true' }, it.ok ? medals[i] || '' : '🚫'),
          h('div', { class: 'mn-rank-b' },
            h('div', { class: 'mn-rank-t' }, h('b', null, it.name), h('span', { class: 'mn-rank-s' }, it.ok ? it.score + ' 点' : '制約条件に合わない'),
              h('span', { class: 'mn-rank-key', 'aria-hidden': 'true', style: 'color:' + MN.SERIES[it.idx % 3].color }, MN.SERIES[it.idx % 3].mark)),
            h('div', { class: 'mn-bar' }, h('span', { style: 'width:' + (it.ok ? it.score : 0) + '%;background:' + MN.SERIES[it.idx % 3].color })),
            h('p', { class: 'mn-help' }, it.opt.note, it.fails.length ? h('b', { class: 'mn-out' }, '(' + it.fails.map(function (f) { return f.label; }).join('・') + ')') : null))));
      });
      optRes.appendChild(ul);
      var radar = h('div', { class: 'mn-radar-wrap mn-radar-s' });
      radar.innerHTML = MN.radarSVG(crit.map(function (c) { return c.label; }), p.options.map(function (o, i) {
        return { values: crit.map(function (c) { return o.s[c.k]; }), style: i, bold: o.id === r.best, fill: o.id === r.best ? 0.16 : 0.04 };
      }), { label: p.name + 'の案のレーダーチャート' });
      radar.appendChild(legend(p.options.map(function (o, i) { return [o.name, i]; })));
      optRes.appendChild(radar);
      optRes.appendChild(h('div', { class: 'mn-challenge' + (wins.length === p.options.length ? ' is-done' : '') },
        h('b', null, wins.length === p.options.length ? '🏆 チャレンジ達成! ' : '🎯 チャレンジ: '),
        '重みや制約条件を変えて、' + p.options.length + 'つの案をそれぞれ1位にしてみよう ',
        h('span', { class: 'mn-badges' }, p.options.map(function (o) {
          var w = wins.indexOf(o.id) >= 0;
          return h('span', { class: 'mn-badge' + (w ? ' on' : '') }, (w ? '✓ ' : '・') + o.name);
        }))));
      // 製品をえらぶボタンの「1位にできた案」の数も新しくする
      if (newWin) {
        var pb = P.opt.querySelectorAll('.mn-prod')[dom.products.indexOf(p)];
        if (pb) { var sm = pb.querySelector('small') || pb.appendChild(h('small')); sm.textContent = '1位にできた案 ' + wins.length + '/' + p.options.length; }
      }
    }

    /* ---------- 振り返り ---------- */
    function renderRefl() {
      var el = P.refl; if (!el) return; el.innerHTML = '';
      var R = D.refl;
      var self = h('div', { class: 'mn-self' }, MN.SELF.map(function (s) {
        return h('fieldset', { class: 'mn-self-f' }, h('legend', null, s.label), MN.SELF_LV.map(function (lv) {
          var id = idp + 's-' + s.k + lv[0];
          var rb = h('input', { type: 'radio', id: id, name: idp + 'self-' + s.k, value: lv[0], onchange: function () { R.self[s.k] = lv[0]; changed(); } });
          rb.checked = R.self[s.k] === lv[0];
          return h('label', { class: 'mn-check', for: id }, rb, h('span', null, lv[1]));
        }));
      }));
      el.appendChild(card('今回の問題解決を振り返ろう', null, h('h3', null, '自己評価'), self,
        field('分かったこと・できるようになったこと', 'learned', R, { rows: 3 }),
        field('これからの問題解決に生かしたいこと', 'next', R, { rows: 3, help: '今回の問題解決をふり返って、次に何かを作ったり育てたりするときに役立てたいことを書こう。' })));
      el.appendChild(nextBar('rec'));
    }

    /* ---------- 記録 ---------- */
    function renderRec() {
      var el = P.rec; if (!el) return; el.innerHTML = '';
      var S = D.student;
      var who = h('div', { class: 'mn-row mn-who' },
        field('組', 'cls', S, { rows: 0, max: 6 }), field('番号', 'no', S, { rows: 0, max: 4 }), field('名前', 'name', S, { rows: 0, max: 20 }));
      var tools = typeof opts.recordTools === 'function' ? opts.recordTools() : opts.recordTools;
      el.appendChild(card('記録を残そう', 'ノートは自動で保存されます。先生に出すときは「ファイルに書き出す」、紙で出すときは「印刷する」を使います。',
        who, h('div', { class: 'mn-row mn-rec-tools' }, btn('🖨 印刷する(問題解決シート)', function () { api.print(); }, 'mn-btn-primary'), tools || null),
        h('p', { class: 'mn-help' }, '印刷すると、書いていない欄は線だけのわくになります。紙に書きこんで使うこともできます。')));
      var sum = MN.summary(D, D.domain), box = card('ノートのまとめ', null);
      sum.forEach(function (sec) {
        if (sec.reflect && !reflOn()) return;
        var tb = h('table', { class: 'mn-table' });
        sec.rows.forEach(function (r) { tb.appendChild(h('tr', null, h('th', null, r[0]), h('td', { class: r[1] ? '' : 'mn-empty' }, r[1] || '—'))); });
        box.appendChild(h('h3', null, sec.title)); box.appendChild(h('div', { class: 'mn-table-wrap' }, tb));
      });
      el.appendChild(box);
    }

    /* ---------- 印刷(問題解決シート) ---------- */
    function lines(text, n) {
      text = str(text).trim();
      if (text) return h('div', { class: 'mn-ps-text' }, text);
      var d = h('div', { class: 'mn-ps-lines' }); for (var i = 0; i < (n || 2); i++) d.appendChild(h('div', { class: 'mn-ps-line' })); return d;
    }
    function buildSheet() {
      var S = D.student, T = D.task, E = D.ev, O = D.opt;
      var info = root.EDUIT_INFO || {};
      var sheet = h('div', { class: 'mn-sheet', 'aria-hidden': 'true' });
      sheet.appendChild(h('div', { class: 'mn-ps-head' },
        h('div', null, h('div', { class: 'mn-ps-sub' }, dom.name + '(' + (info.domain || D.domain) + ')'), h('h1', null, '問題解決シート')),
        h('div', { class: 'mn-ps-who' }, '組 ', h('span', { class: 'mn-ps-box' }, S.cls), ' 番号 ', h('span', { class: 'mn-ps-box' }, S.no), ' 名前 ', h('span', { class: 'mn-ps-box mn-ps-name' }, S.name))));
      // 1
      var cards = D.cards.length ? h('ul', { class: 'mn-ps-cards' }, D.cards.map(function (c) {
        return h('li', { class: c.star ? 'star' : '' }, (c.star ? '★ ' : '') + c.text, c.vp.length ? h('small', null, ' [' + c.vp.map(function (k) { return vpBy[k] ? vpBy[k].icon + vpBy[k].label : k; }).join(' ') + ']') : null);
      })) : lines('', 3);
      sheet.appendChild(h('section', { class: 'mn-ps-sec' }, h('h2', null, '1 問題の発見と課題の設定'),
        h('h3', null, '「こうだったらいいのに」「不便だな」(観点: ' + MN.VP.map(function (v) { return v.icon + v.label; }).join(' ') + ')'), cards,
        h('table', { class: 'mn-ps-t' },
          psRow('問題', T.problem), psRow('困っている人', T.who), psRow('どうなれば解決するか', T.goal),
          psRow('課題', T.kadai, 2), psRow('観点', T.vp.map(function (k) { return vpBy[k] ? vpBy[k].label : k; }).join('・')),
          psRow('制約条件', T.limits.join('・') + (T.limitNote ? (T.limits.length ? '/' : '') + T.limitNote : '')))));
      // 2
      var rad = h('div', { class: 'mn-ps-radar' });
      rad.innerHTML = MN.radarSVG(dom.evalCrit.map(function (c) { return c.label; }), [
        { values: dom.evalCrit.map(function (c) { return E.res[c.k] || 0; }), style: 0, bold: true },
        { values: dom.evalCrit.map(function (c) { return E.tgt[c.k] || 0; }), style: 1, fill: 0.03 }], { label: '評価' });
      rad.appendChild(legend([['できあがり(評価)', 0], ['はじめの目標', 1]]));
      var et = h('table', { class: 'mn-ps-t mn-ps-score' }, h('tr', null, h('th', null, '観点'), h('th', null, '目標'), h('th', null, '評価')),
        dom.evalCrit.map(function (c) { return h('tr', null, h('td', null, c.label), h('td', { class: 'num' }, E.tgt[c.k] || ''), h('td', { class: 'num' }, E.res[c.k] || '')); }));
      sheet.appendChild(h('section', { class: 'mn-ps-sec' }, h('h2', null, '2 評価、改善・修正'),
        h('p', null, dom.work + 'の名前: ', h('span', { class: 'mn-ps-box mn-ps-wide' }, E.title)),
        h('div', { class: 'mn-ps-evgrid' }, rad, et),
        h('p', { class: 'mn-ps-proc' }, '過程の評価: ', dom.process.map(function (t, i) { return (E.process[i] ? '☑ ' : '☐ ') + t; }).join('  ')),
        h('table', { class: 'mn-ps-t' }, psRow('よかった点', E.good, 2), psRow('改善・修正の方法', E.improve, 2), psRow('新たに見つけた問題', E.newProblem))));
      // 3
      var p = MN.product(dom, O.product), crit = MN.critOf(dom, p), W = MN.weightsOf(D, dom, p), r = MN.rank(dom, p, W, O.limits[p.id]);
      var ot = h('table', { class: 'mn-ps-t mn-ps-score' },
        h('tr', null, h('th', null, '案'), crit.map(function (c) { return h('th', null, c.label + ' ×' + W[c.k]); }), h('th', null, '点')),
        p.options.map(function (o) {
          var it = r.list.filter(function (x) { return x.id === o.id; })[0];
          return h('tr', null, h('td', null, (o.id === r.best ? '🥇 ' : '') + o.name), crit.map(function (c) { return h('td', { class: 'num' }, o.s[c.k]); }), h('td', { class: 'num' }, it.ok ? it.score : '×'));
        }));
      sheet.appendChild(h('section', { class: 'mn-ps-sec' }, h('h2', null, '3 技術の最適化: ' + p.name),
        ot, h('table', { class: 'mn-ps-t' }, psRow('気づいたこと(折り合い)', O.notice, 2), psRow('自分の問題解決と社会の問題解決', O.compare, 2))));
      // 振り返り
      if (reflOn()) {
        sheet.appendChild(h('section', { class: 'mn-ps-sec', 'data-ef-reflect': '' }, h('h2', null, '振り返り'),
          h('table', { class: 'mn-ps-t mn-ps-self' }, MN.SELF.map(function (s) {
            return h('tr', null, h('th', null, s.label), h('td', null, MN.SELF_LV.map(function (lv) { return (D.refl.self[s.k] === lv[0] ? '◉ ' : '○ ') + lv[1]; }).join('  ')));
          }), psRow('分かったこと・できるようになったこと', D.refl.learned, 2), psRow('これからの問題解決に生かしたいこと', D.refl.next, 2))));
      }
      sheet.appendChild(h('p', { class: 'mn-ps-foot' }, '問題解決ノート ・ ' + (info.suite || dom.name) + (info.version ? ' 第' + info.version + '版' : '')));
      return sheet;
    }
    function psRow(k, v, n) { return h('tr', null, h('th', null, k), h('td', null, lines(v, n || 1))); }
    var sheetEl = null;
    function attachSheet() {
      if (sheetEl) sheetEl.remove();
      sheetEl = buildSheet(); document.body.appendChild(sheetEl);
      document.documentElement.classList.add('mn-printing');
    }
    function detachSheet() { document.documentElement.classList.remove('mn-printing'); if (sheetEl) { sheetEl.remove(); sheetEl = null; } }
    window.addEventListener('beforeprint', function () { if (!sheetEl) attachSheet(); });
    window.addEventListener('afterprint', detachSheet);
    api.print = function () { attachSheet(); setTimeout(function () { window.print(); }, 60); };
    api.sheet = buildSheet;

    /* ---------- 全体 ---------- */
    var R = { intro: renderIntro, find: renderFind, eval: renderEval, opt: renderOpt, refl: renderRefl, rec: renderRec };
    api.render = function (id) { if (id) { if (R[id]) R[id](); } else Object.keys(R).forEach(function (k) { R[k](); }); };
    api.setData = function (data) { D = api.data = MN.normalize(JSON.parse(JSON.stringify(data || {})), opts.domain); lastBest = {}; api.render(); };
    api.render();
    return api;
  };
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this);
