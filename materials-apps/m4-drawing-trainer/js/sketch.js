/* 作図ボード: 格子点にスナップして線を引く(タッチ・ペン・マウス・キーボード)。
 * mode 'square' … 三面図用の方眼。 mode 'iso' … 等角図用の三角格子。
 * 描いた線は「長さ1の線分キー → 'v'(外形線)| 'h'(かくれ線)」の表で持つ。
 */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function create(opt) {
    var M = root.M4Core, G = root.G;
    var mode = opt.mode || 'square', cell = opt.cell || 40, pad = cell * 0.5;
    var cols = opt.cols || 8, rows = opt.rows || 6;          // square: 格子点 0..cols, 0..rows
    var iMax = opt.iMax || 12, jMin = 0, jMax = opt.jMax || 16; // iso: 格子点 i 0..iMax, j 0..jMax
    var drawn = {}, history = [], tool = 'v', start = null, cursor = null;
    var onChange = opt.onChange || function () {};

    function toXY(i, j) {
      if (mode === 'iso') return [pad + i * M.C30 * cell, pad + (j - jMin) * 0.5 * cell];
      return [pad + i * cell, pad + j * cell];
    }
    var W = mode === 'iso' ? pad * 2 + iMax * M.C30 * cell : pad * 2 + cols * cell;
    var H = mode === 'iso' ? pad * 2 + (jMax - jMin) * 0.5 * cell : pad * 2 + rows * cell;
    function inside(p) {
      if (mode === 'iso') return p[0] >= 0 && p[0] <= iMax && p[1] >= jMin && p[1] <= jMax && ((p[0] - p[1]) % 2 + 2) % 2 === 0;
      return p[0] >= 0 && p[0] <= cols && p[1] >= 0 && p[1] <= rows;
    }
    function snap(x, y) {
      var best = null, bd = Infinity;
      if (mode === 'iso') {
        var i0 = Math.round((x - pad) / (M.C30 * cell)), j0 = Math.round((y - pad) / (0.5 * cell)) + jMin;
        for (var i = i0 - 1; i <= i0 + 1; i++) for (var j = j0 - 2; j <= j0 + 2; j++) {
          var p = [i, j]; if (!inside(p)) continue;
          var q = toXY(i, j), d = Math.hypot(q[0] - x, q[1] - y);
          if (d < bd) { bd = d; best = p; }
        }
        return best;
      }
      var pp = [Math.round((x - pad) / cell), Math.round((y - pad) / cell)];
      pp[0] = Math.max(0, Math.min(cols, pp[0])); pp[1] = Math.max(0, Math.min(rows, pp[1]));
      return pp;
    }

    var svg = svgEl('svg', { viewBox: '0 0 ' + W.toFixed(1) + ' ' + H.toFixed(1), class: 'm4-board', tabindex: '0', role: 'application',
      'aria-label': opt.label || '作図ボード。矢印キーで点を動かし、スペースキーで線の始めと終わりを決めます。' });
    var gGrid = svgEl('g', { class: 'm4-grid' }), gGuide = svgEl('g', { class: 'm4-guide-layer' }), gHint = svgEl('g', { class: 'm4-hint' }),
      gAns = svgEl('g', { class: 'm4-ans-layer' }), gLines = svgEl('g'), gFb = svgEl('g', { class: 'm4-fb' }), gUi = svgEl('g');
    [gGrid, gGuide, gHint, gAns, gLines, gFb, gUi].forEach(function (g) { svg.appendChild(g); });
    // 格子点の範囲(正解の線を置く位置を決めるときに使う)
    var box = mode === 'iso' ? { iMin: 0, iMax: iMax, jMin: jMin, jMax: jMax } : { iMin: 0, iMax: cols, jMin: 0, jMax: rows };

    // 格子
    if (mode === 'iso') {
      for (var i = 0; i <= iMax; i++) for (var j = jMin; j <= jMax; j++) {
        if (!inside([i, j])) continue;
        var q = toXY(i, j);
        gGrid.appendChild(svgEl('circle', { cx: q[0], cy: q[1], r: 1.8 }));
      }
    } else {
      for (var c = 0; c <= cols; c++) { var a = toXY(c, 0), b = toXY(c, rows); gGrid.appendChild(svgEl('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1] })); }
      for (var r = 0; r <= rows; r++) { var a2 = toXY(0, r), b2 = toXY(cols, r); gGrid.appendChild(svgEl('line', { x1: a2[0], y1: a2[1], x2: b2[0], y2: b2[1] })); }
    }
    var preview = svgEl('line', { class: 'm4-preview', visibility: 'hidden' });
    var curMark = svgEl('circle', { class: 'm4-cursor', r: 7, visibility: 'hidden' });
    var startMark = svgEl('circle', { class: 'm4-start', r: 6, visibility: 'hidden' });
    gUi.appendChild(preview); gUi.appendChild(startMark); gUi.appendChild(curMark);

    function render() {
      while (gLines.firstChild) gLines.removeChild(gLines.firstChild);
      var vis = [], hid = [];
      Object.keys(drawn).forEach(function (k) { (drawn[k] === 'v' ? vis : hid).push(k); });
      [['m4-hid', hid], ['m4-vis', vis]].forEach(function (pair) {
        M.mergeSegments(pair[1]).forEach(function (s) {
          var a = toXY(s[0], s[1]), b = toXY(s[2], s[3]);
          gLines.appendChild(svgEl('line', { class: pair[0], x1: a[0], y1: a[1], x2: b[0], y2: b[1] }));
        });
      });
    }
    function snapshot() { history.push(JSON.stringify(drawn)); if (history.length > 100) history.shift(); }
    function changed() { clearFeedback(); render(); onChange(drawn); }

    function commit(a, b) {
      var keys = M.decompose(a, b, mode);
      if (!keys) {
        if (a[0] !== b[0] || a[1] !== b[1]) say(mode === 'iso' ? '等角図の線は、3つの軸の向き(縦・右上・右下)に引きます。' : '線は縦か横に引きます。');
        return false;
      }
      snapshot();
      say('');
      keys.forEach(function (k) {
        if (tool === 'erase') delete drawn[k];
        else drawn[k] = tool;
      });
      changed();
      return true;
    }
    // その場をタップしたとき: 近くの線分を消す(消しゴム)/何もしない
    function tapErase(x, y) {
      var best = null, bd = cell * 0.3;
      Object.keys(drawn).forEach(function (k) {
        var p = M.parseKey(k), a = toXY(p[0], p[1]), b = toXY(p[2], p[3]);
        var dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
        var d = Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
        if (d < bd) { bd = d; best = k; }
      });
      if (best) { snapshot(); delete drawn[best]; changed(); }
    }

    var msgEl = G.h('p', { class: 'm4-board-msg g-muted', 'aria-live': 'polite' });
    function say(t) { msgEl.textContent = t; }

    function svgPoint(e) {
      // 画面の高さに合わせて縮めたとき(左右に余白が出る)も、ずれないように計算する
      var r = svg.getBoundingClientRect();
      var s = Math.min(r.width / W, r.height / H), ox = (r.width - W * s) / 2, oy = (r.height - H * s) / 2;
      return [(e.clientX - r.left - ox) / s, (e.clientY - r.top - oy) / s];
    }
    function setLine(el, a, b) {
      var p = toXY(a[0], a[1]), q = toXY(b[0], b[1]);
      el.setAttribute('x1', p[0]); el.setAttribute('y1', p[1]); el.setAttribute('x2', q[0]); el.setAttribute('y2', q[1]);
    }
    function previewClass() { return 'm4-preview' + (tool === 'h' ? ' dash' : tool === 'erase' ? ' erase' : ''); }

    var down = null;
    svg.style.touchAction = 'none';
    svg.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button > 0) return;
      e.preventDefault();
      var xy = svgPoint(e);
      down = { p: snap(xy[0], xy[1]), xy: xy, id: e.pointerId };
      svg.setPointerCapture(e.pointerId);
      preview.setAttribute('class', previewClass());
    });
    svg.addEventListener('pointermove', function (e) {
      if (!down || e.pointerId !== down.id) return;
      var xy = svgPoint(e), p = snap(xy[0], xy[1]);
      setLine(preview, down.p, p);
      preview.setAttribute('visibility', 'visible');
    });
    function finish(e) {
      if (!down || e.pointerId !== down.id) return;
      var xy = svgPoint(e), p = snap(xy[0], xy[1]);
      preview.setAttribute('visibility', 'hidden');
      var moved = Math.hypot(xy[0] - down.xy[0], xy[1] - down.xy[1]) > cell * 0.25;
      if (p[0] === down.p[0] && p[1] === down.p[1]) { if (!moved || tool === 'erase') tapErase(xy[0], xy[1]); }
      else commit(down.p, p);
      down = null;
    }
    svg.addEventListener('pointerup', finish);
    svg.addEventListener('pointercancel', function () { down = null; preview.setAttribute('visibility', 'hidden'); });

    // キーボード
    function showCursor() {
      if (!cursor) cursor = mode === 'iso' ? [4, 8] : [1, 1];
      var q = toXY(cursor[0], cursor[1]);
      curMark.setAttribute('cx', q[0]); curMark.setAttribute('cy', q[1]); curMark.setAttribute('visibility', 'visible');
      if (start) {
        var s = toXY(start[0], start[1]);
        startMark.setAttribute('cx', s[0]); startMark.setAttribute('cy', s[1]); startMark.setAttribute('visibility', 'visible');
        setLine(preview, start, cursor); preview.setAttribute('class', previewClass()); preview.setAttribute('visibility', 'visible');
      } else { startMark.setAttribute('visibility', 'hidden'); preview.setAttribute('visibility', 'hidden'); }
    }
    svg.addEventListener('focus', showCursor);
    svg.addEventListener('blur', function () { curMark.setAttribute('visibility', 'hidden'); });
    svg.addEventListener('keydown', function (e) {
      var step = mode === 'iso' ? { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }
        : { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (mode === 'iso') { step.q = [-1, -1]; step.e = [1, -1]; step.z = [-1, 1]; step.c = [1, 1]; }
      var k = e.key;
      if (step[k]) {
        e.preventDefault();
        var n = [cursor[0] + step[k][0], cursor[1] + step[k][1]];
        if (inside(n)) cursor = n;
        showCursor();
      } else if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        if (!start) { start = cursor.slice(); say('始点を決めました。終点まで動かして、もう一度スペースキー。'); }
        else { if (start[0] === cursor[0] && start[1] === cursor[1]) say('始点と終点が同じです。'); else commit(start, cursor); start = null; }
        showCursor();
      } else if (k === 'Escape') { start = null; showCursor(); }
      else if (k === '1' || k === '2' || k === '3') { setTool(tools[Number(k) - 1] || tool); }
      else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); }
    });

    // 道具
    var tools = opt.tools || ['v', 'h', 'erase'];
    var TOOL_LABEL = { v: '外形線', h: 'かくれ線', erase: '消しゴム' };
    var TOOL_ICON = { v: '━', h: '┅', erase: '⌫' };
    var toolBtns = {};
    function setTool(t) {
      tool = t;
      Object.keys(toolBtns).forEach(function (k) { toolBtns[k].setAttribute('aria-pressed', String(k === t)); });
    }
    var toolbar = G.h('div', { class: 'g-row m4-tools', role: 'toolbar', 'aria-label': '道具' },
      tools.map(function (t, n) {
        toolBtns[t] = G.h('button', { class: 'btn small m4-tool', type: 'button', 'data-tool': t, 'aria-pressed': 'false', title: TOOL_LABEL[t] + '(キー ' + (n + 1) + ')',
          onclick: function () { setTool(t); } }, G.h('span', { 'aria-hidden': 'true', class: 'm4-tool-icon' }, TOOL_ICON[t]), ' ', TOOL_LABEL[t]);
        return toolBtns[t];
      }),
      G.h('button', { class: 'btn small', type: 'button', onclick: function () { undo(); } }, '↶ もどす'),
      G.h('button', { class: 'btn small danger', type: 'button', 'data-act': 'clear-all', onclick: function () {
        // 線がなくても、答え・ヒント・答え合わせの表示は消す(以前は線がないと何も消えなかった)
        if (Object.keys(drawn).length) { snapshot(); drawn = {}; changed(); }
        clearFeedback(); hideAnswer(); setHint([]);
        if (opt.onClearAll) opt.onClearAll();
      } }, 'ぜんぶ消す'));
    setTool('v');

    function undo() {
      if (!history.length) return;
      drawn = JSON.parse(history.pop());
      changed();
    }

    /* 判定結果を重ねて表示する。色だけに頼らず、記号(○ 足りない / × 余分 / △ 線の種類ちがい)も付ける。
     * まっすぐつながる線は1本にまとめ、記号も1本に1つだけ付ける(短い線ごとに付けると重なって読めないため) */
    function showFeedback(res) {
      clearFeedback();
      function mark(list, cls, sym) {
        ['v', 'h'].forEach(function (type) {
          var keys = list.filter(function (it) { return it.type === type; }).map(function (it) { return it.key; });
          M.mergeSegments(keys).forEach(function (p) {
            var a = toXY(p[0], p[1]), b = toXY(p[2], p[3]);
            gFb.appendChild(svgEl('line', { class: cls + (type === 'h' ? ' dash' : ''), x1: a[0], y1: a[1], x2: b[0], y2: b[1] }));
            var t = svgEl('text', { class: cls + '-sym', x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 + 6, 'text-anchor': 'middle' });
            t.textContent = sym;
            gFb.appendChild(t);
          });
        });
      }
      mark(res.missing, 'm4-miss', '○');
      mark(res.extra, 'm4-extra', '×');
      mark(res.wrongType, 'm4-wrong', '△');
    }
    /* 正解の図を、位置 off にずらして重ねて表示する(外形線は実線、かくれ線は破線)。
     * 答え合わせの表示とは別の層に置き、線をかいても消えない(答えを見ながらかき直せる)。hideAnswer で消す */
    function showAnswer(expected, off) {
      clearFeedback(); hideAnswer();
      [['h', expected.hidden], ['v', expected.visible]].forEach(function (pair) {
        M.mergeSegments(pair[1]).forEach(function (p) {
          var a = toXY(p[0] + off[0], p[1] + off[1]), b = toXY(p[2] + off[0], p[3] + off[1]);
          gAns.appendChild(svgEl('line', { class: 'm4-ans' + (pair[0] === 'h' ? ' dash' : ''), x1: a[0], y1: a[1], x2: b[0], y2: b[1] }));
        });
      });
    }
    function hideAnswer() { while (gAns.firstChild) gAns.removeChild(gAns.firstChild); }
    function clearFeedback() { while (gFb.firstChild) gFb.removeChild(gFb.firstChild); }
    function setGuide(nodes) {
      while (gGuide.firstChild) gGuide.removeChild(gGuide.firstChild);
      (nodes || []).forEach(function (n) { gGuide.appendChild(n); });
    }
    function setHint(nodes) {
      while (gHint.firstChild) gHint.removeChild(gHint.firstChild);
      (nodes || []).forEach(function (n) { gHint.appendChild(n); });
    }

    var el = G.h('div', { class: 'm4-board-wrap' }, toolbar, svg, msgEl);
    render();
    return {
      el: el, svg: svg, toXY: toXY, svgEl: svgEl, box: box, mode: mode,
      getDrawn: function () { return drawn; },
      setDrawn: function (d) { drawn = Object.assign({}, d || {}); history = []; changed(); },
      clear: function () { drawn = {}; history = []; changed(); },
      showFeedback: showFeedback, showAnswer: showAnswer, hideAnswer: hideAnswer, clearFeedback: clearFeedback, setHint: setHint, setGuide: setGuide, say: say
    };
  }

  root.M4Sketch = { create: create, svgEl: svgEl };
})(typeof self !== 'undefined' ? self : this);
