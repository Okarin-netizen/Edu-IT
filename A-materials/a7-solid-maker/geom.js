/* A7 第三角法 立体メーカー: 三面図(マス目)から立体を作る計算(画面に依存しない)
 * ブラウザでは window.SolidGeom、node では require('./geom.js')。
 *
 * 座標: x = 幅(左→右)、y = 奥行き(手前→おく)、z = 高さ(下→上)。1マス = 1。
 * 三面図のマス(u: 右へ、v: 上へ、0 から):
 *   正面図 front[v*W+u]: u = x, v = z(手前から見る)
 *   平面図 top[v*W+u]  : u = x, v = y(上から見る。正面図の上に置き、下が手前)
 *   右側面図 side[v*D+u]: u = y, v = z(右から見る。正面図の右に置き、左が手前)
 * マスの値: 0 = 空き, 1 = ぬる, 2 ◣ 3 ◢ 4 ◥ 5 ◤(斜めに半分ぬる)
 *
 * 立体 = 3つの図をそれぞれの向きにのばした柱の重なり(共通部分)。
 * 1つの立方体を、斜めのマスの面で切ると凸多面体になるので、それを集めて外側の面だけを残す。
 */
(function (root) {
  'use strict';
  var G = {};
  var EPS = 1e-9;

  // 斜めのマス: マスの中の座標 (a: 右へ, b: 上へ, 0〜1) で n0*a + n1*b <= c の側をぬる
  var HALF = {
    2: [1, 1, 1],     // ◣ 左下
    3: [-1, 1, 0],    // ◢ 右下
    4: [-1, -1, -1],  // ◥ 右上
    5: [1, -1, 0]     // ◤ 左上
  };
  G.CELL_KINDS = [0, 1, 2, 3, 4, 5];
  G.CELL_CHAR = { 0: '.', 1: '#', 2: 'a', 3: 'b', 4: 'c', 5: 'd' };

  // マスの形が点 (a,b) をふくむか(tol > 0 で少し広く、< 0 で少しせまく)
  function contains(val, a, b, tol) {
    tol = tol || 0;
    if (!val) return false;
    if (a < -tol || a > 1 + tol || b < -tol || b > 1 + tol) return false;
    if (val === 1) return true;
    var h = HALF[val];
    return h[0] * a + h[1] * b <= h[2] + tol * Math.SQRT2;
  }
  G.contains = contains;

  /* ---------- 小さなベクトル計算 ---------- */
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function norm(a) { var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  G.vec = { sub: sub, add: add, mul: mul, dot: dot, cross: cross, len: len, norm: norm };

  // 多角形の面積ベクトル(Newell)
  function areaVec(pts) {
    var s = [0, 0, 0];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length];
      s[0] += (p[1] - q[1]) * (p[2] + q[2]);
      s[1] += (p[2] - q[2]) * (p[0] + q[0]);
      s[2] += (p[0] - q[0]) * (p[1] + q[1]);
    }
    return mul(s, 0.5);
  }
  function centroid(pts) {
    var c = [0, 0, 0];
    pts.forEach(function (p) { c = add(c, p); });
    return mul(c, 1 / pts.length);
  }
  // 平らな凸多角形の点を、法線 n のまわりに左回り(外から見て反時計回り)にならべる。同じ点は1つに
  function orderAround(pts, n) {
    var uniq = [];
    pts.forEach(function (p) {
      if (!uniq.some(function (q) { return Math.abs(p[0] - q[0]) < 1e-7 && Math.abs(p[1] - q[1]) < 1e-7 && Math.abs(p[2] - q[2]) < 1e-7; })) uniq.push(p);
    });
    if (uniq.length < 3) return uniq;
    var c = centroid(uniq);
    var e1 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    e1 = norm(sub(e1, mul(n, dot(e1, n))));
    var e2 = cross(n, e1);
    uniq.sort(function (p, q) {
      var dp = sub(p, c), dq = sub(q, c);
      return Math.atan2(dot(dp, e2), dot(dp, e1)) - Math.atan2(dot(dq, e2), dot(dq, e1));
    });
    // 一直線にならぶ点を取る
    var out = [];
    for (var i = 0; i < uniq.length; i++) {
      var a = uniq[(i + uniq.length - 1) % uniq.length], b = uniq[i], d = uniq[(i + 1) % uniq.length];
      if (len(cross(sub(b, a), sub(d, b))) > 1e-9) out.push(b);
    }
    return out;
  }

  /* ---------- 凸多面体(面の配列)と平面での切断 ---------- */
  function cube(i, j, k) {
    var x0 = i, x1 = i + 1, y0 = j, y1 = j + 1, z0 = k, z1 = k + 1;
    function F(n, pts) { return { n: n, pts: orderAround(pts, n) }; }
    return [
      F([-1, 0, 0], [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]]),
      F([1, 0, 0], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]),
      F([0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]),
      F([0, 1, 0], [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]),
      F([0, 0, -1], [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]]),
      F([0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]])
    ];
  }
  // N·p <= d の側を残す
  function clipPoly(faces, N, d) {
    var nn = norm(N), dd = d / len(N);
    var out = [], onPlane = [];
    faces.forEach(function (f) {
      var pts = f.pts, res = [];
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i], q = pts[(i + 1) % pts.length];
        var sp = dot(nn, p) - dd, sq = dot(nn, q) - dd;
        var pin = sp <= 1e-9, qin = sq <= 1e-9;
        if (pin) res.push(p);
        if (pin !== qin) {
          var t = sp / (sp - sq);
          var x = add(p, mul(sub(q, p), t));
          res.push(x); onPlane.push(x);
        }
        if (Math.abs(sp) <= 1e-9) onPlane.push(p);
      }
      if (res.length >= 3) {
        var o = orderAround(res, f.n);
        if (o.length >= 3 && len(areaVec(o)) > 1e-9) out.push({ n: f.n, pts: o });
      }
    });
    if (!out.length) return [];
    var cap = orderAround(onPlane, nn);
    if (cap.length >= 3 && len(areaVec(cap)) > 1e-9) out.push({ n: nn, pts: cap });
    return out;
  }

  /* ---------- 三面図のデータ ---------- */
  G.emptyModel = function (W, D, H) {
    return { W: W, D: D, H: H, front: zeros(W * H), top: zeros(W * D), side: zeros(D * H) };
  };
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  // 文字の行(上の行から)から作る: '.' 空き '#' ぬる 'a' ◣ 'b' ◢ 'c' ◥ 'd' ◤
  var CH = { '.': 0, '#': 1, 'a': 2, 'b': 3, 'c': 4, 'd': 5 };
  function fromRows(rows, U, V) {
    var a = zeros(U * V);
    for (var r = 0; r < V; r++) {
      var line = rows[r] || '', v = V - 1 - r;
      for (var u = 0; u < U; u++) a[v * U + u] = CH[line.charAt(u)] || 0;
    }
    return a;
  }
  function toRows(a, U, V) {
    var rows = [];
    for (var v = V - 1; v >= 0; v--) {
      var s = '';
      for (var u = 0; u < U; u++) s += G.CELL_CHAR[a[v * U + u]] || '.';
      rows.push(s);
    }
    return rows;
  }
  // {W,D,H, front:[行...], top:[行...], side:[行...]} (行は上から) → model
  G.modelFromRows = function (o) {
    return { W: o.W, D: o.D, H: o.H, front: fromRows(o.front, o.W, o.H), top: fromRows(o.top, o.W, o.D), side: fromRows(o.side, o.D, o.H) };
  };
  G.modelToRows = function (m) {
    return { W: m.W, D: m.D, H: m.H, front: toRows(m.front, m.W, m.H), top: toRows(m.top, m.W, m.D), side: toRows(m.side, m.D, m.H) };
  };
  // 大きさを変える(重なるところはそのまま残す)
  G.resizeModel = function (m, W, D, H) {
    function re(a, U0, V0, U, V) {
      var b = zeros(U * V);
      for (var v = 0; v < Math.min(V, V0); v++) for (var u = 0; u < Math.min(U, U0); u++) b[v * U + u] = a[v * U0 + u] || 0;
      return b;
    }
    return { W: W, D: D, H: H, front: re(m.front, m.W, m.H, W, H), top: re(m.top, m.W, m.D, W, D), side: re(m.side, m.D, m.H, D, H) };
  };
  G.isEmptyView = function (a) { return !a.some(function (v) { return v; }); };

  /* ---------- 立体を作る ---------- */
  // 3つの図 → 凸多面体の集まり(マスごと)
  function pieces(m) {
    var W = m.W, D = m.D, H = m.H, out = {};
    for (var k = 0; k < H; k++) for (var j = 0; j < D; j++) for (var i = 0; i < W; i++) {
      var f = m.front[k * W + i], t = m.top[j * W + i], s = m.side[k * D + j];
      if (!f || !t || !s) continue;
      var poly = cube(i, j, k), h;
      if (f > 1) { h = HALF[f]; poly = clipPoly(poly, [h[0], 0, h[1]], h[2] + h[0] * i + h[1] * k); }
      if (t > 1 && poly.length) { h = HALF[t]; poly = clipPoly(poly, [h[0], h[1], 0], h[2] + h[0] * i + h[1] * j); }
      if (s > 1 && poly.length) { h = HALF[s]; poly = clipPoly(poly, [0, h[0], h[1]], h[2] + h[0] * j + h[1] * k); }
      if (poly.length >= 4) out[i + ',' + j + ',' + k] = { i: i, j: j, k: k, faces: poly };
    }
    return out;
  }

  /* 2D の凸多角形(左回り)を半平面で切る。keepLeft: 辺 p→q の左側を残す */
  function area2(pts) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; }
    return s / 2;
  }
  function clip2(poly, p, q, keepLeft) {
    var out = [];
    function side(x) { var c = (q[0] - p[0]) * (x[1] - p[1]) - (q[1] - p[1]) * (x[0] - p[0]); return keepLeft ? c : -c; }
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b);
      if (sa >= -1e-12) out.push(a);
      if ((sa >= -1e-12) !== (sb >= -1e-12)) {
        var t = sa / (sa - sb);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  }
  // 凸多角形 A から凸多角形 B を引いた残り(凸多角形の配列)
  function diff2(A, B) {
    if (area2(B) < 0) B = B.slice().reverse();
    var rest = A, pieces = [];
    for (var i = 0; i < B.length && rest.length >= 3; i++) {
      var p = B[i], q = B[(i + 1) % B.length];
      var outP = clip2(rest, p, q, false);
      if (outP.length >= 3 && Math.abs(area2(outP)) > 1e-9) pieces.push(outP);
      rest = clip2(rest, p, q, true);
    }
    if (rest.length < 3 || Math.abs(area2(rest)) <= 1e-9) return pieces;
    return pieces;
  }

  // 外側に出ている面だけを集める
  function exposedFaces(P) {
    var faces = [];
    Object.keys(P).forEach(function (key) {
      var pc = P[key];
      pc.faces.forEach(function (f) {
        var ax = -1;
        for (var a = 0; a < 3; a++) if (Math.abs(Math.abs(f.n[a]) - 1) < 1e-9) ax = a;
        if (ax < 0) { faces.push({ n: f.n, pts: f.pts }); return; } // 斜めの面はいつも外側
        var dir = f.n[ax] > 0 ? 1 : -1;
        var idx = [pc.i, pc.j, pc.k];
        idx[ax] += dir;
        var nb = P[idx.join(',')];
        var other = nb && nb.faces.filter(function (g) { return Math.abs(g.n[ax] + dir) < 1e-9; })[0];
        if (!other) { faces.push({ n: f.n, pts: f.pts }); return; }
        var u = (ax + 1) % 3, v = (ax + 2) % 3, c = f.pts[0][ax];
        var A = f.pts.map(function (p) { return [p[u], p[v]]; });
        if (area2(A) < 0) A.reverse();
        var B = other.pts.map(function (p) { return [p[u], p[v]]; });
        diff2(A, B).forEach(function (pp) {
          var pts3 = pp.map(function (q) { var r = [0, 0, 0]; r[ax] = c; r[u] = q[0]; r[v] = q[1]; return r; });
          var o = orderAround(pts3, f.n);
          if (o.length >= 3) faces.push({ n: f.n, pts: o });
        });
      });
    });
    return faces;
  }

  function vkey(p) { return Math.round(p[0] * 1e5) + ',' + Math.round(p[1] * 1e5) + ',' + Math.round(p[2] * 1e5); }

  /* 面の辺を、その上にあるほかの点で分ける(T字のつなぎ目をなくす)。
   * 戻り値: 面ごとの「分けたあとの点の列」と、小さな辺 → その辺を持つ面の法線 */
  function splitEdges(faces) {
    var verts = {}, hash = {};
    faces.forEach(function (f) {
      f.pts.forEach(function (p) {
        var k = vkey(p);
        if (verts[k]) return;
        verts[k] = p;
        var hk = Math.floor(p[0] + 1e-7) + ',' + Math.floor(p[1] + 1e-7) + ',' + Math.floor(p[2] + 1e-7);
        (hash[hk] || (hash[hk] = [])).push({ k: k, p: p });
      });
    });
    var segs = {};
    faces.forEach(function (f, fi) {
      var ring = [];
      for (var i = 0; i < f.pts.length; i++) {
        var a = f.pts[i], b = f.pts[(i + 1) % f.pts.length], ab = sub(b, a), L2 = dot(ab, ab);
        var ka = vkey(a), kb = vkey(b);
        var on = [];
        var lo = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];
        var hi = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
        for (var X = Math.floor(lo[0] - 1e-6); X <= Math.floor(hi[0] + 1e-6); X++)
          for (var Y = Math.floor(lo[1] - 1e-6); Y <= Math.floor(hi[1] + 1e-6); Y++)
            for (var Z = Math.floor(lo[2] - 1e-6); Z <= Math.floor(hi[2] + 1e-6); Z++) {
              (hash[X + ',' + Y + ',' + Z] || []).forEach(function (v) {
                if (v.k === ka || v.k === kb) return;
                var t = dot(sub(v.p, a), ab) / L2;
                if (t <= 1e-9 || t >= 1 - 1e-9) return;
                if (len(sub(v.p, add(a, mul(ab, t)))) > 1e-6) return;
                on.push({ t: t, k: v.k, p: v.p });
              });
            }
        on.sort(function (x, y) { return x.t - y.t; });
        var chain = [{ k: ka, p: a }].concat(on, [{ k: kb, p: b }]);
        for (var c = 0; c < chain.length - 1; c++) {
          ring.push(chain[c].p);
          var k1 = chain[c].k, k2 = chain[c + 1].k;
          if (k1 === k2) continue;
          var sk = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
          var s = segs[sk] || (segs[sk] = { a: chain[c].p, b: chain[c + 1].p, normals: [], faces: [] });
          s.normals.push(f.n); s.faces.push(fi);
        }
      }
      f.ring = ring;
    });
    return segs;
  }

  // 折れ目(となりの面と向きがちがう辺)かどうか
  function isCrease(s) {
    if (s.normals.length < 2) return true;
    for (var i = 1; i < s.normals.length; i++) if (dot(s.normals[0], s.normals[i]) < 1 - 1e-6) return true;
    return false;
  }

  // 一直線にならぶ折れ目をつないで長い線にする
  function mergeLines(list) {
    var groups = {};
    list.forEach(function (s) {
      var d = norm(sub(s.b, s.a));
      for (var i = 0; i < 3; i++) { if (Math.abs(d[i]) > 1e-9) { if (d[i] < 0) d = mul(d, -1); break; } }
      var o = sub(s.a, mul(d, dot(s.a, d)));
      var key = d.map(function (x) { return Math.round(x * 1e4); }).join(',') + '/' + o.map(function (x) { return Math.round(x * 1e4); }).join(',');
      var g = groups[key] || (groups[key] = { d: d, o: o, iv: [] });
      var t1 = dot(s.a, d), t2 = dot(s.b, d);
      g.iv.push([Math.min(t1, t2), Math.max(t1, t2)]);
    });
    var out = [];
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      g.iv.sort(function (x, y) { return x[0] - y[0]; });
      var cur = null;
      g.iv.forEach(function (iv) {
        if (cur && iv[0] <= cur[1] + 1e-7) cur[1] = Math.max(cur[1], iv[1]);
        else { if (cur) out.push(cur); cur = [iv[0], iv[1]]; cur.g = g; }
      });
      if (cur) out.push(cur);
    });
    return out.map(function (iv) { return { a: add(iv.g.o, mul(iv.g.d, iv[0])), b: add(iv.g.o, mul(iv.g.d, iv[1])) }; });
  }

  /* 三面図 → 立体(面・折れ目の線・大きさ・体積) */
  G.build = function (m) {
    var P = pieces(m);
    var faces = exposedFaces(P);
    var segs = splitEdges(faces);
    var creases = [];
    faces.forEach(function (f) { f.edges = []; });
    Object.keys(segs).forEach(function (k) {
      var s = segs[k];
      if (!isCrease(s)) return;
      creases.push(s);
      s.faces.forEach(function (fi) { faces[fi].edges.push([s.a, s.b]); });
    });
    var lines = mergeLines(creases);
    var lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], vol = 0;
    faces.forEach(function (f) {
      f.pts.forEach(function (p) { for (var i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); } });
      vol += dot(f.pts[0], areaVec(f.pts)) / 3;
    });
    var empty = !faces.length;
    return { faces: faces, lines: lines, empty: empty, min: empty ? [0, 0, 0] : lo, max: empty ? [0, 0, 0] : hi, volume: vol, pieces: Object.keys(P).length };
  };

  /* ---------- 投影(図にする向き) ----------
   * toward: 見る人のほうへ向かう向き。proj(p) → [右へ, 上へ] */
  var C30 = Math.cos(Math.PI / 6), K = 0.5 * Math.cos(Math.PI / 4);
  G.VIEWS = {
    front: { toward: [0, -1, 0], proj: function (p) { return [p[0], p[2]]; } },
    top: { toward: [0, 0, 1], proj: function (p) { return [p[0], p[1]]; } },
    right: { toward: [1, 0, 0], proj: function (p) { return [p[1], p[2]]; } },
    iso: { toward: norm([1, -1, 1]), proj: function (p) { return [C30 * (p[0] + p[1]), 0.5 * (p[1] - p[0]) + p[2]]; } },
    // キャビネット図: 正面はそのままの形、奥行きは 45° の向きに半分の長さ
    cabinet: { toward: [K, -1, K], proj: function (p) { return [p[0] + K * p[1], p[2] + K * p[1]]; } }
  };

  /* 見える線・かくれ線を求める。戻り値 { visible:[[x1,y1,x2,y2]...], hidden:[...] }(2D、上が +) */
  G.lineDrawing = function (solid, viewName) {
    var V = G.VIEWS[viewName], w = V.toward, proj = V.proj;
    var occ = [];
    solid.faces.forEach(function (f) {
      var den = dot(f.n, w);
      if (den <= 1e-9) return; // 見る人に向いた面だけが前をふさぐ
      var p2 = f.pts.map(proj), x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      p2.forEach(function (q) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
      occ.push({ f: f, den: den, d: dot(f.n, f.pts[0]), x0: x0 - 1e-6, y0: y0 - 1e-6, x1: x1 + 1e-6, y1: y1 + 1e-6 });
    });
    function hidden(p) {
      var q = proj(p);
      for (var i = 0; i < occ.length; i++) {
        var o = occ[i];
        if (q[0] < o.x0 || q[0] > o.x1 || q[1] < o.y0 || q[1] > o.y1) continue;
        var t = (o.d - dot(o.f.n, p)) / o.den;
        if (t <= 1e-6) continue;
        var x = add(p, mul(w, t)), pts = o.f.pts, inside = true;
        for (var k = 0; k < pts.length; k++) {
          var a = pts[k], b = pts[(k + 1) % pts.length];
          if (dot(cross(sub(b, a), sub(x, a)), o.f.n) < -1e-7) { inside = false; break; }
        }
        if (inside) return true;
      }
      return false;
    }
    var vis = [], hid = [];
    solid.lines.forEach(function (L) {
      var a2 = proj(L.a), b2 = proj(L.b);
      if (Math.hypot(b2[0] - a2[0], b2[1] - a2[1]) < 1e-7) return; // 見る向きと平行な線は点になる
      var ab = sub(L.b, L.a), n = Math.max(3, Math.min(80, Math.ceil(len(ab) * 6)));
      function at(t) { return add(L.a, mul(ab, t)); }
      var state = [];
      for (var i = 0; i < n; i++) state.push(hidden(at((i + 0.5) / n)));
      // かわり目を二分法でくわしく求める
      var cuts = [0];
      for (i = 1; i < n; i++) {
        if (state[i] === state[i - 1]) continue;
        var lo = (i - 0.5) / n, hi = (i + 0.5) / n;
        for (var it = 0; it < 14; it++) { var mid = (lo + hi) / 2; if (hidden(at(mid)) === state[i - 1]) lo = mid; else hi = mid; }
        cuts.push((lo + hi) / 2);
      }
      cuts.push(1);
      for (i = 0; i < cuts.length - 1; i++) {
        var mid2 = (cuts[i] + cuts[i + 1]) / 2, h = hidden(at(mid2));
        var p = proj(at(cuts[i])), q = proj(at(cuts[i + 1]));
        (h ? hid : vis).push([p[0], p[1], q[0], q[1]]);
      }
    });
    return cleanup2D(vis, hid);
  };

  // 2D: 同じ直線上の線をまとめ、見える線と重なるかくれ線は消す
  function cleanup2D(vis, hid) {
    function key(s) {
      var dx = s[2] - s[0], dy = s[3] - s[1], L = Math.hypot(dx, dy);
      dx /= L; dy /= L;
      if (dx < -1e-9 || (Math.abs(dx) <= 1e-9 && dy < 0)) { dx = -dx; dy = -dy; }
      var off = s[0] * dy - s[1] * dx;
      return { k: Math.round(dx * 1e4) + ',' + Math.round(dy * 1e4) + ',' + Math.round(off * 1e4), dx: dx, dy: dy, off: off };
    }
    var groups = {};
    function put(list, kind) {
      list.forEach(function (s) {
        if (Math.hypot(s[2] - s[0], s[3] - s[1]) < 1e-7) return;
        var K2 = key(s), g = groups[K2.k] || (groups[K2.k] = { dx: K2.dx, dy: K2.dy, off: K2.off, v: [], h: [] });
        var t1 = s[0] * g.dx + s[1] * g.dy, t2 = s[2] * g.dx + s[3] * g.dy;
        g[kind].push([Math.min(t1, t2), Math.max(t1, t2)]);
      });
    }
    put(vis, 'v'); put(hid, 'h');
    function merge(iv) {
      iv.sort(function (a, b) { return a[0] - b[0]; });
      var out = [];
      iv.forEach(function (x) { var c = out[out.length - 1]; if (c && x[0] <= c[1] + 1e-6) c[1] = Math.max(c[1], x[1]); else out.push([x[0], x[1]]); });
      return out;
    }
    function minus(iv, cut) {
      var out = [];
      iv.forEach(function (x) {
        var parts = [[x[0], x[1]]];
        cut.forEach(function (c) {
          var nx = [];
          parts.forEach(function (p) {
            if (c[1] <= p[0] + 1e-6 || c[0] >= p[1] - 1e-6) { nx.push(p); return; }
            if (c[0] > p[0] + 1e-6) nx.push([p[0], c[0]]);
            if (c[1] < p[1] - 1e-6) nx.push([c[1], p[1]]);
          });
          parts = nx;
        });
        out = out.concat(parts);
      });
      return out.filter(function (p) { return p[1] - p[0] > 1e-6; });
    }
    var V = [], Hd = [];
    Object.keys(groups).forEach(function (k) {
      var g = groups[k], v = merge(g.v), h = minus(merge(g.h), v);
      function pt(t) { return [g.dx * t + g.dy * g.off, g.dy * t - g.dx * g.off]; }
      v.forEach(function (x) { var p = pt(x[0]), q = pt(x[1]); V.push([p[0], p[1], q[0], q[1]]); });
      h.forEach(function (x) { var p = pt(x[0]), q = pt(x[1]); Hd.push([p[0], p[1], q[0], q[1]]); });
    });
    return { visible: V, hidden: Hd };
  }
  G.cleanup2D = cleanup2D;

  /* ---------- 三面図どうしが合っているか ----------
   * ぬったのに立体にならない(ほかの図と合わない)マスの番号を、図ごとに返す */
  G.mismatches = function (m) {
    var W = m.W, D = m.D, H = m.H;
    var S = [0.15, 0.5, 0.85], T = [];
    for (var i = 0; i <= 24; i++) T.push(0.02 + 0.96 * i / 24);
    function samples(val) {
      var out = [];
      S.forEach(function (a) { S.forEach(function (b) { if (contains(val, a, b, -0.06)) out.push([a, b]); }); });
      if (!out.length) out.push(val === 2 ? [0.25, 0.25] : val === 3 ? [0.75, 0.25] : val === 4 ? [0.75, 0.75] : [0.25, 0.75]);
      return out;
    }
    // 視線の向きにならぶマスのどれかで、ほかの2つの図がその点をふくむか
    function coveredFront(i, k, a, b) {
      for (var j = 0; j < D; j++) {
        var t = m.top[j * W + i], s = m.side[k * D + j];
        if (!t || !s) continue;
        for (var q = 0; q < T.length; q++) if (contains(t, a, T[q], 1e-9) && contains(s, T[q], b, 1e-9)) return true;
      }
      return false;
    }
    function coveredTop(i, j, a, b) {
      for (var k = 0; k < H; k++) {
        var f = m.front[k * W + i], s = m.side[k * D + j];
        if (!f || !s) continue;
        for (var q = 0; q < T.length; q++) if (contains(f, a, T[q], 1e-9) && contains(s, b, T[q], 1e-9)) return true;
      }
      return false;
    }
    function coveredSide(j, k, a, b) {
      for (var i = 0; i < W; i++) {
        var f = m.front[k * W + i], t = m.top[j * W + i];
        if (!f || !t) continue;
        for (var q = 0; q < T.length; q++) if (contains(f, T[q], b, 1e-9) && contains(t, T[q], a, 1e-9)) return true;
      }
      return false;
    }
    var out = { front: [], top: [], side: [] };
    var u, v;
    for (v = 0; v < H; v++) for (u = 0; u < W; u++) {
      var f = m.front[v * W + u];
      if (f && samples(f).some(function (p) { return !coveredFront(u, v, p[0], p[1]); })) out.front.push(v * W + u);
    }
    for (v = 0; v < D; v++) for (u = 0; u < W; u++) {
      var t = m.top[v * W + u];
      if (t && samples(t).some(function (p) { return !coveredTop(u, v, p[0], p[1]); })) out.top.push(v * W + u);
    }
    for (v = 0; v < H; v++) for (u = 0; u < D; u++) {
      var s = m.side[v * D + u];
      if (s && samples(s).some(function (p) { return !coveredSide(u, v, p[0], p[1]); })) out.side.push(v * D + u);
    }
    out.count = out.front.length + out.top.length + out.side.length;
    return out;
  };

  /* ---------- STL(3D プリンタ用) ----------
   * 面を三角形に分ける(T字のつなぎ目の点も入れて、すき間のない形にする)。scale: 1マスの mm */
  G.triangles = function (solid, scale) {
    var tris = [];
    solid.faces.forEach(function (f) {
      var ring = f.ring || f.pts;
      if (ring.length < 3) return;
      if (ring.length === 3) { tris.push({ n: f.n, v: ring.map(function (p) { return mul(p, scale); }) }); return; }
      var c = centroid(f.pts);
      for (var i = 0; i < ring.length; i++) {
        var a = ring[i], b = ring[(i + 1) % ring.length];
        if (len(cross(sub(a, c), sub(b, c))) < 1e-12) continue;
        tris.push({ n: f.n, v: [mul(c, scale), mul(a, scale), mul(b, scale)] });
      }
    });
    return tris;
  };
  // バイナリ STL(ArrayBuffer)
  G.stlBinary = function (solid, scale, name) {
    var tris = G.triangles(solid, scale);
    var buf = new ArrayBuffer(84 + tris.length * 50), dv = new DataView(buf);
    var head = String(name || 'solid').replace(/[^\x20-\x7e]/g, '_').slice(0, 79);
    for (var i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i));
    dv.setUint32(80, tris.length, true);
    var o = 84;
    tris.forEach(function (t) {
      var vals = t.n.concat(t.v[0], t.v[1], t.v[2]);
      vals.forEach(function (x) { dv.setFloat32(o, x, true); o += 4; });
      dv.setUint16(o, 0, true); o += 2;
    });
    return buf;
  };

  /* ---------- 立体を3Dで見る(回す)ための投影 ---------- */
  // yaw: 上から見て左回り(度)、pitch: 見下ろす角度(度)。戻り値 {toward, right, up}
  G.camera = function (yaw, pitch) {
    var y = yaw * Math.PI / 180, p = pitch * Math.PI / 180;
    // yaw = 0, pitch = 0 で正面(手前)から見る
    var toward = [Math.sin(y) * Math.cos(p), -Math.cos(y) * Math.cos(p), Math.sin(p)];
    var right = [Math.cos(y), Math.sin(y), 0];
    return { toward: toward, right: right, up: norm(cross(toward, right)) };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.SolidGeom = G;
})(typeof self !== 'undefined' ? self : this);
