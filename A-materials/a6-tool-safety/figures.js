/*
 * A6 工具の使い方・安全トレーナー 図(自作SVG)
 * 手順カードの図は tools-data.js の fig: [[部品名, {…}], …] を組み合わせて描く。
 * 教科書の図は使わず、自分で描いた形で「どの工具か」「どう持つか」「どこが危ないか」を表す。
 *   - 手は「にぎる手(grip)」「おさえる手(press)」「ひらいた手(palm)」「つまむ手(pinch)」の4種類。うでは画面の外へのびる
 *   - 工具の部品に hand: true を付けると、その工具を正しくにぎった手もいっしょに描く
 *   - 安全の点は「!の三角(warn)」「近づけない場所(ng)」「○よい/×だめの枠(panel)」で示す
 * KYT の場面図は scene(id) で描く。
 */
(function () {
  'use strict';
  var seq = 0;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function n(v, d) { return v === undefined ? d : v; }
  function r1(v) { return Math.round(v * 10) / 10; }
  // 点 (x,y) を a 度まわす(SVG の rotate と同じ向き)
  function rot(a, x, y) {
    var r = a * Math.PI / 180;
    return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
  }
  function tf(o, dx, dy) {
    return 'translate(' + n(o.x, dx) + ' ' + n(o.y, dy) + ') rotate(' + n(o.a, 0) + ')' + (o.s ? ' scale(' + o.s + ')' : '');
  }
  function label(x, y, t, anchor, cls) {
    return t ? '<text class="' + (cls || 'f-label') + '" x="' + r1(x) + '" y="' + r1(y) + '" text-anchor="' + (anchor || 'start') + '">' + esc(t) + '</text>' : '';
  }

  /* ---------- 手とうで ---------- */
  // はだの形: 同じ形を「ふち」と「中」の2回かいて、指の間に線が出るようにする
  function skin(shapes) { return '<g class="f-skin-o">' + shapes + '</g><g class="f-skin">' + shapes + '</g>'; }
  // うで: 手首 (x1,y1) から (x2,y2)(ふつうは画面の外)へ。先のほうは そで
  function arm(x1, y1, x2, y2) {
    var mx = r1(x1 + (x2 - x1) * 0.42), my = r1(y1 + (y2 - y1) * 0.42);
    var d = 'M' + r1(x1) + ' ' + r1(y1) + ' L' + r1(x2) + ' ' + r1(y2), ds = 'M' + mx + ' ' + my + ' L' + r1(x2) + ' ' + r1(y2);
    return '<path class="f-arm-o" d="' + d + '"/><path class="f-arm" d="' + d + '"/>' +
      '<path class="f-sleeve-o" d="' + ds + '"/><path class="f-sleeve" d="' + ds + '"/>';
  }
  // にぎる手(横から見た にぎりこぶし)。柄は横向きに (cx,cy) を通る。flip で親指が下になる
  function fist(cx, cy, ax, ay, flip) {
    var body = '<rect x="-13" y="-10" width="26" height="21" rx="8"/>' +
      '<circle cx="-9" cy="9.5" r="4.6"/><circle cx="-3" cy="11" r="4.6"/><circle cx="3" cy="11" r="4.6"/><circle cx="9" cy="9.5" r="4.6"/>';
    var thumb = '<path d="M-14 -5 Q-10 -15 3 -13 Q13 -12 13 -7 Q13 -3 6 -4 L-10 -1 Z"/>';
    return arm(cx, cy, ax, ay) + '<g transform="translate(' + r1(cx) + ' ' + r1(cy) + ')' + (flip ? ' scale(1 -1)' : '') + '">' +
      skin(body) + '<path class="f-crease" d="M-6 2 v10 M0 3 v11 M6 2 v10"/>' + skin(thumb) + '</g>';
  }
  // ひらいた手(上から見た手の甲)。指は -y 向き、手首は +y。右手(flip で左手)
  var PALM = '<rect x="-13" y="-12" width="26" height="25" rx="8"/>' +
    '<rect x="-13" y="-33" width="5.8" height="26" rx="2.9"/><rect x="-6.5" y="-36" width="5.8" height="29" rx="2.9"/>' +
    '<rect x="0" y="-34" width="5.8" height="27" rx="2.9"/><rect x="6.6" y="-28" width="5.4" height="21" rx="2.7"/>' +
    '<rect x="-3.5" y="-21" width="7" height="21" rx="3.5" transform="translate(-11 8) rotate(-55)"/>';
  // おさえる手(横から見た、手のひらを下にした手)。下の面が y=0、指は -x 向き
  var PRESS = '<path d="M-31 0 Q-34 0 -33 -3.5 Q-31 -7.5 -22 -8 L-6 -10 Q3 -16 13 -14 Q19 -12 19 -5 L19 0 Z"/>';
  var PRESS_THUMB = '<rect x="-4" y="-27" width="7.5" height="22" rx="3.7" transform="rotate(8 -1 -6)"/>';
  // つまむ手(横から見た親指と人さし指)。指先が原点、手は -x 側
  var PINCH = '<rect x="-46" y="-15" width="25" height="25" rx="9"/>' +
    '<rect x="-31" y="-10" width="32" height="6.5" rx="3.2"/><rect x="-27" y="-0.5" width="28" height="7" rx="3.5"/>';

  /* ---------- 部品 ---------- */
  var P = {
    // 作業台 {x, w, y}
    bench: function (o) {
      var x = n(o.x, 10), w = n(o.w, 220), y = n(o.y, 130), fl = n(o.floor, 178);
      return '<g class="f-bench"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="12" rx="2"/>' +
        '<rect x="' + (x + 12) + '" y="' + (y + 12) + '" width="10" height="' + (fl - y) + '"/>' +
        '<rect x="' + (x + w - 22) + '" y="' + (y + 12) + '" width="10" height="' + (fl - y) + '"/></g>';
    },
    // 板 {x,y,w,h, metal, grain:'h'|'slant'|'v'|false}
    board: function (o) {
      var x = n(o.x, 40), y = n(o.y, 110), w = n(o.w, 240), h = n(o.h, 20);
      var s = '<g class="' + (o.metal ? 'f-metal' : (o.cls || 'f-wood')) + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/>';
      if (!o.metal && o.grain !== false) {
        var k = Math.max(3, Math.round(h / 9)), gr = '', i;
        for (i = 1; i < k; i++) {
          var gy = y + (h * i) / k, gx = x + (w * i) / k;
          if (o.grain === 'slant') gr += 'M' + x + ' ' + r1(gy + h / 3) + ' L' + (x + w) + ' ' + r1(gy - h / 3) + ' ';
          else if (o.grain === 'v') gr += 'M' + r1(gx) + ' ' + (y + 3) + ' Q' + r1(gx + (i % 2 ? 2 : -2)) + ' ' + (y + h / 2) + ' ' + r1(gx) + ' ' + (y + h - 3) + ' ';
          else gr += 'M' + (x + 4) + ' ' + r1(gy) + ' Q' + (x + w / 2) + ' ' + r1(gy + (i % 2 ? 2 : -2)) + ' ' + (x + w - 4) + ' ' + r1(gy) + ' ';
        }
        if (o.grain === 'end') {
          gr = '';
          for (i = 1; i <= 4; i++) gr += 'M' + r1(x + w / 2 - i * w / 9) + ' ' + (y + h) + ' A' + r1(i * w / 9) + ' ' + r1(i * h / 3.2) + ' 0 0 1 ' + r1(x + w / 2 + i * w / 9) + ' ' + (y + h) + ' ';
          s += '<clipPath id="' + o._id + 'c"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/></clipPath>' +
            '<path class="f-grain" clip-path="url(#' + o._id + 'c)" d="' + gr + '"/>';
        } else if (o.grain === 'slant') {
          for (i = 1; i < k; i++) gr += 'M' + x + ' ' + r1(y + (h * i) / k + h + h / 3) + ' L' + (x + w) + ' ' + r1(y + (h * i) / k + h - h / 3) + ' ';
          for (i = 1; i < k; i++) gr += 'M' + x + ' ' + r1(y + (h * i) / k - h + h / 3) + ' L' + (x + w) + ' ' + r1(y + (h * i) / k - h - h / 3) + ' ';
          s += '<clipPath id="' + o._id + 'c"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/></clipPath>' +
            '<path class="f-grain" clip-path="url(#' + o._id + 'c)" d="' + gr + '"/>';
        } else s += '<path class="f-grain" d="' + gr + '"/>';
      }
      return s + '</g>';
    },
    // 両刃のこぎり。(x,y)=下側の刃(横びき)の、首から 40 はなれた点。a=角度(負で柄が上がる)
    // 刃は先(-x)ほど幅が広い。上側=縦びき(大きな歯)、下側=横びき(細かい歯)。hand: 柄をにぎる手
    saw: function (o) {
      var fine = '', coarse = '', i;
      function yu(x) { return r1(-27 - (40 - x) * 11 / 130); }
      for (i = 40; i > -90; i -= 4) fine += 'L' + (i - 2) + ' 3.5 L' + (i - 4) + ' 0 ';
      for (i = -90; i < 40; i += 9) coarse += 'L' + (i + 3) + ' ' + r1(yu(i + 3) - 6) + ' L' + (i + 9) + ' ' + yu(i + 9) + ' ';
      var wrap = '';
      for (i = 70; i < 146; i += 7) wrap += 'M' + i + ' -21 l3 14 ';
      var s = '<g transform="' + tf(o, 160, 110) + '"><path class="f-metal" d="M40 0 ' + fine + 'L-90 ' + yu(-90) + ' ' + coarse + 'Z"/>' +
        '<path class="f-metal" d="M40 -22 L64 -18 L64 -10 L40 -5 Z"/>' +
        '<rect class="f-handle" x="62" y="-21" width="88" height="14" rx="6"/><path class="f-wrap" d="' + wrap + '"/>';
      if (o.hand) s += fist(112, -14, n(o.ax, 230), n(o.ay, 30));
      return s + '</g>';
    },
    // 平かんな。(x,y)=台の下面の中央。左=だいがしら、右=だいじり(手前に引く向き=右)
    // hand: 右手で台とかんな身をにぎり、左手で台がしらをおさえる。nolabel: 名前を出さない
    plane: function (o) {
      var s = '<g transform="' + tf(o, 160, 110) + '">' +
        '<rect class="f-wood-dark" x="-60" y="-26" width="120" height="26" rx="3"/>' +
        '<path class="f-grain" d="M-56 -17 Q0 -19 56 -16 M-56 -9 Q0 -7 56 -10"/>' +
        '<path class="f-hidden" d="M-12 0 L21.3 -26"/>' +
        '<path class="f-metal" d="M14 -26 L40 -46.5 L44.5 -43 L20 -26 Z"/>' +
        '<path class="f-blade" d="M21.3 -26 L49 -48 L56 -39 L36 -26 Z"/>' +
        '<path class="f-bladetip" d="M-13 0 L-9 0 L-12 2.5 Z"/>';
      if (!o.nolabel) s += label(-58, -33, 'だいがしら', 'start', 'f-small') + label(58, -50, 'だいじり', 'end', 'f-small');
      if (o.hand) {
        s += arm(-30, -40, 30, -200) + '<g transform="translate(-36 -26)">' + skin(PRESS) + '<path class="f-crease" d="M-22 -8 v6 M-14 -9 v7"/></g>' +
          fist(36, -24, 190, 40);
      }
      return s + '</g>';
    },
    // げんのう。(x,y)=下の打つ面の中心、柄は右へ伸びる。round:'down' で下が曲面(木殺し面)、ふつうは上が曲面
    // hand: 柄の端をにぎる手。near: 頭の近くをにぎる(悪い例)。crack: 柄のひび
    hammer: function (o) {
      var len = n(o.len, 120), down = o.round === 'down';
      var s = '<g transform="' + tf(o, 160, 80) + '">' +
        '<path class="f-handle" d="M10 -31 L' + (12 + len) + ' -33 Q' + (17 + len) + ' -27 ' + (12 + len) + ' -20 L10 -21 Z"/>' +
        '<rect class="f-metal" x="-12" y="-52" width="24" height="52" rx="2"/>' +
        '<path class="f-band" d="M-12 -45 h24 M-12 -7 h24"/>' +
        (down ? '<path class="f-metal" d="M-12 0 Q0 8 12 0 Z"/>' : '<path class="f-metal" d="M-12 -52 Q0 -60 12 -52 Z"/>');
      if (o.crack) s += '<path class="f-crack" d="M18 -34 l5 4 l-4 3 l6 4"/>';
      if (o.hand) s += o.near ? fist(32, -26, n(o.ax, 120), n(o.ay, 60)) : fist(len - 6, -26, n(o.ax, len + 80), n(o.ay, 60));
      return s + '</g>';
    },
    // くぎ {x, y(先), h}
    nail: function (o) {
      var x = n(o.x, 160), y = n(o.y, 130), h = n(o.h, 36);
      return '<g class="f-metal"><path d="M' + (x - 1.8) + ' ' + (y - h) + ' L' + (x + 1.8) + ' ' + (y - h) + ' L' + (x + 1.3) + ' ' + (y - 4) + ' L' + x + ' ' + y + ' L' + (x - 1.3) + ' ' + (y - 4) + ' Z"/>' +
        '<rect x="' + (x - 7) + '" y="' + (y - h - 3) + '" width="14" height="3.5" rx="1"/></g>';
    },
    // 三つ目ぎり {x, y(刃先), a}。hand:'rub' 両手のひらで柄をはさむ。hand:'carry' 柄をにぎる
    awl: function (o) {
      var s = '<g transform="' + tf(o, 160, 110) + '">' +
        '<path class="f-metal" d="M0 0 L-3.5 -9 L-2.2 -48 L2.2 -48 L3.5 -9 Z"/>' +
        '<rect class="f-metal" x="-5" y="-55" width="10" height="7" rx="1"/>' +
        '<path class="f-handle" d="M-5.5 -55 L-7 -130 Q0 -137 7 -130 L5.5 -55 Z"/>';
      if (o.hand === 'rub') {
        // 手のひらを向かい合わせて柄をはさむ(指は上向き)
        var mitt = '<rect x="0" y="-26" width="12" height="48" rx="6"/><rect x="-3" y="2" width="8" height="17" rx="4" transform="rotate(-25 1 10)"/>';
        s += arm(-14, -78, -150, -60) + arm(14, -78, 150, -60) +
          '<g transform="translate(-19 -100)">' + skin(mitt) + '<path class="f-crease" d="M5 -20 v14 M8 -21 v14"/></g>' +
          '<g transform="translate(19 -100) scale(-1 1)">' + skin(mitt) + '<path class="f-crease" d="M5 -20 v14 M8 -21 v14"/></g>';
      }
      if (o.hand === 'carry') s += '<g transform="rotate(-90 0 -95)">' + fist(0, -95, 100, -10, true) + '</g>';
      return s + '</g>';
    },
    // 鉄工やすり {x, y, a}。(x,y)=刃の中央。nohandle: 柄のないやすり(こみが出ている)
    // hand: 柄をにぎる手、tiphand: 先をおさえる左手
    file: function (o) {
      var t = '', i;
      for (i = -86; i < 38; i += 5) t += 'M' + i + ' -4.5 l3 9 M' + (i + 3) + ' -4.5 l-3 9 ';
      var s = '<g transform="' + tf(o, 160, 100) + '"><path class="f-metal" d="M-90 -3.5 L40 -6 L40 6 L-90 3.5 Z"/>' +
        '<path class="f-filecut" d="' + t + '"/>' +
        '<path class="f-metal" d="M40 -3.5 L62 -1 L62 1 L40 3.5 Z"/>';
      if (!o.nohandle) s += '<rect class="f-handle" x="56" y="-8.5" width="62" height="17" rx="7"/><rect class="f-metal" x="54" y="-8.5" width="7" height="17" rx="1.5"/>';
      if (o.hand) s += fist(90, 0, 180, 60);
      if (o.tiphand) s += arm(-84, -15, -130, -110) + '<g transform="translate(-70 -6) scale(-1 1)">' + skin(PRESS) + '<path class="f-crease" d="M-22 -8 v6 M-14 -9 v7"/></g>';
      return s + '</g>';
    },
    // けがき針 {x, y(針先), a, cap}
    scriber: function (o) {
      var s = '<g transform="' + tf(o, 160, 100) + '"><path class="f-metal" d="M0 0 L-2.5 -16 L-2.5 -110 L2.5 -110 L2.5 -16 Z"/>' +
        '<rect class="f-knurl" x="-5" y="-86" width="10" height="44" rx="2"/>';
      if (o.cap) s += '<rect class="f-cap" x="-6" y="-24" width="12" height="28" rx="5"/>';
      return s + '</g>';
    },
    // 鉛筆 {x, y(先), a}
    pencil: function (o) {
      return '<g transform="' + tf(o, 160, 100) + '"><path class="f-pencil" d="M0 0 L-5 -14 L-5 -84 L5 -84 L5 -14 Z"/><path class="f-wood-soft" d="M0 0 L-5 -14 L5 -14 Z"/><path class="f-ink" d="M0 0 L-1.8 -5 L1.8 -5 Z"/></g>';
    },
    // さしがね(上から見た図) {x, y(内側の角), long, short}。長手は右へ、妻手は下へ
    square: function (o) {
      var x = n(o.x, 60), y = n(o.y, 60), L = n(o.long, 220), S = n(o.short, 100), w = n(o.w, 10);
      var s = '<g class="f-metal"><path d="M' + x + ' ' + y + ' L' + (x + L) + ' ' + y + ' L' + (x + L) + ' ' + (y - w) + ' L' + (x - w) + ' ' + (y - w) + ' L' + (x - w) + ' ' + (y + S) + ' L' + x + ' ' + (y + S) + ' Z"/>';
      for (var i = 10; i < L; i += 10) s += '<path class="f-tick" d="M' + (x + i) + ' ' + (y - w) + ' v' + (i % 50 ? 3 : 6) + '"/>';
      for (i = 10; i < S; i += 10) s += '<path class="f-tick" d="M' + (x - w) + ' ' + (y + i) + ' h' + (i % 50 ? 3 : 6) + '"/>';
      s += '</g>';
      // flip: 上下を返す(長手が下、妻手が上へのびる)
      return o.flip ? '<g transform="translate(0 ' + (2 * y) + ') scale(1 -1)">' + s + '</g>' : s;
    },
    // C形クランプ {x(ねじの位置), top(板の上面), bottom(台の下面), pads(当て木)}
    clamp: function (o) {
      var x = n(o.x, 80), top = n(o.top, 110), bot = n(o.bottom, 142), pad = o.pads ? 7 : 0;
      var j1 = top - pad, j2 = bot + pad;
      var d = 'M' + (x + 9) + ' ' + (j1 - 5) + ' H' + (x - 26) + ' Q' + (x - 36) + ' ' + (j1 - 5) + ' ' + (x - 36) + ' ' + (j1 + 6) +
        ' V' + (j2 + 8) + ' Q' + (x - 36) + ' ' + (j2 + 18) + ' ' + (x - 26) + ' ' + (j2 + 18) + ' H' + (x + 9);
      var s = '<g class="f-clamp"><path class="f-clamp-o" d="' + d + '"/><path class="f-clamp-c" d="' + d + '"/></g>' +
        '<rect class="f-metal" x="' + (x - 3) + '" y="' + (j2 + 2) + '" width="6" height="34"/>' +
        '<rect class="f-metal" x="' + (x - 8) + '" y="' + j2 + '" width="16" height="4" rx="1"/>' +
        '<rect class="f-handle" x="' + (x - 17) + '" y="' + (j2 + 34) + '" width="34" height="7" rx="3.5"/>';
      if (o.pads) {
        s += '<rect class="f-pad" x="' + (x - 13) + '" y="' + (top - 7) + '" width="26" height="7"/>' +
          '<rect class="f-pad" x="' + (x - 13) + '" y="' + bot + '" width="26" height="7"/>';
      }
      // flip: 背(C の曲がった所)を右側にする
      return o.flip ? '<g transform="translate(' + (2 * x) + ' 0) scale(-1 1)">' + s + '</g>' : s;
    },
    // 万力(前から見た図) {x(中央), y(口金の上), w}
    vise: function (o) {
      var x = n(o.x, 160), y = n(o.y, 92), w = n(o.w, 110), b = n(o.bench, 130);
      return '<g class="f-vise"><rect x="' + (x - w / 2 + 10) + '" y="' + (y + 30) + '" width="' + (w - 20) + '" height="' + (b - y - 30) + '" rx="3"/>' +
        '<rect x="' + (x - w / 2) + '" y="' + y + '" width="' + w + '" height="32" rx="3"/></g>' +
        '<path class="f-jawline" d="M' + (x - w / 2 + 3) + ' ' + (y + 5) + ' h' + (w - 6) + '"/>' +
        '<circle class="f-metal" cx="' + x + '" cy="' + (y + 20) + '" r="6"/>' +
        '<rect class="f-metal" x="' + (x - 45) + '" y="' + (y + 17.5) + '" width="90" height="5" rx="2.5"/>' +
        '<circle class="f-metal" cx="' + (x - 46) + '" cy="' + (y + 20) + '" r="4.5"/><circle class="f-metal" cx="' + (x + 46) + '" cy="' + (y + 20) + '" r="4.5"/>';
    },
    // ワイヤブラシ {x, y, a}
    brush: function (o) {
      var b = '', i;
      for (i = -26; i <= 26; i += 4) b += 'M' + i + ' 8 v9 ';
      return '<g transform="' + tf(o, 160, 60) + '"><rect class="f-handle" x="-30" y="-6" width="60" height="14" rx="4"/>' +
        '<rect class="f-handle" x="30" y="-3" width="50" height="9" rx="4"/><path class="f-bristle" d="' + b + '"/></g>';
    },

    /* --- 手 --- */
    // にぎる手 {x, y, a(柄の向き), ax, ay(うでの先), flip}
    grip: function (o) {
      var x = n(o.x, 160), y = n(o.y, 90), a = n(o.a, 0);
      var e = rot(-a, n(o.ax, x + 80) - x, n(o.ay, y + 80) - y);
      return '<g transform="' + tf(o, 160, 90) + '">' + fist(0, 0, e[0], e[1], o.flip) + '</g>';
    },
    // ひらいた手(上から見た手の甲) {x, y, a(指の向き 0=上), ax, ay, left}
    palm: function (o) {
      var x = n(o.x, 100), y = n(o.y, 100), a = n(o.a, 0), wr = rot(a, 0, 10);
      return arm(x + wr[0], y + wr[1], n(o.ax, x + wr[0] * 8), n(o.ay, y + wr[1] * 8)) +
        '<g transform="' + tf(o, 100, 100) + (o.left ? ' scale(-1 1)' : '') + '">' + skin(PALM) + '</g>' +
        label(x + n(o.dx, 0), y + n(o.dy, -44), o.t, 'middle');
    },
    // おさえる手(横から) {x, y(おさえる面), ax, ay, right(指を右に向ける), thumb(親指を立てる)}
    press: function (o) {
      var x = n(o.x, 100), y = n(o.y, 110), sx = o.right ? -1 : 1;
      return arm(x + 14 * sx, y - 9, n(o.ax, x + 70 * sx), n(o.ay, y - 120)) +
        '<g transform="translate(' + x + ' ' + y + ')' + (o.right ? ' scale(-1 1)' : '') + '">' + skin(PRESS) +
        '<path class="f-crease" d="M-22 -8 v6 M-14 -9 v7"/>' + (o.thumb ? skin(PRESS_THUMB) : '') + '</g>' +
        label(x + n(o.dx, 0), y + n(o.dy, -24), o.t, 'middle');
    },
    // つまむ手(横から) {x, y(指先), ax, ay, right(右から)}
    pinch: function (o) {
      var x = n(o.x, 160), y = n(o.y, 100), sx = o.right ? -1 : 1;
      return arm(x - 36 * sx, y - 2, n(o.ax, x - 110 * sx), n(o.ay, y + 60)) +
        '<g transform="translate(' + x + ' ' + y + ')' + (o.right ? ' scale(-1 1)' : '') + '">' + skin(PINCH) + '</g>';
    },
    // 古いデータ用: 手の位置 {x, y, t}(上から見た手で描く)
    hand: function (o) {
      return P.palm({ x: o.x, y: n(o.y, 100) + 12, a: 0, ax: o.x, ay: n(o.y, 100) + 120, t: o.t, dx: o.dx, dy: n(o.dy, -16) - 30 });
    },
    // 目と視線 {x, y, tx, ty, t}
    eye: function (o) {
      var x = n(o.x, 60), y = n(o.y, 40);
      var s = '<g class="f-eye"><path d="M' + (x - 14) + ' ' + y + ' Q' + x + ' ' + (y - 11) + ' ' + (x + 14) + ' ' + y + ' Q' + x + ' ' + (y + 11) + ' ' + (x - 14) + ' ' + y + ' Z"/>' +
        '<circle cx="' + x + '" cy="' + y + '" r="4"/></g>';
      if (o.tx !== undefined) s += '<path class="f-sight" d="M' + x + ' ' + (y + 8) + ' L' + o.tx + ' ' + o.ty + '"/>';
      if (o.t) s += label(x + 20, y + 4, o.t);
      return s;
    },
    // 人の顔(「人に向けない」などに使う) {x, y}
    face: function (o) {
      var x = n(o.x, 280), y = n(o.y, 80);
      return '<g class="k-person"><path class="k-body" d="M' + (x - 20) + ' ' + (y + 46) + ' Q' + (x - 20) + ' ' + (y + 20) + ' ' + x + ' ' + (y + 20) + ' Q' + (x + 20) + ' ' + (y + 20) + ' ' + (x + 20) + ' ' + (y + 46) + ' Z"/>' +
        '<circle class="k-head" cx="' + x + '" cy="' + y + '" r="16"/>' +
        '<path class="k-hair" d="M' + (x - 16) + ' ' + (y - 2) + ' Q' + x + ' ' + (y - 26) + ' ' + (x + 16) + ' ' + (y - 2) + ' Q' + x + ' ' + (y - 12) + ' ' + (x - 16) + ' ' + (y - 2) + ' Z"/>' +
        '<circle class="k-eye" cx="' + (x - 6) + '" cy="' + (y + 2) + '" r="1.8"/><circle class="k-eye" cx="' + (x + 6) + '" cy="' + (y + 2) + '" r="1.8"/></g>';
    },

    /* --- 矢印・文字・安全の印 --- */
    // 矢印 {x1,y1,x2,y2,t, dash, tx, ty}
    arrow: function (o, id) {
      var s = '<path class="f-arrow' + (o.dash ? ' dash' : '') + '" d="M' + o.x1 + ' ' + o.y1 + ' L' + o.x2 + ' ' + o.y2 + '" marker-end="url(#' + id + ')"/>';
      return s + label(n(o.tx, (o.x1 + o.x2) / 2), n(o.ty, (o.y1 + o.y2) / 2 - 8), o.t, n(o.anchor, 'middle'));
    },
    // 行ったり来たりの矢印 {x, y, w, a, t}
    swing: function (o, id) {
      var x = n(o.x, 160), y = n(o.y, 60), w = n(o.w, 24);
      return '<g transform="' + tf(o, 160, 60) + '"><path class="f-arrow" d="M' + (-w) + ' 0 L' + w + ' 0" marker-start="url(#' + id + ')" marker-end="url(#' + id + ')"/></g>' +
        label(x + n(o.tx, 0), y + n(o.ty, -10), o.t, 'middle');
    },
    // 回転を表す円弧の矢印 {x, y, r, t}
    turn: function (o, id) {
      var x = n(o.x, 160), y = n(o.y, 60), r = n(o.r, 18);
      return '<path class="f-arrow" d="M' + (x - r) + ' ' + y + ' A' + r + ' ' + (r * 0.45) + ' 0 1 0 ' + (x + r) + ' ' + (y - 2) + '" marker-end="url(#' + id + ')"/>' +
        label(x + r + 6, y + 4, o.t);
    },
    // 角度の弧 {x, y, r, from, to(度、SVG の向き), t}
    angle: function (o) {
      var x = n(o.x, 160), y = n(o.y, 110), r = n(o.r, 50);
      var a1 = n(o.from, 0) * Math.PI / 180, a2 = n(o.to, -30) * Math.PI / 180;
      var p1 = [x + r * Math.cos(a1), y + r * Math.sin(a1)], p2 = [x + r * Math.cos(a2), y + r * Math.sin(a2)];
      var sweep = a2 > a1 ? 1 : 0, mid = (a1 + a2) / 2;
      return '<path class="f-angle" d="M' + r1(p1[0]) + ' ' + r1(p1[1]) + ' A' + r + ' ' + r + ' 0 0 ' + sweep + ' ' + r1(p2[0]) + ' ' + r1(p2[1]) + '"/>' +
        label(x + (r + 14) * Math.cos(mid), y + (r + 14) * Math.sin(mid) + 4, o.t, n(o.anchor, 'start'));
    },
    // 直角の印 {x, y, size, a}
    right: function (o) {
      var s = n(o.size, 10);
      return '<path class="f-angle" transform="translate(' + n(o.x, 160) + ' ' + n(o.y, 110) + ') rotate(' + n(o.a, 0) + ')" d="M' + s + ' 0 L' + s + ' ' + (-s) + ' L0 ' + (-s) + '"/>' + label(n(o.x, 160) + s + 6, n(o.y, 110) - s, o.t);
    },
    // 線 {x1,y1,x2,y2, dash, cls}
    line: function (o) {
      return '<path class="' + (o.cls || 'f-mark') + (o.dash ? ' dash' : '') + '" d="M' + o.x1 + ' ' + o.y1 + ' L' + o.x2 + ' ' + o.y2 + '"/>';
    },
    // 文字 {x, y, t, anchor, cls}
    text: function (o) {
      return label(o.x, o.y, o.t, o.anchor, o.cls);
    },
    // 引き出し線つきの文字 {x, y, t, px, py(指す点), anchor}
    lead: function (o) {
      var x = n(o.x, 40), y = n(o.y, 30), lx = n(o.lx, x), ly = n(o.ly, y + 5);
      return '<path class="f-lead" d="M' + lx + ' ' + ly + ' L' + o.px + ' ' + o.py + '"/><circle class="f-leaddot" cx="' + o.px + '" cy="' + o.py + '" r="2.6"/>' +
        label(x, y, o.t, o.anchor);
    },
    // ○・× の札 {x, y, ok, t}
    mark: function (o) {
      var x = n(o.x, 40), y = n(o.y, 30);
      return '<g class="' + (o.ok ? 'f-ok' : 'f-ng') + '"><circle cx="' + x + '" cy="' + y + '" r="12"/>' +
        '<text x="' + x + '" y="' + (y + 6) + '" text-anchor="middle" class="f-markchar">' + (o.ok ? '○' : '×') + '</text></g>' +
        label(x + 17, y + 5, o.t);
    },
    // ○よい/×だめ の枠 {x, y, w, h, ok, t}(図のはじめに置く)
    panel: function (o) {
      var x = n(o.x, 6), y = n(o.y, 6), w = n(o.w, 150), h = n(o.h, 168), ty = o.bottom ? y + h - 32 : y;
      return '<g class="' + (o.ok ? 'f-pok' : 'f-png') + '"><rect class="f-pbox" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8"/>' +
        '<circle cx="' + (x + 16) + '" cy="' + (ty + 16) + '" r="11"/><text class="f-markchar" x="' + (x + 16) + '" y="' + (ty + 22) + '" text-anchor="middle">' + (o.ok ? '○' : '×') + '</text>' +
        '<text class="f-ptitle" x="' + (x + 32) + '" y="' + (ty + 21) + '">' + esc(o.t || (o.ok ? 'よい' : 'だめ')) + '</text></g>';
    },
    // 注意の三角(!) {x, y, t, anchor}
    warn: function (o) {
      var x = n(o.x, 20), y = n(o.y, 20), end = o.anchor === 'end';
      return '<g class="f-warn"><path d="M' + x + ' ' + (y - 11) + ' L' + (x + 12) + ' ' + (y + 9) + ' L' + (x - 12) + ' ' + (y + 9) + ' Z"/>' +
        '<text x="' + x + '" y="' + (y + 7) + '" text-anchor="middle">!</text></g>' +
        label(end ? x - 16 : x + 16, y + 5, o.t, end ? 'end' : 'start', 'f-label f-warnt');
    },
    // 手を近づけない場所 {x, y, w, h, t, tx, ty}
    ng: function (o) {
      var x = n(o.x, 100), y = n(o.y, 60), w = n(o.w, 60), h = n(o.h, 40);
      return '<rect class="f-ngzone" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5"/>' +
        label(n(o.tx, x + w / 2), n(o.ty, y - 5), o.t, n(o.anchor, 'middle'), 'f-label f-warnt');
    },
    // ズボン(ポケットつき) {x, y, w, h}
    pants: function (o) {
      var x = n(o.x, 190), y = n(o.y, 40), w = n(o.w, 110), h = n(o.h, 130), m = x + w / 2;
      return '<path class="f-cloth" d="M' + x + ' ' + y + ' H' + (x + w) + ' L' + (x + w + 4) + ' ' + (y + h) + ' H' + (m + 6) + ' L' + m + ' ' + (y + 46) + ' L' + (m - 6) + ' ' + (y + h) + ' H' + (x - 4) + ' Z"/>' +
        '<path class="f-pocket" d="M' + x + ' ' + (y + 12) + ' H' + (x + w) + ' M' + (x + 10) + ' ' + (y + 14) + ' Q' + (x + 22) + ' ' + (y + 40) + ' ' + (x + 40) + ' ' + (y + 46) + '"/>';
    },
    // ポケットの前の布(中に入れた物をかくす) {x, y}(pants と同じ x, y)
    pocket: function (o) {
      var x = n(o.x, 190), y = n(o.y, 40);
      return '<path class="f-cloth" d="M' + (x + 1.5) + ' ' + (y + 14) + ' H' + (x + 10) + ' Q' + (x + 22) + ' ' + (y + 40) + ' ' + (x + 40) + ' ' + (y + 46) + ' L' + (x + 1.5) + ' ' + (y + 80) + ' Z" style="stroke:none"/>' +
        '<path class="f-pocket" d="M' + (x + 10) + ' ' + (y + 14) + ' Q' + (x + 22) + ' ' + (y + 40) + ' ' + (x + 40) + ' ' + (y + 46) + '"/>';
    },
    // 背景色でおおう(図の外にはみ出した刃をかくす) {x, y, w, h}
    cover: function (o) {
      return '<rect class="f-cover" x="' + n(o.x, 0) + '" y="' + n(o.y, 0) + '" width="' + n(o.w, 40) + '" height="' + n(o.h, 40) + '"/>';
    },
    // 削りくず(かんなくず) {x, y}
    curl: function (o) {
      var x = n(o.x, 160), y = n(o.y, 80);
      var d = 'M' + x + ' ' + y + ' c2 -14 10 -24 22 -24 c10 0 14 10 8 16 c-5 5 -12 2 -11 -4';
      return '<path class="f-curl-o" d="' + d + '"/><path class="f-curl" d="' + d + '"/>';
    },
    // 点検マーク(虫めがね) {x, y, t}
    check: function (o) {
      var x = n(o.x, 100), y = n(o.y, 60);
      return '<g class="f-check"><circle cx="' + x + '" cy="' + y + '" r="13"/><path d="M' + (x + 9) + ' ' + (y + 9) + ' l11 11"/></g>' +
        label(x + n(o.dx, 20), y + n(o.dy, -8), o.t, n(o.anchor, 'start'));
    }
  };

  function defs(id) {
    return '<defs><marker id="' + id + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path class="f-arrowhead" d="M0 0 L10 5 L0 10 Z"/></marker></defs>';
  }

  // fig: [[部品名, {…}], …] → SVG 文字列
  function draw(fig, label, vb) {
    var id = 'a6arr' + (++seq);
    var body = (fig || []).map(function (part, i) {
      var fn = P[part[0]], o = part[1] || {};
      if (!fn) return '';
      o = Object.assign({ _id: id + 'p' + i }, o);
      return fn(o, id);
    }).join('');
    return '<svg class="a6-fig" viewBox="' + (vb || '0 0 320 180') + '" role="img" aria-label="' + esc(label || '') + '" focusable="false">' +
      defs(id) + body + '</svg>';
  }

  /* ---------- 人物(KYT 用) ---------- */
  // 横向きの人 {x(頭の中心), y(頭の中心), face:'left'|'right'(向いている方), hair:'long'|'tied'|'short',
  //   sleeve:'loose'(そで口が広い), walk(歩いている), arms:[[手のx,手のy], …](1本目は体のむこう側、2本目は手前)}
  // y=106 で床(226)に立つ
  function kArm(sx, sy, hx, hy, loose) {
    var cx = r1((sx + hx) / 2 + (hx > sx ? -6 : 6)), cy = r1((sy + hy) / 2 + 16);
    var d = 'M' + sx + ' ' + sy + ' Q' + cx + ' ' + cy + ' ' + hx + ' ' + hy;
    var s = '<path class="k-arm-o" d="' + d + '"/><path class="k-arm" d="' + d + '"/>';
    if (loose) {
      // 手首の近くで広がったそで口
      var vx = hx - cx, vy = hy - cy, L = Math.sqrt(vx * vx + vy * vy) || 1, ux = vx / L, uy = vy / L;
      var bx = hx - ux * 9, by = hy - uy * 9, ex = hx - ux * 24, ey = hy - uy * 24;
      s += '<path class="k-sleeve" d="M' + r1(ex - uy * 4) + ' ' + r1(ey + ux * 4) + ' L' + r1(bx - uy * 12) + ' ' + r1(by + ux * 12) +
        ' L' + r1(bx + uy * 12) + ' ' + r1(by - ux * 12) + ' L' + r1(ex + uy * 4) + ' ' + r1(ey - ux * 4) + ' Z"/>';
    }
    return s + '<circle class="k-handp" cx="' + hx + '" cy="' + hy + '" r="6.5"/>';
  }
  function person(o) {
    var x = o.x, y = o.y, d = o.face === 'right' ? 1 : -1, s = '<g class="k-person">';
    var sx = x - d * 2, sy = y + 28, arms = o.arms || [];
    if (o.hair === 'long') s += '<path class="k-hair" d="M' + (x + d * 4) + ' ' + (y - 15) + ' Q' + (x - d * 26) + ' ' + (y - 10) + ' ' + (x - d * 22) + ' ' + (y + 60) +
      ' L' + (x - d * 9) + ' ' + (y + 60) + ' Q' + (x - d * 8) + ' ' + (y + 24) + ' ' + (x + d * 2) + ' ' + y + ' Z"/>';
    // 足
    if (o.walk) s += '<path class="k-leg" d="M' + (x - 6) + ' ' + (y + 74) + ' L' + (x - d * 16) + ' ' + (y + 118) + ' L' + (x - d * 6) + ' ' + (y + 120) + ' L' + (x + 4) + ' ' + (y + 80) + ' Z"/>' +
      '<path class="k-leg" d="M' + (x + 6) + ' ' + (y + 74) + ' L' + (x + d * 18) + ' ' + (y + 118) + ' L' + (x + d * 8) + ' ' + (y + 120) + ' L' + (x - 4) + ' ' + (y + 80) + ' Z"/>';
    else s += '<rect class="k-leg" x="' + (x - 12) + '" y="' + (y + 74) + '" width="11" height="46" rx="4"/><rect class="k-leg" x="' + (x + 1) + '" y="' + (y + 74) + '" width="11" height="46" rx="4"/>';
    // むこう側のうで
    if (arms[0]) s += kArm(sx, sy, arms[0][0], arms[0][1], o.sleeve === 'loose');
    s += '<rect class="k-body" x="' + (x - 15) + '" y="' + (y + 17) + '" width="30" height="62" rx="10"/>';
    s += '<circle class="k-head" cx="' + x + '" cy="' + y + '" r="16"/>';
    // 髪(頭の後ろ側)
    s += '<path class="k-hair" d="M' + (x + d * 14) + ' ' + (y - 8) + ' Q' + (x + d * 4) + ' ' + (y - 22) + ' ' + (x - d * 12) + ' ' + (y - 11) + ' Q' + (x - d * 19) + ' ' + (y - 2) + ' ' + (x - d * 13) + ' ' + (y + 8) +
      ' Q' + (x - d * 6) + ' ' + (y - 4) + ' ' + (x + d * 14) + ' ' + (y - 8) + ' Z"/>';
    if (o.hair === 'tied') s += '<circle class="k-hair" cx="' + (x - d * 17) + '" cy="' + (y - 6) + '" r="7"/>';
    s += '<circle class="k-eye" cx="' + (x + d * 8) + '" cy="' + (y - 1) + '" r="2"/>';
    if (arms[1]) s += kArm(sx, sy, arms[1][0], arms[1][1], o.sleeve === 'loose');
    return s + '</g>';
  }

  /* ---------- KYT の場面(400×260) ---------- */
  // 床は y=226。絵は y=30 から下を見せる(viewBox)。正解の場所(tools-data.js の kyt[].hazards[].regions)は、この絵の座標で書く
  var SCENES = {
    // のこぎりで板を切る場面
    saw: function () {
      return '<rect class="k-floor" x="0" y="226" width="400" height="34"/>' +
        P.saw({ x: 268, y: 132, a: -35, s: 0.72 }) +
        P.bench({ x: 30, w: 220, y: 150, floor: 226 }) +
        // 作業台の端からはみ出したげんのう(柄が外に出ている)
        '<g transform="translate(72 150) scale(-0.8 0.8)">' + P.hammer({ x: 0, y: 0, len: 60 }) + '</g>' +
        // 固定されていない板(クランプなし)
        P.board({ x: 60, y: 132, w: 240, h: 18 }) +
        P.line({ x1: 268, y1: 132, x2: 268, y2: 150, dash: true }) +
        // 作業する人(長い髪をまとめていない)。左手は切る所のすぐそば
        person({ x: 362, y: 106, face: 'left', hair: 'long', arms: [[328, 78], [256, 128]] }) +
        // 床の木片
        '<rect class="f-wood" x="300" y="234" width="46" height="9" transform="rotate(-8 323 238)"/>' +
        '<rect class="f-wood" x="250" y="240" width="22" height="7"/>';
    },
    // 工作室での移動・受けわたし
    room: function () {
      return '<rect class="k-floor" x="0" y="226" width="400" height="34"/>' +
        P.bench({ x: 10, w: 116, y: 150, floor: 226 }) +
        P.board({ x: 20, y: 134, w: 96, h: 16 }) +
        // 作業中の人
        person({ x: 148, y: 106, face: 'left', hair: 'tied', arms: [[112, 132], [104, 136]] }) +
        // そのすぐ後ろを通る人
        person({ x: 196, y: 106, face: 'left', hair: 'short', walk: true, arms: [[186, 168], [208, 166]] }) +
        P.arrow({ x1: 218, y1: 80, x2: 176, y2: 80 }, ARR) +
        // きりの刃先を相手に向けて手わたす人(そで口が広い)
        P.awl({ x: 342, y: 128, a: -90, s: 0.75 }) +
        person({ x: 262, y: 106, face: 'right', hair: 'short', sleeve: 'loose', arms: [[284, 168], [292, 128]] }) +
        person({ x: 372, y: 106, face: 'left', hair: 'tied', arms: [[380, 168], [344, 136]] }) +
        // 通路をまたぐコード
        '<path class="k-cord" d="M170 260 Q200 230 240 246 T330 238 L400 232"/>';
    },
    // げんのうでくぎを打つ場面
    hammer: function () {
      return '<rect class="k-floor" x="0" y="226" width="400" height="34"/>' +
        // 顔を近づけてのぞきこむ友だち(台の向こう側)
        '<g transform="rotate(14 226 180)">' + person({ x: 226, y: 104, face: 'right', hair: 'short', arms: [[250, 156], [244, 160]] }) + '</g>' +
        P.bench({ x: 20, w: 200, y: 160, floor: 226 }) +
        // 台から大きくはみ出した材料
        P.board({ x: 80, y: 140, w: 250, h: 20 }) +
        P.nail({ x: 290, y: 152, h: 32 }) +
        // 柄にひびのあるげんのう
        P.hammer({ x: 290, y: 96, len: 62, crack: true }) +
        // 作業する人。くぎを支える指をはなしていない
        person({ x: 372, y: 106, face: 'left', hair: 'tied', arms: [[284, 132], [346, 72]] });
    }
  };

  var ARR = '';
  function scene(id, label) {
    var fn = SCENES[id];
    var aid = ARR = 'a6arr' + (++seq);
    return '<svg class="a6-scene" viewBox="0 30 400 230" role="img" aria-label="' + esc(label || '') + '">' +
      defs(aid) + (fn ? fn() : '') + '<g class="k-marks"></g><g class="k-cursor"></g></svg>';
  }

  window.A6Fig = { draw: draw, scene: scene, parts: P };
})();
