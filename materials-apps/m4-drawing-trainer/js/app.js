/* M4 製図トレーナー 画面 */
(function () {
  'use strict';
  var G = window.G, M = window.M4Core, V3 = window.M4View3D, SV = window.M4SVG, SK = window.M4Sketch, T = window.M4Terms;
  var APP = 'drawing-trainer';
  var h = G.h;

  G.ruby.add(window.M4_RUBY || {});
  G.initApp({
    app: APP,
    title: '製図トレーナー',
    files: ['index.html', 'style.css', 'js/drawing-core.js', 'js/view3d.js', 'js/svgviews.js', 'js/sketch.js',
      'js/terms-data.js', 'js/ruby-words.js', 'js/app.js', 'icon.svg']
  });

  /* ---------- 問題(決まった種から毎回同じものをつくる) ---------- */
  function setOf(prefix, parts) {
    var out = [];
    parts.forEach(function (p) {
      M.problemSet(p[0], p[1], p[2]).forEach(function (s) {
        out.push({ id: prefix + (out.length + 1), solid: s, level: p[1] });
      });
    });
    return out;
  }
  var QUIZ = {
    1: setOf('q1-', [[1001, 1, 10]]),
    2: setOf('q2-', [[1002, 2, 10]]),
    3: setOf('q3-', [[1003, 3, 10]])
  };
  var BUILD = setOf('b', [[2001, 1, 3], [2002, 2, 4], [2003, 3, 3]]);
  var DRAW = setOf('d', [[3001, 1, 3], [3002, 2, 4], [3003, 3, 3]]);
  var ISO = setOf('i', [[4001, 1, 3], [4002, 2, 3], [4003, 3, 2]]);
  var LEVEL_NAME = { 1: 'やさしい', 2: 'ふつう', 3: 'むずかしい' };
  var VIEW_NAME = { front: '正面図', top: '平面図', right: '右側面図' };
  var VIEW_DIR = { front: '正面(手前)から', top: '真上から', right: '右から' };

  /* ---------- 記録(共通スキーマ artifact で保存) ---------- */
  var REC_ID = 'drawing-trainer-record';
  var rec = G.newArtifact(APP, '製図トレーナーの記録', emptyData(), 'progress');
  rec.id = REC_ID;
  function emptyData() { return { name: '', quiz: {}, build: {}, draw: {}, iso: {}, terms: { best: null, history: [] }, reflect: { self: {}, learned: '', hard: '', use: '' } }; }
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      G.store.put(rec).catch(function () { G.toast('記録を保存できませんでした'); });
    }, 300);
  }
  function mergeData(d) {
    var base = emptyData();
    Object.keys(base).forEach(function (k) { if (d && d[k] !== undefined) base[k] = d[k]; });
    return base;
  }

  /* ---------- 共通の小部品 ---------- */
  function svgNode(str) {
    var d = document.createElement('div');
    d.innerHTML = str;
    return d.firstChild;
  }
  // 問題を選ぶ列(状態は記号 ✓ / × / ・ で示す)
  function problemNav(list, getState, onPick, cur) {
    var nav = h('div', { class: 'm4-nav', role: 'group', 'aria-label': '問題を選ぶ' });
    list.forEach(function (p, i) {
      var st = getState(p);
      var sym = st === 'ok' ? '✓' : st === 'ng' ? '×' : '';
      nav.appendChild(h('button', {
        class: 'btn small m4-nav-btn' + (st ? ' ' + st : ''), type: 'button', 'aria-current': i === cur ? 'true' : null,
        'aria-label': '問題 ' + (i + 1) + (st === 'ok' ? '(できた)' : st === 'ng' ? '(まちがえた)' : ''),
        onclick: function () { onPick(i); }
      }, String(i + 1), sym ? h('span', { class: 'm4-nav-sym', 'aria-hidden': 'true' }, sym) : null));
    });
    return nav;
  }
  function legendLines() {
    return h('ul', { class: 'g-legend m4-legend' },
      h('li', null, svgNode('<svg width="40" height="12" aria-hidden="true"><line class="m4-vis" x1="2" y1="6" x2="38" y2="6"/></svg>'), ' 外形線(見える線)'),
      h('li', null, svgNode('<svg width="40" height="12" aria-hidden="true"><line class="m4-hid" x1="2" y1="6" x2="38" y2="6"/></svg>'), ' かくれ線(見えない線)'));
  }

  /* ================= 1. 三面図クイズ ================= */
  var quizState = { level: 1, idx: 0 };
  var quizCache = {};
  function quizOf(p) {
    if (!quizCache[p.id]) {
      var seed = p.level * 100 + Number(p.id.split('-')[1]) - 1; // tests/run-tests.js と同じ種
      quizCache[p.id] = M.makeQuiz(seed, p.solid);
    }
    return quizCache[p.id];
  }
  var KIND_EXPLAIN = {
    mirror: '右側面図の左右が逆になっています。右から見ると、品物の正面(手前)は図の左側にきます。',
    flipTop: '平面図の上下が逆になっています。第三角法では、平面図の下側(正面図に近い側)が品物の正面(手前)です。',
    hiddenAsSolid: '見えない部分の線を、外形線(実線)でかいています。見えない線はかくれ線(破線)でかきます。',
    noHidden: '見えない部分の線(かくれ線)がぬけています。奥にあって見えない段差やくぼみも、破線でかきます。',
    shape: '形がちがいます。ブロックの位置や高さを、正面・上・右の3方向から確かめましょう。'
  };
  function renderQuiz() {
    var root = G.$('[data-panel="quiz"]');
    root.innerHTML = '';
    var list = QUIZ[quizState.level], p = list[quizState.idx], q = quizOf(p);
    var done = rec.data.quiz[p.id];

    var levelBar = h('div', { class: 'g-row', role: 'group', 'aria-label': 'むずかしさ' },
      [1, 2, 3].map(function (lv) {
        var n = QUIZ[lv].filter(function (x) { return rec.data.quiz[x.id] && rec.data.quiz[x.id].first; }).length;
        var on = lv === quizState.level;
        return h('button', { class: 'btn m4-level' + (on ? ' primary' : ''), type: 'button', 'aria-pressed': String(on),
          onclick: function () { quizState.level = lv; quizState.idx = 0; renderQuiz(); } },
          on ? h('span', { class: 'm4-level-mark', 'aria-hidden': 'true' }, '✓') : null,
          LEVEL_NAME[lv] + ' ', h('span', { class: 'badge m4-level-badge' }, n + '/10'));
      }));
    var nav = problemNav(list, function (x) {
      var r = rec.data.quiz[x.id]; return r ? (r.first ? 'ok' : 'ng') : '';
    }, function (i) { quizState.idx = i; renderQuiz(); }, quizState.idx);

    var v = V3.widget();
    var opts = h('div', { class: 'm4-options', role: 'group', 'aria-label': '三面図の選択肢' });
    var result = h('div', { class: 'm4-result', 'aria-live': 'polite' });
    var LBL = ['ア', 'イ', 'ウ', 'エ'];
    var answered = !!(done && done.answered);
    q.options.forEach(function (o, i) {
      var b = h('button', { class: 'm4-option', type: 'button', 'aria-label': '選択肢 ' + LBL[i],
        onclick: function () { choose(i); } },
        h('span', { class: 'm4-option-lbl' }, LBL[i]),
        svgNode(SV.threeView(o.views, { cell: 36, aria: '選択肢' + LBL[i] + 'の三面図' })));
      opts.appendChild(b);
    });
    // 4つの図を同じ縮尺にそろえる(いちばん幅の広い図をカードの幅いっぱいにする)
    (function () {
      var svgs = G.$$('.m4-option .m4-views', opts), ws = svgs.map(function (el) { return Number(el.getAttribute('width')) || 1; });
      var maxW = Math.max.apply(null, ws);
      svgs.forEach(function (el, i) { el.style.width = (ws[i] / maxW * 100).toFixed(1) + '%'; el.style.maxWidth = ws[i] + 'px'; });
    })();
    function mark(chosen) {
      G.$$('.m4-option', opts).forEach(function (b, i) {
        b.classList.toggle('is-answer', i === q.answer);
        b.classList.toggle('is-wrong', i === chosen && i !== q.answer);
        var tag = G.$('.m4-option-tag', b);
        if (tag) tag.remove();
        if (i === q.answer) b.appendChild(h('span', { class: 'badge ok m4-option-tag' }, '○ 正解'));
        else if (i === chosen) b.appendChild(h('span', { class: 'badge ng m4-option-tag' }, '× えらんだ図'));
      });
    }
    function choose(i) {
      var r = rec.data.quiz[p.id] || { tries: 0 };
      if (!r.answered) { r.first = i === q.answer; }
      r.tries++; r.answered = true; r.last = i;
      rec.data.quiz[p.id] = r; save();
      mark(i);
      result.innerHTML = '';
      if (i === q.answer) result.appendChild(h('p', { class: 'm4-ok' }, '○ 正解です。'));
      else {
        result.appendChild(h('p', { class: 'm4-ng' }, '× ちがいます。'));
        result.appendChild(h('p', null, KIND_EXPLAIN[q.options[i].kind] || ''));
      }
      result.appendChild(h('div', { class: 'g-row' },
        h('button', { class: 'btn', type: 'button', onclick: function () { v.setView('front'); } }, '正面から見てみる'),
        h('button', { class: 'btn', type: 'button', onclick: function () { v.setView('top'); } }, '上から見てみる'),
        h('button', { class: 'btn', type: 'button', onclick: function () { v.setView('right'); } }, '右から見てみる'),
        quizState.idx < list.length - 1 ? h('button', { class: 'btn primary', type: 'button', onclick: function () { quizState.idx++; renderQuiz(); } }, '次の問題 ▶') : null));
      nav.replaceWith(nav = problemNav(list, function (x) {
        var rr = rec.data.quiz[x.id]; return rr ? (rr.first ? 'ok' : 'ng') : '';
      }, function (k) { quizState.idx = k; renderQuiz(); }, quizState.idx));
    }

    root.appendChild(h('div', { class: 'card' },
      h('h2', null, '三面図クイズ'),
      h('p', null, '左の立体を第三角法でかいた三面図はどれですか。立体はドラッグや矢印キーで回せます。'),
      levelBar, nav));
    root.appendChild(h('div', { class: 'm4-cols' },
      h('div', { class: 'card' }, h('h3', null, '問題 ' + (quizState.idx + 1) + '(' + LEVEL_NAME[quizState.level] + ')'), v.el),
      h('div', { class: 'card' }, h('h3', null, '正しい三面図をえらぶ'), legendLines(), opts, result)));
    v.setSolid(p.solid);
    if (answered && done.last !== undefined) mark(done.last);
  }

  /* ================= 2. 立体づくり(三面図 → 立体) ================= */
  var buildState = { idx: 0, heights: {} };
  function renderBuild() {
    var root = G.$('[data-panel="build"]');
    root.innerHTML = '';
    var p = BUILD[buildState.idx], s = p.solid, target = M.threeViews(s);
    var maxH = Math.max(3, s.h);
    var hm = buildState.heights[p.id] || (buildState.heights[p.id] = s.d ? emptyHeights(s.w, s.d) : []);
    function emptyHeights(w, d) { var o = []; for (var y = 0; y < d; y++) { var r = []; for (var x = 0; x < w; x++) r.push(0); o.push(r); } return o; }

    var nav = problemNav(BUILD, function (x) { var r = rec.data.build[x.id]; return r ? (r.ok ? 'ok' : 'ng') : ''; },
      function (i) { buildState.idx = i; renderBuild(); }, buildState.idx);
    var v = V3.widget();
    var countEl = h('p', { class: 'm4-count', 'aria-live': 'polite' });
    var result = h('div', { class: 'm4-result', 'aria-live': 'polite' });

    // 上から見た台(奥が上、手前が下)。数字はそのマスに積むブロックの数
    var grid = h('div', { class: 'm4-base', role: 'grid', 'aria-label': '台のマス。数字は積んだブロックの数。上が奥、下が正面(手前)。' });
    grid.style.gridTemplateColumns = 'repeat(' + s.w + ', 3.4rem)';
    for (var row = s.d - 1; row >= 0; row--) {
      for (var x = 0; x < s.w; x++) (function (y, x) {
        var b = h('button', { class: 'm4-cell', type: 'button' });
        function paint() {
          b.textContent = String(hm[y][x]);
          b.setAttribute('data-h', hm[y][x]);
          b.setAttribute('aria-label', '左から' + (x + 1) + '列め、手前から' + (y + 1) + '列め、ブロック ' + hm[y][x] + ' 個');
        }
        function change(dv) { hm[y][x] = (hm[y][x] + dv + maxH + 1) % (maxH + 1); paint(); update(); }
        b.addEventListener('click', function () { change(1); });
        b.addEventListener('contextmenu', function (e) { e.preventDefault(); change(-1); });
        b.addEventListener('keydown', function (e) {
          if (e.key === '+' || e.key === 'ArrowUp') { e.preventDefault(); change(1); }
          if (e.key === '-' || e.key === 'ArrowDown' || e.key === 'Backspace') { e.preventDefault(); change(-1); }
          if (/^[0-9]$/.test(e.key) && Number(e.key) <= maxH) { hm[y][x] = Number(e.key); paint(); update(); }
        });
        paint();
        grid.appendChild(b);
      })(row, x);
    }
    function current() { return M.trim(M.fromHeights(hm, 1)); }
    function update() {
      var n = hm.reduce(function (a, r) { return a + r.reduce(function (b, c) { return b + c; }, 0); }, 0);
      countEl.textContent = '積んだブロック: ' + n + ' 個';
      v.setSolid(n ? M.fromHeights(hm, 1) : M.makeSolid(s.w, s.d, 1));
      result.innerHTML = '';
    }
    function check() {
      var mine = current(), mv = M.threeViews(mine), n = M.count(mine);
      result.innerHTML = '';
      if (!n) { result.appendChild(h('p', null, 'ブロックを積んでから答え合わせしましょう。')); return; }
      var okAll = n > 0 && M.sameViews(mv, target);
      var r = rec.data.build[p.id] || { tries: 0 };
      r.tries++; if (okAll) r.ok = true; else if (!r.ok) r.ok = false;
      rec.data.build[p.id] = r; save();
      if (okAll) {
        result.appendChild(h('p', { class: 'm4-ok' }, '○ 正解です。3つの図がすべて合っています。'));
        result.appendChild(h('p', { class: 'g-muted' }, '三面図に合う積み方は、1つとは限りません。ブロックの数を変えても同じ三面図になる積み方がないか、考えてみましょう。'));
      } else {
        result.appendChild(h('p', { class: 'm4-ng' }, '× まだ合っていません。'));
        var ul = h('ul', { class: 'm4-check-list' });
        M.VIEWS.forEach(function (vw) {
          var same = n > 0 && mv[vw].dims.U === target[vw].dims.U && mv[vw].dims.V === target[vw].dims.V &&
            mv[vw].visible.join() === target[vw].visible.join() && mv[vw].hidden.join() === target[vw].hidden.join();
          ul.appendChild(h('li', null, (same ? '○ ' : '× ') + VIEW_NAME[vw] + (same ? ' は合っています' : ' がちがいます')));
        });
        result.appendChild(ul);
        if (n) result.appendChild(h('div', null, h('p', { class: 'g-muted' }, 'いま積んだ立体の三面図:'),
          svgNode(SV.threeView(mv, { cell: 18, aria: 'いま積んだ立体の三面図' }))));
      }
      nav.replaceWith(nav = problemNav(BUILD, function (x) { var rr = rec.data.build[x.id]; return rr ? (rr.ok ? 'ok' : 'ng') : ''; },
        function (i) { buildState.idx = i; renderBuild(); }, buildState.idx));
    }

    root.appendChild(h('div', { class: 'card' },
      h('h2', null, '立体づくり(三面図から立体へ)'),
      h('p', null, '三面図を読んで、台の上にブロックを積みましょう。マスを押すと1個ずつ増えます(右クリック・↓キーで減る)。'),
      nav));
    root.appendChild(h('div', { class: 'm4-cols' },
      h('div', { class: 'card' }, h('h3', null, '問題 ' + (buildState.idx + 1) + ' の三面図'),
        legendLines(),
        svgNode(SV.threeView(target, { cell: 30, guides: true, aria: '問題の三面図' })),
        h('p', { class: 'g-muted' }, '台の大きさ: 横 ' + s.w + ' マス × 奥行き ' + s.d + ' マス。1マスにつき ' + maxH + ' 個まで積めます。')),
      h('div', { class: 'card' }, h('h3', null, '台の上に積む(上から見た図)'),
        h('div', { class: 'm4-base-wrap' }, h('span', { class: 'm4-base-lbl' }, '奥'), grid, h('span', { class: 'm4-base-lbl' }, '▼ 正面(手前)')),
        countEl, v.el,
        h('div', { class: 'g-row' },
          h('button', { class: 'btn primary', type: 'button', 'data-act': 'check', onclick: check }, '答え合わせ'),
          h('button', { class: 'btn', type: 'button', onclick: function () { buildState.heights[p.id] = null; renderBuild(); } }, 'やり直す')),
        result)));
    update();
  }

  /* ================= 3. 三面図をかく ================= */
  var drawState = { idx: 0, view: 'front', drawings: {}, hint: {} };
  function renderDraw() {
    var root = G.$('[data-panel="draw"]');
    root.innerHTML = '';
    var p = DRAW[drawState.idx], s = p.solid, view = drawState.view;
    var exp = M.orthoLines(s, view), key = p.id + ':' + view;
    var recP = rec.data.draw[p.id] || (rec.data.draw[p.id] = {});

    function stateOf(x) {
      var r = rec.data.draw[x.id]; if (!r) return '';
      var n = M.VIEWS.filter(function (vw) { return r[vw]; }).length;
      return n === 3 ? 'ok' : '';
    }
    var nav = problemNav(DRAW, stateOf, function (i) { drawState.idx = i; renderDraw(); }, drawState.idx);
    var v = V3.widget();
    var viewTabs = h('div', { class: 'g-row', role: 'group', 'aria-label': 'かく図' },
      M.VIEWS.map(function (vw) {
        return h('button', { class: 'btn' + (vw === view ? ' primary' : ''), type: 'button', 'data-view': vw, 'aria-pressed': String(vw === view),
          onclick: function () { drawState.view = vw; renderDraw(); } }, VIEW_NAME[vw], recP[vw] ? ' ✓' : '');
      }));
    var result = h('div', { class: 'm4-result', 'aria-live': 'polite' });
    var hintBox = h('div', { class: 'm4-hintbox', 'aria-live': 'polite' });
    var board = SK.create({ mode: 'square', cols: 8, rows: 6, cell: 44, tools: ['v', 'h', 'erase'],
      label: VIEW_NAME[view] + 'をかくボード。矢印キーで点を動かし、スペースキーで線の始めと終わりを決めます。1 外形線、2 かくれ線、3 消しゴム。',
      onChange: function (d) { drawState.drawings[key] = d; result.innerHTML = ''; } });
    if (drawState.drawings[key]) board.setDrawn(drawState.drawings[key]);
    var hintLevel = drawState.hint[key] || 0;

    function offset() {
      var d = board.getDrawn();
      if (!Object.keys(d).length) return [1, 1];
      return M.grade(exp, d).offset;
    }
    function showHint() {
      hintBox.innerHTML = '';
      var nodes = [];
      if (hintLevel >= 1) {
        var D = M.viewDims(s, view), off = offset();
        // 図の外形になる範囲(ブロックが見える範囲)をうすく塗る
        for (var u = 0; u < D.U; u++) for (var vv = 0; vv < D.V; vv++) {
          var filled = false;
          for (var k = 0; k < D.K; k++) if (M.cellAt(s, view, u, vv, k)) { filled = true; break; }
          if (!filled) continue;
          var a = board.toXY(u + off[0], vv + off[1]), b = board.toXY(u + off[0] + 1, vv + off[1] + 1);
          nodes.push(SK.svgEl('rect', { x: a[0], y: a[1], width: b[0] - a[0], height: b[1] - a[1] }));
        }
        hintBox.appendChild(h('p', null, 'ヒント1: ' + VIEW_DIR[view] + '見た形です。うすく塗った範囲が、この図の外形(輪郭)になります。大きさは 横 ' + D.U + ' マス × 縦 ' + D.V + ' マスです。'));
        v.setView(view);
      }
      if (hintLevel >= 2) {
        hintBox.appendChild(h('p', null, 'ヒント2: 外形線は ' + M.mergeSegments(exp.visible).length + ' 本、かくれ線は ' + M.mergeSegments(exp.hidden).length +
          ' 本です(まっすぐつながった線を1本と数えます)。'));
      }
      if (hintLevel >= 3) {
        var g = M.grade(exp, board.getDrawn());
        var miss = g.missing.concat(g.wrongType);
        if (miss.length) {
          var pk = M.parseKey(miss[0].key), a3 = board.toXY(pk[0], pk[1]), b3 = board.toXY(pk[2], pk[3]);
          nodes.push(SK.svgEl('line', { class: 'm4-hint-line' + (miss[0].type === 'h' ? ' dash' : ''), x1: a3[0], y1: a3[1], x2: b3[0], y2: b3[1] }));
          hintBox.appendChild(h('p', null, 'ヒント3: 足りない線を1つ、太い点線の枠で示しました(' + (miss[0].type === 'h' ? 'かくれ線' : '外形線') + ')。'));
        } else hintBox.appendChild(h('p', null, 'ヒント3: 足りない線はありません。余分な線がないか確かめましょう。'));
      }
      board.setHint(nodes);
    }
    function check() {
      var g = M.grade(exp, board.getDrawn());
      board.showFeedback(g);
      result.innerHTML = '';
      if (g.ok) {
        recP[view] = true; save();
        result.appendChild(h('p', { class: 'm4-ok' }, '○ 正解です。' + VIEW_NAME[view] + 'が正しくかけました。'));
        var next = M.VIEWS.filter(function (vw) { return !recP[vw]; })[0];
        if (next) result.appendChild(h('button', { class: 'btn primary', type: 'button', onclick: function () { drawState.view = next; renderDraw(); } }, VIEW_NAME[next] + 'をかく ▶'));
        else if (drawState.idx < DRAW.length - 1) result.appendChild(h('button', { class: 'btn primary', type: 'button', onclick: function () { drawState.idx++; drawState.view = 'front'; renderDraw(); } }, '次の問題 ▶'));
      } else {
        result.appendChild(h('p', { class: 'm4-ng' }, '× まだちがうところがあります。'));
        var ul = h('ul', { class: 'm4-check-list' });
        if (g.missing.length) ul.appendChild(h('li', null, '○ の線が足りません(' + g.missing.length + ' か所)'));
        if (g.extra.length) ul.appendChild(h('li', null, '× の線は余分です(' + g.extra.length + ' か所)'));
        if (g.wrongType.length) ul.appendChild(h('li', null, '△ の線は線の種類がちがいます。外形線とかくれ線を確かめましょう(' + g.wrongType.length + ' か所)'));
        result.appendChild(ul);
      }
    }

    root.appendChild(h('div', { class: 'card' },
      h('h2', null, '三面図をかく'),
      h('p', null, '立体を見て、' + '正面図・平面図・右側面図を方眼にかきましょう。点から点へドラッグすると線が引けます。見えない部分はかくれ線でかきます。'),
      nav));
    root.appendChild(h('div', { class: 'm4-cols' },
      h('div', { class: 'card' }, h('h3', null, '問題 ' + (drawState.idx + 1) + ' の立体'), v.el,
        h('p', { class: 'g-muted' }, '第三角法: 平面図は正面図の上、右側面図は正面図の右に置きます。')),
      h('div', { class: 'card' },
        h('h3', null, VIEW_NAME[view] + 'をかく(' + VIEW_DIR[view] + '見た図)'), viewTabs,
        board.el,
        h('div', { class: 'g-row' },
          h('button', { class: 'btn primary', type: 'button', 'data-act': 'check', onclick: check }, '答え合わせ'),
          h('button', { class: 'btn', type: 'button', 'data-act': 'hint', onclick: function () { hintLevel = Math.min(3, hintLevel + 1); drawState.hint[key] = hintLevel; showHint(); } }, 'ヒント'),
          h('button', { class: 'btn', type: 'button', onclick: function () {
            var g = M.grade(exp, board.getDrawn());
            board.showFeedback({ missing: g.missing, extra: [], wrongType: g.wrongType });
            result.innerHTML = '';
            result.appendChild(h('p', null, '○ の線が正解の線です(太い点線の枠)。自分でかき直して、答え合わせしましょう。'));
          } }, '答えを見る')),
        h('p', { class: 'g-muted m4-marks' }, '答え合わせの記号: ○ 足りない線 / × 余分な線 / △ 線の種類ちがい'),
        hintBox, result)));
    v.setSolid(s);
    if (hintLevel) showHint();
  }

  /* ================= 4. 等角図をかく ================= */
  var isoState = { idx: 0, drawings: {}, hint: {} };
  function renderIso() {
    var root = G.$('[data-panel="iso"]');
    root.innerHTML = '';
    var p = ISO[isoState.idx], s = p.solid, exp = M.isoLines(s), key = p.id;
    var nav = problemNav(ISO, function (x) { var r = rec.data.iso[x.id]; return r ? (r.ok ? 'ok' : 'ng') : ''; },
      function (i) { isoState.idx = i; renderIso(); }, isoState.idx);
    var result = h('div', { class: 'm4-result', 'aria-live': 'polite' });
    var hintBox = h('div', { class: 'm4-hintbox', 'aria-live': 'polite' });
    var board = SK.create({ mode: 'iso', iMax: 12, jMax: 16, cell: 34, tools: ['v', 'erase'],
      label: '等角図をかくボード。矢印キーで点を動かし(Q E Z C でななめ)、スペースキーで線の始めと終わりを決めます。',
      onChange: function (d) { isoState.drawings[key] = d; result.innerHTML = ''; } });
    if (isoState.drawings[key]) board.setDrawn(isoState.drawings[key]);
    var hintLevel = isoState.hint[key] || 0;
    var v3wrap = h('div');

    function offset() {
      var d = board.getDrawn();
      if (Object.keys(d).length) return M.grade(exp, d).offset;
      var dj = s.d + 2 * s.h + 2; if (dj % 2) dj++;
      return [2, dj];
    }
    function showHint() {
      hintBox.innerHTML = ''; v3wrap.innerHTML = '';
      var nodes = [];
      if (hintLevel >= 1) {
        // 補助線: 立体がちょうど入る直方体(箱)をうすくかく
        var off = offset(), W = s.w, D = s.d, Hh = s.h;
        var corners = [[0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0], [0, 0, Hh], [W, 0, Hh], [W, D, Hh], [0, D, Hh]];
        var pts = corners.map(function (c) { var q = M.isoPoint(c[0], c[1], c[2]); return board.toXY(q[0] + off[0], q[1] + off[1]); });
        [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(function (e) {
          nodes.push(SK.svgEl('line', { class: 'm4-box', x1: pts[e[0]][0], y1: pts[e[0]][1], x2: pts[e[1]][0], y2: pts[e[1]][1] }));
        });
        hintBox.appendChild(h('p', null, 'ヒント1: 立体がちょうど入る箱(横 ' + W + '・奥行き ' + D + '・高さ ' + Hh + ')を補助線でかきました。この箱からいらない部分をけずるように考えます。'));
      }
      if (hintLevel >= 2) {
        var v = V3.widget();
        v3wrap.appendChild(h('p', { class: 'g-muted' }, 'ヒント2: 立体の見本(回せます)'));
        v3wrap.appendChild(v.el);
        v.setSolid(s);
      }
      if (hintLevel >= 3) {
        var g = M.grade(exp, board.getDrawn());
        if (g.missing.length) {
          var pk = M.parseKey(g.missing[0].key), a = board.toXY(pk[0], pk[1]), b = board.toXY(pk[2], pk[3]);
          nodes.push(SK.svgEl('line', { class: 'm4-hint-line', x1: a[0], y1: a[1], x2: b[0], y2: b[1] }));
          hintBox.appendChild(h('p', null, 'ヒント3: 足りない線を1つ示しました。'));
        } else hintBox.appendChild(h('p', null, 'ヒント3: 足りない線はありません。余分な線がないか確かめましょう。'));
      }
      board.setHint(nodes);
    }
    function check() {
      var g = M.grade(exp, board.getDrawn());
      board.showFeedback(g);
      result.innerHTML = '';
      var r = rec.data.iso[p.id] || { tries: 0 };
      r.tries++; if (g.ok) r.ok = true; else if (!r.ok) r.ok = false;
      rec.data.iso[p.id] = r; save();
      if (g.ok) {
        result.appendChild(h('p', { class: 'm4-ok' }, '○ 正解です。等角図が正しくかけました。'));
        if (isoState.idx < ISO.length - 1) result.appendChild(h('button', { class: 'btn primary', type: 'button', onclick: function () { isoState.idx++; renderIso(); } }, '次の問題 ▶'));
      } else {
        result.appendChild(h('p', { class: 'm4-ng' }, '× まだちがうところがあります。'));
        var ul = h('ul', { class: 'm4-check-list' });
        if (g.missing.length) ul.appendChild(h('li', null, '○ の線が足りません(' + g.missing.length + ' か所)'));
        if (g.extra.length) ul.appendChild(h('li', null, '× の線は余分です。等角図では、見えない線はかきません(' + g.extra.length + ' か所)'));
        result.appendChild(ul);
      }
      nav.replaceWith(nav = problemNav(ISO, function (x) { var rr = rec.data.iso[x.id]; return rr ? (rr.ok ? 'ok' : 'ng') : ''; },
        function (i) { isoState.idx = i; renderIso(); }, isoState.idx));
    }

    root.appendChild(h('div', { class: 'card' },
      h('h2', null, '等角図をかく'),
      h('p', null, '三面図を読んで、立体を等角図でかきましょう。高さは縦、横と奥行きは右下・右上の向き(水平から30°)に引きます。見える線だけをかきます。'),
      nav));
    root.appendChild(h('div', { class: 'm4-cols' },
      h('div', { class: 'card' }, h('h3', null, '問題 ' + (isoState.idx + 1) + ' の三面図'), legendLines(),
        svgNode(SV.threeView(M.threeViews(s), { cell: 28, guides: true, aria: '問題の三面図' })),
        h('p', { class: 'g-muted' }, '等角図は、右手前の上から見たようにかきます。正面は左下の面、右側面は右下の面になります。'),
        v3wrap),
      h('div', { class: 'card' }, h('h3', null, '等角図をかく'),
        board.el,
        h('div', { class: 'g-row' },
          h('button', { class: 'btn primary', type: 'button', 'data-act': 'check', onclick: check }, '答え合わせ'),
          h('button', { class: 'btn', type: 'button', 'data-act': 'hint', onclick: function () { hintLevel = Math.min(3, hintLevel + 1); isoState.hint[key] = hintLevel; showHint(); } }, 'ヒント'),
          h('button', { class: 'btn', type: 'button', onclick: function () {
            var g = M.grade(exp, board.getDrawn());
            board.showFeedback({ missing: g.missing, extra: [], wrongType: [] });
            result.innerHTML = '';
            result.appendChild(h('p', null, '○ の線が正解の線です。自分でかき直して、答え合わせしましょう。'));
          } }, '答えを見る')),
        h('p', { class: 'g-muted m4-marks' }, '答え合わせの記号: ○ 足りない線 / × 余分な線'),
        hintBox, result)));
    if (hintLevel) showHint();
  }

  /* ================= 5. 線と記号のテスト ================= */
  var termState = null;
  function newTermTest() {
    var r = M.rng(Date.now() & 0xffffffff);
    var order = M.shuffle(r, T.BANK.map(function (_, i) { return i; })).slice(0, 10);
    termState = { order: order, idx: 0, score: 0, answered: false, shuffles: order.map(function (qi) {
      return M.shuffle(r, T.BANK[qi].c.map(function (_, k) { return k; }));
    }) };
  }
  function renderTerms() {
    var root = G.$('[data-panel="terms"]');
    root.innerHTML = '';
    if (!termState) newTermTest();
    var st = termState;
    var best = rec.data.terms.best;
    var head = h('div', { class: 'card' }, h('h2', null, '線と記号のミニテスト'),
      h('p', null, '製図で使う線の種類や、寸法の記入のしかた・記号を確かめます。全部で10問です。'),
      best !== null ? h('p', { class: 'g-muted' }, 'これまでの最高: ' + best + ' / 10') : null);
    root.appendChild(head);
    if (st.idx >= st.order.length) {
      root.appendChild(h('div', { class: 'card' }, h('h3', null, '結果'),
        h('p', { class: 'm4-big' }, st.score + ' / 10 問 正解'),
        h('button', { class: 'btn primary', type: 'button', onclick: function () { newTermTest(); renderTerms(); } }, 'もう一度(問題が入れかわります)')));
      return;
    }
    var q = T.BANK[st.order[st.idx]], sh = st.shuffles[st.idx];
    var result = h('div', { class: 'm4-result', 'aria-live': 'polite' });
    var choices = h('div', { class: 'm4-choices', role: 'group', 'aria-label': '答えをえらぶ' });
    sh.forEach(function (ci, k) {
      choices.appendChild(h('button', { class: 'btn m4-choice', type: 'button', onclick: function () { answer(ci, k); } },
        h('span', { class: 'm4-choice-num', 'aria-hidden': 'true' }, String(k + 1)), q.c[ci]));
    });
    function answer(ci, k) {
      if (st.answered) return;
      st.answered = true;
      var ok = ci === q.a;
      if (ok) st.score++;
      G.$$('.m4-choice', choices).forEach(function (b, kk) {
        b.disabled = true;
        if (sh[kk] === q.a) { b.classList.add('is-answer'); b.appendChild(h('span', { class: 'badge ok' }, '○ 正解')); }
        else if (kk === k) { b.classList.add('is-wrong'); b.appendChild(h('span', { class: 'badge ng' }, '× えらんだ答え')); }
      });
      result.appendChild(h('p', { class: ok ? 'm4-ok' : 'm4-ng' }, ok ? '○ 正解です。' : '× ちがいます。'));
      result.appendChild(h('p', null, q.e));
      var last = st.idx === st.order.length - 1;
      result.appendChild(h('button', { class: 'btn primary', type: 'button', onclick: function () {
        st.idx++; st.answered = false;
        if (st.idx >= st.order.length) {
          var t = rec.data.terms;
          t.history.push({ at: new Date().toISOString(), score: st.score });
          if (t.history.length > 30) t.history.shift();
          t.best = Math.max(t.best || 0, st.score);
          save();
        }
        renderTerms();
      } }, last ? '結果を見る ▶' : '次の問題 ▶'));
      var nb = G.$('.m4-result .btn.primary', root); if (nb) nb.focus();
    }
    root.appendChild(h('div', { class: 'card m4-term' },
      h('h3', null, '第 ' + (st.idx + 1) + ' 問(全 10 問)'),
      q.fig ? svgNode(T.FIGS[q.fig]) : null,
      h('p', { class: 'm4-q' }, q.q), choices, result));
    root.onkeydown = function (e) {
      if (st.answered || !/^[1-4]$/.test(e.key) || e.target.tagName === 'INPUT') return;
      var b = G.$$('.m4-choice', choices)[Number(e.key) - 1]; if (b) b.click();
    };
  }

  /* ================= 6. 記録 ================= */
  function renderRecord() {
    var root = G.$('[data-panel="record"]');
    root.innerHTML = '';
    var d = rec.data;
    function cnt(obj, list, fn) { return list.filter(function (p) { return obj[p.id] && fn(obj[p.id]); }).length; }
    var rows = [
      ['三面図クイズ ' + LEVEL_NAME[1], cnt(d.quiz, QUIZ[1], function (r) { return r.first; }) + ' / 10(1回目で正解)'],
      ['三面図クイズ ' + LEVEL_NAME[2], cnt(d.quiz, QUIZ[2], function (r) { return r.first; }) + ' / 10(1回目で正解)'],
      ['三面図クイズ ' + LEVEL_NAME[3], cnt(d.quiz, QUIZ[3], function (r) { return r.first; }) + ' / 10(1回目で正解)'],
      ['立体づくり', cnt(d.build, BUILD, function (r) { return r.ok; }) + ' / ' + BUILD.length],
      ['三面図をかく', cnt(d.draw, DRAW, function (r) { return r.front && r.top && r.right; }) + ' / ' + DRAW.length + '(3つの図すべて)'],
      ['等角図をかく', cnt(d.iso, ISO, function (r) { return r.ok; }) + ' / ' + ISO.length],
      ['線と記号のテスト', d.terms.best === null ? 'まだ' : '最高 ' + d.terms.best + ' / 10(' + d.terms.history.length + ' 回)']
    ];
    var nameIn = h('input', { type: 'text', id: 'm4-name', value: d.name || '', maxlength: '40', autocomplete: 'off' });
    nameIn.addEventListener('change', function () { d.name = nameIn.value.trim(); rec.title = '製図トレーナーの記録' + (d.name ? '(' + d.name + ')' : ''); save(); });
    root.appendChild(h('div', { class: 'card' }, h('h2', null, '記録'),
      h('p', null, '記録はこの端末に自動で保存されます。先生に出すときや、別の端末に移すときは、ファイルに書き出してください。'),
      h('div', { class: 'g-field' }, h('label', { for: 'm4-name' }, '名前(書き出すファイルに入ります)'), nameIn),
      h('div', { class: 'g-table-wrap' }, h('table', { class: 'g-table' },
        h('thead', null, h('tr', null, h('th', null, '練習'), h('th', null, 'できたこと'))),
        h('tbody', null, rows.map(function (r) { return h('tr', null, h('td', null, r[0]), h('td', null, r[1])); })))),
      h('div', { class: 'g-row', style: { marginTop: '.75rem' } },
        h('button', { class: 'btn primary', type: 'button', 'data-act': 'export', onclick: function () {
          var stamp = new Date().toISOString().slice(0, 10);
          G.exportJSON(rec, 'drawing-trainer-' + (d.name || 'record') + '-' + stamp + '.json');
        } }, 'ファイルに書き出す'),
        h('button', { class: 'btn', type: 'button', onclick: function () {
          G.pickJSON().then(function (obj) {
            var list = G.normalizeImport(obj, APP);
            if (!list.length) { G.toast('製図トレーナーの記録が見つかりませんでした'); return; }
            var a = list[0];
            G.confirm('「' + (a.title || '記録') + '」を読み込みます。いまの記録は置きかわります。', '読み込む').then(function (ok) {
              if (!ok) return;
              rec.data = mergeData(a.data); rec.title = a.title || rec.title;
              save(); G.toast('記録を読み込みました'); renderAll();
            });
          }).catch(function (e) { G.toast(e.message); });
        } }, 'ファイルから読み込む'),
        h('button', { class: 'btn danger', type: 'button', onclick: function () {
          G.confirm('この端末の記録をすべて消します。もとに戻せません。', '消す').then(function (ok) {
            if (!ok) return;
            rec.data = emptyData(); save(); renderAll();
          });
        } }, '記録を消す'))));
    root.appendChild(renderReflect());
  }

  /* ---------- ふりかえり(記録タブの下) ---------- */
  var SELF_ITEMS = [
    ['read', '三面図を見て、立体の形を思いうかべることができた'],
    ['draw', '第三角法で、正面図・平面図・右側面図を正しい位置にかけた'],
    ['iso', '等角図を、たて・横・おくの3つの向きの線でかけた'],
    ['line', '線の種類(外形線・かくれ線・中心線など)を使い分けられた']
  ];
  var SELF_LEVELS = [['3', 'できた'], ['2', 'だいたいできた'], ['1', 'もう少し']];
  function renderReflect() {
    var r = rec.data.reflect || (rec.data.reflect = { self: {}, learned: '', hard: '', use: '' });
    r.self = r.self || {};
    var card = h('div', { class: 'card m4-reflect' }, h('h2', null, 'ふりかえり'),
      h('p', null, '練習をふり返って、自分で評価しよう。書いた内容は記録といっしょに保存・書き出しされます。'));
    var tbl = h('table', { class: 'g-table' },
      h('thead', null, h('tr', null, h('th', null, '自己評価'), SELF_LEVELS.map(function (l) { return h('th', null, l[1]); }))));
    var tb = h('tbody', null);
    SELF_ITEMS.forEach(function (it) {
      tb.appendChild(h('tr', null, h('td', null, it[1]), SELF_LEVELS.map(function (l) {
        var inp = h('input', { type: 'radio', name: 'm4-self-' + it[0], value: l[0], 'aria-label': it[1] + ': ' + l[1] });
        if (r.self[it[0]] === l[0]) inp.checked = true;
        inp.addEventListener('change', function () { r.self[it[0]] = l[0]; save(); });
        return h('td', { style: { textAlign: 'center' } }, h('label', { class: 'm4-radio' }, inp, h('span', { class: 'sr-only' }, l[1])));
      })));
    });
    tbl.appendChild(tb);
    card.appendChild(h('div', { class: 'g-table-wrap' }, tbl));
    [['learned', 'わかったこと・できるようになったこと'], ['hard', 'むずかしかったこと・次にがんばりたいこと'], ['use', '製作図をかくとき(木取りや作品づくり)に、どう生かしたいか']].forEach(function (f) {
      var ta = h('textarea', { id: 'm4-r-' + f[0], rows: '3', maxlength: '600' });
      ta.value = r[f[0]] || '';
      ta.addEventListener('input', function () { r[f[0]] = ta.value; save(); });
      card.appendChild(h('div', { class: 'g-field' }, h('label', { for: 'm4-r-' + f[0] }, f[1]), ta));
    });
    return card;
  }

  /* ---------- 起動 ---------- */
  var renderers = { quiz: renderQuiz, build: renderBuild, draw: renderDraw, iso: renderIso, terms: renderTerms, record: renderRecord };
  var currentTab = null;
  function renderAll() { if (currentTab) renderers[currentTab](); }
  G.store.get(REC_ID).then(function (a) {
    if (a && a.data) { rec = a; rec.data = mergeData(a.data); }
  }).catch(function () {}).then(function () {
    G.tabs(G.$('[data-g-tabs]'), function (name) { currentTab = name; renderers[name](); });
  });

  // テスト用に公開
  window.M4App = { QUIZ: QUIZ, BUILD: BUILD, DRAW: DRAW, ISO: ISO, rec: function () { return rec; } };
})();
