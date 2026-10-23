/*
 * draw.js — 製作図(等角図・第三角法の三面図)と部品図を Canvas にかく
 * 立体の座標: x = 幅、y = 奥行き、z = 高さ。部品は直方体 {pos:[x,y,z], size:[sx,sy,sz]}。
 * 三面図は手前の部品で奥の部品をかくす「画家のアルゴリズム」で外形線をかく(かくれ線は省略)。
 */
(function (root) {
  'use strict';
  var COS30 = Math.cos(Math.PI / 6), SIN30 = 0.5;

  function colors() {
    return { ink: G.cssVar('--ink', '#222'), muted: G.cssVar('--muted', '#555'), dim: G.cssVar('--accent', '#1f6feb'), paper: '#ffffff', wood: G.cssVar('--wood-soft', '#f1dfc5') };
  }

  function bounds(boxes) {
    var mx = [Infinity, Infinity, Infinity], Mx = [-Infinity, -Infinity, -Infinity];
    boxes.forEach(function (b) {
      for (var i = 0; i < 3; i++) { mx[i] = Math.min(mx[i], b.pos[i]); Mx[i] = Math.max(Mx[i], b.pos[i] + b.size[i]); }
    });
    return { min: mx, max: Mx, W: Mx[0] - mx[0], D: Mx[1] - mx[1], H: Mx[2] - mx[2] };
  }

  // 寸法線: (x1,y1)-(x2,y2) の長さを、off だけ外側にずらしてかく。side: 'below'|'left'|'above'|'right'
  function dim(ctx, x1, y1, x2, y2, side, label, c) {
    var off = 26, ext = 6;
    ctx.save();
    ctx.strokeStyle = c.dim; ctx.fillStyle = c.dim; ctx.lineWidth = 1; ctx.setLineDash([]);
    var horiz = side === 'below' || side === 'above';
    var sgn = side === 'below' || side === 'right' ? 1 : -1;
    var ax1, ay1, ax2, ay2;
    if (horiz) { ay1 = ay2 = (side === 'below' ? Math.max(y1, y2) : Math.min(y1, y2)) + sgn * off; ax1 = x1; ax2 = x2; }
    else { ax1 = ax2 = (side === 'right' ? Math.max(x1, x2) : Math.min(x1, x2)) + sgn * off; ay1 = y1; ay2 = y2; }
    // 寸法補助線
    ctx.beginPath();
    if (horiz) {
      ctx.moveTo(x1, y1 + sgn * 3); ctx.lineTo(x1, ay1 + sgn * ext);
      ctx.moveTo(x2, y2 + sgn * 3); ctx.lineTo(x2, ay2 + sgn * ext);
    } else {
      ctx.moveTo(x1 + sgn * 3, y1); ctx.lineTo(ax1 + sgn * ext, y1);
      ctx.moveTo(x2 + sgn * 3, y2); ctx.lineTo(ax2 + sgn * ext, y2);
    }
    // 寸法線
    ctx.moveTo(ax1, ay1); ctx.lineTo(ax2, ay2);
    ctx.stroke();
    arrow(ctx, ax1, ay1, ax2, ay2); arrow(ctx, ax2, ay2, ax1, ay1);
    ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var mx = (ax1 + ax2) / 2, my = (ay1 + ay2) / 2;
    if (horiz) {
      ctx.fillStyle = c.paper; var w = ctx.measureText(label).width + 6; ctx.fillRect(mx - w / 2, my - 16, w, 13);
      ctx.fillStyle = c.dim; ctx.fillText(label, mx, my - 9);
    } else {
      ctx.translate(mx - 9, my); ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = c.paper; var w2 = ctx.measureText(label).width + 6; ctx.fillRect(-w2 / 2, -7, w2, 13);
      ctx.fillStyle = c.dim; ctx.fillText(label, 0, 0);
    }
    ctx.restore();
  }
  function arrow(ctx, x, y, fx, fy) {
    var a = Math.atan2(fy - y, fx - x), L = 8, s = 0.35;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + L * Math.cos(a + s), y + L * Math.sin(a + s));
    ctx.lineTo(x + L * Math.cos(a - s), y + L * Math.sin(a - s));
    ctx.closePath(); ctx.fill();
  }
  function fmt(n) { return String(Math.round(n * 10) / 10); }

  // 1つの投影図。view: 'front'|'top'|'right'。(ox, oy) は図の左下(キャンバス座標)
  function view(ctx, boxes, b, kind, ox, oy, s, c) {
    var items = boxes.map(function (bx) {
      var p = bx.pos, z = bx.size, r;
      if (kind === 'front') r = { u0: p[0], v0: p[2], u1: p[0] + z[0], v1: p[2] + z[2], depth: p[1] };            // 手前(y 小)ほど近い
      else if (kind === 'top') r = { u0: p[0], v0: p[1], u1: p[0] + z[0], v1: p[1] + z[1], depth: -(p[2] + z[2]) }; // 上(z 大)ほど近い
      else r = { u0: p[1], v0: p[2], u1: p[1] + z[1], v1: p[2] + z[2], depth: -(p[0] + z[0]) };                   // 右(x 大)ほど近い
      return r;
    });
    var u0 = kind === 'right' ? b.min[1] : b.min[0];
    var v0 = kind === 'top' ? b.min[1] : b.min[2];
    items.sort(function (a, q) { return q.depth - a.depth; }); // 遠いものから
    ctx.save();
    ctx.lineWidth = 2; ctx.strokeStyle = c.ink; ctx.fillStyle = c.paper; ctx.setLineDash([]); ctx.lineJoin = 'miter';
    items.forEach(function (r) {
      var x = ox + (r.u0 - u0) * s, y = oy - (r.v1 - v0) * s, w = (r.u1 - r.u0) * s, h = (r.v1 - r.v0) * s;
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    });
    ctx.restore();
  }

  // 等角図。(ox, oy) は原点(幅0・奥行き0・高さ0 の角)のキャンバス座標
  function iso(ctx, boxes, b, ox, oy, s, c) {
    function P(x, y, z) {
      x -= b.min[0]; y -= b.min[1]; z -= b.min[2];
      return [ox + (x + y) * COS30 * s, oy - ((y - x) * SIN30 + z) * s];
    }
    var items = boxes.slice().sort(function (a, q) {
      var na = a.pos[0] + a.size[0] / 2 - (a.pos[1] + a.size[1] / 2) + a.pos[2] + a.size[2] / 2;
      var nq = q.pos[0] + q.size[0] / 2 - (q.pos[1] + q.size[1] / 2) + q.pos[2] + q.size[2] / 2;
      return na - nq;
    });
    ctx.save();
    ctx.lineWidth = 1.6; ctx.strokeStyle = c.ink; ctx.lineJoin = 'round';
    items.forEach(function (bx) {
      var x0 = bx.pos[0], y0 = bx.pos[1], z0 = bx.pos[2], x1 = x0 + bx.size[0], y1 = y0 + bx.size[1], z1 = z0 + bx.size[2];
      var faces = [
        { pts: [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], fill: '#fbf3e6' }, // 上の面
        { pts: [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], fill: '#f1dfc5' }, // 正面
        { pts: [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], fill: '#e2c39b' }  // 右の面
      ];
      faces.forEach(function (f) {
        ctx.beginPath();
        f.pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
        ctx.closePath(); ctx.fillStyle = f.fill; ctx.fill(); ctx.stroke();
      });
    });
    ctx.restore();
    return P;
  }

  /* 組み立て図(三面図＋等角図)をかく。opts: {title, t} */
  function assembly(canvas, boxes, opts) {
    opts = opts || {};
    var c = colors();
    var cw = canvas.clientWidth || 900, ch = Math.round(Math.max(420, Math.min(760, cw * 0.72)));
    if (!boxes.length) { G.setupCanvas(canvas, cw, 10); return; }
    var b = bounds(boxes);
    var W = b.W, D = b.D, H = b.H;
    var isoW = (W + D) * COS30, isoH = (W + D) * SIN30 + H;
    var mL = 70, gap = 80, mT = opts.title ? 58 : 40, mB = 100; // 題名があるときは「平面図」の文字が題名に重ならないように下げる
    var s = Math.min((cw - mL - gap - 40 - 30) / (W + D + isoW), (ch - mT - gap - mB) / (D + H));
    s = Math.max(0.05, s);
    ch = Math.max(Math.round(mT + gap + mB + (D + H) * s), 300); // 図に合わせて高さを決める
    var ctx = G.setupCanvas(canvas, cw, ch);
    ctx.fillStyle = c.paper; ctx.fillRect(0, 0, cw, ch);
    var frontX = mL, frontY = mT + D * s + gap + H * s; // 正面図の左下
    var topY = mT + D * s;                               // 平面図の左下
    var rightX = mL + W * s + gap;
    view(ctx, boxes, b, 'front', frontX, frontY, s, c);
    view(ctx, boxes, b, 'top', frontX, topY, s, c);
    view(ctx, boxes, b, 'right', rightX, frontY, s, c);
    // 寸法
    dim(ctx, frontX, frontY, frontX + W * s, frontY, 'below', fmt(W), c);
    dim(ctx, frontX, frontY - H * s, frontX, frontY, 'left', fmt(H), c);
    dim(ctx, frontX, topY - D * s, frontX, topY, 'left', fmt(D), c);
    dim(ctx, rightX, frontY, rightX + D * s, frontY, 'below', fmt(D), c);
    // 図の名前
    ctx.fillStyle = c.muted; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('正面図', frontX + W * s / 2, frontY + 58);
    ctx.fillText('平面図', frontX + W * s / 2, mT - 12 > 12 ? mT - 14 : 14);
    ctx.fillText('右側面図', rightX + D * s / 2, frontY + 58);
    // 等角図(右上の空き)
    var isoS = Math.min(s, (cw - (rightX + D * s + 40) - 20) / isoW, (topY + 10) / isoH * 1.4);
    isoS = Math.max(0.05, Math.min(isoS, (ch * 0.5) / isoH));
    var iox = cw - 20 - isoW * isoS, ioy = Math.max(mT + isoH * isoS, topY + 10);
    ioy = Math.min(ioy, frontY - 10);
    var P = iso(ctx, boxes, b, iox, ioy - W * SIN30 * isoS, isoS, c);
    var o = P(b.max[0], b.min[1], b.min[2]);
    ctx.fillStyle = c.muted; ctx.textAlign = 'center';
    ctx.fillText('等角図', o[0], Math.min(ch - 8, o[1] + 22));
    // 注記
    ctx.textAlign = 'left'; ctx.fillStyle = c.muted; ctx.font = '12px sans-serif';
    ctx.fillText('第三角法 / 単位 mm' + (opts.t ? ' / 板の厚さ t' + fmt(opts.t) : '') + ' / 尺度は画面に合わせています', 10, ch - 10);
    if (opts.title) { ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = c.ink; ctx.fillText(opts.title, 10, 20); }
  }

  /* 部品図: 部品ごとに長さ×幅の長方形と寸法、厚さ t、木目の向き、個数 */
  function partsSheet(canvas, parts) {
    var c = colors();
    var cw = canvas.clientWidth || 900;
    var cols = cw > 760 ? 3 : cw > 480 ? 2 : 1;
    var cellW = cw / cols, cellH = 190;
    var rows = Math.max(1, Math.ceil(parts.length / cols));
    var ctx = G.setupCanvas(canvas, cw, rows * cellH + 10);
    ctx.fillStyle = c.paper; ctx.fillRect(0, 0, cw, rows * cellH + 10);
    // 全部の部品を同じ尺度でかく(同じ長さの部品が同じ長さに見えるように)
    var maxL = parts.reduce(function (m, p) { return Math.max(m, p.l || 0); }, 1);
    var maxW = parts.reduce(function (m, p) { return Math.max(m, p.w || 0); }, 1);
    var s = Math.min((cellW - 90) / maxL, 110 / maxW);
    parts.forEach(function (p, i) {
      var cx = (i % cols) * cellW, cy = Math.floor(i / cols) * cellH;
      var L = Math.max(0, p.l || 0), Wd = Math.max(0, p.w || 0);
      var w = Math.max(4, L * s), h = Math.max(4, Wd * s);
      var x = cx + 50, y = cy + 40;
      ctx.fillStyle = c.wood; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      if (p.grain) {
        ctx.save(); ctx.strokeStyle = '#b07a40'; ctx.lineWidth = 1;
        for (var gy = y + 6; gy < y + h - 3; gy += 8) { ctx.beginPath(); ctx.moveTo(x + 3, gy); ctx.lineTo(x + w - 3, gy); ctx.stroke(); }
        ctx.restore();
      }
      dim(ctx, x, y + h, x + w, y + h, 'below', fmt(L), c);
      dim(ctx, x, y, x, y + h, 'left', fmt(Wd), c);
      ctx.fillStyle = c.ink; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      var title = p.name + ' ×' + (p.qty || 1);
      ctx.fillText(title, cx + 12, cy + 22);
      // 厚さと木目の向きは名前の右に書く(横に長い部品でも図に重ならないように)
      var tx = cx + 12 + ctx.measureText(title).width + 10;
      ctx.font = '12px sans-serif'; ctx.fillStyle = c.muted;
      ctx.fillText('t' + fmt(p.t || 0) + (p.grain ? ' / 木目は長さ方向' : ''), tx, cy + 22);
    });
  }

  root.KidoriDraw = { assembly: assembly, partsSheet: partsSheet, bounds: bounds };
})(typeof self !== 'undefined' ? self : this);
