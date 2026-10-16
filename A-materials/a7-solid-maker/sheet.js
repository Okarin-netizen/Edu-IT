/* A7 第三角法 立体メーカー: 図面(A4 横)を SVG で作る・PDF にする
 * ブラウザでは window.SolidSheet、node では require('./sheet.js')(SVG と PDF の組み立てだけ)。
 *
 * SolidSheet.svg(solid, opt) → { svg: 'SVG の文字列', scale: 尺度(数) }
 *   opt: { cell: 1マスの mm, title, material, grade, cls, no, name, date,
 *          scale: 'auto' か 数(1, 0.5 …), dims: 寸法を入れる, detail: 細かい寸法も, iso: 等角図も入れる }
 * SolidSheet.toPDF(svg, title) → Promise<Blob>(ブラウザだけ。300dpi の画像を1ページの PDF に入れる)
 */
(function (root) {
  'use strict';
  var S = {};
  var Geom = root.SolidGeom || (typeof require !== 'undefined' ? require('./geom.js') : null);
  var PW = 297, PH = 210;          // 用紙 A4 横(mm)
  var FRAME = 10;                   // 輪郭線までの余白
  var LW = { frame: 0.7, outline: 0.5, hidden: 0.35, thin: 0.25, table: 0.35 };
  var FONT = "'BIZ UDPGothic','BIZ UDゴシック','Hiragino Kaku Gothic ProN','Noto Sans JP','Noto Sans CJK JP','Yu Gothic',Meiryo,sans-serif";
  var SCALES = [5, 2, 1, 1 / 2, 1 / 5, 1 / 10, 1 / 20];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function mmText(v) { var x = Math.round(v * 10) / 10; return String(x % 1 === 0 ? x.toFixed(0) : x.toFixed(1)); }
  S.scaleLabel = function (sc) { return sc >= 1 ? mmText(sc) + ':1' : '1:' + mmText(1 / sc); };

  function Pen() {
    var out = [];
    return {
      out: out,
      line: function (x1, y1, x2, y2, w, dash) {
        out.push('<line x1="' + r2(x1) + '" y1="' + r2(y1) + '" x2="' + r2(x2) + '" y2="' + r2(y2) + '" stroke="#000" stroke-width="' + w + '"' +
          (dash ? ' stroke-dasharray="' + dash + '"' : ' stroke-linecap="round"') + '/>');
      },
      rect: function (x, y, w, h, lw) { out.push('<rect x="' + r2(x) + '" y="' + r2(y) + '" width="' + r2(w) + '" height="' + r2(h) + '" fill="none" stroke="#000" stroke-width="' + lw + '"/>'); },
      // 欄の幅 maxW(mm)に入るように、文字を小さくする(それでも入らないときは … で切る)
      fit: function (x, y, s, size, anchor, maxW) {
        s = String(s == null ? '' : s);
        function w(t, z) { var n = 0; for (var i = 0; i < t.length; i++) n += t.charCodeAt(i) < 0x80 ? 0.55 : 1; return n * z; }
        var z = size;
        if (w(s, z) > maxW) z = Math.max(2.2, size * maxW / w(s, size));
        while (s.length > 1 && w(s, z) > maxW) s = s.slice(0, -2) + '…';
        this.text(x, y, s, r2(z), anchor);
      },
      text: function (x, y, s, size, anchor, rot, bold) {
        out.push('<text x="' + r2(x) + '" y="' + r2(y) + '" font-size="' + size + '" text-anchor="' + (anchor || 'start') + '"' +
          (bold ? ' font-weight="bold"' : '') + (rot ? ' transform="rotate(' + rot + ' ' + r2(x) + ' ' + r2(y) + ')"' : '') + '>' + esc(s) + '</text>');
      },
      raw: function (s) { out.push(s); }
    };
  }

  // 矢印(寸法線の端)。(x,y) が先、(dx,dy) は矢の向き
  function arrow(pen, x, y, dx, dy) {
    var L = 2.6, Wd = 0.55, bx = x - dx * L, by = y - dy * L;
    pen.raw('<path d="M' + r2(x) + ' ' + r2(y) + ' L' + r2(bx - dy * Wd) + ' ' + r2(by + dx * Wd) + ' L' + r2(bx + dy * Wd) + ' ' + r2(by - dx * Wd) + ' Z" fill="#000"/>');
  }
  // 横の寸法: 図の線の高さ fromY から、寸法線の高さ y まで補助線を引く
  function dimH(pen, x1, x2, fromY, y, value) {
    var s = y > fromY ? 1 : -1;
    pen.line(x1, fromY + s * 1, x1, y + s * 2, LW.thin);
    pen.line(x2, fromY + s * 1, x2, y + s * 2, LW.thin);
    pen.line(x1, y, x2, y, LW.thin);
    var d = x2 > x1 ? 1 : -1;
    arrow(pen, x1, y, -d, 0); arrow(pen, x2, y, d, 0);
    pen.text((x1 + x2) / 2, y - 0.8, value, 3.2, 'middle');
  }
  // たての寸法(文字は右から読む向き)
  function dimV(pen, y1, y2, fromX, x, value) {
    var s = x > fromX ? 1 : -1;
    pen.line(fromX + s * 1, y1, x + s * 2, y1, LW.thin);
    pen.line(fromX + s * 1, y2, x + s * 2, y2, LW.thin);
    pen.line(x, y1, x, y2, LW.thin);
    var d = y2 > y1 ? 1 : -1;
    arrow(pen, x, y1, 0, -d); arrow(pen, x, y2, 0, d);
    pen.text(x - 0.8, (y1 + y2) / 2, value, 3.2, 'middle', -90);
  }
  // 区切りの位置(小さい順・重なりなし)
  function stops(list) {
    var a = list.slice().sort(function (p, q) { return p - q; }), out = [];
    a.forEach(function (v) { if (!out.length || v - out[out.length - 1] > 1e-6) out.push(v); });
    return out;
  }

  // 第三角法の記号
  function projSymbol(pen, x, y) {
    // 円すい台を横から見た台形(左が大きい)と、右から見た2つの円
    pen.raw('<path d="M' + r2(x) + ' ' + r2(y - 3) + ' L' + r2(x + 7) + ' ' + r2(y - 1.6) + ' L' + r2(x + 7) + ' ' + r2(y + 1.6) + ' L' + r2(x) + ' ' + r2(y + 3) + ' Z" fill="none" stroke="#000" stroke-width="0.35"/>');
    pen.raw('<circle cx="' + r2(x + 13) + '" cy="' + r2(y) + '" r="3" fill="none" stroke="#000" stroke-width="0.35"/>');
    pen.raw('<circle cx="' + r2(x + 13) + '" cy="' + r2(y) + '" r="1.6" fill="none" stroke="#000" stroke-width="0.35"/>');
    pen.line(x - 1.5, y, x + 17.5, y, 0.18, '4 0.8 0.8 0.8');
  }

  S.svg = function (solid, opt) {
    opt = opt || {};
    var cell = +opt.cell || 10;
    var pen = Pen();
    // 輪郭線と中心マーク
    pen.rect(FRAME, FRAME, PW - 2 * FRAME, PH - 2 * FRAME, LW.frame);
    pen.line(PW / 2, 0, PW / 2, FRAME, LW.frame); pen.line(PW / 2, PH - FRAME, PW / 2, PH, LW.frame);
    pen.line(0, PH / 2, FRAME, PH / 2, LW.frame); pen.line(PW - FRAME, PH / 2, PW, PH / 2, LW.frame);

    // 表題欄(右下)と部品欄(その上)
    var TW = 120, TX = PW - FRAME - TW, RH = 8, TY = PH - FRAME - RH * 4;
    var who = [opt.grade ? opt.grade + '年' : '', opt.cls ? opt.cls + '組' : '', opt.no ? opt.no + '番' : ''].join('');
    var sc = 1;
    function cellBox(x, y, w, label, value, size) {
      pen.rect(x, y, w, RH, LW.table);
      if (label) pen.text(x + 1.5, y + 3.2, label, 2.3);
      if (value != null) pen.fit(x + (label ? w / 2 + 3 : w / 2), y + 6, value, size || 3.6, 'middle', w - (label ? 14 : 3));
    }
    // 尺度はあとで決まるので、表は最後に描く
    function titleBlock() {
      cellBox(TX, TY, 84, '図名', opt.title || '', 4.2);
      cellBox(TX + 84, TY, 36, '尺度', S.scaleLabel(sc));
      pen.rect(TX, TY + RH, 84, RH, LW.table); pen.text(TX + 1.5, TY + RH + 3.2, '投影法', 2.3);
      projSymbol(pen, TX + 32, TY + RH + 4.2); pen.text(TX + 53, TY + RH + 5.4, '第三角法', 3.2);
      cellBox(TX + 84, TY + RH, 36, '単位', 'mm');
      cellBox(TX, TY + RH * 2, 60, '年組番号', who);
      cellBox(TX + 60, TY + RH * 2, 60, '日付', opt.date || '');
      cellBox(TX, TY + RH * 3, 120, '氏名', opt.name || '', 4);
      pen.rect(TX, TY, TW, RH * 4, LW.frame);
      // 部品欄
      var PY = TY - 14, cols = [['品番', 12], ['品名', 42], ['材料', 32], ['個数', 12], ['備考', 22]], x = TX;
      cols.forEach(function (c, i) {
        pen.rect(x, PY, c[1], 7, LW.table); pen.text(x + c[1] / 2, PY + 4.9, c[0], 3, 'middle');
        var v = [1, opt.title || '', opt.material || '', 1, ''][i];
        pen.rect(x, PY + 7, c[1], 7, LW.table); pen.fit(x + c[1] / 2, PY + 11.9, v, 3.2, 'middle', c[1] - 2);
        x += c[1];
      });
      pen.rect(TX, PY, TW, 14, LW.frame);
    }

    if (!solid || solid.empty) {
      sc = 1; titleBlock();
      pen.text(PW / 2 - 40, PH / 2, '(まだ立体になっていません)', 6, 'middle');
      return { svg: wrap(pen.out.join('\n')), scale: sc };
    }

    var V = Geom.VIEWS;
    var dF = Geom.lineDrawing(solid, 'front'), dT = Geom.lineDrawing(solid, 'top'), dR = Geom.lineDrawing(solid, 'right');
    var mn = solid.min, mx = solid.max;
    var W = (mx[0] - mn[0]) * cell, D = (mx[1] - mn[1]) * cell, H = (mx[2] - mn[2]) * cell;

    // 寸法の区切り(図の線の端の位置)
    function chain(draw, idx, lo, hi) {
      var vals = [lo, hi];
      draw.visible.concat(draw.hidden).forEach(function (s) { vals.push(s[idx], s[idx + 2]); });
      return stops(vals);
    }
    var cx = chain(dF, 0, mn[0], mx[0]), cz = chain(dF, 1, mn[2], mx[2]), cy = chain(dR, 0, mn[1], mx[1]);

    // 図をかく場所
    var useIso = opt.iso !== false;
    var area = useIso ? { x0: FRAME + 6, y0: FRAME + 6, x1: TX - 8, y1: PH - FRAME - 6 } : { x0: FRAME + 6, y0: FRAME + 6, x1: PW - FRAME - 6, y1: TY - 18 };
    var gap = 14, dims = opt.dims !== false;
    function needRows(c, k) {
      if (!dims) return 0;
      if (!opt.detail || c.length < 3 || c.length > 11) return 1;
      for (var i = 1; i < c.length; i++) if ((c[i] - c[i - 1]) * cell * k < 5) return 1;
      return 2;
    }
    function size(k) {
      var mL = needRows(cz, k) * 8 + (dims ? 4 : 0), mB = Math.max(needRows(cx, k), needRows(cy, k)) * 8 + (dims ? 4 : 0);
      return { w: mL + W * k + gap + D * k, h: D * k + gap + H * k + mB, mL: mL, mB: mB };
    }
    var aw = area.x1 - area.x0, ah = area.y1 - area.y0;
    if (opt.scale && opt.scale !== 'auto') sc = +opt.scale;
    else {
      sc = SCALES[SCALES.length - 1];
      for (var i = 0; i < SCALES.length; i++) { var z = size(SCALES[i]); if (z.w <= aw && z.h <= ah) { sc = SCALES[i]; break; } }
    }
    var L = size(sc), k = cell * sc;
    var ox = area.x0 + (aw - L.w) / 2 + L.mL, top = area.y0 + (ah - L.h) / 2;
    var FX = ox, FY = top + D * sc + gap + H * sc;     // 正面図の左下
    var TY0 = top + D * sc;                             // 平面図の下(手前)
    var RX = FX + W * sc + gap;                         // 右側面図の左(手前)

    function place(draw, fx, fy, u0, v0) {
      function X(u) { return fx + (u - u0) * k; }
      function Y(v) { return fy - (v - v0) * k; }
      draw.hidden.forEach(function (s) { pen.line(X(s[0]), Y(s[1]), X(s[2]), Y(s[3]), LW.hidden, '2.4 0.9'); });
      draw.visible.forEach(function (s) { pen.line(X(s[0]), Y(s[1]), X(s[2]), Y(s[3]), LW.outline); });
    }
    place(dF, FX, FY, mn[0], mn[2]);
    place(dT, FX, TY0, mn[0], mn[1]);
    place(dR, RX, FY, mn[1], mn[2]);
    pen.text(FX + W * sc / 2, FY + L.mB + 5, '正面図', 3.4, 'middle');
    pen.text(FX + W * sc / 2, top - 2, '平面図', 3.4, 'middle');
    pen.text(RX + D * sc / 2, FY + L.mB + 5, '右側面図', 3.4, 'middle');

    if (dims) {
      var rowsX = needRows(cx, sc), rowsZ = needRows(cz, sc), rowsY = needRows(cy, sc);
      var by = FY + 8;
      if (rowsX === 2) { for (i = 1; i < cx.length; i++) dimH(pen, FX + (cx[i - 1] - mn[0]) * k, FX + (cx[i] - mn[0]) * k, FY, by, mmText((cx[i] - cx[i - 1]) * cell)); by += 8; }
      dimH(pen, FX, FX + W * sc, FY, by, mmText(W));
      var bx = FX - 8;
      if (rowsZ === 2) { for (i = 1; i < cz.length; i++) dimV(pen, FY - (cz[i - 1] - mn[2]) * k, FY - (cz[i] - mn[2]) * k, FX, bx, mmText((cz[i] - cz[i - 1]) * cell)); bx -= 8; }
      dimV(pen, FY, FY - H * sc, FX, bx, mmText(H));
      var ry = FY + 8;
      if (rowsY === 2) { for (i = 1; i < cy.length; i++) dimH(pen, RX + (cy[i - 1] - mn[1]) * k, RX + (cy[i] - mn[1]) * k, FY, ry, mmText((cy[i] - cy[i - 1]) * cell)); ry += 8; }
      dimH(pen, RX, RX + D * sc, FY, ry, mmText(D));
    }

    // 等角図(参考・尺度なし)
    if (useIso) {
      var dI = Geom.lineDrawing(solid, 'iso');
      var b = bounds(dI.visible);
      var IA = { x0: TX + 4, y0: FRAME + 12, x1: PW - FRAME - 4, y1: TY - 14 - 6 };
      var s2 = Math.min((IA.x1 - IA.x0) / (b.x1 - b.x0 || 1), (IA.y1 - IA.y0) / (b.y1 - b.y0 || 1)) * 0.9;
      var ix = IA.x0 + ((IA.x1 - IA.x0) - (b.x1 - b.x0) * s2) / 2 - b.x0 * s2;
      var iy = IA.y0 + ((IA.y1 - IA.y0) - (b.y1 - b.y0) * s2) / 2 + b.y1 * s2;
      dI.visible.forEach(function (s) { pen.line(ix + s[0] * s2, iy - s[1] * s2, ix + s[2] * s2, iy - s[3] * s2, LW.outline); });
      pen.text(TX + TW / 2, FRAME + 7, '等角図(参考・尺度なし)', 3.4, 'middle');
    }
    titleBlock();
    return { svg: wrap(pen.out.join('\n')), scale: sc };
  };
  function bounds(segs) {
    var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    segs.forEach(function (s) {
      b.x0 = Math.min(b.x0, s[0], s[2]); b.x1 = Math.max(b.x1, s[0], s[2]);
      b.y0 = Math.min(b.y0, s[1], s[3]); b.y1 = Math.max(b.y1, s[1], s[3]);
    });
    if (!isFinite(b.x0)) return { x0: 0, y0: 0, x1: 1, y1: 1 };
    return b;
  }
  S.bounds = bounds;
  function wrap(body) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + PW + ' ' + PH + '" width="' + PW + 'mm" height="' + PH + 'mm" font-family="' + FONT + '">' +
      '<rect x="0" y="0" width="' + PW + '" height="' + PH + '" fill="#fff"/>\n' + body + '\n</svg>';
  }

  /* ---------- PDF(1ページ・画像1枚) ---------- */
  function bytes(s) { // ASCII だけの文字列
    var a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255;
    return a;
  }
  function utf16hex(s) {
    var h = 'FEFF';
    for (var i = 0; i < s.length; i++) h += ('000' + s.charCodeAt(i).toString(16).toUpperCase()).slice(-4);
    return '<' + h + '>';
  }
  /* img: { data: Uint8Array, width, height, filter: 'FlateDecode'|'DCTDecode', color: 'DeviceGray'|'DeviceRGB' } → Uint8Array */
  S.buildPDF = function (img, title) {
    var w = 841.89, h = 595.28; // A4 横(pt)
    var parts = [], offs = [], pos = 0;
    function put(x) { var b = typeof x === 'string' ? bytes(x) : x; parts.push(b); pos += b.length; }
    function obj(n, body, stream) {
      offs[n] = pos;
      put(n + ' 0 obj\n' + body);
      if (stream) { put('\nstream\n'); put(stream); put('\nendstream'); }
      put('\nendobj\n');
    }
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + w + ' ' + h + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
    obj(4, '<< /Type /XObject /Subtype /Image /Width ' + img.width + ' /Height ' + img.height + ' /ColorSpace /' + img.color +
      ' /BitsPerComponent 8 /Filter /' + img.filter + ' /Length ' + img.data.length + ' >>', img.data);
    var content = 'q ' + w + ' 0 0 ' + h + ' 0 0 cm /Im0 Do Q';
    obj(5, '<< /Length ' + content.length + ' >>', bytes(content));
    obj(6, '<< /Title ' + utf16hex(title || '図面') + ' /Creator (Edu-IT A7) >>');
    var xref = pos;
    var x = 'xref\n0 7\n0000000000 65535 f \n';
    for (var i = 1; i <= 6; i++) x += ('000000000' + offs[i]).slice(-10) + ' 00000 n \n';
    put(x + 'trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    var out = new Uint8Array(pos), o = 0;
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  };

  // ブラウザ: SVG → 300dpi の画像 → PDF
  S.toPDF = function (svg, title) {
    var DPI = 300, W = Math.round(PW / 25.4 * DPI), H = Math.round(PH / 25.4 * DPI);
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error('図面を画像にできませんでした')); };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }).then(function (im) {
      var cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(im, 0, 0, W, H);
      if (typeof CompressionStream === 'undefined') {
        return new Promise(function (r) { cv.toBlob(r, 'image/jpeg', 0.95); }).then(function (b) { return b.arrayBuffer(); }).then(function (ab) {
          return { data: new Uint8Array(ab), width: W, height: H, filter: 'DCTDecode', color: 'DeviceRGB' };
        });
      }
      var px = ctx.getImageData(0, 0, W, H).data, gray = new Uint8Array(W * H);
      for (var i = 0, j = 0; j < gray.length; i += 4, j++) gray[j] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
      var cs = new Blob([gray]).stream().pipeThrough(new CompressionStream('deflate'));
      return new Response(cs).arrayBuffer().then(function (ab) {
        return { data: new Uint8Array(ab), width: W, height: H, filter: 'FlateDecode', color: 'DeviceGray' };
      });
    }).then(function (img) {
      return new Blob([S.buildPDF(img, title)], { type: 'application/pdf' });
    });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
  else root.SolidSheet = S;
})(typeof self !== 'undefined' ? self : this);
