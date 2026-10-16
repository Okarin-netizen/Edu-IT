/* A4 製図トレーナー: 立体(ボクセル)・投影・判定のコア。
 * ブラウザでは window.A4Core、Node では module.exports。DOM に依存しない。
 *
 * 座標: x = 左→右(幅), y = 手前→奥(奥行き), z = 下→上(高さ)。
 * 正面は y = 0 の側。第三角法: 平面図は正面図の上、右側面図は正面図の右。
 */
(function (root, factory) {
  var M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.A4Core = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var C30 = Math.sqrt(3) / 2;

  /* ---------- 乱数 ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function shuffle(r, arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ---------- 立体 ---------- */
  function makeSolid(w, d, h) {
    var cells = new Array(w * d * h);
    for (var i = 0; i < cells.length; i++) cells[i] = 0;
    return { w: w, d: d, h: h, cells: cells };
  }
  function get(s, x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= s.w || y >= s.d || z >= s.h) return 0;
    return s.cells[x + s.w * (y + s.d * z)];
  }
  function set(s, x, y, z, v) { s.cells[x + s.w * (y + s.d * z)] = v ? 1 : 0; }
  function count(s) { var n = 0; for (var i = 0; i < s.cells.length; i++) n += s.cells[i]; return n; }

  /* heights[y][x](y=0 が手前)から積み木の立体をつくる */
  function fromHeights(heights, h) {
    var d = heights.length, w = heights[0].length;
    var maxH = h || 0;
    heights.forEach(function (row) { row.forEach(function (v) { if (v > maxH) maxH = v; }); });
    var s = makeSolid(w, d, Math.max(1, maxH));
    for (var y = 0; y < d; y++) for (var x = 0; x < w; x++)
      for (var z = 0; z < heights[y][x]; z++) set(s, x, y, z, 1);
    return s;
  }
  function toHeights(s) {
    var out = [];
    for (var y = 0; y < s.d; y++) {
      var row = [];
      for (var x = 0; x < s.w; x++) {
        var t = 0;
        for (var z = 0; z < s.h; z++) if (get(s, x, y, z)) t = z + 1;
        row.push(t);
      }
      out.push(row);
    }
    return out;
  }

  /* 空の行・列・段を取り除いて外形にぴったり合わせる */
  function trim(s) {
    var mn = [Infinity, Infinity, Infinity], mx = [-1, -1, -1];
    for (var z = 0; z < s.h; z++) for (var y = 0; y < s.d; y++) for (var x = 0; x < s.w; x++) {
      if (!get(s, x, y, z)) continue;
      var p = [x, y, z];
      for (var k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; }
    }
    if (mx[0] < 0) return makeSolid(1, 1, 1);
    var t = makeSolid(mx[0] - mn[0] + 1, mx[1] - mn[1] + 1, mx[2] - mn[2] + 1);
    for (z = 0; z < t.h; z++) for (y = 0; y < t.d; y++) for (x = 0; x < t.w; x++)
      set(t, x, y, z, get(s, x + mn[0], y + mn[1], z + mn[2]));
    return t;
  }

  /* 面でつながっているか */
  function isConnected(s) {
    var n = count(s); if (n === 0) return false;
    var seen = {}, stack = [], found = 0;
    outer: for (var z = 0; z < s.h; z++) for (var y = 0; y < s.d; y++) for (var x = 0; x < s.w; x++)
      if (get(s, x, y, z)) { stack.push([x, y, z]); break outer; }
    var N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    while (stack.length) {
      var p = stack.pop(), key = p.join(',');
      if (seen[key]) continue;
      seen[key] = 1; found++;
      N.forEach(function (o) {
        var q = [p[0] + o[0], p[1] + o[1], p[2] + o[2]];
        if (get(s, q[0], q[1], q[2]) && !seen[q.join(',')]) stack.push(q);
      });
    }
    return found === n;
  }

  /* ---------- 正投影(三面図) ---------- */
  var VIEWS = ['front', 'top', 'right'];

  /* 各図で (u: 左→右, v: 上→下, k: 見る人から近い順の奥行き) を立体の座標に対応させる */
  function viewDims(s, view) {
    if (view === 'front') return { U: s.w, V: s.h, K: s.d };
    if (view === 'top') return { U: s.w, V: s.d, K: s.h };
    return { U: s.d, V: s.h, K: s.w };
  }
  function cellAt(s, view, u, v, k) {
    if (view === 'front') return get(s, u, k, s.h - 1 - v);
    if (view === 'top') return get(s, u, s.d - 1 - v, s.h - 1 - k);
    return get(s, s.w - 1 - k, u, s.h - 1 - v);
  }

  function segKey(a, b, c, d) {
    if (a > c || (a === c && b > d)) return c + ',' + d + ',' + a + ',' + b;
    return a + ',' + b + ',' + c + ',' + d;
  }
  function parseKey(k) { return k.split(',').map(Number); }

  /* 1つの図の線を求める。
   * 戻り値 { visible: [key...], hidden: [key...] }(長さ1の線分のキー、格子点は 0..U, 0..V)
   * 方法: 投影面上の長さ1の線分ごとに、その線分を通り視線に平行な面で立体を切り、
   * 奥行き方向の各境界面で隣り合う4つのブロックの並びから「稜線があるか」を判定する。
   * その稜線より手前に、線分の両側ともブロックがあれば「かくれ線」、なければ「外形線」。 */
  function orthoLines(s, view) {
    var D = viewDims(s, view), U = D.U, V = D.V, K = D.K;
    function occ(u, v, k) {
      if (u < 0 || v < 0 || u >= U || v >= V || k < 0 || k >= K) return 0;
      return cellAt(s, view, u, v, k);
    }
    function front(u, v) {
      for (var k = 0; k < K; k++) if (occ(u, v, k)) return k;
      return Infinity;
    }
    var vis = [], hid = [];
    function judge(a, b, key) {
      var fa = front(a[0], a[1]), fb = front(b[0], b[1]);
      var anyVis = false, anyHid = false;
      for (var p = 0; p <= K; p++) {
        var c00 = occ(a[0], a[1], p - 1), c01 = occ(a[0], a[1], p);
        var c10 = occ(b[0], b[1], p - 1), c11 = occ(b[0], b[1], p);
        var n = c00 + c01 + c10 + c11;
        var edge = n === 1 || n === 3 || (n === 2 && c00 === c11);
        if (!edge) continue;
        if (p <= fa || p <= fb) anyVis = true; else anyHid = true;
      }
      if (anyVis) vis.push(key); else if (anyHid) hid.push(key);
    }
    var u, v;
    for (u = 0; u <= U; u++) for (v = 0; v < V; v++)
      judge([u - 1, v], [u, v], segKey(u, v, u, v + 1));
    for (v = 0; v <= V; v++) for (u = 0; u < U; u++)
      judge([u, v - 1], [u, v], segKey(u, v, u + 1, v));
    return { visible: vis.sort(), hidden: hid.sort() };
  }

  function threeViews(s) {
    var o = {};
    VIEWS.forEach(function (v) { o[v] = orthoLines(s, v); o[v].dims = viewDims(s, v); });
    return o;
  }
  function viewSignature(lines) {
    return 'V:' + lines.visible.join(';') + '|H:' + lines.hidden.join(';');
  }
  function sameViews(a, b) {
    return VIEWS.every(function (v) {
      return a[v].dims.U === b[v].dims.U && a[v].dims.V === b[v].dims.V &&
        viewSignature(a[v]) === viewSignature(b[v]);
    });
  }

  /* 左右反転(右側面図を左右逆にかくまちがいを作るため) */
  function mirrorLines(lines, U) {
    function m(k) { var p = parseKey(k); return segKey(U - p[0], p[1], U - p[2], p[3]); }
    return { visible: lines.visible.map(m).sort(), hidden: lines.hidden.map(m).sort(), dims: lines.dims };
  }

  function flipLines(lines, V) {
    function m(k) { var p = parseKey(k); return segKey(p[0], V - p[1], p[2], V - p[3]); }
    return { visible: lines.visible.map(m).sort(), hidden: lines.hidden.map(m).sort(), dims: lines.dims };
  }

  /* ---------- 等角図 ---------- */
  /* 格子点 (i, j): 画面 X = i*cos30, Y = j/2(下向き正)。
   * 立体の点 (x,y,z) は i = x + y, j = (x - y) - 2z に写る(右手前上から見る)。 */
  function isoPoint(x, y, z) { return [x + y, (x - y) - 2 * z]; }
  function isoScreen(i, j) { return [i * C30, j / 2]; }

  /* 画面上の点から視線をのばし、最初に見える面の名前を返す */
  function isoPlaneAt(s, X, Y) {
    var A = X / C30, B = 2 * Y;
    var x0 = (A + B) / 2, y0 = (A - B) / 2;
    // P(t) = (x0 + t, y0 - t, t)、t が大きいほど見る人に近い
    var lo = Math.max(0, -x0, y0 - s.d), hi = Math.min(s.h, s.w - x0, y0);
    if (!(hi > lo)) return 'bg';
    var ts = [lo, hi], k;
    for (k = Math.ceil(lo); k <= hi; k++) ts.push(k);
    for (k = Math.ceil(x0 + lo); k <= x0 + hi; k++) ts.push(k - x0);
    for (k = Math.ceil(y0 - hi); k <= y0 - lo; k++) ts.push(y0 - k);
    ts = ts.filter(function (t) { return t >= lo && t <= hi; }).sort(function (a, b) { return b - a; });
    for (var n = 0; n + 1 < ts.length; n++) {
      var t1 = ts[n], t2 = ts[n + 1];
      if (t1 - t2 < 1e-9) continue;
      var tm = (t1 + t2) / 2;
      var cx = Math.floor(x0 + tm), cy = Math.floor(y0 - tm), cz = Math.floor(tm);
      if (!get(s, cx, cy, cz)) continue;
      var px = x0 + t1, py = y0 - t1, pz = t1, e = 1e-7;
      if (Math.abs(px - (cx + 1)) < e) return 'x' + (cx + 1);
      if (Math.abs(py - cy) < e) return 'y' + cy;
      if (Math.abs(pz - (cz + 1)) < e) return 'z' + (cz + 1);
      return '?' + cx + ',' + cy + ',' + cz;
    }
    return 'bg';
  }

  var ISO_DIRS = [[1, 1], [1, -1], [0, 2]];

  /* 等角図の線(見える線のみ)。隣り合う2つの三角形で見える面が違えば線になる。 */
  function isoLines(s) {
    var p0 = isoPoint(0, s.d, s.h), iMin = 0, iMax = s.w + s.d;
    var jMin = p0[1], jMax = s.w;
    var out = [];
    for (var i = iMin - 1; i <= iMax + 1; i++) {
      for (var j = jMin - 2; j <= jMax + 2; j++) {
        if (((i - j) % 2 + 2) % 2) continue;
        for (var q = 0; q < 3; q++) {
          var di = ISO_DIRS[q][0], dj = ISO_DIRS[q][1];
          var a = isoScreen(i, j), b = isoScreen(i + di, j + dj);
          var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
          var nx = -dy / L * 0.11, ny = dx / L * 0.11;
          if (isoPlaneAt(s, mx + nx, my + ny) !== isoPlaneAt(s, mx - nx, my - ny))
            out.push(segKey(i, j, i + di, j + dj));
        }
      }
    }
    return { visible: out.sort(), hidden: [] };
  }

  /* ---------- 作図の分解・判定 ---------- */
  var SQ_DIRS = [[1, 0], [0, 1]];

  /* 端点 a→b の線を長さ1の線分キーに分ける。許された向きでなければ null */
  function decompose(a, b, mode) {
    var dirs = mode === 'iso' ? ISO_DIRS : SQ_DIRS;
    var dx = b[0] - a[0], dy = b[1] - a[1];
    if (dx === 0 && dy === 0) return null;
    for (var q = 0; q < dirs.length; q++) {
      var ux = dirs[q][0], uy = dirs[q][1], n;
      if (ux === 0) { if (dx !== 0 || dy % uy) continue; n = dy / uy; }
      else { if (dx % ux) continue; n = dx / ux; if (n * uy !== dy) continue; }
      var step = n > 0 ? 1 : -1, keys = [];
      for (var t = 0; t !== n; t += step) {
        var p = [a[0] + ux * t, a[1] + uy * t], r = [a[0] + ux * (t + step), a[1] + uy * (t + step)];
        keys.push(segKey(p[0], p[1], r[0], r[1]));
      }
      return keys;
    }
    return null;
  }

  function shiftKey(k, di, dj) {
    var p = parseKey(k);
    return segKey(p[0] + di, p[1] + dj, p[2] + di, p[3] + dj);
  }

  /* 描いた線(Map: key → 'v' 外形線 | 'h' かくれ線)と正解を比べる。
   * 書き順・線の分け方・描いた位置(平行移動)によらず判定する。 */
  /* 線分キーの集まりが入る範囲(格子点の最小・最大) */
  function keyBounds(keys) {
    var b = { iMin: Infinity, iMax: -Infinity, jMin: Infinity, jMax: -Infinity };
    keys.forEach(function (k) {
      var p = parseKey(k);
      b.iMin = Math.min(b.iMin, p[0], p[2]); b.iMax = Math.max(b.iMax, p[0], p[2]);
      b.jMin = Math.min(b.jMin, p[1], p[3]); b.jMax = Math.max(b.jMax, p[1], p[3]);
    });
    return b;
  }
  function allKeys(expected) { return expected.visible.concat(expected.hidden); }
  /* 平行移動 off をしたとき、正解の線がボード(格子点の範囲 box)に収まるか */
  function fitsBox(expected, off, box) {
    var keys = allKeys(expected);
    if (!keys.length) return true;
    var b = keyBounds(keys);
    return b.iMin + off[0] >= box.iMin && b.iMax + off[0] <= box.iMax && b.jMin + off[1] >= box.jMin && b.jMax + off[1] <= box.jMax;
  }
  /* 正解の線をボードのまん中に置く平行移動。等角図(iso)では三角格子の点に乗るよう di - dj を偶数にする */
  function centerOffset(expected, box, mode) {
    var keys = allKeys(expected);
    if (!keys.length) return [0, 0];
    var b = keyBounds(keys);
    var di = Math.round((box.iMin + box.iMax - b.iMin - b.iMax) / 2);
    var dj = Math.round((box.jMin + box.jMax - b.jMin - b.jMax) / 2);
    if (mode === 'iso' && ((di - dj) % 2 + 2) % 2) dj += (b.jMax + dj + 1 <= box.jMax) ? 1 : -1;
    return [di, dj];
  }

  /* opt.prefer: 描いた線がないとき・同点のときに使う位置 / opt.force: 必ずこの位置で比べる */
  function grade(expected, drawn, opt) {
    opt = opt || {};
    var exp = {};
    expected.visible.forEach(function (k) { exp[k] = 'v'; });
    expected.hidden.forEach(function (k) { if (!exp[k]) exp[k] = 'h'; });
    var dk = Object.keys(drawn), ek = Object.keys(exp);
    // いちばん多く重なる平行移動を探す
    var votes = {}, best = null, bestN = -1;
    dk.forEach(function (d) {
      var pd = parseKey(d);
      ek.forEach(function (e) {
        var pe = parseKey(e);
        if (pd[2] - pd[0] !== pe[2] - pe[0] || pd[3] - pd[1] !== pe[3] - pe[1]) return;
        var s = (pd[0] - pe[0]) + ',' + (pd[1] - pe[1]);
        votes[s] = (votes[s] || 0) + (drawn[d] === exp[e] ? 2 : 1);
      });
    });
    Object.keys(votes).forEach(function (s) { if (votes[s] > bestN) { bestN = votes[s]; best = s; } });
    if (opt.prefer && votes[opt.prefer.join(',')] === bestN) best = opt.prefer.join(',');
    var off = opt.force ? opt.force.slice() : best ? best.split(',').map(Number) : (opt.prefer ? opt.prefer.slice() : [0, 0]);
    var res = { missing: [], extra: [], wrongType: [], offset: off };
    var shifted = {};
    ek.forEach(function (e) { shifted[shiftKey(e, off[0], off[1])] = exp[e]; });
    Object.keys(shifted).forEach(function (k) {
      if (!drawn[k]) res.missing.push({ key: k, type: shifted[k] });
      else if (drawn[k] !== shifted[k]) res.wrongType.push({ key: k, type: shifted[k] });
    });
    dk.forEach(function (k) { if (!shifted[k]) res.extra.push({ key: k, type: drawn[k] }); });
    res.ok = !res.missing.length && !res.extra.length && !res.wrongType.length;
    return res;
  }

  /* 長さ1の線分を、まっすぐつながる長い線にまとめる(表示と本数の数え方用) */
  function mergeSegments(keys) {
    var groups = {};
    keys.forEach(function (k) {
      var p = parseKey(k), di = p[2] - p[0], dj = p[3] - p[1];
      // 線の向きと、その線が通る直線の識別子
      var line = di === 0 ? 'c' + p[0] : (dj === 0 ? 'r' + p[1] : 'd' + di + ',' + dj + ':' + (p[1] * di - p[0] * dj));
      var g = di + ',' + dj + '|' + line;
      (groups[g] = groups[g] || []).push(p);
    });
    var out = [];
    Object.keys(groups).forEach(function (g) {
      var ps = groups[g].sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      var cur = ps[0].slice();
      for (var n = 1; n < ps.length; n++) {
        if (ps[n][0] === cur[2] && ps[n][1] === cur[3]) { cur[2] = ps[n][2]; cur[3] = ps[n][3]; }
        else { out.push(cur); cur = ps[n].slice(); }
      }
      out.push(cur);
    });
    return out;
  }

  /* ---------- 問題づくり ---------- */
  var LEVELS = {
    1: { maxW: 2, maxD: 2, maxH: 2, minN: 2, maxN: 5 },
    2: { maxW: 3, maxD: 3, maxH: 2, minN: 4, maxN: 9 },
    3: { maxW: 3, maxD: 3, maxH: 3, minN: 5, maxN: 14, needHidden: true }
  };

  function hasHidden(views) { return VIEWS.some(function (v) { return views[v].hidden.length > 0; }); }

  /* 積み木(浮いたブロックなし)の立体をランダムにつくる */
  function randomSolid(r, level) {
    var L = LEVELS[level] || LEVELS[2];
    for (var tries = 0; tries < 500; tries++) {
      var w = randInt(r, Math.max(1, L.maxW - 1), L.maxW), d = randInt(r, Math.max(1, L.maxD - 1), L.maxD);
      var hm = [];
      for (var y = 0; y < d; y++) {
        var row = [];
        for (var x = 0; x < w; x++) row.push(r() < 0.22 ? 0 : randInt(r, 1, L.maxH));
        hm.push(row);
      }
      var s = trim(fromHeights(hm, 1));
      var n = count(s);
      if (n < L.minN || n > L.maxN) continue;
      if (!isConnected(s)) continue;
      if (s.w * s.d * s.h === n) continue; // ただの直方体は避ける
      if (L.needHidden && !hasHidden(threeViews(s))) continue;
      return s;
    }
    return fromHeights([[2, 1], [1, 0]]);
  }

  function solidKey(s) { return s.w + 'x' + s.d + 'x' + s.h + ':' + s.cells.join(''); }

  /* 決まった種から、重複のない問題列をつくる */
  function problemSet(seed, level, n) {
    var r = rng(seed), out = [], seen = {};
    for (var g = 0; out.length < n && g < n * 50; g++) {
      var s = randomSolid(r, level), key = solidKey(s);
      if (seen[key]) continue;
      seen[key] = 1;
      out.push(s);
    }
    return out;
  }

  /* 1列だけ高さを ±1 した「似ているがちがう」立体 */
  function mutate(r, s) {
    // まわりに高さ0の列を足して、となりにブロックを置く変化も作れるようにする
    var hm = [];
    var src = toHeights(s);
    var zero = []; for (var c = 0; c < s.w + 2; c++) zero.push(0);
    hm.push(zero.slice());
    src.forEach(function (row) { hm.push([0].concat(row, [0])); });
    hm.push(zero.slice());
    for (var tries = 0; tries < 60; tries++) {
      var y = randInt(r, 0, hm.length - 1), x = randInt(r, 0, hm[0].length - 1);
      var nh = hm.map(function (row) { return row.slice(); });
      nh[y][x] += r() < 0.5 ? -1 : 1;
      if (nh[y][x] < 0 || nh[y][x] > Math.max(3, s.h)) continue;
      var t = trim(fromHeights(nh, 1));
      if (count(t) === 0 || !isConnected(t)) continue;
      return t;
    }
    return null;
  }

  /* クイズ1問: 正解1つ + まちがい3つの三面図 */
  function makeQuiz(seed, s) {
    var r = rng(seed * 7919 + 13);
    var correct = threeViews(s);
    var cands = [];
    function push(views, kind) {
      if (sameViews(views, correct)) return;
      for (var i = 0; i < cands.length; i++) if (sameViews(cands[i].views, views)) return;
      cands.push({ views: views, kind: kind });
    }
    // 右側面図の左右を逆にした図(よくあるまちがい)
    var mir = {
      front: correct.front, top: correct.top,
      right: mirrorLines(correct.right, correct.right.dims.U)
    };
    push(mir, 'mirror');
    // 平面図の上下(手前と奥)を逆にした図
    var flipTop = {
      front: correct.front, right: correct.right,
      top: flipLines(correct.top, correct.top.dims.V)
    };
    push(flipTop, 'flipTop');
    // かくれ線を外形線でかいた図
    if (hasHidden(correct)) {
      var solidOnly = {};
      VIEWS.forEach(function (v) {
        solidOnly[v] = { visible: correct[v].visible.concat(correct[v].hidden).sort(), hidden: [], dims: correct[v].dims };
      });
      push(solidOnly, 'hiddenAsSolid');
      var noHidden = {};
      VIEWS.forEach(function (v) { noHidden[v] = { visible: correct[v].visible, hidden: [], dims: correct[v].dims }; });
      push(noHidden, 'noHidden');
    }
    // 形が少しちがう立体
    for (var t = 0; t < 40 && cands.length < 8; t++) {
      var m = mutate(r, s);
      if (m) push(threeViews(m), 'shape');
    }
    var shapes = cands.filter(function (c) { return c.kind === 'shape'; });
    var others = shuffle(r, cands.filter(function (c) { return c.kind !== 'shape'; }));
    var pick = others.slice(0, 1).concat(shapes.slice(0, 2));
    for (var k = 0; pick.length < 3 && k < cands.length; k++) if (pick.indexOf(cands[k]) < 0) pick.push(cands[k]);
    var options = pick.slice(0, 3).concat([{ views: correct, kind: 'correct' }]);
    shuffle(r, options);
    return { options: options, answer: options.findIndex(function (o) { return o.kind === 'correct'; }) };
  }

  return {
    C30: C30, VIEWS: VIEWS, ISO_DIRS: ISO_DIRS, LEVELS: LEVELS,
    rng: rng, shuffle: shuffle,
    makeSolid: makeSolid, get: get, set: set, count: count, fromHeights: fromHeights, toHeights: toHeights,
    trim: trim, isConnected: isConnected, solidKey: solidKey,
    viewDims: viewDims, cellAt: cellAt, orthoLines: orthoLines, threeViews: threeViews, sameViews: sameViews,
    mirrorLines: mirrorLines, flipLines: flipLines, hasHidden: hasHidden,
    keyBounds: keyBounds, fitsBox: fitsBox, centerOffset: centerOffset,
    isoPoint: isoPoint, isoScreen: isoScreen, isoPlaneAt: isoPlaneAt, isoLines: isoLines,
    segKey: segKey, parseKey: parseKey, decompose: decompose, grade: grade, mergeSegments: mergeSegments,
    randomSolid: randomSolid, problemSet: problemSet, mutate: mutate, makeQuiz: makeQuiz
  };
});
