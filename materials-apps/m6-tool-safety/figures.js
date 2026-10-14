/*
 * M6 工具の使い方・安全トレーナー 図(自作SVG)
 * 手順カードの図は tools-data.js の fig: [[部品名, {…}], …] を組み合わせて描く。
 * 教科書の図は使わず、簡単な形だけで工具と動きを表す。
 * KYT の場面図は scene(id) で描く。
 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var seq = 0;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function n(v, d) { return v === undefined ? d : v; }

  /* ---------- 部品 ---------- */
  var P = {
    // 作業台 {x, w, y}
    bench: function (o) {
      var x = n(o.x, 10), w = n(o.w, 220), y = n(o.y, 130), fl = n(o.floor, 178);
      return '<g class="f-bench"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="12" rx="2"/>' +
        '<rect x="' + (x + 12) + '" y="' + (y + 12) + '" width="10" height="' + (178 - y) + '"/>' +
        '<rect x="' + (x + w - 22) + '" y="' + (y + 12) + '" width="10" height="' + (178 - y) + '"/></g>';
    },
    // 板 {x,y,w,h, metal, grain:'h'|'slant'|false}
    board: function (o) {
      var x = n(o.x, 40), y = n(o.y, 110), w = n(o.w, 240), h = n(o.h, 20);
      var s = '<g class="' + (o.metal ? 'f-metal' : 'f-wood') + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/>';
      if (!o.metal && o.grain !== false) {
        for (var i = 1; i < 4; i++) {
          var gy = y + (h * i) / 4;
          if (o.grain === 'slant') s += '<path class="f-grain" d="M' + x + ' ' + (gy + h / 6) + ' L' + (x + w) + ' ' + (gy - h / 6) + '"/>';
          else s += '<path class="f-grain" d="M' + (x + 4) + ' ' + gy + ' Q' + (x + w / 2) + ' ' + (gy + (i % 2 ? 2 : -2)) + ' ' + (x + w - 4) + ' ' + gy + '"/>';
        }
      }
      return s + '</g>';
    },
    // 両刃のこぎり。(x,y)=刃の下側(横びきの歯)の中央、a=角度(負で柄が上がる)。
    // 両側に歯を描く: 上側=縦びき(大きめの歯)、下側=横びき(細かい歯)。double は古いデータのために受け付けるだけ
    saw: function (o) {
      var t = 'translate(' + n(o.x, 160) + ' ' + n(o.y, 110) + ') rotate(' + n(o.a, 0) + ')';
      var fine = '', coarse = '', i;
      // 下側: 横びき。細かい歯(間かく 4、高さ 3.5)
      for (i = -80; i < 60; i += 4) fine += 'L' + (i + 2) + ' 3.5 L' + (i + 4) + ' 0 ';
      // 上側: 縦びき。大きめの歯(間かく 10、高さ 7、のこぎり形)
      for (i = 60; i > -80; i -= 10) coarse += 'L' + (i - 3) + ' -33 L' + (i - 10) + ' -26 ';
      return '<g transform="' + t + '"><path class="f-metal" d="M-80 0 ' + fine + 'L60 0 L60 -26 ' + coarse + 'Z"/>' +
        '<rect class="f-handle" x="60" y="-19" width="70" height="12" rx="5"/></g>';
    },
    // 平かんな。(x,y)=台の下面の中央
    plane: function (o) {
      var t = 'translate(' + n(o.x, 160) + ' ' + n(o.y, 110) + ') rotate(' + n(o.a, 0) + ')';
      return '<g transform="' + t + '"><rect class="f-wood-dark" x="-55" y="-26" width="110" height="26" rx="3"/>' +
        '<path class="f-metal" d="M-14 -44 L-4 -44 L8 0 L-1 0 Z"/>' +
        (o.nolabel ? '' : '<text class="f-small" x="-50" y="-31">だいがしら</text><text class="f-small" x="22" y="-31">だいじり</text>') + '</g>';
    },
    // げんのう。(x,y)=打撃面の中心、柄は右へ伸びる
    hammer: function (o) {
      var t = 'translate(' + n(o.x, 160) + ' ' + n(o.y, 80) + ') rotate(' + n(o.a, 0) + ')';
      var s = '<g transform="' + t + '"><rect class="f-handle" x="8" y="-30" width="' + n(o.len, 120) + '" height="10" rx="4"/>' +
        '<rect class="f-metal" x="-11" y="-50" width="22" height="50" rx="3"/>';
      if (o.crack) s += '<path class="f-crack" d="M14 -30 l6 4 l-4 3 l6 3"/>';
      return s + '</g>';
    },
    // くぎ {x, y(先), h}
    nail: function (o) {
      var x = n(o.x, 160), y = n(o.y, 130), h = n(o.h, 36);
      return '<g class="f-metal"><path d="M' + (x - 1.5) + ' ' + (y - h) + ' L' + (x + 1.5) + ' ' + (y - h) + ' L' + (x + 1) + ' ' + (y - 3) + ' L' + x + ' ' + y + ' L' + (x - 1) + ' ' + (y - 3) + ' Z"/>' +
        '<rect x="' + (x - 6) + '" y="' + (y - h - 3) + '" width="12" height="3"/></g>';
    },
    // きり {x, y(刃先), a}
    awl: function (o) {
      var t = 'translate(' + n(o.x, 160) + ' ' + n(o.y, 110) + ') rotate(' + n(o.a, 0) + ')';
      return '<g transform="' + t + '"><path class="f-metal" d="M0 0 L-3 -8 L-2 -34 L2 -34 L3 -8 Z"/>' +
        '<rect class="f-handle" x="-5" y="-110" width="10" height="78" rx="4"/></g>';
    },
    // 鉄工やすり {x, y, a}  (x,y)=刃の中央
    file: function (o) {
      var t = 'translate(' + n(o.x, 160) + ' ' + n(o.y, 100) + ') rotate(' + n(o.a, 0) + ')';
      var hatch = '';
      for (var i = -84; i < 46; i += 6) hatch += 'M' + i + ' -5 l4 10 ';
      return '<g transform="' + t + '"><path class="f-metal" d="M-90 -4 L50 -6 L50 6 L-90 4 Z"/>' +
        '<path class="f-grain" d="' + hatch + '"/>' +
        '<path class="f-metal" d="M50 -2 L62 -2 L62 2 L50 2 Z"/>' +
        '<rect class="f-handle" x="58" y="-8" width="56" height="16" rx="6"/></g>';
    },
    // けがき針 {x, y(針先), a, cap}
    scriber: function (o) {
      var t = 'translate(' + n(o.x, 160) + ' ' + n(o.y, 100) + ') rotate(' + n(o.a, 0) + ')';
      var s = '<g transform="' + t + '"><path class="f-metal" d="M0 0 L-2 -16 L-2 -100 L2 -100 L2 -16 Z"/>' +
        '<rect class="f-knurl" x="-4" y="-80" width="8" height="40" rx="2"/>';
      if (o.cap) s += '<rect class="f-cap" x="-5" y="-22" width="10" height="26" rx="4"/>';
      return s + '</g>';
    },
    // 鉛筆 {x, y(先), a}
    pencil: function (o) {
      var t = 'translate(' + n(o.x, 160) + ' ' + n(o.y, 100) + ') rotate(' + n(o.a, 0) + ')';
      return '<g transform="' + t + '"><path class="f-handle" d="M0 0 L-4 -12 L-4 -80 L4 -80 L4 -12 Z"/><path class="f-ink" d="M0 0 L-1.6 -5 L1.6 -5 Z"/></g>';
    },
    // さしがね(上から見た図) {x, y(内側の角), long, short}
    square: function (o) {
      var x = n(o.x, 60), y = n(o.y, 60), L = n(o.long, 220), S = n(o.short, 100);
      var s = '<g class="f-metal"><path d="M' + x + ' ' + y + ' L' + (x + L) + ' ' + y + ' L' + (x + L) + ' ' + (y - 10) + ' L' + (x - 8) + ' ' + (y - 10) + ' L' + (x - 8) + ' ' + (y + S) + ' L' + x + ' ' + (y + S) + ' Z"/>';
      for (var i = 20; i < L; i += 20) s += '<path class="f-tick" d="M' + (x + i) + ' ' + (y - 10) + ' v4"/>';
      for (i = 20; i < S; i += 20) s += '<path class="f-tick" d="M' + (x - 8) + ' ' + (y + i) + ' h4"/>';
      return s + '</g>';
    },
    // C形クランプ {x, top(板の上面), bottom(台の下面), pads}
    clamp: function (o) {
      var x = n(o.x, 80), top = n(o.top, 110), bot = n(o.bottom, 142);
      var s = '<g class="f-clamp"><path d="M' + (x - 26) + ' ' + (top - 16) + ' L' + (x + 8) + ' ' + (top - 16) + ' L' + (x + 8) + ' ' + (top - 8) +
        ' L' + (x - 18) + ' ' + (top - 8) + ' L' + (x - 18) + ' ' + (bot + 14) + ' L' + (x + 8) + ' ' + (bot + 14) + ' L' + (x + 8) + ' ' + (bot + 22) + ' L' + (x - 26) + ' ' + (bot + 22) + ' Z"/>' +
        '<rect class="f-metal" x="' + (x - 3) + '" y="' + (bot + 2) + '" width="6" height="26"/>' +
        '<rect class="f-handle" x="' + (x - 14) + '" y="' + (bot + 28) + '" width="28" height="6" rx="3"/>' +
        '<rect class="f-metal" x="' + (x - 7) + '" y="' + bot + '" width="14" height="4"/>';
      if (o.pads) {
        s += '<rect class="f-pad" x="' + (x - 12) + '" y="' + (top - 8) + '" width="24" height="8"/>' +
          '<rect class="f-pad" x="' + (x - 12) + '" y="' + (bot - 4) + '" width="24" height="0"/>';
      }
      return s + '</g>';
    },
    // 手の位置 {x, y, t:ラベル}
    hand: function (o) {
      var x = n(o.x, 100), y = n(o.y, 100);
      return '<g class="f-hand"><ellipse cx="' + x + '" cy="' + y + '" rx="15" ry="11"/>' +
        '<path d="M' + (x - 9) + ' ' + (y - 4) + ' h12 M' + (x - 9) + ' ' + y + ' h14 M' + (x - 9) + ' ' + (y + 4) + ' h12"/>' +
        (o.t ? '<text class="f-label" x="' + (x + n(o.dx, 0)) + '" y="' + (y + n(o.dy, -16)) + '" text-anchor="middle">' + esc(o.t) + '</text>' : '') + '</g>';
    },
    // 目と視線 {x, y, tx, ty, t}
    eye: function (o) {
      var x = n(o.x, 60), y = n(o.y, 40);
      var s = '<g class="f-eye"><path d="M' + (x - 14) + ' ' + y + ' Q' + x + ' ' + (y - 11) + ' ' + (x + 14) + ' ' + y + ' Q' + x + ' ' + (y + 11) + ' ' + (x - 14) + ' ' + y + ' Z"/>' +
        '<circle cx="' + x + '" cy="' + y + '" r="4"/></g>';
      if (o.tx !== undefined) s += '<path class="f-sight" d="M' + x + ' ' + (y + 8) + ' L' + o.tx + ' ' + o.ty + '"/>';
      if (o.t) s += '<text class="f-label" x="' + (x + 20) + '" y="' + (y + 4) + '">' + esc(o.t) + '</text>';
      return s;
    },
    // 矢印 {x1,y1,x2,y2,t, dash, tx, ty}
    arrow: function (o, id) {
      var s = '<path class="f-arrow' + (o.dash ? ' dash' : '') + '" d="M' + o.x1 + ' ' + o.y1 + ' L' + o.x2 + ' ' + o.y2 + '" marker-end="url(#' + id + ')"/>';
      if (o.t) s += '<text class="f-label" x="' + n(o.tx, (o.x1 + o.x2) / 2) + '" y="' + n(o.ty, (o.y1 + o.y2) / 2 - 8) + '" text-anchor="middle">' + esc(o.t) + '</text>';
      return s;
    },
    // 回転を表す円弧の矢印 {x, y, r, t}
    turn: function (o, id) {
      var x = n(o.x, 160), y = n(o.y, 60), r = n(o.r, 18);
      return '<path class="f-arrow" d="M' + (x - r) + ' ' + y + ' A' + r + ' ' + (r * 0.45) + ' 0 1 0 ' + (x + r) + ' ' + (y - 2) + '" marker-end="url(#' + id + ')"/>' +
        (o.t ? '<text class="f-label" x="' + (x + r + 6) + '" y="' + (y + 4) + '">' + esc(o.t) + '</text>' : '');
    },
    // 角度の弧 {x, y, r, from, to(度、SVG の向き), t}
    angle: function (o) {
      var x = n(o.x, 160), y = n(o.y, 110), r = n(o.r, 50);
      var a1 = n(o.from, 0) * Math.PI / 180, a2 = n(o.to, -30) * Math.PI / 180;
      var p1 = [x + r * Math.cos(a1), y + r * Math.sin(a1)], p2 = [x + r * Math.cos(a2), y + r * Math.sin(a2)];
      var sweep = a2 > a1 ? 1 : 0, mid = (a1 + a2) / 2;
      return '<path class="f-angle" d="M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' A' + r + ' ' + r + ' 0 0 ' + sweep + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1) + '"/>' +
        (o.t ? '<text class="f-label" x="' + (x + (r + 14) * Math.cos(mid)).toFixed(1) + '" y="' + (y + (r + 14) * Math.sin(mid) + 4).toFixed(1) + '" text-anchor="' + n(o.anchor, 'start') + '">' + esc(o.t) + '</text>' : '');
    },
    // 線 {x1,y1,x2,y2, dash, cls}
    line: function (o) {
      return '<path class="' + (o.cls || 'f-mark') + (o.dash ? ' dash' : '') + '" d="M' + o.x1 + ' ' + o.y1 + ' L' + o.x2 + ' ' + o.y2 + '"/>';
    },
    // 文字 {x, y, t, anchor, cls}
    text: function (o) {
      return '<text class="' + (o.cls || 'f-label') + '" x="' + o.x + '" y="' + o.y + '" text-anchor="' + (o.anchor || 'start') + '">' + esc(o.t) + '</text>';
    },
    // ○・× の札 {x, y, ok, t}
    mark: function (o) {
      var x = n(o.x, 40), y = n(o.y, 30);
      return '<g class="' + (o.ok ? 'f-ok' : 'f-ng') + '"><circle cx="' + x + '" cy="' + y + '" r="13"/>' +
        '<text x="' + x + '" y="' + (y + 6) + '" text-anchor="middle" class="f-markchar">' + (o.ok ? '○' : '×') + '</text>' +
        (o.t ? '<text class="f-label" x="' + (x + 18) + '" y="' + (y + 5) + '">' + esc(o.t) + '</text>' : '') + '</g>';
    },
    // 点検マーク(虫めがね) {x, y, t}
    check: function (o) {
      var x = n(o.x, 100), y = n(o.y, 60);
      return '<g class="f-check"><circle cx="' + x + '" cy="' + y + '" r="11"/><path d="M' + (x + 8) + ' ' + (y + 8) + ' l10 10"/></g>' +
        (o.t ? '<text class="f-label" x="' + (x + 18) + '" y="' + (y - 6) + '">' + esc(o.t) + '</text>' : '');
    }
  };

  function defs(id) {
    return '<defs><marker id="' + id + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path class="f-arrowhead" d="M0 0 L10 5 L0 10 Z"/></marker></defs>';
  }

  // fig: [[部品名, {…}], …] → SVG 文字列
  function draw(fig, label, vb) {
    var id = 'm6arr' + (++seq);
    var body = (fig || []).map(function (part) {
      var fn = P[part[0]];
      return fn ? fn(part[1] || {}, id) : '';
    }).join('');
    return '<svg class="m6-fig" viewBox="' + (vb || '0 0 320 180') + '" role="img" aria-label="' + esc(label || '') + '" focusable="false">' +
      defs(id) + body + '</svg>';
  }

  /* ---------- 人物(KYT 用) ---------- */
  // {x(頭の中心), y(頭の中心), hair:'long'|'tied'|'short', sleeve:'loose', goggles, arms:[[x,y],[x,y]], face:'left'|'right'}
  function person(o) {
    var x = o.x, y = o.y, s = '<g class="k-person">';
    if (o.hair === 'long') s += '<path class="k-hair" d="M' + (x - 15) + ' ' + (y - 4) + ' Q' + (x - 22) + ' ' + (y + 30) + ' ' + (x - 10) + ' ' + (y + 52) + ' L' + (x + 10) + ' ' + (y + 52) + ' Q' + (x + 22) + ' ' + (y + 30) + ' ' + (x + 15) + ' ' + (y - 4) + ' Z"/>';
    if (o.hair === 'tied') s += '<circle class="k-hair" cx="' + (x + (o.face === 'left' ? 14 : -14)) + '" cy="' + (y - 8) + '" r="7"/>';
    s += '<rect class="k-body" x="' + (x - 18) + '" y="' + (y + 18) + '" width="36" height="58" rx="10"/>';
    s += '<circle class="k-head" cx="' + x + '" cy="' + y + '" r="16"/>';
    s += '<path class="k-hair" d="M' + (x - 16) + ' ' + (y - 2) + ' Q' + x + ' ' + (y - 26) + ' ' + (x + 16) + ' ' + (y - 2) + ' Q' + x + ' ' + (y - 12) + ' ' + (x - 16) + ' ' + (y - 2) + ' Z"/>';
    if (o.goggles) s += '<rect class="k-goggles" x="' + (x - 13) + '" y="' + (y - 4) + '" width="26" height="9" rx="4"/>';
    (o.arms || []).forEach(function (a, i) {
      var sx = x + (i ? 14 : -14), sy = y + 26;
      s += '<path class="k-arm' + (o.sleeve === 'loose' ? ' loose' : '') + '" d="M' + sx + ' ' + sy + ' L' + a[0] + ' ' + a[1] + '"/>';
      if (o.sleeve === 'loose') s += '<path class="k-sleeve" d="M' + sx + ' ' + sy + ' L' + ((sx + a[0]) / 2 - 8) + ' ' + ((sy + a[1]) / 2 + 10) + ' L' + ((sx + a[0]) / 2 + 8) + ' ' + ((sy + a[1]) / 2 + 12) + ' Z"/>';
      s += '<circle class="k-handp" cx="' + a[0] + '" cy="' + a[1] + '" r="6"/>';
    });
    s += '<rect class="k-leg" x="' + (x - 14) + '" y="' + (y + 76) + '" width="11" height="44" rx="4"/><rect class="k-leg" x="' + (x + 3) + '" y="' + (y + 76) + '" width="11" height="44" rx="4"/>';
    return s + '</g>';
  }

  /* ---------- KYT の場面(400×260) ---------- */
  // 人物は y=106 で床(226)に立つ
  var SCENES = {
    // のこぎりで板を切る場面
    saw: function () {
      return '<rect class="k-floor" x="0" y="226" width="400" height="34"/>' +
        // 作業する人(長い髪)は台の向こう側
        person({ x: 372, y: 106, hair: 'long', face: 'left', arms: [[338, 74], [250, 128]] }) +
        P.bench({ x: 40, w: 200, y: 150, floor: 226 }) +
        // 固定されていない板(クランプなし)
        P.board({ x: 70, y: 132, w: 250, h: 18 }) +
        P.line({ x1: 262, y1: 132, x2: 262, y2: 150, dash: true }) +
        P.saw({ x: 262, y: 128, a: -28 }) +
        // 切断線のすぐそばを押さえる手
        '<circle class="k-handp" cx="250" cy="128" r="7"/>' +
        // 作業台の端からはみ出したげんのう
        P.hammer({ x: 52, y: 150, len: 90 }) +
        // 床の木片
        '<rect class="f-wood" x="300" y="234" width="46" height="9" transform="rotate(-8 323 238)"/>' +
        '<rect class="f-wood" x="250" y="240" width="22" height="7"/>';
    },
    // 工作室での移動・受けわたし
    room: function () {
      return '<rect class="k-floor" x="0" y="226" width="400" height="34"/>' +
        // 作業中の人と、そのすぐ後ろを通る人
        person({ x: 80, y: 106, hair: 'tied', arms: [[52, 124], [108, 124]] }) +
        P.bench({ x: 10, w: 140, y: 140, floor: 226 }) +
        P.board({ x: 24, y: 124, w: 112, h: 16 }) +
        person({ x: 160, y: 106, hair: 'short', face: 'left', arms: [[146, 176], [174, 176]] }) +
        P.arrow({ x1: 140, y1: 92, x2: 112, y2: 92 }, ARR) +
        // 刃先を相手に向けて手わたす
        person({ x: 250, y: 106, hair: 'short', sleeve: 'loose', face: 'right', arms: [[300, 128], [228, 172]] }) +
        person({ x: 375, y: 106, hair: 'tied', face: 'left', arms: [[356, 132], [388, 176]] }) +
        P.awl({ x: 352, y: 128, a: -90 }) +
        // 通路をまたぐコード
        '<path class="k-cord" d="M170 260 Q200 230 240 246 T330 238 L400 232"/>';
    },
    // げんのうでくぎを打つ場面
    hammer: function () {
      return '<rect class="k-floor" x="0" y="226" width="400" height="34"/>' +
        // のぞきこむ友だち(台の向こう側)
        person({ x: 226, y: 104, hair: 'short', arms: [[204, 150], [250, 150]] }) +
        P.bench({ x: 30, w: 200, y: 160, floor: 226 }) +
        // 台から大きくはみ出した材料
        P.board({ x: 100, y: 140, w: 230, h: 20 }) +
        P.nail({ x: 280, y: 152, h: 34 }) +
        // 作業する人と、柄にひびのあるげんのう
        person({ x: 375, y: 106, hair: 'tied', face: 'left', arms: [[345, 67], [272, 124]] }) +
        P.hammer({ x: 280, y: 92, len: 76, crack: true });
    }
  };

  var ARR = '';
  function scene(id, label) {
    var fn = SCENES[id];
    var aid = ARR = 'm6arr' + (++seq);
    return '<svg class="m6-scene" viewBox="0 0 400 260" role="img" aria-label="' + esc(label || '') + '">' +
      defs(aid) + (fn ? fn() : '') + '<g class="k-marks"></g><g class="k-cursor"></g></svg>';
  }

  window.M6Fig = { draw: draw, scene: scene, parts: P };
})();
