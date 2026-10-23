/* A4 製図トレーナー 自動テスト。実行: node tests/run-tests.js
 * 1) ランダム立体100件で、三面図の線を「別の方法」(立体の表面の稜線を集めて投影する方法)で求め、
 *    アプリの計算と一致することを確かめる。外形(シルエット)の一致も確かめる。
 * 2) 作図の判定が、書き順・線の分け方・向き・描く位置を変えても正しく判定されることを確かめる。
 * 3) 等角図の基本形(立方体1個など)の線の本数を確かめる。
 * 4) クイズ30問すべてで、正解の選択肢が立体の三面図と一致し、まちがいの選択肢がすべて異なることを確かめる。
 */
'use strict';
var path = require('path');
var M = require(path.join(__dirname, '..', 'js', 'drawing-core.js'));

var failures = 0, passes = 0;
function check(cond, msg) { if (cond) passes++; else { failures++; console.error('NG: ' + msg); } }

/* ---- 別の方法: 表面の面を集め、平面がつながらない辺を稜線とする ---- */
function meshEdges(s) {
  var faces = {}; // 辺キー -> 法線の配列
  var dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  function addEdge(a, b, n) {
    var k = a.join(',') < b.join(',') ? a.join(',') + '|' + b.join(',') : b.join(',') + '|' + a.join(',');
    (faces[k] = faces[k] || []).push(n.join(','));
  }
  for (var z = 0; z < s.h; z++) for (var y = 0; y < s.d; y++) for (var x = 0; x < s.w; x++) {
    if (!M.get(s, x, y, z)) continue;
    dirs.forEach(function (n) {
      if (M.get(s, x + n[0], y + n[1], z + n[2])) return;
      var ax = n[0] !== 0 ? 0 : (n[1] !== 0 ? 1 : 2);
      var base = [x, y, z]; if (n[ax] > 0) base[ax] += 1;
      var o = [0, 1, 2].filter(function (q) { return q !== ax; });
      var c = [];
      [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(function (t) {
        var p = base.slice(); p[o[0]] += t[0]; p[o[1]] += t[1]; c.push(p);
      });
      for (var i = 0; i < 4; i++) addEdge(c[i], c[(i + 1) % 4], n);
    });
  }
  var edges = [];
  Object.keys(faces).forEach(function (k) {
    var ns = faces[k];
    var flat = ns.length === 2 && ns[0] === ns[1];
    if (!flat) edges.push(k.split('|').map(function (p) { return p.split(',').map(Number); }));
  });
  return edges;
}

/* 視線方向ごとに、3D の点を (u, v, 奥行き) に写す(アプリとは独立に書いたもの) */
function project(s, view, p) {
  if (view === 'front') return [p[0], s.h - p[2], p[1]];
  if (view === 'top') return [p[0], s.d - p[1], s.h - p[2]];
  return [p[1], s.h - p[2], s.w - p[0]];
}
/* 点 (u, v) から見る人の方向へ、奥行き depth より手前にブロックがあるか */
function blocked(s, view, u, v, depth) {
  // 連続な点を見る人の方向へ動かし、ブロックの内部に入るか調べる
  for (var t = depth - 0.0005; t > -0.5; t -= 0.01) {
    var q;
    if (view === 'front') q = [u, t, s.h - v];
    else if (view === 'top') q = [u, s.d - v, s.h - t];
    else q = [s.w - t, u, s.h - v];
    if (M.get(s, Math.floor(q[0]), Math.floor(q[1]), Math.floor(q[2]))) return true;
  }
  return false;
}
function referenceLines(s, view) {
  var vis = {}, hid = {};
  meshEdges(s).forEach(function (e) {
    var a = project(s, view, e[0]), b = project(s, view, e[1]);
    if (a[0] === b[0] && a[1] === b[1]) return; // 視線に平行な辺は点になる
    var key = M.segKey(a[0], a[1], b[0], b[1]);
    var mu = (a[0] + b[0]) / 2, mv = (a[1] + b[1]) / 2, depth = a[2];
    // 線の両側に少しずらした視線が、両方ともさえぎられていれば見えない
    var horiz = a[1] === b[1], eps = 0.01;
    var s1 = horiz ? blocked(s, view, mu, mv - eps, depth) : blocked(s, view, mu - eps, mv, depth);
    var s2 = horiz ? blocked(s, view, mu, mv + eps, depth) : blocked(s, view, mu + eps, mv, depth);
    if (s1 && s2) hid[key] = 1; else vis[key] = 1;
  });
  Object.keys(vis).forEach(function (k) { delete hid[k]; });
  return { visible: Object.keys(vis).sort(), hidden: Object.keys(hid).sort() };
}

/* シルエット(塗りつぶした外形)からも外枠を確かめる */
function silhouetteOK(s, view, lines) {
  var D = M.viewDims(s, view), set = {};
  lines.visible.forEach(function (k) { set[k] = 1; });
  for (var u = 0; u <= D.U; u++) for (var v = 0; v <= D.V; v++) {
    // 塗りの境目(片側だけ塗られている)なら必ず外形線がある
    function filled(uu, vv) {
      if (uu < 0 || vv < 0 || uu >= D.U || vv >= D.V) return false;
      for (var k = 0; k < D.K; k++) if (M.cellAt(s, view, uu, vv, k)) return true;
      return false;
    }
    if (v < D.V && filled(u - 1, v) !== filled(u, v) && !set[M.segKey(u, v, u, v + 1)]) return false;
    if (u < D.U && filled(u, v - 1) !== filled(u, v) && !set[M.segKey(u, v, u + 1, v)]) return false;
  }
  return true;
}

/* ---- 1) ランダム立体100件 ---- */
(function () {
  var r = M.rng(20261012), n = 0, withHidden = 0;
  while (n < 100) {
    var level = 1 + (n % 3);
    var s;
    if (n % 4 === 3) {
      // 張り出しのある立体も試す(積み木以外)
      s = M.makeSolid(3, 3, 3);
      for (var i = 0; i < s.cells.length; i++) s.cells[i] = r() < 0.45 ? 1 : 0;
      s = M.trim(s);
      if (M.count(s) < 2) continue;
    } else s = M.randomSolid(r, level);
    var tv = M.threeViews(s);
    M.VIEWS.forEach(function (view) {
      var ref = referenceLines(s, view);
      check(JSON.stringify(ref.visible) === JSON.stringify(tv[view].visible),
        'case ' + n + ' ' + view + ' 外形線が一致しない ' + M.solidKey(s));
      check(JSON.stringify(ref.hidden) === JSON.stringify(tv[view].hidden),
        'case ' + n + ' ' + view + ' かくれ線が一致しない ' + M.solidKey(s));
      check(silhouetteOK(s, view, tv[view]), 'case ' + n + ' ' + view + ' 外形が足りない');
    });
    // 投影の対応(第三角法): 正面図と平面図の幅、正面図と右側面図の高さ、平面図の奥行きと右側面図の幅
    check(tv.front.dims.U === tv.top.dims.U, 'case ' + n + ' 幅が対応しない');
    check(tv.front.dims.V === tv.right.dims.V, 'case ' + n + ' 高さが対応しない');
    check(tv.top.dims.V === tv.right.dims.U, 'case ' + n + ' 奥行きが対応しない');
    if (M.hasHidden(tv)) withHidden++;
    n++;
  }
  check(withHidden >= 20, 'かくれ線のある立体が少なすぎる (' + withHidden + ')');
  console.log('ランダム立体100件: 完了(かくれ線あり ' + withHidden + ' 件)');
})();

/* 手で確かめた例: L字(正面から見て 2段+1段、奥行き1) */
(function () {
  var s = M.fromHeights([[2, 1]]);
  var f = M.orthoLines(s, 'front');
  // 外形: 長さ1の線分が 外周 8 本、段の内側の線 なし(正面は1枚の面)
  check(f.visible.length === 8 && f.hidden.length === 0, 'L字の正面図');
  var t = M.orthoLines(s, 'top');
  // 平面図: 2×1 の長方形 + 高さが変わる境目の線1本 = 6 + 1
  check(t.visible.length === 7, 'L字の平面図 ' + t.visible.length);
  // 奥だけ高い形: 正面図に段差の線は見えるが、奥の段差は前から見ると…
  var s2 = M.fromHeights([[1, 1], [2, 2]]); // 手前1段、奥2段
  var f2 = M.orthoLines(s2, 'front');
  check(f2.hidden.length === 0 && f2.visible.indexOf(M.segKey(0, 1, 1, 1)) >= 0, '手前が低い形の正面図に段の線');
  var s3 = M.fromHeights([[2, 2], [1, 1]]); // 手前2段、奥1段 → 右側面図は L、正面図は長方形
  var f3 = M.orthoLines(s3, 'front');
  // 外形は長方形。奥の低い部分が手前の高い部分に当たるへこんだ辺は、正面から見えないのでかくれ線になる
  check(f3.visible.length === 8 && f3.hidden.length === 2, '手前が高い形の正面図は長方形+かくれ線 (' + f3.hidden.length + ')');
  // くぼみが奥にある形: 正面図にかくれ線が出る
  var s4 = M.fromHeights([[2, 2, 2], [2, 0, 2]]);
  var f4 = M.orthoLines(s4, 'front');
  check(f4.hidden.length === 4, '奥のくぼみはかくれ線 (' + f4.hidden.length + ')');
})();

/* ---- 2) 書き順・分け方を変えても同じ判定 ---- */
(function () {
  var r = M.rng(77);
  for (var n = 0; n < 60; n++) {
    var s = M.randomSolid(r, 1 + (n % 3));
    var view = M.VIEWS[n % 3];
    var exp = M.orthoLines(s, view);
    // 長い線にまとめてから、ランダムな位置で分け、向きを反転し、順番を入れかえて描く
    var strokes = [];
    [['v', exp.visible], ['h', exp.hidden]].forEach(function (pair) {
      M.mergeSegments(pair[1]).forEach(function (seg) {
        var len = Math.max(Math.abs(seg[2] - seg[0]), Math.abs(seg[3] - seg[1]));
        var ux = Math.sign(seg[2] - seg[0]), uy = Math.sign(seg[3] - seg[1]);
        var cut = 1 + Math.floor(r() * len);
        var parts = cut < len ? [[0, cut], [cut, len]] : [[0, len]];
        if (r() < 0.3 && len > 1) parts = [[0, len - 1], [1, len]]; // 重ねがき
        parts.forEach(function (pt) {
          var a = [seg[0] + ux * pt[0], seg[1] + uy * pt[0]], b = [seg[0] + ux * pt[1], seg[1] + uy * pt[1]];
          strokes.push(r() < 0.5 ? [a, b, pair[0]] : [b, a, pair[0]]);
        });
      });
    });
    M.shuffle(r, strokes);
    var dx = Math.floor(r() * 4), dy = Math.floor(r() * 3); // 描く位置をずらす
    var drawn = {};
    strokes.forEach(function (st) {
      var keys = M.decompose([st[0][0] + dx, st[0][1] + dy], [st[1][0] + dx, st[1][1] + dy], 'square');
      keys.forEach(function (k) { if (st[2] === 'v' || !drawn[k]) drawn[k] = st[2]; });
    });
    var g = M.grade(exp, drawn);
    check(g.ok, '書き順違い ' + n + ' が正解にならない ' + JSON.stringify(g));
    // 1本消すと不正解になる
    var any = Object.keys(drawn)[0];
    var drawn2 = Object.assign({}, drawn); delete drawn2[any];
    check(!M.grade(exp, drawn2).ok, '線が足りないのに正解になる ' + n);
    // かくれ線を外形線にすると不正解になる
    if (exp.hidden.length) {
      var drawn3 = Object.assign({}, drawn);
      var hk = Object.keys(drawn3).filter(function (k) { return drawn3[k] === 'h'; })[0];
      drawn3[hk] = 'v';
      check(!M.grade(exp, drawn3).ok, '線の種類がちがうのに正解になる ' + n);
    }
  }
  // 斜めの線は分解できない
  check(M.decompose([0, 0], [2, 1], 'square') === null, '斜め線を拒否');
  check(M.decompose([0, 0], [3, 3], 'iso').length === 3, '等角の軸方向');
  check(M.decompose([0, 0], [0, 3], 'iso') === null, '等角で奇数の縦線を拒否');
  console.log('書き順違いの判定: 完了');
})();

/* ---- 3b) キャビネット図 ---- */
(function () {
  var cube = M.fromHeights([[1]]);
  check(M.mergeSegments(M.cabLines(cube).visible).length === 9, '立方体1個のキャビネット図は9本');
  var bar = M.fromHeights([[1, 1, 1]]);
  check(M.mergeSegments(M.cabLines(bar).visible).length === 9, '直方体のキャビネット図は9本');
  // 正面の面は、正面図の外形線と同じ形(左下の角をそろえると、正面図の線はすべてキャビネット図にある)
  var r = M.rng(11);
  for (var n = 0; n < 40; n++) {
    var s = M.randomSolid(r, 1 + (n % 3)), lines = {};
    M.cabLines(s).visible.forEach(function (k) { lines[k] = 1; });
    check(M.decompose([0, 0], [3, -1], 'cab') === null, 'キャビネットで45°以外のななめを拒否');
    check(M.decompose([0, 0], [2, -2], 'cab').length === 2, 'キャビネットの奥行きの向き');
    // 書き順違い・位置ずらしで正解
    var exp = M.cabLines(s), drawn = {};
    M.mergeSegments(exp.visible).forEach(function (sg) {
      (r() < 0.5 ? M.decompose([sg[0] + 2, sg[1] + 5], [sg[2] + 2, sg[3] + 5], 'cab') : M.decompose([sg[2] + 2, sg[3] + 5], [sg[0] + 2, sg[1] + 5], 'cab')).forEach(function (k) { drawn[k] = 'v'; });
    });
    check(M.grade(exp, drawn).ok, 'キャビネット図の判定 ' + n);
  }
  console.log('キャビネット図: 完了');
})();

/* ---- 3) 等角図 ---- */
(function () {
  var cube = M.fromHeights([[1]]);
  check(M.isoLines(cube).visible.length === 9, '立方体1個の等角図は9本 (' + M.isoLines(cube).visible.length + ')');
  var bar = M.fromHeights([[1, 1, 1]]);
  check(M.mergeSegments(M.isoLines(bar).visible).length === 9, '直方体の等角図は9本');
  // 等角図も、書き順違い・位置ずらしで正解
  var r = M.rng(5);
  for (var n = 0; n < 30; n++) {
    var s = M.randomSolid(r, 1 + (n % 3));
    var exp = M.isoLines(s);
    var drawn = {};
    M.shuffle(r, M.mergeSegments(exp.visible)).forEach(function (seg) {
      var a = [seg[0] + 2, seg[1] + 4], b = [seg[2] + 2, seg[3] + 4];
      (r() < 0.5 ? M.decompose(a, b, 'iso') : M.decompose(b, a, 'iso')).forEach(function (k) { drawn[k] = 'v'; });
    });
    check(M.grade(exp, drawn).ok, '等角図の書き順違い ' + n);
    check(exp.visible.length > 0 && exp.visible.every(function (k) {
      var p = M.parseKey(k); return ((p[0] - p[1]) % 2 + 2) % 2 === 0;
    }), '等角図の線が格子上にある ' + n);
  }
  console.log('等角図: 完了');
})();

/* ---- 3b) 答え・ヒントの位置(ボードの外にはみ出さない) ---- */
(function () {
  var ISO_BOX = { iMin: 0, iMax: 12, jMin: 0, jMax: 16 }, SQ_BOX = { iMin: 0, iMax: 8, jMin: 0, jMax: 6 };
  var r = M.rng(11);
  for (var n = 0; n < 60; n++) {
    var s = M.randomSolid(r, 1 + (n % 3));
    var exp = M.isoLines(s), home = M.centerOffset(exp, ISO_BOX, 'iso');
    check(M.fitsBox(exp, home, ISO_BOX), '等角図の答えがボードに入る ' + n);
    check(((home[0] - home[1]) % 2 + 2) % 2 === 0, '等角図の答えの位置が三角格子に乗る ' + n);
    // 何も描いていないとき: 基準線の位置で比べる(以前は [0,0] でボードの上にはみ出していた)
    var g0 = M.grade(exp, {}, { prefer: home });
    check(g0.offset[0] === home[0] && g0.offset[1] === home[1], '何も描いていないときは基準線の位置 ' + n);
    // 基準線の位置にかけば正解
    var drawn = {};
    exp.visible.forEach(function (k) { var p = M.parseKey(k); drawn[M.segKey(p[0] + home[0], p[1] + home[1], p[2] + home[0], p[3] + home[1])] = 'v'; });
    check(M.grade(exp, drawn, { prefer: home }).ok, '基準線の位置にかいた等角図は正解 ' + n);
    // force で比べると、ずれた位置の線は足りない線・余分な線になる
    var gf = M.grade(exp, drawn, { force: [home[0] + 2, home[1]] });
    check(!gf.ok && gf.offset[0] === home[0] + 2, 'force の位置で比べる ' + n);
    M.VIEWS.forEach(function (vw) {
      var e2 = M.orthoLines(s, vw), h2 = M.centerOffset(e2, SQ_BOX, 'square');
      check(M.fitsBox(e2, h2, SQ_BOX), '三面図の答えがボードに入る ' + vw + ' ' + n);
    });
  }
  // はみ出す位置は fitsBox が false になる
  var s1 = M.randomSolid(M.rng(3), 2), e1 = M.isoLines(s1);
  check(!M.fitsBox(e1, [0, 0], ISO_BOX), '等角図を [0,0] に置くとボードの上にはみ出す');
  console.log('答えの位置: 完了');
})();

/* ---- 3c) 等角図の正解を別の方法で確かめる ----
 * 画面の点から視線を少しずつ進めて(アプリの計算とは別の方法)最初に当たる面を調べ、
 * 線の両側で面がちがうところを「線がある」とする。アプリの isoLines と一致するか比べる。 */
function marchLabel(s, X, Y) {
  var A = X / M.C30, B = 2 * Y, x0 = (A + B) / 2, y0 = (A - B) / 2;
  var prev = null;
  for (var t = s.h + 0.5; t > -0.5; t -= 0.003) {
    var x = x0 + t, y = y0 - t, z = t;
    var c = [Math.floor(x), Math.floor(y), Math.floor(z)];
    if (prev && M.get(s, c[0], c[1], c[2])) {
      if (c[0] !== prev[0]) return 'x' + (c[0] + 1);
      if (c[1] !== prev[1]) return 'y' + c[1];
      if (c[2] !== prev[2]) return 'z' + (c[2] + 1);
    }
    prev = c;
  }
  return 'bg';
}
function referenceIso(s) {
  var out = [];
  for (var i = -2; i <= s.w + s.d + 2; i++) for (var j = -s.d - 2 * s.h - 3; j <= s.w + 3; j++) {
    if (((i - j) % 2 + 2) % 2) continue;
    M.ISO_DIRS.forEach(function (dd) {
      var a = M.isoScreen(i, j), b = M.isoScreen(i + dd[0], j + dd[1]);
      var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L * 0.15, ny = dx / L * 0.15;
      var diff = [0.3, 0.5, 0.7].filter(function (f) {
        var mx = a[0] + dx * f, my = a[1] + dy * f;
        return marchLabel(s, mx + nx, my + ny) !== marchLabel(s, mx - nx, my - ny);
      }).length;
      if (diff >= 2) out.push(M.segKey(i, j, i + dd[0], j + dd[1]));
    });
  }
  return out.sort();
}
(function () {
  var ISO_BOX = { iMin: 0, iMax: 12, jMin: 0, jMax: 16 }, SQ_BOX = { iMin: 0, iMax: 8, jMin: 0, jMax: 6 };
  // アプリと同じ種で作った「等角図をかく」8問と「三面図をかく」10問
  var iso = [], draw = [];
  [[4001, 1, 3], [4002, 2, 3], [4003, 3, 2]].forEach(function (p) { iso = iso.concat(M.problemSet(p[0], p[1], p[2])); });
  [[3001, 1, 3], [3002, 2, 4], [3003, 3, 3]].forEach(function (p) { draw = draw.concat(M.problemSet(p[0], p[1], p[2])); });
  check(iso.length === 8 && draw.length === 10, '問題の数(等角図8・三面図10)');
  iso.forEach(function (s, n) {
    var exp = M.isoLines(s), ref = referenceIso(s);
    check(JSON.stringify(exp.visible) === JSON.stringify(ref), '等角図 ' + (n + 1) + ' 問目の正解が別の方法と一致');
    check(M.isConnected(s) && M.count(s) > 0, '等角図 ' + (n + 1) + ' 問目の立体がつながっている');
    check(M.fitsBox(exp, M.centerOffset(exp, ISO_BOX, 'iso'), ISO_BOX), '等角図 ' + (n + 1) + ' 問目がボードに入る');
    var g = M.grade(exp, exp.visible.reduce(function (o, k) { o[k] = 'v'; return o; }, {}));
    check(g.ok, '等角図 ' + (n + 1) + ' 問目: 正解どおりにかくと正解');
  });
  // 等角図の問題は三面図だけを見てかくので、三面図から立体が1つに決まることを確かめる(箱の中のブロックの置き方を全部ためす)
  iso.forEach(function (s, n) {
    var tv = M.threeViews(s), N = s.w * s.d * s.h, found = 0;
    for (var m = 1; m < (1 << N); m++) {
      var t = M.makeSolid(s.w, s.d, s.h);
      for (var k = 0; k < N; k++) t.cells[k] = (m >> k) & 1;
      if (M.sameViews(M.threeViews(t), tv)) found++;
    }
    check(found === 1, '等角図 ' + (n + 1) + ' 問目: 三面図から立体が1つに決まる(' + found + ' 通り)');
  });
  var r = M.rng(21);
  for (var n = 0; n < 40; n++) {
    var s = M.randomSolid(r, 1 + (n % 3));
    check(JSON.stringify(M.isoLines(s).visible) === JSON.stringify(referenceIso(s)), 'ランダム立体の等角図が別の方法と一致 ' + n);
  }
  draw.forEach(function (s, n) {
    check(M.isConnected(s), '三面図 ' + (n + 1) + ' 問目の立体がつながっている');
    M.VIEWS.forEach(function (vw) {
      var exp = M.orthoLines(s, vw), ref = referenceLines(s, vw);
      check(JSON.stringify(exp.visible) === JSON.stringify(ref.visible) && JSON.stringify(exp.hidden) === JSON.stringify(ref.hidden),
        '三面図 ' + (n + 1) + ' 問目 ' + vw + ' の正解が別の方法と一致');
      check(M.fitsBox(exp, M.centerOffset(exp, SQ_BOX, 'square'), SQ_BOX), '三面図 ' + (n + 1) + ' 問目 ' + vw + ' がボードに入る');
      check(!exp.hidden.some(function (k) { return exp.visible.indexOf(k) >= 0; }), '三面図 ' + (n + 1) + ' 問目 ' + vw + ': 外形線とかくれ線が重ならない');
    });
  });
  console.log('製図の問題と正解: 完了');
})();

/* ---- 4) クイズ30問 ---- */
(function () {
  var total = 0;
  [1, 2, 3].forEach(function (level) {
    var set = M.problemSet(1000 + level, level, 10);
    check(set.length === 10, 'レベル' + level + 'の問題が10問ある');
    set.forEach(function (s, i) {
      var q = M.makeQuiz(level * 100 + i, s);
      check(q.options.length === 4, 'クイズの選択肢が4つ ' + level + '-' + i);
      check(M.sameViews(q.options[q.answer].views, M.threeViews(s)), 'クイズの正解が三面図と一致 ' + level + '-' + i);
      q.options.forEach(function (o, k) {
        if (k !== q.answer) check(!M.sameViews(o.views, q.options[q.answer].views), 'まちがいの選択肢が正解と同じ ' + level + '-' + i);
      });
      if (level === 3) check(M.hasHidden(M.threeViews(s)), 'レベル3はかくれ線あり ' + i);
      total++;
    });
  });
  console.log('クイズ ' + total + ' 問: 完了');
})();

console.log('\n合格 ' + passes + ' / 不合格 ' + failures);
process.exit(failures ? 1 : 0);
