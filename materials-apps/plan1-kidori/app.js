/* 木取り・構想シミュレータ(plan-1 / M5) app.js */
(function () {
  'use strict';
  var APP = 'kidori';
  if (G.ruby && G.ruby.add) G.ruby.add({ 'あり継ぎ': 'ありつぎ', '発展': 'はってん' });
  G.initApp({
    app: APP,
    title: '木取り・構想シミュレータ',
    files: ['style.css', 'packing.js', 'templates.js', 'draw.js', 'app.js', '../common/beam.js', '../common/materials.js']
  });

  var K = window.Kidori, T = window.KidoriTemplates, D = window.KidoriDraw;
  var WOODS = G.materials.byKind('wood');
  var PRESETS = [
    { id: 'sugi-1820-180-15', label: 'スギ板 1820×180×15', l: 1820, w: 180, t: 15, material: 'sugi' },
    { id: 'sugi-1820-210-12', label: 'スギ板 1820×210×12', l: 1820, w: 210, t: 12, material: 'sugi' },
    { id: 'hinoki-1820-150-15', label: 'ヒノキ板 1820×150×15', l: 1820, w: 150, t: 15, material: 'hinoki' },
    { id: 'glulam-910-300-18', label: '集成材 910×300×18', l: 910, w: 300, t: 18, material: 'glulam' },
    { id: 'plywood-910-450-9', label: '合板 910×450×9', l: 910, w: 450, t: 9, material: 'plywood' },
    { id: 'lauan-1820-200-15', label: 'ラワン材 1820×200×15', l: 1820, w: 200, t: 15, material: 'lauan' },
    { id: 'custom', label: '自分で入力する', custom: true }
  ];
  var INSPECT = [
    'けがき線どおりに切れたか(切りしろの外側を切ったか)',
    '部品の長さ・幅を、さしがねや直定規で測って確かめた',
    '部品の角が直角になっているか、さしがねで確かめた',
    '部品の数がそろっている',
    '組み立てたとき、がたつきやすき間がない',
    'くぎや木ねじが、板の外に飛び出していない',
    '表面や木口にささくれがない(けずり・やすりがけをした)'
  ];
  var SELF = [
    { id: 'grain', label: '木目(繊維)の向きを考えて部品を置いた' },
    { id: 'rest', label: '残った材料の使い道を考えた' },
    { id: 'strength', label: '強度の見通しを確かめ、必要なら設計を直した' },
    { id: 'env', label: '国産材や間伐材など、環境への影響も考えて材料を選んだ' },
    { id: 'cost', label: '材料費を確かめた' },
    { id: 'tell', label: '製作図で、自分の構想をほかの人に説明できる' }
  ];

  /* ---------- データ ---------- */
  function defaultProject() {
    return {
      stock: { preset: PRESETS[0].id, l: 1820, w: 180, t: 15, count: 2, material: 'sugi', price: 0 },
      kerf: 1.5,
      parts: [],
      placements: {},
      template: null,
      strength: { partId: null, support: 'simple', loadType: 'point', span: null, kg: 10, thick: 3, material2: 'hinoki', ribs: 1, ribW: 15, ribH: 30, measured: '' },
      review: { inspect: {}, self: {}, good: '', improve: '', real: '', viewpoints: {} },
      hints: { used: 0, log: [] }
    };
  }
  var art = null; // 共通スキーマの作品
  var P = null;   // art.data
  var instances = [];
  var selected = null;
  var hintStage = 0, ghost = null;

  function setProject(a) {
    var base = defaultProject();
    a.data = a.data || {};
    Object.keys(base).forEach(function (k) {
      if (a.data[k] === undefined) a.data[k] = base[k];
      else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        Object.keys(base[k]).forEach(function (kk) { if (a.data[k][kk] === undefined) a.data[k][kk] = base[k][kk]; });
      }
    });
    art = a; P = a.data;
    selected = null; hintStage = 0; ghost = null;
    try { localStorage.setItem('kidori.last', a.id); } catch (e) {}
    refreshInstances();
    renderAll();
  }
  function newProject() {
    var a = G.newArtifact(APP, '本立て', defaultProject());
    setProject(a);
    applyTemplate('bookstand', 400, 180, 220, true);
  }
  function refreshInstances() {
    instances = K.expand(P.parts);
    var ids = {};
    instances.forEach(function (i) { ids[i.iid] = 1; });
    Object.keys(P.placements).forEach(function (k) { if (!ids[k]) delete P.placements[k]; });
    if (selected && !ids[selected]) selected = null;
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
    return G.store.put(art).then(function () {
      var t = new Date();
      G.$('#save-state').textContent = (manual ? '保存しました ' : '自動保存しました ') + t.getHours() + ':' + ('0' + t.getMinutes()).slice(-2);
      if (manual) G.toast('保存しました');
    }).catch(function (e) { G.$('#save-state').textContent = '保存できませんでした: ' + e.message; });
  }

  /* ---------- 1 材料・部品 ---------- */
  function fillSelect(sel, items, value) {
    sel.innerHTML = '';
    items.forEach(function (it) { sel.appendChild(G.h('option', { value: it.value }, it.label)); });
    sel.value = value;
  }
  function renderStock() {
    var s = P.stock;
    fillSelect(G.$('#preset'), PRESETS.map(function (p) { return { value: p.id, label: p.label }; }), s.preset || 'custom');
    fillSelect(G.$('#material'), WOODS.map(function (m) { return { value: m.id, label: m.name }; }), s.material);
    G.$('#s-l').value = s.l; G.$('#s-w').value = s.w; G.$('#s-t').value = s.t;
    G.$('#s-count').value = s.count; G.$('#s-price').value = s.price || 0; G.$('#kerf').value = P.kerf;
    G.$('#pname').value = art.title === '無題' ? '' : art.title;
  }
  function bindStock() {
    G.$('#preset').addEventListener('change', function () {
      var p = PRESETS.filter(function (x) { return x.id === this.value; }, this)[0];
      P.stock.preset = p.id;
      if (!p.custom) { P.stock.l = p.l; P.stock.w = p.w; P.stock.t = p.t; P.stock.material = p.material; }
      renderStock(); onStockChanged();
    });
    G.$('#material').addEventListener('change', function () { P.stock.material = this.value; onStockChanged(); });
    [['#s-l', 'l', 1820, 50, 4000], ['#s-w', 'w', 180, 20, 1820], ['#s-t', 't', 15, 1, 60], ['#s-count', 'count', 1, 1, 10], ['#s-price', 'price', 0, 0, 100000]].forEach(function (f) {
      G.$(f[0]).addEventListener('change', function () {
        var v = G.num(this.value, f[2], f[3], f[4]);
        if (f[1] === 'count') v = Math.round(v);
        this.value = v;
        P.stock[f[1]] = v;
        if (f[1] !== 'price' && f[1] !== 'count') { P.stock.preset = 'custom'; G.$('#preset').value = 'custom'; }
        if (f[1] === 't') syncThickness();
        onStockChanged();
      });
    });
    G.$('#kerf').addEventListener('change', function () { P.kerf = G.num(this.value, 1.5, 0, 5); this.value = P.kerf; onStockChanged(); });
    G.$('#pname').addEventListener('input', changed);
  }
  // 板の厚さを変えたら、部品の厚さもそろえる(ひな形で作った部品だけ)
  function syncThickness() {
    if (P.template && !P.template.dirty) applyTemplate(P.template.type, P.template.W, P.template.D, P.template.H, true);
  }
  function onStockChanged() {
    // 板の枚数を減らしたら、なくなった板の上の部品は外す
    Object.keys(P.placements).forEach(function (k) { if (P.placements[k].board >= P.stock.count) delete P.placements[k]; });
    renderParts(); changed();
  }

  function renderParts() {
    var tb = G.$('#parts-table tbody');
    tb.innerHTML = '';
    P.parts.forEach(function (p, idx) {
      function numCell(key, def, lo, hi, step) {
        var inp = G.h('input', { type: 'number', min: lo, max: hi, step: step || 1, value: p[key], 'aria-label': p.name + ' の' + { l: '長さ', w: '幅', t: '厚さ', qty: '個数' }[key] });
        inp.addEventListener('change', function () {
          var raw = parseFloat(inp.value);
          var v = G.num(inp.value, def, lo, hi);
          if (key === 'qty') v = Math.round(v);
          inp.setAttribute('aria-invalid', String(!(raw >= lo && raw <= hi)));
          inp.value = v; p[key] = v; partEdited();
        });
        return G.h('td', { class: 'num' }, inp);
      }
      var name = G.h('input', { type: 'text', value: p.name, maxlength: 30, 'aria-label': (idx + 1) + '番目の部品の名前' });
      name.addEventListener('change', function () { p.name = name.value.trim() || '部品' + (idx + 1); partEdited(); });
      var grain = G.h('input', { type: 'checkbox', checked: p.grain, 'aria-label': p.name + ' を木目に合わせる' });
      grain.addEventListener('change', function () { p.grain = grain.checked; partEdited(); });
      var del = G.h('button', { class: 'btn small danger', type: 'button', 'aria-label': p.name + ' を削除' }, '削除');
      del.addEventListener('click', function () { P.parts.splice(idx, 1); partEdited(); });
      tb.appendChild(G.h('tr', null, G.h('td', null, name), numCell('l', 300, 1, 4000), numCell('w', 100, 1, 2000), numCell('t', P.stock.t, 0.5, 100, 0.5), numCell('qty', 1, 0, 50), G.h('td', { class: 'c' }, grain), G.h('td', null, del)));
    });
    // 注意
    var msgs = [];
    P.parts.forEach(function (p) {
      if (!K.fitsStock(p, P.stock)) msgs.push('「' + p.name + '」は板(' + P.stock.l + '×' + P.stock.w + ')より大きく、1枚の板から取れません。' + (p.grain ? '木目の向きを変えられるか、板を変えられるか考えましょう。' : '板を変えましょう。'));
      if (Math.abs((p.t || 0) - P.stock.t) > 0.01) msgs.push('「' + p.name + '」の厚さ(' + p.t + ' mm)が板の厚さ(' + P.stock.t + ' mm)とちがいます。');
    });
    var box = G.$('#parts-msg'); box.innerHTML = '';
    msgs.forEach(function (m) { box.appendChild(G.h('p', { class: 'g-note' }, m)); });
    renderSummary();
  }
  function partEdited() {
    if (P.template) P.template.dirty = true;
    refreshInstances(); renderParts(); changed();
  }
  function renderSummary() {
    var st = K.stats(instances, P.placements, P.stock, P.kerf);
    var box = G.$('#parts-summary');
    box.innerHTML = '';
    box.appendChild(G.h('div', { class: 'stat-grid' },
      G.h('div', null, G.h('span', { class: 'lab' }, '部品の数'), G.h('span', { class: 'stat-big' }, String(instances.length)), ' 個'),
      G.h('div', null, G.h('span', { class: 'lab' }, '部品の面積の合計'), G.h('span', { class: 'stat-big' }, G.fmt(st.totalArea / 100, 0)), ' cm²'),
      G.h('div', null, G.h('span', { class: 'lab' }, '面積から見た最低の板の枚数'), G.h('span', { class: 'stat-big' }, String(st.minBoardsByArea)), ' 枚')));
    box.appendChild(G.h('p', { class: 'g-muted' }, '実際は、切りしろや板の形のために、面積から見た枚数より多く必要になることがあります。「木取り」タブで確かめましょう。'));
  }
  G.$('#add-part').addEventListener('click', function () {
    P.parts.push({ id: G.uid('p'), name: '部品' + (P.parts.length + 1), l: 300, w: Math.min(100, P.stock.w), t: P.stock.t, qty: 1, grain: true });
    partEdited();
  });

  // ひな形
  function renderTemplateForm() {
    var sel = G.$('#tpl-type');
    fillSelect(sel, Object.keys(T.list).map(function (k) { return { value: k, label: T.list[k].label }; }), P.template ? P.template.type : 'bookstand');
    showTplDefaults(!P.template);
  }
  function showTplDefaults(useDefaults) {
    var k = G.$('#tpl-type').value, tp = T.list[k];
    var src = !useDefaults && P.template && P.template.type === k ? P.template : tp.defaults;
    G.$('#tpl-w').value = src.W; G.$('#tpl-d').value = src.D; G.$('#tpl-h').value = src.H;
    G.$('#tpl-note').textContent = tp.note;
  }
  G.$('#tpl-type').addEventListener('change', function () { showTplDefaults(true); });
  G.$('#tpl-apply').addEventListener('click', function () {
    var go = function () {
      applyTemplate(G.$('#tpl-type').value, G.num(G.$('#tpl-w').value, 300, 1, 3000), G.num(G.$('#tpl-d').value, 180, 1, 3000), G.num(G.$('#tpl-h').value, 200, 1, 3000));
    };
    if (P.parts.length) G.confirm('今の部品表と木取りは置きかわります。', '作る').then(function (ok) { if (ok) go(); });
    else go();
  });
  function applyTemplate(type, W, Dp, H, quiet) {
    var r = T.build(type, W, Dp, H, P.stock.t);
    if (!r.ok) { G.toast(r.error); return; }
    var old = {};
    P.parts.forEach(function (p) { if (p.key) old[p.key] = p.id; });
    P.parts = r.parts.map(function (p) {
      return { id: old[p.key] || G.uid('p'), key: p.key, name: p.name, l: p.l, w: p.w, t: p.t, qty: 1, grain: true };
    });
    P.template = { type: type, W: W, D: Dp, H: H, dirty: false };
    if (!quiet) P.placements = {};
    if (!quiet || !art.title || art.title === '無題') { art.title = T.list[type].label; G.$('#pname').value = art.title; }
    refreshInstances(); renderTemplateForm(); renderParts(); changed();
    if (!quiet) G.toast('部品表を作りました。「木取り」タブで板に置いてみましょう');
  }

  /* ---------- 2 木取り ---------- */
  var cv = G.$('#board-canvas'), lay = null; // lay: 描画の配置情報
  var LEFT = 46, TOPPAD = 26, GAP = 40;

  function layoutGeometry() {
    var cw = cv.parentNode.clientWidth || 900;
    var s = Math.max(0.05, (cw - LEFT - 12) / Math.max(1, P.stock.l));
    var bh = Math.max(8, P.stock.w * s);
    if (bh > 420) { s = 420 / P.stock.w; bh = 420; }
    var h = TOPPAD + P.stock.count * (bh + GAP);
    return { cw: cw, ch: h, s: s, bh: bh };
  }
  function boardY(b) { return TOPPAD + b * (lay.bh + GAP); }
  function toScreen(r) { return { x: LEFT + r.x * lay.s, y: boardY(r.board) + r.y * lay.s, w: r.dx * lay.s, h: r.dy * lay.s }; }

  function drawLayout() {
    if (G.$('[data-panel="layout"]').hidden) return;
    lay = layoutGeometry();
    var ctx = G.setupCanvas(cv, lay.cw, lay.ch);
    var ink = G.cssVar('--ink', '#222'), muted = G.cssVar('--muted', '#555'), accent = G.cssVar('--accent', '#1f6feb'), ng = G.cssVar('--ng', '#c62828');
    ctx.clearRect(0, 0, lay.cw, lay.ch);
    var ck = K.check(instances, P.placements, P.stock, P.kerf);
    var st = K.stats(instances, P.placements, P.stock, P.kerf);
    for (var b = 0; b < P.stock.count; b++) {
      var y0 = boardY(b), w = P.stock.l * lay.s;
      ctx.fillStyle = G.cssVar('--wood-soft', '#f1dfc5');
      ctx.fillRect(LEFT, y0, w, lay.bh);
      // 木目
      ctx.save(); ctx.beginPath(); ctx.rect(LEFT, y0, w, lay.bh); ctx.clip();
      ctx.strokeStyle = 'rgba(138,90,43,.28)'; ctx.lineWidth = 1;
      for (var gy = 5; gy < lay.bh; gy += 9) {
        ctx.beginPath();
        for (var gx = 0; gx <= w; gx += 24) {
          var yy = y0 + gy + Math.sin((gx + b * 50 + gy * 7) / 90) * 2.5;
          gx ? ctx.lineTo(LEFT + gx, yy) : ctx.moveTo(LEFT, yy);
        }
        ctx.stroke();
      }
      // 右の残り
      var pb = st.perBoard[b];
      if (pb && pb.n && pb.restL > 0) {
        var rx = LEFT + (P.stock.l - pb.restL) * lay.s;
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(rx, y0, pb.restL * lay.s, lay.bh);
      }
      ctx.restore();
      ctx.strokeStyle = G.cssVar('--wood-dark', '#8a5a2b'); ctx.lineWidth = 2; ctx.strokeRect(LEFT, y0, w, lay.bh);
      ctx.fillStyle = ink; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('板' + (b + 1), 4, y0 + 15);
      ctx.font = '12px sans-serif'; ctx.fillStyle = muted;
      ctx.fillText(P.stock.l + '×' + P.stock.w + '×' + P.stock.t + '  木目の方向 ⟷', LEFT, y0 - 6);
      if (pb && pb.n && pb.restL > 0) {
        ctx.textAlign = 'right';
        ctx.fillText('残り 長さ ' + G.fmt(pb.restL, 1) + ' mm', LEFT + w, y0 + lay.bh + 15);
      }
    }
    // 部品
    ck.rects.forEach(function (r) {
      var q = toScreen(r), bad = ck.bad[r.iid], sel = r.iid === selected;
      ctx.fillStyle = bad ? G.cssVar('--ng-soft', '#ffe7e7') : '#fffdf8';
      ctx.fillRect(q.x, q.y, q.w, q.h);
      if (bad) {
        ctx.save(); ctx.beginPath(); ctx.rect(q.x, q.y, q.w, q.h); ctx.clip();
        ctx.strokeStyle = ng; ctx.lineWidth = 1;
        for (var d = -q.h; d < q.w; d += 10) { ctx.beginPath(); ctx.moveTo(q.x + d, q.y + q.h); ctx.lineTo(q.x + d + q.h, q.y); ctx.stroke(); }
        ctx.restore();
      }
      ctx.strokeStyle = bad ? ng : sel ? accent : ink;
      ctx.lineWidth = sel ? 3 : bad ? 2.5 : 1.5;
      ctx.setLineDash(sel ? [6, 3] : []);
      ctx.strokeRect(q.x, q.y, q.w, q.h);
      ctx.setLineDash([]);
      // 名前
      var label = r.inst.name + (r.inst.qty > 1 ? ' ' + r.inst.no : '');
      ctx.save(); ctx.beginPath(); ctx.rect(q.x + 1, q.y + 1, q.w - 2, q.h - 2); ctx.clip();
      ctx.fillStyle = ink; ctx.font = (q.h > 30 ? 'bold 13px' : '11px') + ' sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var cy = q.y + q.h / 2;
      if (q.h > 34) {
        ctx.fillText((bad ? '! ' : '') + label, q.x + q.w / 2, cy - 8);
        ctx.font = '11px sans-serif'; ctx.fillStyle = muted;
        ctx.fillText(r.inst.l + '×' + r.inst.w + (r.rot ? ' (回転)' : '') + (bad ? ' ' + bad.join('・') : ''), q.x + q.w / 2, cy + 9);
      } else ctx.fillText((bad ? '! ' : '') + label, q.x + q.w / 2, cy);
      ctx.restore();
    });
    // ヒントの「ここに置けます」
    if (ghost) {
      var gi = instances.filter(function (i) { return i.iid === ghost.iid; })[0];
      if (gi) {
        var d0 = K.dims(gi, ghost.rot), q = toScreen({ board: ghost.board, x: ghost.x, y: ghost.y, dx: d0.dx, dy: d0.dy });
        ctx.save(); ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.setLineDash([3, 4]);
        ctx.fillStyle = 'rgba(31,111,235,.12)'; ctx.fillRect(q.x, q.y, q.w, q.h); ctx.strokeRect(q.x, q.y, q.w, q.h);
        ctx.fillStyle = accent; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('ヒント: ' + gi.name, q.x + q.w / 2, q.y + q.h / 2);
        ctx.restore();
      }
    }
    G.$('#layout-legend').innerHTML = '';
    G.$('#layout-legend').appendChild(G.h('li', null, '▭ 実線: 置いた部品'));
    G.$('#layout-legend').appendChild(G.h('li', null, '▨ 斜線と「!」: 重なり・はみ出し・木目の向きに問題'));
    G.$('#layout-legend').appendChild(G.h('li', null, '┄ 点線: 選んでいる部品'));
    G.$('#layout-legend').appendChild(G.h('li', null, '白っぽい部分: 右はしの残り'));
  }

  function renderTray() {
    var tray = G.$('#tray');
    tray.innerHTML = '';
    var left = instances.filter(function (i) { return !P.placements[i.iid]; });
    if (!left.length) { tray.appendChild(G.h('p', { class: 'tray-empty' }, instances.length ? '✓ すべての部品を置きました' : '部品表に部品がありません')); return; }
    var biggest = hintStage >= 1 ? largestUnplaced() : null;
    left.forEach(function (i) {
      var b = G.h('button', { class: 'btn tray-item' + (biggest && biggest.iid === i.iid ? ' hl' : ''), type: 'button', 'aria-label': i.name + ' ' + i.l + '×' + i.w + '。押すと空いている場所に置きます' },
        G.h('span', null, i.name + (i.qty > 1 ? ' ' + i.no : '')),
        G.h('span', { class: 'd' }, i.l + '×' + i.w + (i.grain ? ' 木目' : '')));
      b.addEventListener('pointerdown', function (e) { startDrag(e, i, true); });
      b.addEventListener('click', function (e) { if (e.detail === 0) placeAuto(i); }); // キーボードの Enter / Space
      tray.appendChild(b);
    });
  }
  function placeAuto(inst) {
    var spot = K.findSpot(inst, P.placements, instances, P.stock, P.kerf);
    if (!spot) { G.toast('「' + inst.name + '」を置ける空きがありません。板を増やすか、配置を見直しましょう'); return; }
    P.placements[inst.iid] = spot;
    selected = inst.iid; layoutChanged();
  }
  function largestUnplaced() {
    var left = instances.filter(function (i) { return !P.placements[i.iid]; });
    left.sort(function (a, b) { return b.l * b.w - a.l * a.w; });
    return left[0] || null;
  }

  function renderSel() {
    var box = G.$('#sel-panel');
    box.innerHTML = '';
    var inst = instances.filter(function (i) { return i.iid === selected; })[0];
    if (!inst) { box.appendChild(G.h('p', { class: 'g-muted' }, '部品を選ぶと、ここで位置を数字で決められます。')); return; }
    var pl = P.placements[inst.iid];
    box.appendChild(G.h('p', null, G.h('strong', null, inst.name + (inst.qty > 1 ? ' ' + inst.no : '')), ' 長さ ' + inst.l + ' × 幅 ' + inst.w + ' mm', inst.grain ? ' (木目に合わせる)' : ''));
    if (!pl) {
      box.appendChild(G.h('button', { class: 'btn primary', type: 'button', onclick: function () { placeAuto(inst); } }, '空いている場所に置く'));
      return;
    }
    var boardSel = G.h('select', { 'aria-label': '板' });
    for (var b = 0; b < P.stock.count; b++) boardSel.appendChild(G.h('option', { value: b }, '板' + (b + 1)));
    boardSel.value = pl.board;
    var xi = G.h('input', { type: 'number', step: 1, value: round1(pl.x), 'aria-label': '左はしからの位置 x (mm)' });
    var yi = G.h('input', { type: 'number', step: 1, value: round1(pl.y), 'aria-label': '上はしからの位置 y (mm)' });
    function apply() {
      pl.board = +boardSel.value;
      pl.x = G.num(xi.value, pl.x, -4000, 4000);
      pl.y = G.num(yi.value, pl.y, -2000, 2000);
      layoutChanged();
    }
    boardSel.onchange = apply; xi.onchange = apply; yi.onchange = apply;
    box.appendChild(G.h('div', { class: 'g-row align-end' },
      G.h('label', { class: 'g-field' }, G.h('span', null, '板'), boardSel),
      G.h('label', { class: 'g-field' }, G.h('span', null, '左はしから x (mm)'), xi),
      G.h('label', { class: 'g-field' }, G.h('span', null, '上はしから y (mm)'), yi)));
    box.appendChild(G.h('div', { class: 'g-row' },
      G.h('button', { class: 'btn', type: 'button', onclick: function () { rotateSel(); } }, '90°回す (R)'),
      G.h('button', { class: 'btn', type: 'button', onclick: function () { unplace(); } }, '板から外す (Delete)'),
      G.h('button', { class: 'btn', type: 'button', onclick: function () { delete P.placements[inst.iid]; placeAuto(inst); } }, '空いている場所へ')));
    var ck = K.check(instances, P.placements, P.stock, P.kerf);
    var bad = ck.bad[inst.iid];
    box.appendChild(bad ? G.h('p', { class: 'badge ng' }, '✕ ' + bad.join('・') + (bad.indexOf('重なり') >= 0 ? '(部品の間は切りしろ ' + P.kerf + ' mm 以上あける)' : '')) : G.h('p', { class: 'badge ok' }, '○ 問題なし'));
  }
  function round1(v) { return Math.round(v * 10) / 10; }

  function renderStats() {
    var st = K.stats(instances, P.placements, P.stock, P.kerf);
    var ck = K.check(instances, P.placements, P.stock, P.kerf);
    var box = G.$('#stats'); box.innerHTML = '';
    var cost = (P.stock.price || 0) * st.usedBoards;
    box.appendChild(G.h('div', { class: 'stat-grid' },
      G.h('div', null, G.h('span', { class: 'lab' }, '歩留まり(使う板の中で部品になる割合)'), G.h('span', { class: 'stat-big' }, G.fmt(st.yield * 100, 1)), ' %'),
      G.h('div', null, G.h('span', { class: 'lab' }, '使う板'), G.h('span', { class: 'stat-big' }, String(st.usedBoards)), ' 枚'),
      G.h('div', null, G.h('span', { class: 'lab' }, '置いた部品'), G.h('span', { class: 'stat-big' }, st.placed + '/' + st.total)),
      P.stock.price && st.usedBoards ? G.h('div', null, G.h('span', { class: 'lab' }, '材料費'), G.h('span', { class: 'stat-big' }, G.fmt(cost, 0)), ' 円')
        : G.h('div', null, G.h('span', { class: 'lab' }, '材料費'), G.h('span', { class: 'cost-hint' }, P.stock.price ? '部品を板に置くと材料費が出ます' : '「材料・部品」タブで1枚の値段を入れると材料費が出ます'))));
    var tb = G.h('tbody');
    st.perBoard.forEach(function (pb) {
      tb.appendChild(G.h('tr', null, G.h('td', null, '板' + (pb.board + 1)), G.h('td', { class: 'num' }, String(pb.n)), G.h('td', { class: 'num' }, G.fmt(pb.yield * 100, 1) + ' %'), G.h('td', { class: 'num' }, pb.n ? G.fmt(pb.restL, 1) + ' mm' : '使わない')));
    });
    box.appendChild(G.h('div', { class: 'g-table-wrap' }, G.h('table', { class: 'g-table' },
      G.h('thead', null, G.h('tr', null, G.h('th', null, '板'), G.h('th', { class: 'num' }, '部品'), G.h('th', { class: 'num' }, '歩留まり'), G.h('th', { class: 'num' }, '右はしの残り'))), tb)));
    var nBad = Object.keys(ck.bad).length;
    if (nBad) box.appendChild(G.h('p', { class: 'badge ng' }, '✕ 問題のある部品が ' + nBad + ' 個あります(斜線の部品)'));
    if (st.unplaced) box.appendChild(G.h('p', { class: 'badge warn' }, '△ まだ置いていない部品が ' + st.unplaced + ' 個あります'));
    if (!nBad && !st.unplaced && st.total) box.appendChild(G.h('p', { class: 'badge ok' }, '○ すべての部品を問題なく置けました'));
  }

  function layoutChanged() {
    ghost = null;
    drawLayout(); renderTray(); renderSel(); renderStats(); changed();
  }

  // ドラッグ
  var drag = null;
  function canvasPoint(e) {
    var r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
  }
  function boardAt(py) {
    for (var b = 0; b < P.stock.count; b++) {
      var y0 = boardY(b);
      if (py >= y0 - GAP / 2 && py <= y0 + lay.bh + GAP / 2) return b;
    }
    return -1;
  }
  function hitTest(pt) {
    var rs = K.rects(instances, P.placements);
    for (var i = rs.length - 1; i >= 0; i--) {
      var q = toScreen(rs[i]);
      if (pt.x >= q.x && pt.x <= q.x + q.w && pt.y >= q.y && pt.y <= q.y + q.h) return rs[i];
    }
    return null;
  }
  function startDrag(e, inst, fromTray, offMM) {
    if (e.button !== undefined && e.button !== 0) return;
    if (!lay) lay = layoutGeometry();
    var pl = P.placements[inst.iid];
    var d = K.dims(inst, pl ? pl.rot : 0);
    drag = { iid: inst.iid, fromTray: fromTray, moved: false, sx: e.clientX, sy: e.clientY, off: offMM || { x: d.dx / 2, y: d.dy / 2 }, rot: pl ? pl.rot : 0, orig: pl ? JSON.parse(JSON.stringify(pl)) : null };
    selected = inst.iid;
    if (e.target.setPointerCapture) try { e.target.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
  }
  cv.addEventListener('pointerdown', function (e) {
    cv.focus();
    var pt = canvasPoint(e), hit = hitTest(pt);
    if (!hit) { selected = null; drawLayout(); renderSel(); return; }
    var off = { x: (pt.x - LEFT) / lay.s - hit.x, y: (pt.y - boardY(hit.board)) / lay.s - hit.y };
    startDrag(e, hit.inst, false, off);
    drawLayout(); renderSel();
  });
  document.addEventListener('pointermove', function (e) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
    drag.moved = true;
    var pt = canvasPoint(e);
    var inst = instances.filter(function (i) { return i.iid === drag.iid; })[0];
    if (!inst) return;
    var b = pt.inside ? boardAt(pt.y) : -1;
    if (b < 0) {
      if (drag.fromTray) { delete P.placements[drag.iid]; drawLayout(); }
      return;
    }
    var d = K.dims(inst, drag.rot);
    var x = (pt.x - LEFT) / lay.s - drag.off.x, y = (pt.y - boardY(b)) / lay.s - drag.off.y;
    var sn = snap(inst.iid, b, x, y, d);
    P.placements[drag.iid] = { board: b, x: sn.x, y: sn.y, rot: drag.rot };
    drawLayout();
  });
  document.addEventListener('pointerup', function (e) {
    if (!drag) return;
    var dd = drag; drag = null;
    var inst = instances.filter(function (i) { return i.iid === dd.iid; })[0];
    if (!dd.moved) {
      if (dd.fromTray && inst) placeAuto(inst);
      else { renderSel(); }
      return;
    }
    var pt = canvasPoint(e);
    if (!pt.inside || boardAt(pt.y) < 0) {
      delete P.placements[dd.iid];
      if (!dd.fromTray && inst) G.toast('「' + inst.name + '」を板から外しました');
    }
    layoutChanged();
  });
  // 1mm 単位にそろえ、板のはしや、ほかの部品から切りしろの位置に吸いつける
  function snap(iid, board, x, y, d) {
    var thr = 8 / lay.s, kerf = P.kerf;
    var xs = [0, P.stock.l - d.dx], ys = [0, P.stock.w - d.dy];
    K.rects(instances, P.placements).forEach(function (r) {
      if (r.iid === iid || r.board !== board) return;
      xs.push(r.x + r.dx + kerf, r.x - kerf - d.dx, r.x);
      ys.push(r.y + r.dy + kerf, r.y - kerf - d.dy, r.y);
    });
    function best(v, list) {
      var b = Math.round(v), bd = thr;
      list.forEach(function (c) { if (Math.abs(c - v) < bd) { bd = Math.abs(c - v); b = c; } });
      return b;
    }
    return { x: best(x, xs), y: best(y, ys) };
  }
  // キーボード操作
  cv.addEventListener('keydown', function (e) {
    if (!selected) {
      if (e.key === 'Tab') return;
      var first = K.rects(instances, P.placements)[0];
      if (first && /^Arrow/.test(e.key)) { selected = first.iid; drawLayout(); renderSel(); e.preventDefault(); }
      return;
    }
    var pl = P.placements[selected];
    var step = e.shiftKey ? 10 : 1, used = true;
    if (!pl) return;
    if (e.key === 'ArrowLeft') pl.x -= step;
    else if (e.key === 'ArrowRight') pl.x += step;
    else if (e.key === 'ArrowUp') pl.y -= step;
    else if (e.key === 'ArrowDown') pl.y += step;
    else if (e.key === 'r' || e.key === 'R') { rotateSel(); return e.preventDefault(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { unplace(); return e.preventDefault(); }
    else if (e.key === 'PageDown') pl.board = Math.min(P.stock.count - 1, pl.board + 1);
    else if (e.key === 'PageUp') pl.board = Math.max(0, pl.board - 1);
    else if (e.key === 'n' || e.key === 'N') { // 次の部品を選ぶ
      var rs = K.rects(instances, P.placements), i = rs.map(function (r) { return r.iid; }).indexOf(selected);
      selected = rs[(i + 1) % rs.length].iid; drawLayout(); renderSel(); return e.preventDefault();
    }
    else used = false;
    if (used) { e.preventDefault(); layoutChanged(); }
  });
  function rotateSel() {
    var inst = instances.filter(function (i) { return i.iid === selected; })[0], pl = P.placements[selected];
    if (!inst || !pl) return;
    if (inst.grain) { G.toast('「' + inst.name + '」は木目に合わせる部品なので回せません'); return; }
    pl.rot = pl.rot ? 0 : 1; layoutChanged();
  }
  function unplace() {
    if (!selected || !P.placements[selected]) return;
    delete P.placements[selected]; layoutChanged();
  }
  G.$('#clear-layout').addEventListener('click', function () {
    G.confirm('板の上の部品をすべて外します。', '外す').then(function (ok) { if (ok) { P.placements = {}; selected = null; layoutChanged(); } });
  });

  // ヒント(段階的に出す)
  function logHint(stage) {
    P.hints.used++;
    P.hints.log.push({ stage: stage, at: new Date().toISOString() });
    changed();
  }
  G.$('#hint').addEventListener('click', function () {
    var box = G.$('#hint-box');
    var left = instances.filter(function (i) { return !P.placements[i.iid]; });
    box.innerHTML = '';
    if (!left.length && hintStage < 2) hintStage = 2;
    hintStage = Math.min(3, hintStage + 1);
    logHint(hintStage);
    if (hintStage === 1) {
      box.appendChild(G.h('div', { class: 'hint-card' }, G.h('strong', null, 'ヒント1: '),
        '大きい部品から先に置くと、すき間が少なくなります。板の長い方向に部品を並べ、のこぎりで端から端までまっすぐ切れる並べ方にすると、作業も楽になります。今いちばん大きいのは、点線で囲んだ部品です。'));
    } else if (hintStage === 2) {
      var big = largestUnplaced();
      var spot = big && K.findSpot(big, P.placements, instances, P.stock, P.kerf);
      if (big && spot) {
        ghost = { iid: big.iid, board: spot.board, x: spot.x, y: spot.y, rot: spot.rot };
        box.appendChild(G.h('div', { class: 'hint-card' }, G.h('strong', null, 'ヒント2: '),
          '「' + big.name + '」は、青い点線の場所に置けます。',
          G.h('button', { class: 'btn small', type: 'button', onclick: function () { P.placements[big.iid] = spot; selected = big.iid; box.innerHTML = ''; layoutChanged(); } }, 'ここに置く')));
      } else {
        box.appendChild(G.h('div', { class: 'hint-card' }, G.h('strong', null, 'ヒント2: '), big ? '今の配置のままでは「' + big.name + '」を置く空きがありません。部品を寄せるか、板を増やしましょう。' : 'すべての部品が置けています。歩留まりを上げられないか、並べ方を変えて比べてみましょう。'));
      }
    } else {
      var plan = K.guillotine(instances, P.stock, P.kerf, 10);
      var st = K.stats(instances, plan.placements, { l: P.stock.l, w: P.stock.w, count: 10 }, P.kerf);
      var cur = K.stats(instances, P.placements, P.stock, P.kerf);
      box.appendChild(G.h('div', { class: 'hint-card' }, G.h('strong', null, 'ヒント3(配置の案): '),
        'コンピュータの案では、板 ' + plan.boardsUsed + ' 枚・歩留まり ' + G.fmt(st.yield * 100, 1) + ' % になります(今は ' + cur.usedBoards + ' 枚・' + G.fmt(cur.yield * 100, 1) + ' %)。',
        plan.unplaced.length ? ' ただし ' + plan.unplaced.length + ' 個の部品は板より大きくて入りません。' : '',
        ' 案はひとつの例です。木目や節の位置、切る手間も考えて、自分で決めましょう。',
        G.h('div', { class: 'g-row' },
          G.h('button', { class: 'btn small', type: 'button', onclick: function () {
            G.confirm('今の配置を、コンピュータの案に置きかえます。', '置きかえる').then(function (ok) {
              if (!ok) return;
              if (plan.boardsUsed > P.stock.count) { P.stock.count = plan.boardsUsed; renderStock(); }
              P.placements = plan.placements; box.innerHTML = ''; hintStage = 0; layoutChanged();
            });
          } }, 'この案を使ってみる'),
          G.h('button', { class: 'btn small ghost', type: 'button', onclick: function () { box.innerHTML = ''; hintStage = 0; ghost = null; drawLayout(); renderTray(); } }, '閉じる'))));
    }
    G.$('#hint').textContent = hintStage < 3 ? 'ヒント(次: ' + (hintStage + 1) + '/3)' : 'ヒント(3/3)';
    drawLayout(); renderTray();
  });

  function printPanel() { window.print(); }
  function canvasPng(canvas, name) {
    canvas.toBlob(function (b) { if (b) G.download(b, name); });
  }
  G.$('#png-layout').addEventListener('click', function () { canvasPng(cv, '木取り図_' + (art.title || '') + '.png'); });
  G.$('#print-layout').addEventListener('click', printPanel);

  /* ---------- 3 製作図 ---------- */
  var JOINTS = [
    { name: 'くぎ', svg: '<rect x="20" y="60" width="160" height="20" fill="#f1dfc5" stroke="#333"/><rect x="20" y="20" width="20" height="40" fill="#f1dfc5" stroke="#333"/><line x1="30" y1="10" x2="30" y2="72" stroke="#555" stroke-width="3"/><rect x="24" y="6" width="12" height="4" fill="#555"/>', text: '手軽で速い。くぎの長さは板の厚さの約2.5〜3倍が目安。板の端に近いと割れやすいので注意。' },
    { name: '木ねじ', svg: '<rect x="20" y="60" width="160" height="20" fill="#f1dfc5" stroke="#333"/><rect x="20" y="20" width="20" height="40" fill="#f1dfc5" stroke="#333"/><path d="M30 12 L30 74" stroke="#555" stroke-width="3"/><path d="M26 30 l8 3 M26 38 l8 3 M26 46 l8 3 M26 54 l8 3 M26 62 l8 3" stroke="#555"/>', text: 'くぎよりゆるみにくく、分解もできる。下穴をあけてからねじ込む。' },
    { name: '接着剤', svg: '<rect x="20" y="58" width="160" height="22" fill="#f1dfc5" stroke="#333"/><rect x="60" y="26" width="80" height="30" fill="#f1dfc5" stroke="#333"/><rect x="60" y="55" width="80" height="4" fill="#9bc3ff"/>', text: '面どうしをはり合わせる。かわくまでクランプなどで固定する。くぎ・木ねじと組み合わせることが多い。' },
    { name: 'ほぞ接ぎ', svg: '<rect x="20" y="50" width="160" height="30" fill="#f1dfc5" stroke="#333"/><rect x="85" y="50" width="30" height="16" fill="#fff" stroke="#333" stroke-dasharray="3 2"/><path d="M80 10 h40 v30 h-5 v16 h-30 v-16 h-5 z" fill="#e2c39b" stroke="#333"/>', text: '一方に「ほぞ」、もう一方に「ほぞ穴」を作ってはめ込む。金物を使わずに丈夫につなぐ、日本の伝統的な技。' },
    { name: 'あり継ぎ', svg: '<path d="M20 30 h70 l-12 25 h44 l-12 -25 h70 v30 h-160 z" fill="#f1dfc5" stroke="#333"/><path d="M90 30 l-12 25 h44 l-12 -25 z" fill="#e2c39b" stroke="#333"/>', text: '台形(ありの形)にきざんで、引っぱっても抜けないように組む。精密な加工が必要な、日本の伝統的な技。' }
  ];
  function renderDrawing() {
    var msg = G.$('#drawing-msg'); msg.innerHTML = '';
    var acv = G.$('#assembly-canvas');
    if (P.template) {
      var r = T.build(P.template.type, P.template.W, P.template.D, P.template.H, P.stock.t);
      if (r.ok) {
        D.assembly(acv, r.parts.map(function (p) { return p.box; }), { title: (art.title || T.list[P.template.type].label) + '(' + T.list[P.template.type].label + ')', t: P.stock.t });
        if (P.template.dirty) msg.appendChild(G.h('p', { class: 'g-note' }, '部品表を手で変えたので、組み立て図はひな形の寸法(幅 ' + P.template.W + '・奥行き ' + P.template.D + '・高さ ' + P.template.H + ')のままです。'));
      } else msg.appendChild(G.h('p', { class: 'g-note' }, r.error));
      acv.hidden = !r.ok;
    } else {
      acv.hidden = true;
      msg.appendChild(G.h('p', { class: 'g-note' }, '組み立て図は、「材料・部品」タブのひな形から部品表を作ると自動でかけます。部品図は下にあります。'));
    }
    D.partsSheet(G.$('#parts-canvas'), P.parts);
    var jb = G.$('#joints');
    if (!jb.childNodes.length) JOINTS.forEach(function (j) {
      var card = G.h('div', { class: 'joint-card' });
      card.innerHTML = '<svg viewBox="0 0 200 90" role="img" aria-label="' + G.esc(j.name) + 'の図">' + j.svg + '</svg>';
      card.appendChild(G.h('h3', null, j.name));
      card.appendChild(G.h('p', null, j.text));
      jb.appendChild(card);
    });
  }
  G.$('#png-drawing').addEventListener('click', function () { canvasPng(G.$('#assembly-canvas'), '製作図_' + (art.title || '') + '.png'); });
  G.$('#print-drawing').addEventListener('click', printPanel);

  /* ---------- 4 強度 ---------- */
  var anim = { from: 0, to: 0, t0: 0, raf: 0 };
  function strengthPart() {
    var S = P.strength;
    var p = P.parts.filter(function (x) { return x.id === S.partId; })[0];
    if (!p) {
      p = P.parts.filter(function (x) { return /棚板|底板|天板/.test(x.name); })[0] || P.parts[0];
      if (p) { S.partId = p.id; S.span = p.l; }
    }
    return p;
  }
  function renderStrengthForm() {
    var S = P.strength, p = strengthPart();
    fillSelect(G.$('#st-part'), P.parts.map(function (x) { return { value: x.id, label: x.name + '(' + x.l + '×' + x.w + '×' + x.t + ')' }; }), p ? p.id : '');
    fillSelect(G.$('#st-support'), Object.keys({ simple: 1, cantilever: 1 }).map(function (k) { return { value: k, label: k === 'simple' ? '両端で支える' : '片方だけ固定(片持ち)' }; }), S.support);
    G.$('#st-loadtype').value = S.loadType;
    G.$('#st-span').value = S.span || (p ? p.l : 300);
    G.$('#st-kg').value = S.kg; G.$('#st-kg-range').value = Math.min(50, S.kg);
    fillSelect(G.$('#cmp-material'), G.materials.list.filter(function (m) { return m.id !== P.stock.material; }).map(function (m) { return { value: m.id, label: m.name + '(' + G.materials.kinds[m.kind] + ')' }; }), S.material2);
    if (G.$('#cmp-material').value !== S.material2) S.material2 = G.$('#cmp-material').value;
    G.$('#cmp-thick').value = S.thick; G.$('#cmp-ribs').value = S.ribs; G.$('#cmp-ribw').value = S.ribW; G.$('#cmp-ribh').value = S.ribH;
    G.$('#exp-delta').value = S.measured;
  }
  function bindStrength() {
    var S = function () { return P.strength; };
    G.$('#st-part').addEventListener('change', function () {
      S().partId = this.value; var p = strengthPart(); if (p) { S().span = p.l; G.$('#st-span').value = p.l; } renderStrength(); changed();
    });
    G.$('#st-support').addEventListener('change', function () { S().support = this.value; renderStrength(); changed(); });
    G.$('#st-loadtype').addEventListener('change', function () { S().loadType = this.value; renderStrength(); changed(); });
    G.$('#st-span').addEventListener('change', function () { S().span = G.num(this.value, 300, 10, 4000); this.value = S().span; renderStrength(); changed(); });
    G.$('#st-kg').addEventListener('change', function () { S().kg = G.num(this.value, 5, 0, 500); this.value = S().kg; G.$('#st-kg-range').value = Math.min(50, S().kg); renderStrength(); changed(); });
    G.$('#st-kg-range').addEventListener('input', function () { S().kg = +this.value; G.$('#st-kg').value = S().kg; renderStrength(); changed(); });
    [['#cmp-thick', 'thick', 3, 0, 30], ['#cmp-ribs', 'ribs', 1, 1, 4], ['#cmp-ribw', 'ribW', 15, 5, 60], ['#cmp-ribh', 'ribH', 30, 5, 80]].forEach(function (f) {
      G.$(f[0]).addEventListener('change', function () { S()[f[1]] = Math.round(G.num(this.value, f[2], f[3], f[4])); this.value = S()[f[1]]; renderStrength(); changed(); });
    });
    G.$('#cmp-material').addEventListener('change', function () { S().material2 = this.value; renderStrength(); changed(); });
    G.$('#exp-delta').addEventListener('change', function () { S().measured = this.value === '' ? '' : G.num(this.value, 0, 0, 500); renderStrength(); changed(); });
  }
  function calcVariants(p) {
    var S = P.strength, base = { span: S.span || p.l, loadKg: S.kg, support: S.support, loadType: S.loadType };
    function run(label, material, section) {
      var r = window.Beam.analyze({ material: material, section: section, span: base.span, loadKg: base.loadKg, support: base.support, loadType: base.loadType });
      return { label: label, r: r, material: material };
    }
    var m = P.stock.material;
    var m2 = G.materials.get(S.material2);
    return [
      run('今の設計(' + G.materials.get(m).name + ' 厚さ ' + p.t + ')', m, { shape: 'rect', b: p.w, t: p.t }),
      run('厚さを ' + S.thick + ' mm 増やす', m, { shape: 'rect', b: p.w, t: p.t + S.thick }),
      run('下に補強材 ' + S.ribs + ' 本(' + S.ribW + '×' + S.ribH + ')', m, { shape: 'ribbed', b: p.w, t: p.t, ribs: S.ribs, ribW: S.ribW, ribH: S.ribH }),
      run('材料を' + (m2 ? m2.name : '') + 'に変える', S.material2, { shape: 'rect', b: p.w, t: p.t })
    ];
  }
  function renderStrength() {
    var p = strengthPart(), res = G.$('#st-result'), tbl = G.$('#cmp-table');
    res.innerHTML = ''; tbl.innerHTML = '';
    if (!p) { res.appendChild(G.h('p', { class: 'g-note' }, '部品表に部品がありません。')); return; }
    var vs = calcVariants(p), cur = vs[0].r;
    if (!cur.ok) { res.appendChild(G.h('p', { class: 'g-note' }, cur.error)); drawBeam(null); return; }
    res.appendChild(G.h('div', { class: 'stat-grid' },
      G.h('div', null, G.h('span', { class: 'lab' }, 'たわみ(へこむ量)'), G.h('span', { class: 'stat-big' }, G.fmt(cur.deflection, 2)), ' mm'),
      G.h('div', null, G.h('span', { class: 'lab' }, '強さの余裕'), G.h('span', { class: 'stat-big lvl-' + cur.level.id }, cur.level.mark + ' ' + cur.level.label)),
      G.h('div', null, G.h('span', { class: 'lab' }, '重さ'), G.h('span', { class: 'stat-big' }, G.fmt(cur.mass * 1000, 0)), ' g')));
    res.appendChild(G.h('details', { class: 'more' }, G.h('summary', null, 'くわしく見る(発展)'),
      G.h('p', null, '板の中の応力(いちばん大きい所): ' + G.fmt(cur.stress, 2) + ' N/mm²'),
      G.h('p', null, '安全率(強さ ÷ 応力): ' + (isFinite(cur.safety) ? G.fmt(cur.safety, 1) : '—') + '(3以上で「○ 余裕あり」)'),
      G.h('p', { class: 'g-muted' }, '式: ' + formulaText() + '(E: ヤング率 ' + G.fmt(cur.E, 0) + ' N/mm²、I: 断面二次モーメント = 幅×厚さ³÷12 = ' + G.fmt(cur.I, 0) + ' mm⁴)')));
    cur.warnings.forEach(function (w) { res.appendChild(G.h('p', { class: 'badge ng' }, '! ' + w)); });
    res.appendChild(G.noteEstimate('計算は、木の性質がどこでも同じと考えた「目安」です。実際の板は、節・木目・含水率で変わります。実験で確かめましょう。' + G.materials.source));
    // 比べる表
    var maxD = vs.reduce(function (m, v) { return v.r.ok ? Math.max(m, v.r.deflection) : m; }, 0) || 1;
    var tb = G.h('tbody');
    vs.forEach(function (v) {
      if (!v.r.ok) { tb.appendChild(G.h('tr', null, G.h('td', null, v.label), G.h('td', { colspan: 4 }, v.r.error))); return; }
      var pct = Math.max(1, Math.min(100, v.r.deflection / maxD * 100));
      tb.appendChild(G.h('tr', null,
        G.h('td', null, v.label),
        G.h('td', { class: 'num' }, G.fmt(v.r.deflection, 2) + ' mm'),
        G.h('td', { class: 'bar-cell' }, G.h('div', { class: 'bar', style: { width: pct + '%' }, 'aria-hidden': 'true' })),
        G.h('td', { class: 'lvl-' + v.r.level.id }, v.r.level.mark + ' ' + v.r.level.label),
        G.h('td', { class: 'num' }, G.fmt(v.r.mass * 1000, 0) + ' g')));
    });
    tbl.appendChild(G.h('div', { class: 'g-table-wrap' }, G.h('table', { class: 'g-table' },
      G.h('thead', null, G.h('tr', null, G.h('th', null, '案'), G.h('th', { class: 'num' }, 'たわみ'), G.h('th', null, '(たわみの大きさ)'), G.h('th', null, '強さの余裕'), G.h('th', { class: 'num' }, '重さ'))), tb)));
    tbl.appendChild(G.h('p', { class: 'g-muted' }, '厚さを2倍にすると、たわみは約8分の1になります(厚さの3乗がきく)。補強材は、少ない材料で板を丈夫にする工夫です。'));
    // 実験
    var er = G.$('#exp-result'); er.innerHTML = '';
    var me = P.strength.measured;
    if (me !== '' && me !== null && isFinite(me)) {
      var diff = cur.deflection > 0 ? (me - cur.deflection) / cur.deflection * 100 : 0;
      er.appendChild(G.h('p', null, '計算 ' + G.fmt(cur.deflection, 2) + ' mm / 実験 ' + G.fmt(+me, 2) + ' mm(差 ' + (diff >= 0 ? '+' : '') + G.fmt(diff, 0) + ' %)'));
      er.appendChild(G.h('p', { class: 'g-muted' }, Math.abs(diff) < 25 ? '計算とだいたい合っています。' : '差が大きいときは、節や木目の向き、支える位置、測り方、含水率などの違いを考えてみましょう。'));
    }
    animateBeam(cur);
  }
  function formulaText() {
    var s = P.strength.support, l = P.strength.loadType;
    if (s === 'cantilever') return l === 'uniform' ? 'δ = PL³ ÷ (8EI)' : 'δ = PL³ ÷ (3EI)';
    return l === 'uniform' ? 'δ = 5PL³ ÷ (384EI)' : 'δ = PL³ ÷ (48EI)';
  }
  function animateBeam(r) {
    cancelAnimationFrame(anim.raf);
    anim.from = anim.cur || 0; anim.to = r.deflection; anim.t0 = performance.now();
    var step = function (now) {
      var k = Math.min(1, (now - anim.t0) / 450), e = 1 - Math.pow(1 - k, 3);
      anim.cur = anim.from + (anim.to - anim.from) * e;
      drawBeam(r, anim.cur);
      if (k < 1) anim.raf = requestAnimationFrame(step);
    };
    anim.raf = requestAnimationFrame(step);
  }
  function drawBeam(r, dNow) {
    var c = G.$('#beam-canvas');
    if (G.$('[data-panel="strength"]').hidden) return;
    var cw = c.parentNode.clientWidth || 600, ch = 210;
    var ctx = G.setupCanvas(c, cw, ch);
    ctx.clearRect(0, 0, cw, ch);
    if (!r || !r.ok) return;
    var ink = G.cssVar('--ink', '#222'), accent = G.cssVar('--accent', '#1f6feb'), muted = G.cssVar('--muted', '#555');
    var x0 = 40, x1 = cw - 40, y0 = 80, L = r.L, thick = 14;
    var maxPx = 60;
    var scale = r.deflection > 0 ? Math.min(maxPx / r.deflection, 1e4) : 1;
    var dispScale = scale * (cw - 80) / L > 0 ? scale : 1;
    var support = P.strength.support, lt = P.strength.loadType;
    var ratio = r.deflection > 0 ? dNow / r.deflection : 0;
    function yAt(x) { return window.Beam.shape(x, L, support, lt) * r.deflection * ratio * scale; }
    // 変形前(点線)
    ctx.setLineDash([5, 4]); ctx.strokeStyle = muted; ctx.lineWidth = 1;
    ctx.strokeRect(x0, y0 - thick / 2, x1 - x0, thick); ctx.setLineDash([]);
    // 変形後
    ctx.beginPath();
    var N = 60, i, x, px, py;
    for (i = 0; i <= N; i++) { x = L * i / N; px = x0 + (x1 - x0) * i / N; py = y0 - thick / 2 + yAt(x); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    for (i = N; i >= 0; i--) { x = L * i / N; px = x0 + (x1 - x0) * i / N; py = y0 + thick / 2 + yAt(x); ctx.lineTo(px, py); }
    ctx.closePath(); ctx.fillStyle = G.cssVar('--wood-soft', '#f1dfc5'); ctx.fill(); ctx.strokeStyle = G.cssVar('--wood-dark', '#8a5a2b'); ctx.lineWidth = 2; ctx.stroke();
    // 支点
    ctx.fillStyle = ink;
    if (support === 'cantilever') {
      ctx.fillRect(x0 - 14, y0 - 40, 12, 80);
      ctx.strokeStyle = ink; ctx.lineWidth = 1;
      for (var hy = y0 - 40; hy < y0 + 40; hy += 8) { ctx.beginPath(); ctx.moveTo(x0 - 14, hy + 8); ctx.lineTo(x0 - 24, hy); ctx.stroke(); }
    } else {
      [x0, x1].forEach(function (sx) { ctx.beginPath(); ctx.moveTo(sx, y0 + thick / 2); ctx.lineTo(sx - 10, y0 + thick / 2 + 18); ctx.lineTo(sx + 10, y0 + thick / 2 + 18); ctx.closePath(); ctx.fill(); });
    }
    // 荷重の矢印
    ctx.strokeStyle = accent; ctx.fillStyle = accent; ctx.lineWidth = 3;
    function arrowDown(ax, ay) { ctx.beginPath(); ctx.moveTo(ax, ay - 34); ctx.lineTo(ax, ay - 6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - 6, ay - 10); ctx.lineTo(ax + 6, ay - 10); ctx.closePath(); ctx.fill(); }
    if (lt === 'uniform') {
      for (i = 0; i <= 8; i++) { x = L * i / 8; arrowDown(x0 + (x1 - x0) * i / 8, y0 - thick / 2 + yAt(x) - 2); }
    } else {
      var lx = support === 'cantilever' ? L : L / 2;
      arrowDown(x0 + (x1 - x0) * lx / L, y0 - thick / 2 + yAt(lx) - 2);
    }
    ctx.font = '13px sans-serif'; ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(G.fmt(P.strength.kg, 1) + ' kg(約 ' + G.fmt(r.P, 0) + ' N)', 10, 18);
    ctx.fillStyle = muted;
    ctx.fillText('支点間距離 ' + L + ' mm / たわみは見やすくするため 約' + G.fmt(dispScale * (x1 - x0) / L, 0) + '倍に拡大', 10, ch - 10);
  }

  /* ---------- 5 ふりかえり ---------- */
  function renderReview() {
    var R = P.review;
    G.psCycle(G.$('#ps'), ['plan', 'eval', 'improve']);
    var ib = G.$('#inspect'); ib.innerHTML = '';
    INSPECT.forEach(function (txt, i) {
      var id = 'insp-' + i;
      var c = G.h('input', { type: 'checkbox', id: id, checked: !!R.inspect[i] });
      c.addEventListener('change', function () { R.inspect[i] = c.checked; changed(); });
      ib.appendChild(G.h('div', { class: 'g-check' }, c, G.h('label', { for: id }, txt)));
    });
    var st = K.stats(instances, P.placements, P.stock, P.kerf), ck = K.check(instances, P.placements, P.stock, P.kerf);
    var sb = G.$('#selfcheck'); sb.innerHTML = '';
    var allPlaced = st.total > 0 && st.unplaced === 0, noBad = ck.ok;
    sb.appendChild(G.h('p', null, G.h('span', { class: 'badge ' + (allPlaced ? 'ok' : 'warn') }, allPlaced ? '○ すべての部品を板に置けた' : '△ 置いていない部品がある'), ' ',
      G.h('span', { class: 'badge ' + (noBad ? 'ok' : 'ng') }, noBad ? '○ 重なり・はみ出しがない' : '✕ 重なり・はみ出しがある')));
    SELF.forEach(function (s) {
      var id = 'self-' + s.id;
      var c = G.h('input', { type: 'checkbox', id: id, checked: !!R.self[s.id] });
      c.addEventListener('change', function () { R.self[s.id] = c.checked; changed(); });
      sb.appendChild(G.h('div', { class: 'g-check' }, c, G.h('label', { for: id }, s.label)));
    });
    ['good', 'improve', 'real'].forEach(function (k) {
      var ta = G.$('#rv-' + k);
      ta.value = R[k] || '';
      ta.oninput = function () { R[k] = ta.value; changed(); };
    });
    G.viewpointSliders(G.$('#vp-sliders'), R.viewpoints, function () { drawRadar(); changed(); });
    drawRadar();
    var rec = G.$('#rv-record'); rec.innerHTML = '';
    rec.appendChild(G.h('ul', null,
      G.h('li', null, '使う板: ' + st.usedBoards + ' 枚(' + P.stock.l + '×' + P.stock.w + '×' + P.stock.t + ' ' + (G.materials.get(P.stock.material) || {}).name + ')'),
      G.h('li', null, '歩留まり: ' + G.fmt(st.yield * 100, 1) + ' %'),
      G.h('li', null, !P.stock.price ? '材料費: 1枚の値段を入れると材料費が出ます(「材料・部品」タブ)' : st.usedBoards ? '材料費: ' + G.fmt(P.stock.price * st.usedBoards, 0) + ' 円' : '材料費: 部品を板に置くと材料費が出ます'),
      G.h('li', null, 'ヒントを使った回数: ' + P.hints.used + ' 回' + (P.hints.log.some(function (l) { return l.stage === 3; }) ? '(配置の案まで見た)' : '')),
      G.h('li', null, '最後に保存: ' + new Date(art.updatedAt).toLocaleString('ja-JP'))));
  }
  function drawRadar() {
    var R = P.review;
    G.radar(G.$('#vp-radar'), { axes: G.VIEWPOINTS.map(function (v) { return v.label; }), max: 5, series: [{ label: '自分の設計', values: G.VIEWPOINTS.map(function (v) { return R.viewpoints[v.id] || 0; }) }] });
  }

  /* ---------- 全体 ---------- */
  function renderAll() {
    renderStock(); renderTemplateForm(); renderParts();
    renderCurrentTab();
  }
  var currentTab = 'parts';
  function renderCurrentTab() {
    if (currentTab === 'layout') { drawLayout(); renderTray(); renderSel(); renderStats(); }
    else if (currentTab === 'drawing') renderDrawing();
    else if (currentTab === 'strength') { renderStrengthForm(); renderStrength(); }
    else if (currentTab === 'review') renderReview();
  }
  var tabs = G.tabs(G.$('[data-g-tabs]'), function (name) {
    currentTab = name;
    if (P) renderCurrentTab();
  });
  var rt = null;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (P) renderCurrentTab(); }, 150); });

  bindStock(); bindStrength();
  G.$('#b-new').addEventListener('click', function () {
    G.confirm('新しい作品を作ります。今の作品は保存されています。', '新しく作る').then(function (ok) { if (ok) { save().then(function () { newProject(); tabs.show('parts'); }); } });
  });
  G.$('#b-save').addEventListener('click', function () { save(true); });
  G.$('#b-open').addEventListener('click', function () {
    save().then(function () { return G.openDialog(APP); }).then(function (a) { if (a) { setProject(a); G.toast('「' + a.title + '」を開きました'); } });
  });
  G.$('#b-export').addEventListener('click', function () {
    save().then(function () { G.exportJSON(art, '木取り_' + (art.title || '無題') + '.json'); });
  });
  G.$('#b-import').addEventListener('click', function () {
    G.pickJSON().then(function (obj) {
      var list = G.normalizeImport(obj, APP);
      if (!list.length) { G.toast('木取りの作品が見つかりませんでした'); return; }
      return Promise.all(list.map(function (a) { return G.store.put(a); })).then(function () {
        setProject(list[0]);
        G.toast(list.length > 1 ? list.length + ' 件を読み込み、1件目を開きました' : '「' + list[0].title + '」を読み込みました');
      });
    }).catch(function (e) { G.toast(e.message); });
  });

  // 起動: 前回の作品を開く
  var lastId = null;
  try { lastId = localStorage.getItem('kidori.last'); } catch (e) {}
  (lastId ? G.store.get(lastId) : Promise.resolve(null)).then(function (a) {
    if (a && a.app === APP) setProject(a); else newProject();
  }).catch(function () { newProject(); });
})();
