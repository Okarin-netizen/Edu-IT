/* 木材の簡易モデル:年輪・心材/辺材・方向別収縮
 * 座標は丸太の半径を 1 とした「丸太座標」(髄が原点、y は上向き) */
(function () {
  'use strict';
  var W = (M2.wood = {});

  W.BARK = 0.94;   // これより外側が樹皮
  W.HEART = 0.56;  // これより内側が心材
  W.PITH = 0.035;  // 髄
  // 方向別の収縮率(生材 → 全乾のおよその目安)
  W.sT = 0.10;  // 接線方向
  W.sR = 0.05;  // 半径方向
  W.sL = 0.005; // 繊維方向

  // 年輪の外周半径(内側ほど幅が広い:若い木はよく育つ)
  W.rings = (function () {
    var n = 22, ws = [], i, sum = 0;
    for (i = 0; i < n; i++) { var w = 1.25 - 0.55 * (i / (n - 1)) + 0.12 * Math.sin(i * 2.3); ws.push(w); sum += w; }
    var r = W.PITH, out = [];
    for (i = 0; i < n; i++) { r += (ws[i] / sum) * (W.BARK - W.PITH); out.push(r); }
    return out;
  })();

  /** 半径 u が何番目の年輪の、どのあたり(0=早材の始まり,1=晩材の終わり)か */
  W.ringAt = function (u) {
    var prev = W.PITH;
    for (var k = 0; k < W.rings.length; k++) {
      if (u < W.rings[k]) return { k: k, p: (u - prev) / (W.rings[k] - prev) };
      prev = W.rings[k];
    }
    return { k: W.rings.length, p: 1 };
  };

  // 開いた円を描くとき、±πちょうどだと割れの両側が同じ側に写るので少し内側から取る
  var EPS = 1e-4;
  function wrap(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a <= -Math.PI) a += 2 * Math.PI;
    return a;
  }
  W.wrap = wrap;

  /**
   * 乾燥による変形の写像。
   * 半径方向は sR、接線方向は sT だけ縮むので、髄まわりの角度が (1-sT)/(1-sR) 倍に閉じる。
   * phi0 は角度を閉じるときの基準の向き(材の中心の向き)。
   */
  W.deformer = function (s, ex, phi0) {
    var sR = W.sR * s * ex, sT = W.sT * s * ex;
    var k = (1 - sT) / (1 - sR);
    return function (x, y) {
      var r = Math.hypot(x, y);
      if (r < 1e-9) return [0, 0];
      var a = phi0 + wrap(Math.atan2(y, x) - phi0) * k;
      var r2 = r * (1 - sR);
      return [r2 * Math.cos(a), r2 * Math.sin(a)];
    };
  };

  /* ---------- 形(丸太座標の多角形) ---------- */
  W.rectPoly = function (cx, cy, w, h, rot, n) {
    n = n || 40;
    var pts = [], c = Math.cos(rot || 0), s = Math.sin(rot || 0);
    var corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    for (var e = 0; e < 4; e++) {
      var a = corners[e], b = corners[(e + 1) % 4];
      var m = (e % 2 === 0) ? n : Math.max(6, Math.round(n * h / w));
      for (var i = 0; i < m; i++) {
        var t = i / m, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        pts.push([cx + x * c - y * s, cy + x * s + y * c]);
      }
    }
    return pts;
  };
  W.circlePoly = function (cx, cy, r, n) {
    n = n || 120;
    var pts = [];
    for (var i = 0; i < n; i++) { var a = (i / n) * 2 * Math.PI; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return pts;
  };
  /** 丸太全体:割れの位置(phi0 の反対側)で開くように、髄から始まる扇形として持つ */
  W.logPoly = function (phi0, n) {
    n = n || 240;
    var pts = [[0, 0]];
    for (var i = 0; i <= n; i++) { var a = phi0 - Math.PI + EPS + (i / n) * (2 * Math.PI - 2 * EPS); pts.push([Math.cos(a), Math.sin(a)]); }
    return pts;
  };
  /** 扇形(髄を中心とする半径 r の円を phi0±π で開いたもの) */
  function piePoly(r, phi0, n) {
    var pts = [[0, 0]];
    for (var i = 0; i <= n; i++) { var a = phi0 - Math.PI + EPS + (i / n) * (2 * Math.PI - 2 * EPS); pts.push([r * Math.cos(a), r * Math.sin(a)]); }
    return pts;
  }
  function ringLine(r, phi0, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) { var a = phi0 - Math.PI + EPS + (i / n) * (2 * Math.PI - 2 * EPS); pts.push([r * Math.cos(a), r * Math.sin(a)]); }
    return pts;
  }

  W.centroid = function (pts) {
    var x = 0, y = 0;
    pts.forEach(function (p) { x += p[0]; y += p[1]; });
    return [x / pts.length, y / pts.length];
  };

  function pathPts(ctx, pts, map, close) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var q = map(pts[i][0], pts[i][1]);
      if (i === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
    }
    if (close) ctx.closePath();
  }
  W.pathPts = pathPts;

  /**
   * 材の木口(断面)を描く。
   * piece: { poly, phi0, isLog, kerf }
   * o: { map(x,y)->[X,Y](画面), px(1単位の画面長さ), layers, early, outline }
   */
  W.drawSection = function (ctx, piece, o) {
    var map = o.map, phi0 = piece.phi0 || 0;
    ctx.save();
    pathPts(ctx, piece.poly, map, true);
    ctx.clip();

    // 地の色:樹皮 → 辺材 → 心材
    pathPts(ctx, piePoly(1.0, phi0, 160), map, true);
    ctx.fillStyle = M2.col('bark'); ctx.fill();
    if (o.layers !== false) { ctx.fillStyle = M2.pattern(ctx, 'cross'); ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1; }
    pathPts(ctx, piePoly(W.BARK, phi0, 160), map, true);
    ctx.fillStyle = M2.col('sapwood'); ctx.fill();
    if (o.layers !== false) {
      ctx.fillStyle = M2.pattern(ctx, 'dots'); ctx.fill();
      pathPts(ctx, piePoly(W.HEART, phi0, 160), map, true);
      ctx.fillStyle = M2.col('heartwood'); ctx.fill();
      ctx.fillStyle = M2.pattern(ctx, 'hatch'); ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
    }

    // 年輪
    var px = o.px;
    for (var k = 0; k < W.rings.length; k++) {
      var r = W.rings[k], prev = k ? W.rings[k - 1] : W.PITH, width = r - prev;
      if (o.early !== false) {
        // 晩材の帯(太い線)
        var band = width * 0.28;
        ctx.lineWidth = Math.max(1.6, band * px);
        ctx.strokeStyle = M2.col('latewood');
        pathPts(ctx, ringLine(r - band / 2, phi0, 180), map, false);
        ctx.stroke();
        // 早材の境目(細い線)
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = M2.col('earlyline');
        pathPts(ctx, ringLine(prev + width * 0.08, phi0, 180), map, false);
        ctx.stroke();
      } else {
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = M2.col('latewood');
        pathPts(ctx, ringLine(r, phi0, 180), map, false);
        ctx.stroke();
      }
    }
    // 髄
    var pc = map(0, 0);
    ctx.fillStyle = M2.col('pith');
    ctx.beginPath(); ctx.arc(pc[0], pc[1], Math.max(2.5, W.PITH * px * 0.8), 0, 7); ctx.fill();
    // 背割り
    if (piece.kerf && o.s < 0.02) {
      var a1 = map(Math.cos(phi0 + Math.PI) * 0.12, Math.sin(phi0 + Math.PI) * 0.12);
      var a2 = map(Math.cos(phi0 + Math.PI) * 1.02, Math.sin(phi0 + Math.PI) * 1.02);
      ctx.strokeStyle = M2.col('ink'); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.stroke();
    }
    ctx.restore();

    // 輪郭
    if (o.outline !== false) {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.strokeStyle = o.outlineColor || M2.col('ink');
      ctx.lineWidth = o.outlineWidth || 2;
      if (piece.isLog) {
        // 割れの縁は乾燥が進んでいるときだけ線を引く
        var arc = piece.poly.slice(1);
        pathPts(ctx, arc, map, false);
        ctx.stroke();
        if (o.s > 0.02) {
          var p0 = map(0, 0), pa = map(arc[0][0], arc[0][1]), pb = map(arc[arc.length - 1][0], arc[arc.length - 1][1]);
          ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(p0[0], p0[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
        }
      } else {
        pathPts(ctx, piece.poly, map, true);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  /** 灰色の点線で形だけ描く(乾燥前の形など) */
  W.drawGhost = function (ctx, poly, map, close) {
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = M2.col('ghost');
    ctx.lineWidth = 1.6;
    pathPts(ctx, poly, map, close !== false);
    ctx.stroke();
    ctx.restore();
  };

  /* ---------- 板の面に出る木目(画素ごとに計算) ---------- */
  function smooth(a, b, x) { var t = M2.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  /**
   * board: { cx, cy, w, t, rot(0|90) }、face: +1/-1(板の法線の向き)
   * 横軸 = 板の長さ(繊維方向)、縦軸 = 板の幅
   */
  W.renderFace = function (ctx, x0, y0, wpx, hpx, board, face) {
    var scale = ctx.scale_ || 1;
    var PW = Math.max(2, Math.round(wpx * scale)), PH = Math.max(2, Math.round(hpx * scale));
    var img = ctx.createImageData(PW, PH), d = img.data;
    var th = board.rot * Math.PI / 180;
    var ax = Math.cos(th), ay = Math.sin(th), nx = -ay, ny = ax;
    var fx = board.cx + nx * face * board.t / 2, fy = board.cy + ny * face * board.t / 2;
    var cSapE = hexToRgb(M2.col('sapwood')), cSapL = hexToRgb(M2.col('sap-late'));
    var cHeaE = hexToRgb(M2.col('heartwood')), cHeaL = hexToRgb(M2.col('latewood'));
    var cBark = hexToRgb(M2.col('bark'));
    var fib = [];
    for (var j = 0; j < PH; j++) fib.push(Math.sin(j * 12.9898) * 43758.5453 % 1);
    for (j = 0; j < PH; j++) {
      var sAcross = (0.5 - (j + 0.5) / PH) * board.w; // 上が +側
      var px = fx + ax * sAcross, py = fy + ay * sAcross;
      var rr = Math.hypot(px, py), ang = Math.atan2(py, px);
      var noise = Math.abs(fib[j]) * 0.06;
      for (var i = 0; i < PW; i++) {
        var z = i / PW;
        var g = 1 + 0.075 * (z - 0.5) + 0.012 * Math.sin(z * 9 + 1.3) + 0.01 * Math.sin(3 * ang + z * 2.2);
        var u = rr / g;
        var col;
        if (u >= W.BARK) col = cBark;
        else {
          var ra = W.ringAt(u);
          var late = smooth(0.6, 0.82, ra.p);
          var heart = u < W.HEART;
          var e = heart ? cHeaE : cSapE, l = heart ? cHeaL : cSapL;
          col = [e[0] + (l[0] - e[0]) * late, e[1] + (l[1] - e[1]) * late, e[2] + (l[2] - e[2]) * late];
        }
        var k = (j * PW + i) * 4, f = 1 - noise;
        d[k] = col[0] * f; d[k + 1] = col[1] * f; d[k + 2] = col[2] * f; d[k + 3] = 255;
      }
    }
    // putImageData は変換行列を無視するので、画面の実ピクセル位置に置く
    ctx.putImageData(img, Math.round(x0 * scale), Math.round(y0 * scale));
  };

  /**
   * 板の木取りの判定。板の中央面で、年輪と板の面がなす角の平均を求める。
   * 90°に近い → 柾目、0°に近い → 板目
   */
  W.classify = function (board) {
    var th = board.rot * Math.PI / 180;
    var ax = Math.cos(th), ay = Math.sin(th), nx = -ay, ny = ax;
    var sum = 0, n = 41;
    for (var i = 0; i < n; i++) {
      var s = (i / (n - 1) - 0.5) * board.w;
      var x = board.cx + ax * s, y = board.cy + ay * s, r = Math.hypot(x, y) || 1e-9;
      var dot = Math.abs((x * nx + y * ny) / r);
      sum += Math.acos(M2.clamp(dot, 0, 1));
    }
    var deg = (sum / n) * 180 / Math.PI;
    var dn = board.cx * nx + board.cy * ny; // 髄から見た板の中心の、法線方向の距離
    var hasPith = Math.abs(dn) < board.t / 2 && Math.abs(board.cx * ax + board.cy * ay) < board.w / 2;
    var type = deg >= 60 ? 'masa' : deg <= 30 ? 'ita' : 'oimasa';
    return { deg: deg, type: type, hasPith: hasPith, omoteSign: dn >= 0 ? 1 : -1 };
  };
  W.TYPE_LABEL = {
    masa: '{柾目|まさめ}',
    ita: '{板目|いため}',
    oimasa: '{追柾目|おいまさめ}'
  };
})();
