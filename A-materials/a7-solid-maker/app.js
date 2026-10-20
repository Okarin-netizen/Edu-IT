/* 第三角法 立体メーカー(A7) app.js
 * 三面図(マス目)をかくと、立体(等角図・キャビネット図・3D)にする。図面の印刷・PDF、STL の書き出し。 */
(function () {
  'use strict';
  var APP = 'solid-maker';
  var SG = window.SolidGeom, SS = window.SolidSheet, SAMPLES = window.SolidSamples;
  if (G.ruby && G.ruby.add) G.ruby.add({ '面取り': 'めんとり', '三角柱': 'さんかくちゅう', '体積': 'たいせき', '投影法': 'とうえいほう', '図名': 'ずめい', '実物': 'じつぶつ' });
  G.initApp({
    app: APP,
    title: '第三角法 立体メーカー',
    files: ['style.css', 'geom.js', 'sheet.js', 'samples.js', 'app.js'],
    help: showHelp
  });

  var TOOLS = [
    { v: 1, label: 'ぬる', name: 'マス全体をぬる' },
    { v: 2, label: '', name: '左下の半分(◣)' },
    { v: 3, label: '', name: '右下の半分(◢)' },
    { v: 4, label: '', name: '右上の半分(◥)' },
    { v: 5, label: '', name: '左上の半分(◤)' },
    { v: 0, label: '消す', name: 'マスを消す' }
  ];
  // マスの中の形(a: 右へ, b: 上へ)
  var SHAPE = { 1: [[0, 0], [1, 0], [1, 1], [0, 1]], 2: [[0, 0], [1, 0], [0, 1]], 3: [[0, 0], [1, 0], [1, 1]], 4: [[1, 0], [1, 1], [0, 1]], 5: [[0, 0], [1, 1], [0, 1]] };
  var VIEW_NAME = { front: '正面図', top: '平面図', side: '右側面図' };
  var SELF = [
    { id: 'match', label: '三面図で、幅・高さ・奥行きがそろう位置がわかった' },
    { id: 'image', label: '三面図から、立体の形を思いうかべることができた' },
    { id: 'pict', label: '等角図とキャビネット図のちがいを説明できる' },
    { id: 'sheet', label: '寸法や表題欄の入った図面にまとめることができた' }
  ];
  var LV = [['3', 'できた'], ['2', 'だいたいできた'], ['1', 'もう少し']];
  var CAMS = { iso: [45, 35.26], front: [0, 0], top: [0, 90], right: [90, 0], back: [215, 25], under: [40, -30] };

  /* ---------- データ ---------- */
  function defaultData() {
    return {
      size: { W: 8, D: 6, H: 6, cell: 10 },
      views: { front: '', top: '', side: '' },
      look: { mode: 'iso', hidden: false },
      sheet: { title: '', material: '', grade: '', cls: '', no: '', name: '', date: '', scale: 'auto', dims: true, detail: true, iso: true },
      reflect: { self: {}, learned: '', hard: '', use: '' },
      done: { samples: 0, print: 0, pdf: 0, stl: 0 }
    };
  }
  var art = null, P = null, M = null;     // 作品・art.data・三面図のモデル
  var solid = null, mis = null, drawCache = {};
  var undoStack = [], redoStack = [];
  var tool = 1, currentTab = 'draw';
  var cam = { yaw: CAMS.iso[0], pitch: CAMS.iso[1] };

  function encode(m) {
    return { W: m.W, D: m.D, H: m.H, front: m.front.join(''), top: m.top.join(''), side: m.side.join('') };
  }
  function decodeInto(size, views) {
    var W = G.clamp(Math.round(+size.W || 8), 1, 16), D = G.clamp(Math.round(+size.D || 6), 1, 16), H = G.clamp(Math.round(+size.H || 6), 1, 16);
    var m = SG.emptyModel(W, D, H);
    ['front', 'top', 'side'].forEach(function (k) {
      var s = String((views && views[k]) || '');
      for (var i = 0; i < m[k].length; i++) { var c = +s.charAt(i); m[k][i] = c >= 0 && c <= 5 ? c : 0; }
    });
    return m;
  }
  function snapshot() { return JSON.stringify(encode(M)); }
  function restore(s) { var o = JSON.parse(s); M = decodeInto(o, o); P.size.W = M.W; P.size.D = M.D; P.size.H = M.H; cursor = { front: 0, top: 0, side: 0 }; }
  function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 60) undoStack.shift(); redoStack = []; }

  function setProject(a) {
    var base = defaultData();
    a.data = a.data || {};
    // ない項目・形のちがう項目(読みこんだファイルがこわれているときなど)は初めの値にする
    Object.keys(base).forEach(function (k) {
      var v = a.data[k], b = base[k];
      if (v === undefined) a.data[k] = b;
      else if (b && typeof b === 'object') {
        if (!v || typeof v !== 'object' || Array.isArray(v)) a.data[k] = b;
        else Object.keys(b).forEach(function (kk) { if (v[kk] === undefined) v[kk] = b[kk]; });
      }
    });
    art = a; P = a.data;
    M = decodeInto(P.size, P.views);
    var pf = G.profile();
    if (!P.sheet.cls && !P.sheet.no && !P.sheet.name) { P.sheet.cls = pf.class; P.sheet.no = pf.no; P.sheet.name = pf.name; }
    undoStack = []; redoStack = [];
    try { localStorage.setItem('solid-maker.last', a.id); } catch (e) {}
    G.$('#pname').value = art.title === '無題' ? '' : art.title;
    modelChanged(true);
    renderAll();
  }
  function newProject(sampleId) {
    var a = G.newArtifact(APP, '無題', defaultData());
    setProject(a);
    if (sampleId) loadSample(sampleId, true);
  }

  // 自動保存
  var saveTimer = null;
  function changed() {
    clearTimeout(saveTimer);
    G.$('#save-state').textContent = '変更があります…';
    saveTimer = setTimeout(save, 900);
  }
  function save(manual) {
    clearTimeout(saveTimer);
    art.title = (G.$('#pname').value || '').trim() || '無題';
    var e = encode(M);
    P.size.W = e.W; P.size.D = e.D; P.size.H = e.H;
    P.views = { front: e.front, top: e.top, side: e.side };
    art.updatedAt = new Date().toISOString();
    return G.store.put(art).then(function () {
      var t = new Date();
      G.$('#save-state').textContent = (manual ? '保存しました ' : '自動保存しました ') + t.getHours() + ':' + ('0' + t.getMinutes()).slice(-2);
      if (manual) G.toast('保存しました');
    }).catch(function (err) { G.$('#save-state').textContent = '保存できませんでした: ' + err.message; });
  }

  // 三面図が変わったら立体を作り直す
  function modelChanged(quiet) {
    solid = SG.build(M);
    mis = SG.mismatches(M);
    drawCache = {};
    if (!quiet) changed();
  }
  // まだかいていない図(空の図)。1つでもあるうちは、合わないマスを知らせない
  function emptyViews() { return ['front', 'top', 'side'].filter(function (k) { return SG.isEmptyView(M[k]); }); }
  function misCount() { return emptyViews().length ? 0 : mis.count; }
  function drawing(name) { return drawCache[name] || (drawCache[name] = SG.lineDrawing(solid, name)); }
  function cellMM() { return G.clamp(+P.size.cell || 10, 1, 200); }
  function title() { return (G.$('#pname').value || '').trim() || '立体'; }

  /* ---------- 1 三面図をかく ---------- */
  var ed = null; // エディタの配置
  var hover = null, focusView = null, cursor = { front: 0, top: 0, side: 0 };

  function buildTools() {
    var box = G.$('.a7-tools');
    TOOLS.forEach(function (t) {
      var icon = t.v === 0 ? '<rect x="2" y="2" width="20" height="20" fill="#fff" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/>'
        : '<rect x="2" y="2" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1"/><polygon points="' +
          SHAPE[t.v].map(function (p) { return (2 + p[0] * 20) + ',' + (22 - p[1] * 20); }).join(' ') + '" fill="currentColor"/>';
      var b = G.h('button', { type: 'button', role: 'radio', class: 'a7-tool', 'data-v': t.v, title: t.name, 'aria-label': t.name, onclick: function () { setTool(t.v); } },
        G.h('span', { html: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' + icon + '</svg>' }), t.label ? G.h('span', null, t.label) : null);
      if (t.v === 2) box.appendChild(G.h('span', { class: 'g-muted a7-tool-sep' }, 'ななめ半分:'));
      box.appendChild(b);
      if (t.v === 5) box.appendChild(G.h('span', { class: 'a7-tool-sep' }));
    });
    setTool(1);
  }
  function setTool(v) {
    tool = v;
    G.$$('.a7-tool').forEach(function (b) { b.setAttribute('aria-checked', String(+b.getAttribute('data-v') === v)); });
  }

  function layout() {
    var wrap = G.$('#editor-wrap');
    var W = M.W, D = M.D, H = M.H;
    var L = 34, T = 40, B = 60, R = 14, gap = 34;
    var aw = Math.max(280, wrap.clientWidth - 4);
    // 開いたときに、3つの図が画面の中に入る高さにする
    var top = wrap.getBoundingClientRect().top + (window.scrollY || 0);
    var ah = Math.max(300, Math.min(window.innerHeight - 250, window.innerHeight - top - 12));
    var px = Math.floor(Math.min((aw - L - gap - R) / (W + D), (ah - T - gap - B) / (D + H)));
    px = G.clamp(px, 12, 56);
    var o = { px: px, gap: gap, L: L, T: T, W: W, D: D, H: H };
    o.top = { x: L, y: T, U: W, V: D };
    o.front = { x: L, y: T + D * px + gap, U: W, V: H };
    o.side = { x: L + W * px + gap, y: o.front.y, U: D, V: H };
    o.width = L + W * px + gap + D * px + R;
    o.height = o.front.y + H * px + B;
    return o;
  }
  // 図とマスの番号 → 画面の位置
  function cellXY(view, u, v) { var b = ed[view]; return [b.x + u * ed.px, b.y + (b.V - 1 - v) * ed.px]; }

  // マウスを置いたマスと、ほかの図で位置がそろう行・列
  function bandsFor(h) {
    var out = { front: { col: null, row: null }, top: { col: null, row: null }, side: { col: null, row: null } };
    if (!h) return out;
    if (h.view === 'front') { out.front = { col: h.u, row: h.v }; out.top.col = h.u; out.side.row = h.v; }
    if (h.view === 'top') { out.top = { col: h.u, row: h.v }; out.front.col = h.u; out.side.col = h.v; }
    if (h.view === 'side') { out.side = { col: h.u, row: h.v }; out.top.row = h.u; out.front.row = h.v; }
    return out;
  }

  function renderEditor() {
    ed = layout();
    var px = ed.px, s = [];
    var bands = bandsFor(hover || (focusView ? { view: focusView, u: cursor[focusView] % ed[focusView].U, v: Math.floor(cursor[focusView] / ed[focusView].U) } : null));
    var misSet = { front: {}, top: {}, side: {} };
    if (misCount() && !stroke) ['front', 'top', 'side'].forEach(function (k) { mis[k].forEach(function (i) { misSet[k][i] = true; }); });
    // 平面図と右側面図をつなぐ 45° の線
    var X0 = ed.side.x, Y0 = ed.top.y + ed.D * px;
    s.push('<line x1="' + X0 + '" y1="' + Y0 + '" x2="' + (X0 + ed.D * px) + '" y2="' + (Y0 - ed.D * px) + '" class="a7-miter"/>');
    ['top', 'front', 'side'].forEach(function (view) {
      var b = ed[view], arr = M[view], U = b.U, V = b.V, bd = bands[view];
      s.push('<g class="a7-view a7-' + view + '" data-view="' + view + '" tabindex="0" role="group" aria-label="' + VIEW_NAME[view] + '(' + U + '×' + V + 'マス)">');
      s.push('<rect x="' + b.x + '" y="' + b.y + '" width="' + U * px + '" height="' + V * px + '" class="a7-bg"/>');
      if (bd.col !== null) s.push('<rect x="' + (b.x + bd.col * px) + '" y="' + b.y + '" width="' + px + '" height="' + V * px + '" class="a7-band"/>');
      if (bd.row !== null) s.push('<rect x="' + b.x + '" y="' + (b.y + (V - 1 - bd.row) * px) + '" width="' + U * px + '" height="' + px + '" class="a7-band"/>');
      for (var v = 0; v < V; v++) for (var u = 0; u < U; u++) {
        var val = arr[v * U + u];
        if (!val) continue;
        var xy = cellXY(view, u, v);
        s.push('<polygon class="a7-fill" points="' + SHAPE[val].map(function (p) { return (xy[0] + p[0] * px) + ',' + (xy[1] + (1 - p[1]) * px); }).join(' ') + '"/>');
      }
      // 方眼
      var d = '';
      for (var i = 1; i < U; i++) d += 'M' + (b.x + i * px) + ' ' + b.y + 'v' + V * px;
      for (i = 1; i < V; i++) d += 'M' + b.x + ' ' + (b.y + i * px) + 'h' + U * px;
      s.push('<path d="' + d + '" class="a7-grid"/>');
      s.push('<rect x="' + b.x + '" y="' + b.y + '" width="' + U * px + '" height="' + V * px + '" class="a7-border"/>');
      // ほかの図と合わないマス
      Object.keys(misSet[view]).forEach(function (k) {
        var idx = +k, xy = cellXY(view, idx % U, Math.floor(idx / U));
        s.push('<rect x="' + (xy[0] + 2) + '" y="' + (xy[1] + 2) + '" width="' + (px - 4) + '" height="' + (px - 4) + '" class="a7-mis"/>');
        s.push('<text x="' + (xy[0] + px / 2) + '" y="' + (xy[1] + px / 2 + 5) + '" class="a7-mis-t">!</text>');
      });
      if (focusView === view) {
        var c = cursor[view], cxy = cellXY(view, c % U, Math.floor(c / U));
        s.push('<rect x="' + (cxy[0] + 1) + '" y="' + (cxy[1] + 1) + '" width="' + (px - 2) + '" height="' + (px - 2) + '" class="a7-cursor"/>');
      }
      // マウス・指で押すための透明なマス
      for (v = 0; v < V; v++) for (u = 0; u < U; u++) {
        var q = cellXY(view, u, v);
        s.push('<rect x="' + q[0] + '" y="' + q[1] + '" width="' + px + '" height="' + px + '" class="a7-hit" data-i="' + (v * U + u) + '"/>');
      }
      s.push('</g>');
    });
    // 図の名前と向き
    var fx = ed.front, tx = ed.top, sx = ed.side;
    s.push(rubyName(fx.x + ed.W * px / 2, fx.y + ed.H * px + 29, '正面図', 'しょうめんず'));
    s.push(txt(fx.x + ed.W * px / 2, fx.y + ed.H * px + 50, '← 幅 →', 'a7-axis'));
    s.push(rubyName(tx.x + ed.W * px / 2 - 34, tx.y - 10, '平面図', 'へいめんず'));
    s.push(txt(tx.x + ed.W * px / 2 - 8, tx.y - 10, '(上から見た図)', 'a7-axis', 'start'));
    s.push(rubyName(sx.x + ed.D * px / 2, sx.y + ed.H * px + 29, '右側面図', 'みぎそくめんず'));
    s.push(txt(sx.x + ed.D * px / 2, sx.y + ed.H * px + 50, '手前 ← 奥行き → おく', 'a7-axis'));
    s.push(txtV(fx.x - 12, fx.y + ed.H * px / 2, '高さ'));
    s.push(txtV(tx.x - 12, tx.y + ed.D * px / 2, '奥行き'));
    s.push(txt(tx.x + ed.W * px + 6, tx.y + 12, 'おく', 'a7-axis', 'start'));
    s.push(txt(tx.x + ed.W * px + 6, tx.y + ed.D * px - 4, '手前', 'a7-axis', 'start'));
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" class="a7-editor" width="' + ed.width + '" height="' + ed.height + '" viewBox="0 0 ' + ed.width + ' ' + ed.height + '">' + s.join('') + '</svg>';
    var wrap = G.$('#editor-wrap');
    var hadFocus = document.activeElement && document.activeElement.closest && document.activeElement.closest('.a7-view');
    var fv = hadFocus ? hadFocus.getAttribute('data-view') : null;
    wrap.innerHTML = svg;
    if (fv) { var g = wrap.querySelector('[data-view="' + fv + '"]'); if (g) g.focus({ preventScroll: true }); }
    G.$('#undo').disabled = !undoStack.length;
    G.$('#redo').disabled = !redoStack.length;
  }
  // ふりがな付きの図の名前(ふりがなを消す設定では .ruby-off で隠れる)
  function rubyName(x, y, s, yomi) { return txt(x, y - 15, yomi, 'a7-rt') + txt(x, y, s, 'a7-name'); }
  function txt(x, y, s, cls, anchor) { return '<text x="' + x + '" y="' + y + '" class="' + cls + '" text-anchor="' + (anchor || 'middle') + '">' + G.esc(s) + '</text>'; }
  function txtV(x, y, s) { return '<text x="' + x + '" y="' + y + '" class="a7-axis" text-anchor="middle" transform="rotate(-90 ' + x + ' ' + y + ')">' + G.esc(s) + '</text>'; }

  // ぬる・消す
  var stroke = null;
  function cellFromPoint(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el || !el.classList || !el.classList.contains('a7-hit')) return null;
    var g = el.closest('[data-view]');
    return { view: g.getAttribute('data-view'), i: +el.getAttribute('data-i') };
  }
  function setCell(view, i, val) {
    if (M[view][i] === val) return false;
    M[view][i] = val;
    return true;
  }
  // ドラッグ中はマスだけを描き直し、指をはなしたときに立体を作り直す(大きな図でも重くならないように)
  var raf = 0;
  function afterEdit() {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      if (stroke) { renderEditor(); return; }
      modelChanged();
      renderEditor(); renderPreview(); renderCheck();
    });
  }
  function bindEditor() {
    var wrap = G.$('#editor-wrap');
    wrap.addEventListener('pointerdown', function (e) {
      var c = cellFromPoint(e.clientX, e.clientY);
      if (!c) return;
      e.preventDefault();
      var cur = M[c.view][c.i];
      var val = tool === 0 ? 0 : cur === tool ? 0 : tool;
      pushUndo();
      stroke = { val: val, id: e.pointerId };
      focusView = c.view; cursor[c.view] = c.i;
      setCell(c.view, c.i, val);
      afterEdit();
    });
    wrap.addEventListener('pointermove', function (e) {
      var c = cellFromPoint(e.clientX, e.clientY);
      if (stroke && stroke.id === e.pointerId) {
        if (c && setCell(c.view, c.i, stroke.val)) { cursor[c.view] = c.i; afterEdit(); }
        return;
      }
      var h = c ? { view: c.view, u: c.i % ed[c.view].U, v: Math.floor(c.i / ed[c.view].U) } : null;
      if (JSON.stringify(h) !== JSON.stringify(hover)) { hover = h; renderEditor(); }
    });
    function end() { if (stroke) { stroke = null; afterEdit(); } }
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    wrap.addEventListener('pointerleave', function () { if (hover) { hover = null; renderEditor(); } });
    wrap.addEventListener('focusin', function (e) {
      var g = e.target.closest && e.target.closest('[data-view]');
      if (g && focusView !== g.getAttribute('data-view')) { focusView = g.getAttribute('data-view'); renderEditor(); }
    });
    wrap.addEventListener('focusout', function () {
      setTimeout(function () { if (!wrap.contains(document.activeElement) && focusView) { focusView = null; renderEditor(); } }, 0);
    });
    wrap.addEventListener('keydown', function (e) {
      var g = e.target.closest && e.target.closest('[data-view]');
      if (!g) return;
      var view = g.getAttribute('data-view'), b = ed[view], c = cursor[view], u = c % b.U, v = Math.floor(c / b.U);
      var mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (mv) {
        e.preventDefault();
        u = G.clamp(u + mv[0], 0, b.U - 1); v = G.clamp(v + mv[1], 0, b.V - 1);
        cursor[view] = v * b.U + u; renderEditor(); announce(view);
      } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        var cur = M[view][c], val = e.key === 'Delete' || e.key === 'Backspace' || tool === 0 ? 0 : cur === tool ? 0 : tool;
        pushUndo(); setCell(view, c, val); afterEdit(); announce(view, val);
      }
    });
  }
  function announce(view, val) {
    var b = ed[view], c = cursor[view];
    if (val === undefined) val = M[view][c];
    var names = { 0: '空き', 1: 'ぬってある', 2: '左下の半分', 3: '右下の半分', 4: '右上の半分', 5: '左上の半分' };
    G.$('#editor-help').setAttribute('aria-live', 'polite');
    G.$('#editor-help').textContent = VIEW_NAME[view] + ' 左から ' + (c % b.U + 1) + ' 列目・下から ' + (Math.floor(c / b.U) + 1) + ' 段目: ' + names[val];
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot()); restore(undoStack.pop());
    modelChanged(); renderSize(); renderEditor(); renderPreview(); renderCheck();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot()); restore(redoStack.pop());
    modelChanged(); renderSize(); renderEditor(); renderPreview(); renderCheck();
  }

  function renderSize() {
    G.$('#sz-w').value = M.W; G.$('#sz-d').value = M.D; G.$('#sz-h').value = M.H; G.$('#sz-cell').value = cellMM();
  }
  function bindSize() {
    [['#sz-w', 'W'], ['#sz-d', 'D'], ['#sz-h', 'H']].forEach(function (f) {
      G.$(f[0]).addEventListener('change', function () {
        var raw = +String(this.value).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
        var v = Math.round(G.num(this.value, M[f[1]], 1, 16));
        if (!(raw >= 1 && raw <= 16)) G.toast('マスの数は 1〜16 にしてください(' + v + ' にしました)');
        this.value = v;
        if (v === M[f[1]]) return;
        pushUndo();
        var n = { W: M.W, D: M.D, H: M.H }; n[f[1]] = v;
        M = SG.resizeModel(M, n.W, n.D, n.H);
        P.size.W = M.W; P.size.D = M.D; P.size.H = M.H;
        cursor = { front: 0, top: 0, side: 0 };
        modelChanged(); renderEditor(); renderPreview(); renderCheck();
      });
    });
    G.$('#sz-cell').addEventListener('change', function () {
      var v = G.num(this.value, cellMM(), 1, 200);
      this.value = v; P.size.cell = v;
      changed(); renderCheck();
    });
  }

  function sampleName(s) { return s.label.replace(/\(.*?\)/, ''); }
  function loadSample(id, quiet) {
    var s = SAMPLES.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    if (!quiet) pushUndo();
    M = SG.modelFromRows(s);
    P.size.W = M.W; P.size.D = M.D; P.size.H = M.H;
    P.done.samples = (P.done.samples || 0) + 1;
    // 名前がまだないか、お手本の名前のままなら、お手本の名前にする
    var cur = (G.$('#pname').value || '').trim();
    if (!cur || cur === '無題' || SAMPLES.some(function (x) { return sampleName(x) === cur; })) { art.title = sampleName(s); G.$('#pname').value = art.title; }
    cursor = { front: 0, top: 0, side: 0 };
    modelChanged(); renderSize(); renderEditor(); renderPreview(); renderCheck();
  }

  // 立体の小さな図(等角図)
  function renderPreview() {
    var cv = G.$('#preview');
    var w = cv.parentNode.clientWidth || 300, h = Math.round(G.clamp(w * 0.72, 180, 300));
    var ctx = G.setupCanvas(cv, w, h);
    drawLines(ctx, w, h, solid.empty ? null : drawing('iso'), false);
    if (solid.empty) emptyNote(ctx, w, h);
  }
  function emptyNote(ctx, w, h) {
    ctx.fillStyle = G.cssVar('--muted', '#666');
    ctx.font = '15px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'center';
    ctx.fillText('3つの図にマスをぬると、ここに立体が出ます', w / 2, h / 2);
  }
  function renderCheck() {
    var box = G.$('#check');
    box.innerHTML = '';
    var ev = emptyViews();
    if (ev.length) {
      box.appendChild(G.h('p', { class: 'g-note' }, ev.length === 3 ? '3つの図にマスをぬると、立体ができます。どの図からかいてもかまいません。'
        : 'つぎは' + ev.map(function (k) { return '「' + VIEW_NAME[k] + '」'; }).join('と') + 'をかきましょう。3つそろうと立体ができます。'));
    } else if (solid.empty) {
      box.appendChild(G.h('p', { class: 'a7-warn' }, G.h('strong', null, '! まだ立体になりません。'), ' 3つの図で、ぬったマスの位置がそろっていません。同じ列(幅)・同じ段(高さ)・同じ奥行きの位置をくらべてみましょう。'));
    } else if (mis.count) {
      var where = ['front', 'top', 'side'].filter(function (k) { return mis[k].length; }).map(function (k) { return VIEW_NAME[k] + ' ' + mis[k].length + ' こ'; }).join('・');
      box.appendChild(G.h('p', { class: 'a7-warn' }, G.h('strong', null, '! 合わないマスがあります(' + where + ')。'),
        ' 赤い点線のマスは、ほかの図と位置がそろっていないので立体になりません。同じ列(幅)・同じ段(高さ)・同じ奥行きの位置をくらべてみましょう。かいている途中なら、3つともかき終えてから確かめましょう。'));
    } else {
      box.appendChild(G.h('p', { class: 'a7-ok' }, '✓ 3つの図の位置がそろっています。'));
    }
    var c = cellMM(), mn = solid.min, mx = solid.max;
    G.$('#info').textContent = solid.empty ? '' :
      '大きさ: 幅 ' + G.fmt((mx[0] - mn[0]) * c, 1) + ' × 奥行き ' + G.fmt((mx[1] - mn[1]) * c, 1) + ' × 高さ ' + G.fmt((mx[2] - mn[2]) * c, 1) + ' mm ・ 体積 約 ' +
      G.fmt(solid.volume * c * c * c / 1000, 1) + ' cm³';
  }

  /* ---------- 線の図(等角図・キャビネット図)を Canvas にかく ---------- */
  function drawLines(ctx, w, h, d, showHidden, opt) {
    opt = opt || {};
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    if (!d) return;
    var segs = d.visible.concat(showHidden ? d.hidden : []);
    var b = SS.bounds(segs), pad = opt.pad || 18;
    var s = Math.min((w - 2 * pad) / ((b.x1 - b.x0) || 1), (h - 2 * pad) / ((b.y1 - b.y0) || 1));
    s = Math.min(s, opt.maxScale || 90);
    var ox = (w - (b.x1 - b.x0) * s) / 2 - b.x0 * s, oy = (h + (b.y1 - b.y0) * s) / 2 + b.y0 * s;
    var ink = G.cssVar('--ink', '#222');
    ctx.lineCap = 'round';
    if (showHidden) {
      ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.setLineDash([6, 4]); ctx.lineCap = 'butt';
      ctx.beginPath();
      d.hidden.forEach(function (q) { ctx.moveTo(ox + q[0] * s, oy - q[1] * s); ctx.lineTo(ox + q[2] * s, oy - q[3] * s); });
      ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'round';
    }
    ctx.strokeStyle = ink; ctx.lineWidth = opt.lw || 2.2;
    ctx.beginPath();
    d.visible.forEach(function (q) { ctx.moveTo(ox + q[0] * s, oy - q[1] * s); ctx.lineTo(ox + q[2] * s, oy - q[3] * s); });
    ctx.stroke();
    return { ox: ox, oy: oy, s: s };
  }

  /* ---------- 3D(回して見る) ---------- */
  function draw3D(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#f7f9fc'); bg.addColorStop(1, '#e4e9f0');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (solid.empty) { emptyNote(ctx, w, h); return; }
    var V = SG.vec, c = SG.camera(cam.yaw, cam.pitch);
    var mn = solid.min, mx = solid.max, ctr = V.mul(V.add(mn, mx), 0.5);
    var rad = V.len(V.sub(mx, mn)) / 2 || 1, s = Math.min(w, h) * 0.44 / rad;
    function P2(p) { var q = V.sub(p, ctr); return [w / 2 + V.dot(q, c.right) * s, h / 2 - V.dot(q, c.up) * s]; }
    var light = V.norm(V.add(V.add(V.mul(c.toward, 0.7), V.mul(c.up, 0.6)), V.mul(c.right, -0.25)));
    var base = hexRgb(G.cssVar('--wood', '#c8955b'));
    var list = solid.faces.filter(function (f) { return V.dot(f.n, c.toward) > 1e-6; }).map(function (f) {
      var cen = [0, 0, 0];
      f.pts.forEach(function (p) { cen = V.add(cen, p); });
      return { f: f, z: V.dot(V.mul(cen, 1 / f.pts.length), c.toward) };
    });
    list.sort(function (a, b) { return a.z - b.z; });
    ctx.lineJoin = 'round';
    list.forEach(function (it) {
      var f = it.f, k = 0.5 + 0.5 * Math.max(0, V.dot(f.n, light));
      var col = 'rgb(' + base.map(function (x) { return Math.round(Math.min(255, x * k + 18)); }).join(',') + ')';
      ctx.beginPath();
      f.pts.forEach(function (p, i) { var q = P2(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      ctx.closePath();
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.fill(); ctx.stroke();
      if (f.edges.length) {
        ctx.beginPath();
        f.edges.forEach(function (e) { var a = P2(e[0]), b = P2(e[1]); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); });
        ctx.strokeStyle = '#3b2a18'; ctx.lineWidth = 1.6; ctx.stroke();
      }
    });
    // 向きの目印
    var o = [44, h - 40], axes = [[[1, 0, 0], '幅', '#c0392b'], [[0, 1, 0], '奥行き', '#1d7a3a'], [[0, 0, 1], '高さ', '#2d6aa8']];
    ctx.font = 'bold 13px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'center';
    axes.forEach(function (a) {
      var dx = V.dot(a[0], c.right) * 28, dy = -V.dot(a[0], c.up) * 28;
      ctx.strokeStyle = a[2]; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(o[0] + dx, o[1] + dy); ctx.stroke();
      if (Math.hypot(dx, dy) > 6) { ctx.fillStyle = a[2]; ctx.fillText(a[1], o[0] + dx * 1.45, o[1] + dy * 1.45 + 4); }
    });
  }
  function hexRgb(hx) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hx).trim());
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [200, 149, 91];
  }

  /* ---------- 2 立体を見る ---------- */
  var NOTES = {
    iso: '等角図: 幅・奥行き・高さの3つの向きの線が、120° ずつ開いて見える図です。横の線は水平から 30° かたむけてかき、長さは実物と同じ割合にします。',
    cabinet: 'キャビネット図: 正面の形をそのままかきます。奥行きの線は 45° かたむけて、長さを実物の 1/2 にします。',
    '3d': '3D: ドラッグ(または矢印キー)で回して、いろいろな向きから見られます。三面図のそれぞれの図が、どの向きから見た形なのかを確かめましょう。'
  };
  function viewSize() {
    var wrap = G.$('#view-canvas').parentNode;
    var w = wrap.clientWidth || 600, h = Math.round(G.clamp(window.innerHeight - 300, 300, 640));
    return [w, h];
  }
  function renderView() {
    var mode = P.look.mode, hid = !!P.look.hidden;
    G.$$('.a7-seg [data-mode]').forEach(function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-mode') === mode)); });
    G.$('#show-hidden').checked = hid;
    G.$('#hid-wrap').hidden = mode === '3d';
    G.$('#cam-btns').hidden = mode !== '3d';
    var cv = G.$('#view-canvas'), sz = viewSize(), ctx = G.setupCanvas(cv, sz[0], sz[1]);
    cv.style.cursor = mode === '3d' ? 'grab' : 'default';
    if (mode === '3d') draw3D(ctx, sz[0], sz[1]);
    else {
      drawLines(ctx, sz[0], sz[1], solid.empty ? null : drawing(mode), hid, { pad: 30, lw: 2.6 });
      if (solid.empty) emptyNote(ctx, sz[0], sz[1]);
    }
    var note = G.$('#mode-note');
    note.innerHTML = '';
    note.appendChild(G.h('p', { class: 'g-muted' }, NOTES[mode]));
    if (mode !== '3d' && hid) note.appendChild(G.h('p', { class: 'g-muted' }, '太い実線 = 見える線(外形線)、細い破線 = かくれ線(見えない線)'));
    if (misCount()) note.appendChild(G.h('p', { class: 'a7-warn' }, '! 三面図に合わないマスがあります(「三面図をかく」で赤い点線のマス)。'));
  }
  function bindView() {
    G.$$('.a7-seg [data-mode]').forEach(function (b) {
      b.addEventListener('click', function () { P.look.mode = b.getAttribute('data-mode'); changed(); renderView(); });
    });
    G.$('#show-hidden').addEventListener('change', function () { P.look.hidden = this.checked; changed(); renderView(); });
    G.$$('[data-cam]').forEach(function (b) {
      b.addEventListener('click', function () { var c = CAMS[b.getAttribute('data-cam')]; cam.yaw = c[0]; cam.pitch = c[1]; renderView(); });
    });
    var cv = G.$('#view-canvas'), drag = null;
    cv.addEventListener('pointerdown', function (e) {
      if (P.look.mode !== '3d') return;
      drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch };
      cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drag) return;
      cam.yaw = drag.yaw - (e.clientX - drag.x) * 0.5;
      cam.pitch = G.clamp(drag.pitch + (e.clientY - drag.y) * 0.5, -89, 90);
      var sz = viewSize(), ctx = G.setupCanvas(cv, sz[0], sz[1]);
      draw3D(ctx, sz[0], sz[1]);
    });
    function up() { drag = null; if (P.look.mode === '3d') cv.style.cursor = 'grab'; }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('keydown', function (e) {
      if (P.look.mode !== '3d') return;
      var d = { ArrowLeft: [10, 0], ArrowRight: [-10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
      if (!d) return;
      e.preventDefault();
      cam.yaw += d[0]; cam.pitch = G.clamp(cam.pitch + d[1], -89, 90);
      renderView();
    });
    G.$('#png-view').addEventListener('click', function () {
      var mode = P.look.mode, name = { iso: '等角図', cabinet: 'キャビネット図', '3d': '3D' }[mode];
      G.$('#view-canvas').toBlob(function (b) { G.download(b, title() + '_' + name + '.png'); });
    });
    G.$('#stl-view').addEventListener('click', saveSTL);
  }

  function saveSTL() {
    if (solid.empty) { G.toast('まだ立体になっていません'); return; }
    var buf = SG.stlBinary(solid, cellMM(), 'Edu-IT A7 ' + (art.id || ''));
    G.download(new Blob([buf], { type: 'model/stl' }), title() + '.stl');
    P.done.stl = (P.done.stl || 0) + 1; changed();
    G.toast('STL ファイルを保存しました(単位: mm)');
  }

  /* ---------- 3 図面・印刷 ---------- */
  var SHEET_FIELDS = [['#sh-title', 'title'], ['#sh-material', 'material'], ['#sh-grade', 'grade'], ['#sh-cls', 'cls'], ['#sh-no', 'no'], ['#sh-name', 'name'], ['#sh-date', 'date'], ['#sh-scale', 'scale']];
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function sheetOpt() {
    var s = P.sheet;
    return {
      cell: cellMM(), title: s.title || title(), material: s.material, grade: s.grade, cls: s.cls, no: s.no, name: s.name,
      date: (s.date || today()).replace(/-/g, '.'), scale: s.scale, dims: s.dims, detail: s.detail, iso: s.iso
    };
  }
  function renderSheet() {
    var s = P.sheet;
    if (!s.date) s.date = today();
    SHEET_FIELDS.forEach(function (f) { G.$(f[0]).value = s[f[1]] || ''; });
    G.$('#sh-title').placeholder = title();
    G.$('#sh-scale').value = s.scale || 'auto';
    G.$('#sh-dims').checked = !!s.dims; G.$('#sh-detail').checked = !!s.detail; G.$('#sh-iso').checked = !!s.iso;
    G.$('#sh-detail').disabled = !s.dims;
    updateSheet();
  }
  var lastSheet = null;
  function updateSheet() {
    lastSheet = SS.svg(solid.empty ? null : solid, sheetOpt());
    G.$('#sheet-box').innerHTML = lastSheet.svg;
    var msg = G.$('#sheet-msg');
    msg.innerHTML = '';
    if (solid.empty) msg.appendChild(G.h('p', { class: 'g-note' }, 'まだ立体になっていません。「三面図をかく」で図をかきましょう。'));
    else {
      msg.appendChild(G.h('p', { class: 'g-muted' }, '尺度 ' + SS.scaleLabel(lastSheet.scale) + '(' + (lastSheet.scale === 1 ? '実物と同じ大きさ' : lastSheet.scale > 1 ? '実物の ' + lastSheet.scale + ' 倍' : '実物の 1/' + Math.round(1 / lastSheet.scale)) + ')でかいています。'));
      if (misCount()) msg.appendChild(G.h('p', { class: 'a7-warn' }, '! 三面図に合わないマスがあります。図面は、立体になった部分からかいています。'));
    }
  }
  function bindSheet() {
    SHEET_FIELDS.forEach(function (f) {
      var el = G.$(f[0]);
      el.addEventListener(el.tagName === 'SELECT' || el.type === 'date' ? 'change' : 'input', function () { P.sheet[f[1]] = el.value; changed(); updateSheet(); });
    });
    [['#sh-dims', 'dims'], ['#sh-detail', 'detail'], ['#sh-iso', 'iso']].forEach(function (f) {
      G.$(f[0]).addEventListener('change', function () { P.sheet[f[1]] = this.checked; G.$('#sh-detail').disabled = !P.sheet.dims; changed(); updateSheet(); });
    });
    G.$('#print').addEventListener('click', function () {
      if (!lastSheet) updateSheet();
      var area = G.$('#print-area');
      area.innerHTML = lastSheet.svg;
      document.body.classList.add('a7-printing');
      P.done.print = (P.done.print || 0) + 1; changed();
      setTimeout(function () { window.print(); }, 50);
    });
    window.addEventListener('afterprint', function () { document.body.classList.remove('a7-printing'); G.$('#print-area').innerHTML = ''; });
    G.$('#pdf').addEventListener('click', function () {
      if (!lastSheet) updateSheet();
      var btn = this;
      btn.disabled = true;
      G.toast('PDF を作っています…');
      SS.toPDF(lastSheet.svg, sheetOpt().title).then(function (blob) {
        G.download(blob, '図面_' + sheetOpt().title + '.pdf');
        P.done.pdf = (P.done.pdf || 0) + 1; changed();
      }).catch(function (e) { G.toast('PDF を作れませんでした: ' + e.message); })
        .then(function () { btn.disabled = false; });
    });
    G.$('#stl-sheet').addEventListener('click', saveSTL);
  }

  /* ---------- 4 ふりかえり ---------- */
  function renderReview() {
    G.psCycle(G.$('#ps'), ['plan']);
    var box = G.$('#selfcheck');
    box.innerHTML = '';
    SELF.forEach(function (it) {
      var fs = G.h('fieldset', { class: 'a7-self' }, G.h('legend', null, it.label));
      LV.forEach(function (lv) {
        var inp = G.h('input', { type: 'radio', name: 'self-' + it.id, value: lv[0], checked: P.reflect.self[it.id] === lv[0] });
        inp.addEventListener('change', function () { P.reflect.self[it.id] = lv[0]; changed(); });
        fs.appendChild(G.h('label', { class: 'g-check' }, inp, lv[1]));
      });
      box.appendChild(fs);
    });
    G.$('#rf-cls').value = P.sheet.cls || ''; G.$('#rf-no').value = P.sheet.no || ''; G.$('#rf-name').value = P.sheet.name || '';
    G.$('#rf-learned').value = P.reflect.learned || '';
    G.$('#rf-hard').value = P.reflect.hard || '';
    G.$('#rf-use').value = P.reflect.use || '';
    var c = cellMM(), mn = solid.min, mx = solid.max, d = P.done || {};
    var rows = [
      ['三面図の大きさ', M.W + ' × ' + M.D + ' × ' + M.H + ' マス(1マス ' + c + ' mm)'],
      ['できた立体', solid.empty ? 'まだ' : '幅 ' + G.fmt((mx[0] - mn[0]) * c, 1) + ' × 奥行き ' + G.fmt((mx[1] - mn[1]) * c, 1) + ' × 高さ ' + G.fmt((mx[2] - mn[2]) * c, 1) + ' mm'],
      ['合わないマス', misCount() ? misCount() + ' こ' : 'なし'],
      ['図面', (d.print ? '印刷 ' + d.print + ' 回 ' : '') + (d.pdf ? 'PDF ' + d.pdf + ' 回' : '') || 'まだ'],
      ['STL', d.stl ? d.stl + ' 回 保存' : 'まだ']
    ];
    var tb = G.h('table', { class: 'g-table' });
    rows.forEach(function (r) { tb.appendChild(G.h('tr', null, G.h('th', null, r[0]), G.h('td', null, r[1]))); });
    G.$('#record').innerHTML = '';
    G.$('#record').appendChild(tb);
  }
  function bindReview() {
    [['#rf-cls', 'cls'], ['#rf-no', 'no'], ['#rf-name', 'name']].forEach(function (f) {
      G.$(f[0]).addEventListener('input', function () { P.sheet[f[1]] = this.value; changed(); });
    });
    [['#rf-learned', 'learned'], ['#rf-hard', 'hard'], ['#rf-use', 'use']].forEach(function (f) {
      G.$(f[0]).addEventListener('input', function () { P.reflect[f[1]] = this.value; changed(); });
    });
  }

  // メニューで組・番号・名前を入れていないとき(単体版など)は、このアプリで入れたものを書き出しに入れる
  function withStudent() {
    var pf = G.profile(), s = P.sheet;
    if (pf.class || pf.no || pf.name || !(s.cls || s.no || s.name)) return art;
    return Object.assign({}, art, { student: { class: String(s.cls || ''), no: String(s.no || ''), name: String(s.name || '') } });
  }

  /* ---------- 使い方 ---------- */
  function showHelp() {
    var body = G.h('div', null,
      G.h('ol', null,
        G.h('li', null, '「三面図をかく」で、正面図・平面図・右側面図のマスをぬります。第三角法なので、平面図は正面図の上、右側面図は正面図の右に置きます。'),
        G.h('li', null, 'ななめの形は、◣ ◢ ◥ ◤ でマスの半分をぬります。'),
        G.h('li', null, '右の「できる立体」に等角図が出ます。赤い点線のマスは、ほかの図と位置が合っていないマスです。'),
        G.h('li', null, '「立体を見る」で、等角図・キャビネット図・3D に切りかえます。3D はドラッグで回せます。'),
        G.h('li', null, '「図面・印刷」で、寸法と表題欄の入った A4 の図面を作れます。印刷や、PDF で保存ができます。STL で保存すると、3Dプリンタで使えます。'),
        G.h('li', null, G.furikaeriOff() ? '最後に「ファイルに書き出す」で提出します。' : '最後に「ふりかえり」を書き、「ファイルに書き出す」で提出します。')),
      G.h('p', { class: 'g-note' }, '三面図に見えている形から、いちばん大きな立体を作ります。三面図だけでは、形が1つに決まらないこともあります。たとえば、見えない部分のくぼみです。そのときは、かくれ線(見えない線)も使って考えましょう。'));
    G.modal({ title: '使い方', body: body });
  }

  /* ---------- 全体 ---------- */
  function renderAll() {
    renderSize();
    renderCurrentTab();
  }
  function renderCurrentTab() {
    if (currentTab === 'draw') { renderEditor(); renderPreview(); renderCheck(); }
    else if (currentTab === 'view') renderView();
    else if (currentTab === 'sheet') renderSheet();
    else if (currentTab === 'review') renderReview();
  }
  var tabs = G.tabs(G.$('[data-g-tabs]'), function (name) {
    currentTab = name;
    if (P) renderCurrentTab();
  });
  var rt = null;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (P) renderCurrentTab(); }, 150); });
  document.addEventListener('keydown', function (e) {
    if (currentTab !== 'draw' || !(e.ctrlKey || e.metaKey)) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)) return;
    if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); redo(); }
  });

  buildTools(); bindEditor(); bindSize(); bindView(); bindSheet(); bindReview();
  var sel = G.$('#sample');
  SAMPLES.forEach(function (s) { sel.appendChild(G.h('option', { value: s.id }, s.label)); });
  G.$('#load-sample').addEventListener('click', function () { loadSample(sel.value); G.toast('「' + sel.options[sel.selectedIndex].text + '」をかきこみました'); });
  G.$('#undo').addEventListener('click', undo);
  G.$('#redo').addEventListener('click', redo);
  G.$('#clear').addEventListener('click', function () {
    G.confirm('3つの図のマスをぜんぶ消します(「元に戻す」で戻せます)。', 'ぜんぶ消す').then(function (ok) {
      if (!ok) return;
      pushUndo();
      M = SG.emptyModel(M.W, M.D, M.H);
      modelChanged(); renderEditor(); renderPreview(); renderCheck();
    });
  });
  G.$('#go-view').addEventListener('click', function () { tabs.show('view'); });
  G.$('#pname').addEventListener('input', changed);

  G.$('#b-new').addEventListener('click', function () {
    G.confirm('新しい作品を作ります。今の作品は保存されています。', '新しく作る').then(function (ok) {
      if (ok) save().then(function () { newProject(); tabs.show('draw'); });
    });
  });
  G.$('#b-save').addEventListener('click', function () { save(true); });
  G.$('#b-open').addEventListener('click', function () {
    save().then(function () { return G.openDialog(APP); }).then(function (a) { if (a) { setProject(a); G.toast('「' + a.title + '」を開きました'); } });
  });
  G.$('#b-export').addEventListener('click', function () {
    save().then(function () { G.exportJSON(withStudent(), '立体メーカー_' + (art.title || '無題') + '.json'); });
  });
  G.$('#b-import').addEventListener('click', function () {
    G.pickJSON().then(function (obj) {
      var list = G.normalizeImport(obj, APP);
      if (!list.length) { G.toast('立体メーカーの作品が見つかりませんでした'); return; }
      return Promise.all(list.map(function (a) { return G.store.put(a); })).then(function () {
        setProject(list[0]);
        G.toast(list.length > 1 ? list.length + ' 件を読み込み、1件目を開きました' : '「' + list[0].title + '」を読み込みました');
      });
    }).catch(function (e) { G.toast(e.message); });
  });

  // 起動: 前回の作品を開く(はじめてなら L字ブロックのお手本から)
  var lastId = null;
  try { lastId = localStorage.getItem('solid-maker.last'); } catch (e) {}
  (lastId ? G.store.get(lastId) : Promise.resolve(null)).then(function (a) {
    if (a && a.app === APP) setProject(a); else newProject('l');
  }).catch(function () { newProject('l'); });
})();
