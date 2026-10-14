/* ⑤ 集成材・合板:製造アニメと、繊維方向を直交させる効果 */
(function () {
  'use strict';
  var PI = Math.PI;
  var cv, ctx, cvX, redraw, redrawX;
  var st = { kind: 'ply', step: 0, t: 1, playing: false, crossMode: 'cross', dry: 0 };
  var stopAnim = null;

  var STEPS = {
    ply: [
      { title: '{丸太|まるた}をうすくむく', text: '{丸太|まるた}を{回|まわ}しながら、{刃物|はもの}でかつらむきのようにうすくむき、{単板|たんばん}をつくる。' },
      { title: '{乾燥|かんそう}・{切|き}りそろえ', text: '{単板|たんばん}を{乾燥|かんそう}させ、{同|おな}じ{大|おお}きさに{切|き}りそろえる。' },
      { title: '{繊維|せんい}{方向|ほうこう}を{直交|ちょっこう}させて{重|かさ}ねる', text: '{接着剤|せっちゃくざい}をぬり、{単板|たんばん}の{繊維|せんい}{方向|ほうこう}を1{枚|まい}ごとに{直角|ちょっかく}に{変|か}えて、{奇数|きすう}{枚|まい}{重|かさ}ねる。' },
      { title: '{熱|ねつ}と{圧力|あつりょく}で{接着|せっちゃく}', text: '{熱|ねつ}をかけながら{強|つよ}く{押|お}さえて{接着|せっちゃく}する。' },
      { title: '{合板|ごうはん}の{完成|かんせい}', text: '{表|おもて}と{裏|うら}の{繊維|せんい}{方向|ほうこう}がそろう。たて・よこどちらにも{強|つよ}く、{伸|の}び{縮|ちぢ}みや{反|そ}りが{少|すく}ない。' }
    ],
    glu: [
      { title: '{丸太|まるた}をひき{板|いた}にする', text: '{丸太|まるた}をのこぎりでひいて、ひき{板|いた}(ラミナ)をつくる。' },
      { title: '{乾燥|かんそう}・{欠点|けってん}を{除|のぞ}く', text: 'ひき{板|いた}を{乾燥|かんそう}させ、{節|ふし}や{割|わ}れなどの{欠点|けってん}を{切|き}り{取|と}る。' },
      { title: '{長|なが}さ{方向|ほうこう}につなぐ', text: '{端|はし}をギザギザ(フィンガージョイント)に{加工|かこう}し、{接着|せっちゃく}して{長|なが}くつなぐ。' },
      { title: '{繊維|せんい}{方向|ほうこう}をそろえて{重|かさ}ねる', text: '{接着剤|せっちゃくざい}をぬり、{繊維|せんい}{方向|ほうこう}をそろえて{重|かさ}ね、{圧力|あつりょく}をかけて{接着|せっちゃく}する。' },
      { title: '{集成材|しゅうせいざい}の{完成|かんせい}', text: '{削|けず}って{仕上|しあ}げる。{大|おお}きな{断面|だんめん}や{長|なが}い{材|ざい}、{曲|ま}がった{材|ざい}もつくれ、{強|つよ}さのばらつきが{小|ちい}さい。' }
    ]
  };

  /* ---------- 等角(アイソメ)図の補助 ---------- */
  var ISO = { ox: 300, oy: 150, k: 1 };
  function iso(x, y, z) {
    return [ISO.ox + (x - y) * 0.866 * ISO.k, ISO.oy + (x + y) * 0.5 * ISO.k - z * ISO.k];
  }
  function poly(pts) { ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); }
  /** 板(x0..x0+w, y0..y0+d, z0..z0+h)。grain: 'x' か 'y' */
  function slab(x0, y0, z0, w, d, h, grain, shade, glue) {
    var x1 = x0 + w, y1 = y0 + d, z1 = z0 + h;
    var top = [iso(x0, y0, z1), iso(x1, y0, z1), iso(x1, y1, z1), iso(x0, y1, z1)];
    var right = [iso(x1, y0, z0), iso(x1, y1, z0), iso(x1, y1, z1), iso(x1, y0, z1)];
    var left = [iso(x0, y1, z0), iso(x1, y1, z0), iso(x1, y1, z1), iso(x0, y1, z1)];
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = M2.col('ink');
    poly(top); ctx.fillStyle = shade ? M2.col('veneer-b') : M2.col('veneer-a'); ctx.fill(); ctx.stroke();
    poly(right); ctx.fillStyle = M2.col('veneer-side'); ctx.fill(); ctx.stroke();
    poly(left); ctx.fillStyle = M2.col('veneer-side2'); ctx.fill(); ctx.stroke();
    // 上面の木目
    ctx.strokeStyle = M2.col('latewood'); ctx.lineWidth = 1.2;
    var i, n = 7, a, b;
    ctx.beginPath();
    for (i = 1; i < n; i++) {
      if (grain === 'x') { var yy = y0 + d * i / n; a = iso(x0 + 2, yy, z1); b = iso(x1 - 2, yy + (i % 2 ? 1.5 : -1.5), z1); }
      else { var xx = x0 + w * i / n; a = iso(xx, y0 + 2, z1); b = iso(xx + (i % 2 ? 1.5 : -1.5), y1 - 2, z1); }
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
    // 側面:木口なら点、板目なら線
    if (h * ISO.k > 4) {
      ctx.fillStyle = ctx.strokeStyle = M2.col('latewood');
      var endRight = grain === 'x', endLeft = grain === 'y';
      [[endRight, function (u, v) { return iso(x1, y0 + d * u, z0 + h * v); }], [endLeft, function (u, v) { return iso(x0 + w * u, y1, z0 + h * v); }]].forEach(function (f) {
        if (f[0]) { for (var j = 1; j < 10; j++) { var p = f[1](j / 10, 0.5); ctx.beginPath(); ctx.arc(p[0], p[1], 0.9, 0, 7); ctx.fill(); } }
        else { var p0 = f[1](0.02, 0.5), p1 = f[1](0.98, 0.5); ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); }
      });
    }
    if (glue) {
      ctx.strokeStyle = M2.col('glue'); ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]);
      poly(top); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }
  function arrowDown(x, y1, y2) {
    ctx.save(); ctx.strokeStyle = ctx.fillStyle = M2.col('ink'); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2 - 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y2); ctx.lineTo(x - 7, y2 - 12); ctx.lineTo(x + 7, y2 - 12); ctx.fill();
    ctx.restore();
  }
  function heatWaves(x0, x1, y, t) {
    ctx.save(); ctx.strokeStyle = M2.col('ng'); ctx.lineWidth = 2;
    for (var x = x0; x <= x1; x += 40) {
      ctx.beginPath();
      for (var k = 0; k <= 20; k++) { var yy = y - k * 1.5, xx = x + Math.sin(k * 0.6 + t * 12) * 4; if (k) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- 合板 ---------- */
  function plyStep(step, t) {
    var LW = 150, LD = 110, H = 9;
    if (step === 0) {
      // ロータリーレース(横から見た図)
      var cx = 190, cy = 210, r = 120 - 50 * t, rot = t * PI * 6;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = M2.col('sapwood'); ctx.fill();
      ctx.strokeStyle = M2.col('latewood'); ctx.lineWidth = 1;
      M2.wood.rings.forEach(function (rr) { if (rr * 120 < r) { ctx.beginPath(); ctx.arc(cx, cy, rr * 120, 0, 7); ctx.stroke(); } });
      ctx.strokeStyle = M2.col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(rot) * r, cy + Math.sin(rot) * r); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0, 7); ctx.fillStyle = M2.col('ink'); ctx.fill();
      // 回転の向き
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r + 16, -PI * 0.9, -PI * 0.55); ctx.stroke();
      var ea = -PI * 0.55, ex = cx + Math.cos(ea) * (r + 16), ey = cy + Math.sin(ea) * (r + 16);
      ctx.beginPath(); ctx.moveTo(ex + 8, ey + 2); ctx.lineTo(ex - 6, ey - 6); ctx.lineTo(ex - 4, ey + 8); ctx.fill();
      // 刃物
      var kx = cx + r, ky = cy - 4;
      ctx.fillStyle = M2.col('metal'); ctx.beginPath(); ctx.moveTo(kx + 2, ky); ctx.lineTo(kx + 60, ky - 40); ctx.lineTo(kx + 70, ky - 26); ctx.closePath(); ctx.fill(); ctx.stroke();
      // 単板
      var len = 50 + 300 * t;
      ctx.fillStyle = M2.col('veneer-a'); ctx.fillRect(kx, cy - 2, Math.min(len, 600 - kx - 10), 6); ctx.strokeRect(kx, cy - 2, Math.min(len, 600 - kx - 10), 6);
      ctx.restore();
      M2.text(ctx, '{刃物|はもの}', kx + 50, ky - 46, { size: 14, bold: true, bg: M2.col('label-bg') });
      M2.text(ctx, '{単板|たんばん}', Math.min(kx + 60, 520), cy + 30, { size: 14, bold: true, bg: M2.col('label-bg') });
      return;
    }
    if (step === 1) {
      ISO.ox = 300; ISO.oy = 215; ISO.k = 1.2;
      for (var i = 0; i < 3; i++) slab(-LW / 2, -LD / 2, i * 26, LW, LD, 3, 'x', i % 2, false);
      // 切りそろえの線
      var cxp = M2.lerp(-LW / 2 + 8, LW / 2 - 8, t);
      var a = iso(cxp, -LD / 2 - 20, 80), b = iso(cxp, LD / 2 + 20, 0);
      ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = M2.col('ng'); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore();
      heatWaves(130, 470, 380, t);
      M2.text(ctx, '{乾燥|かんそう}', 480, 392, { size: 14, bold: true, color: M2.col('ng'), bg: M2.col('label-bg') });
      return;
    }
    ISO.ox = 300; ISO.oy = 235; ISO.k = 1.35;
    var N = 5;
    if (step === 2) {
      for (var j = 0; j < N; j++) {
        var start = j / N, local = M2.clamp((t - start) * N, 0, 1);
        if (local <= 0) continue;
        var drop = (1 - M2.ease(local)) * 90;
        slab(-LW / 2, -LD / 2, j * H + drop, LW, LD, H, j % 2 ? 'y' : 'x', j % 2, j < N - 1 && local >= 1);
      }
      legendGrain(true);
      return;
    }
    if (step === 3 || step === 4) {
      var press = step === 3 ? M2.ease(t) : 1, hh = H * (1 - 0.12 * press);
      for (var m = 0; m < N; m++) slab(-LW / 2, -LD / 2, m * hh, LW, LD, hh, m % 2 ? 'y' : 'x', m % 2, false);
      if (step === 3) {
        var topZ = N * hh + 50 * (1 - press) + 2;
        slab(-LW / 2 - 10, -LD / 2 - 10, topZ, LW + 20, LD + 20, 10, 'x', 0, false);
        ctx.save(); ctx.globalAlpha = 0.85;
        var p = iso(0, 0, topZ + 10); arrowDown(p[0], p[1] - 80, p[1] - 6);
        ctx.restore();
        heatWaves(170, 430, 390, t);
        M2.text(ctx, '{熱|ねつ}と{圧力|あつりょく}', 380, 60, { size: 15, bold: true, bg: M2.col('label-bg') });
      } else {
        legendGrain(true);
        var q = iso(LW / 2, LD / 2, 0);
        M2.text(ctx, '{合板|ごうはん}(5{枚|まい}の{単板|たんばん})', q[0] - 60, q[1] + 40, { size: 16, bold: true, bg: M2.col('label-bg') });
      }
    }
  }
  function legendGrain(cross) {
    var x = 20, y = 30;
    M2.text(ctx, '{上面|じょうめん}の{線|せん}={繊維|せんい}{方向|ほうこう}', x, y, { size: 13, bg: M2.col('label-bg') });
    M2.text(ctx, cross ? '1{枚|まい}ごとに{直角|ちょっかく}' : 'すべて{同|おな}じ{向|む}き', x, y + 24, { size: 13, bold: true, bg: M2.col('label-bg') });
  }

  /* ---------- 集成材 ---------- */
  function gluStep(step, t) {
    if (step === 0) {
      // 丸太を横から見て、のこぎりでひく
      var x0 = 60, x1 = 540, y0 = 120, y1 = 300;
      ctx.save();
      ctx.fillStyle = M2.col('sapwood'); ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = M2.col('bark'); ctx.fillRect(x0, y0 - 10, x1 - x0, 10); ctx.fillRect(x0, y1, x1 - x0, 10);
      ctx.strokeStyle = M2.col('latewood'); ctx.lineWidth = 1;
      for (var g = 1; g < 12; g++) { var yy = y0 + g * 15; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.bezierCurveTo(200, yy - 4, 400, yy + 4, x1, yy); ctx.stroke(); }
      var cut = x0 + (x1 - x0) * t;
      ctx.strokeStyle = M2.col('ng'); ctx.lineWidth = 2.5;
      for (var k = 1; k < 5; k++) { var ly = y0 + k * 36; ctx.beginPath(); ctx.moveTo(x0, ly); ctx.lineTo(cut, ly); ctx.stroke(); }
      // のこ
      ctx.fillStyle = M2.col('metal'); ctx.beginPath(); ctx.arc(cut, y0 + 90, 26, 0, 7); ctx.fill(); ctx.strokeStyle = M2.col('ink'); ctx.lineWidth = 1.5; ctx.stroke();
      for (var a = 0; a < 12; a++) { var an = a / 12 * 2 * PI + t * 20; ctx.beginPath(); ctx.moveTo(cut + Math.cos(an) * 26, y0 + 90 + Math.sin(an) * 26); ctx.lineTo(cut + Math.cos(an + 0.2) * 32, y0 + 90 + Math.sin(an + 0.2) * 32); ctx.stroke(); }
      ctx.restore();
      M2.text(ctx, 'ひき{板|いた}(ラミナ)', x1 - 140, y1 + 40, { size: 14, bold: true, bg: M2.col('label-bg') });
      return;
    }
    if (step === 1) {
      // 節を切り取る
      var bx = 50, by = 180, bw = 500, bh = 40;
      var cutA = 230, cutB = 300, close = M2.ease(M2.clamp((t - 0.4) / 0.6, 0, 1)) * (cutB - cutA);
      var fade = M2.clamp(1 - t / 0.4, 0, 1);
      ctx.save();
      function plank(x, w) {
        ctx.fillStyle = M2.col('sapwood'); ctx.fillRect(x, by, w, bh);
        ctx.strokeStyle = M2.col('latewood'); ctx.lineWidth = 1;
        for (var i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x, by + i * 10); ctx.lineTo(x + w, by + i * 10); ctx.stroke(); }
        ctx.strokeStyle = M2.col('ink'); ctx.lineWidth = 1.5; ctx.strokeRect(x, by, w, bh);
      }
      plank(bx, cutA - bx);
      plank(cutB - close, bx + bw - cutB);
      if (fade > 0) {
        ctx.globalAlpha = fade; plank(cutA, cutB - cutA);
        ctx.fillStyle = M2.col('knot'); ctx.beginPath(); ctx.ellipse((cutA + cutB) / 2, by + 20, 14, 10, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = M2.col('ng'); ctx.setLineDash([5, 4]); ctx.lineWidth = 2;
      if (t < 0.5) { [cutA, cutB].forEach(function (x) { ctx.beginPath(); ctx.moveTo(x, by - 20); ctx.lineTo(x, by + bh + 20); ctx.stroke(); }); }
      ctx.restore();
      if (t < 0.5) M2.text(ctx, '{節|ふし}', (cutA + cutB) / 2, by - 28, { size: 14, bold: true, align: 'center', bg: M2.col('label-bg') });
      heatWaves(120, 480, 380, t);
      return;
    }
    if (step === 2) {
      // フィンガージョイント
      var gap = (1 - M2.ease(t)) * 70, mid = 300, y = 170, h = 60;
      ctx.save();
      var TW = 18, tt = h / 5;
      function side(dir) {
        // 左の材は歯が右へ、右の材は歯が左へ出て、かみ合う形
        var edge = mid + dir * gap / 2 - TW / 2, far = dir < 0 ? 40 : 560, i;
        ctx.beginPath();
        if (dir < 0) {
          ctx.moveTo(far, y); ctx.lineTo(edge, y);
          for (i = 0; i < 5; i++) { ctx.lineTo(edge + TW, y + i * tt + tt / 2); ctx.lineTo(edge, y + (i + 1) * tt); }
          ctx.lineTo(far, y + h);
        } else {
          ctx.moveTo(far, y); ctx.lineTo(edge + TW, y);
          for (i = 0; i < 5; i++) { ctx.lineTo(edge, y + i * tt + tt / 2); ctx.lineTo(edge + TW, y + (i + 1) * tt); }
          ctx.lineTo(far, y + h);
        }
        ctx.closePath();
        ctx.fillStyle = M2.col(dir < 0 ? 'veneer-a' : 'veneer-b'); ctx.fill();
        ctx.strokeStyle = M2.col('ink'); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.strokeStyle = M2.col('latewood'); ctx.lineWidth = 1;
        for (i = 1; i < 4; i++) { var gy = y + i * h / 4; ctx.beginPath(); ctx.moveTo(dir < 0 ? far : edge + TW + 4, gy); ctx.lineTo(dir < 0 ? edge - 4 : far, gy); ctx.stroke(); }
      }
      side(-1); side(1);
      ctx.restore();
      M2.text(ctx, 'フィンガージョイント', mid, y - 24, { size: 15, bold: true, align: 'center', bg: M2.col('label-bg') });
      return;
    }
    ISO.ox = 300; ISO.oy = 250; ISO.k = 1.25;
    var N = 5, LW = 220, LD = 36, H = 16;
    if (step === 3) {
      for (var j = 0; j < N; j++) {
        var local = M2.clamp((t - j / N) * N, 0, 1);
        if (local <= 0) continue;
        slab(-LW / 2, -LD / 2, j * H + (1 - M2.ease(local)) * 90, LW, LD, H, 'x', j % 2, j < N - 1 && local >= 1);
      }
      legendGrain(false);
      return;
    }
    for (var m = 0; m < N; m++) slab(-LW / 2, -LD / 2, m * H, LW, LD, H, 'x', m % 2, false);
    legendGrain(false);
    var q = iso(LW / 2, LD / 2, 0);
    M2.text(ctx, '{集成材|しゅうせいざい}', q[0] - 40, q[1] + 40, { size: 16, bold: true, bg: M2.col('label-bg') });
  }

  function draw() {
    ctx = M2.setupCanvas(cv);
    ctx.clearRect(0, 0, ctx.W, ctx.H);
    if (st.kind === 'ply') plyStep(st.step, st.t); else gluStep(st.step, st.t);
    var s = STEPS[st.kind][st.step];
    M2.text(ctx, (st.step + 1) + '. ' + s.title, ctx.W - 12, ctx.H - 12, { size: 15, bold: true, align: 'right', bg: M2.col('label-bg') });
  }

  function renderSteps() {
    var ol = document.getElementById('makeSteps');
    ol.innerHTML = STEPS[st.kind].map(function (s, i) {
      return '<li' + (i === st.step ? ' class="on" aria-current="step"' : '') + '><button type="button" class="btn step-btn" data-step="' + i + '"><span class="step-title">' + M2.rb(s.title) + '</span><span class="step-go" aria-hidden="true">▶</span></button><div class="small">' + M2.rb(s.text) + '</div></li>';
    }).join('');
    var s = STEPS[st.kind][st.step];
    M2.setR('makeStep', (st.step + 1) + '. ' + s.title + ':' + s.text);
  }

  function playStep(i, chain) {
    if (stopAnim) stopAnim();
    st.step = i; st.t = 0; renderSteps();
    stopAnim = M2.animate(2600, function (t) { st.t = t; redraw(); }, function () {
      stopAnim = null;
      if (chain && st.step < STEPS[st.kind].length - 1) playStep(st.step + 1, true);
      else setPlaying(false);
    });
  }
  function setPlaying(on) {
    st.playing = on;
    M2.setR('makePlay', on ? '■ {停止|ていし}' : '▶ {再生|さいせい}');
  }

  /* ---------- 直交させる効果 ---------- */
  var MODES = [
    { id: 'solid', label: '{無垢|むく}の{板|いた}(1{枚|まい})', ex: 0.08, ey: 0.003, cup: 1, along: 100, across: 5, layers: ['x'] },
    { id: 'align', label: '{単板|たんばん}をそろえて{重|かさ}ねる', ex: 0.075, ey: 0.003, cup: 0.35, along: 100, across: 5, layers: ['x', 'x', 'x', 'x', 'x'] },
    { id: 'cross', label: '{直交|ちょっこう}させて{重|かさ}ねる({合板|ごうはん})', ex: 0.004, ey: 0.003, cup: 0, along: 60, across: 40, layers: ['x', 'y', 'x', 'y', 'x'] }
  ];
  function drawCross() {
    var c = M2.setupCanvas(cvX);
    c.clearRect(0, 0, c.W, c.H);
    var m = MODES.filter(function (x) { return x.id === st.crossMode; })[0];
    var EXG = 2, s = st.dry;
    // 上から見た図:横=繊維方向(表の単板)、縦=繊維に直角
    var L = 250, B = 170, ox = 30, oy = 50;
    var Lw = L * (1 - m.ey * s * EXG), Bw = B * (1 - m.ex * s * EXG);
    c.save();
    c.setLineDash([6, 5]); c.strokeStyle = M2.col('ghost'); c.lineWidth = 1.5; c.strokeRect(ox, oy, L, B); c.setLineDash([]);
    var x0 = ox + (L - Lw) / 2, y0 = oy + (B - Bw) / 2;
    c.fillStyle = M2.col('veneer-a'); c.fillRect(x0, y0, Lw, Bw);
    c.strokeStyle = M2.col('latewood'); c.lineWidth = 1.2;
    for (var i = 1; i < 10; i++) { var yy = y0 + Bw * i / 10; c.beginPath(); c.moveTo(x0 + 3, yy); c.bezierCurveTo(x0 + Lw * 0.3, yy - 3, x0 + Lw * 0.6, yy + 3, x0 + Lw - 3, yy); c.stroke(); }
    c.strokeStyle = M2.col('ink'); c.lineWidth = 2; c.strokeRect(x0, y0, Lw, Bw);
    c.restore();
    M2.text(c, '{上|うえ}から{見|み}た{図|ず}', ox, 26, { size: 13, bold: true });
    M2.text(c, '←{繊維|せんい}{方向|ほうこう}→', ox + L / 2, oy + B + 30, { size: 12, align: 'center' });

    // 木口(断面):層と反り
    var ex0 = 320, ey0 = 120, EW = 250, n = m.layers.length, th = n === 1 ? 40 : 8;
    var cup = m.cup * s * 26 * EXG / 2;
    M2.text(c, '{木口|こぐち}({断面|だんめん})', ex0, 26, { size: 13, bold: true });
    var bw = EW * (1 - m.ex * s * EXG);
    var bx = ex0 + (EW - bw) / 2;
    for (var k = 0; k < n; k++) {
      var top = ey0 + k * th;
      c.beginPath();
      c.moveTo(bx, top - cup);
      c.quadraticCurveTo(bx + bw / 2, top + cup, bx + bw, top - cup);
      c.lineTo(bx + bw, top + th - cup);
      c.quadraticCurveTo(bx + bw / 2, top + th + cup, bx, top + th - cup);
      c.closePath();
      c.fillStyle = M2.col(k % 2 ? 'veneer-b' : 'veneer-a'); c.fill();
      c.strokeStyle = M2.col('ink'); c.lineWidth = 1.2; c.stroke();
      // この層の繊維の向き(木口に見えるのは点=繊維が手前向き、線=横向き)
      c.fillStyle = c.strokeStyle = M2.col('latewood');
      if (m.layers[k] === 'x') { for (var d = 1; d < 14; d++) { var xx = bx + bw * d / 14; c.beginPath(); c.arc(xx, top + th / 2 + cup * (1 - Math.pow((xx - bx - bw / 2) / (bw / 2), 2)) * 1 - cup * 0, 1.1, 0, 7); c.fill(); } }
      else { c.lineWidth = 1; c.beginPath(); c.moveTo(bx + 4, top + th / 2); c.quadraticCurveTo(bx + bw / 2, top + th / 2 + 2 * cup, bx + bw - 4, top + th / 2); c.stroke(); }
    }
    c.save(); c.setLineDash([6, 5]); c.strokeStyle = M2.col('ghost'); c.lineWidth = 1.5;
    c.strokeRect(ex0, ey0, EW, n * th); c.restore();
    M2.text(c, '{点|てん}:{繊維|せんい}が{手前|てまえ}{向|む}き  {線|せん}:{横|よこ}{向|む}き', ex0, ey0 + n * th + 50, { size: 12 });

    var crossOut = document.getElementById('crossDryOut');
    if (crossOut) crossOut.textContent = Math.round(s * 100) + '%';
    var html = '<div>{乾燥|かんそう}による{縮|ちぢ}み({目安|めやす})</div>' +
      '<div>・{繊維|せんい}{方向|ほうこう}:' + M2.shrinkPct(m.ey * s) + '</div>' +
      '<div>・{繊維|せんい}に{直角|ちょっかく}:' + M2.shrinkPct(m.ex * s) + '</div>' +
      '<div>・{反|そ}り:' + (m.cup === 0 ? 'ほとんどない' : m.cup < 0.5 ? '{小|ちい}さい' : '{大|おお}きい') + '</div>' +
      '<div class="mini-bars"><div>{曲|ま}げの{強|つよ}さ({目安|めやす})</div>' +
      miniBar('たて({繊維|せんい}{方向|ほうこう})', m.along, 'p-stripe') + miniBar('よこ', m.across, 'p-dots') + '</div>' +
      '<p class="small">' + (m.id === 'cross'
        ? '{繊維|せんい}{方向|ほうこう}を{直交|ちょっこう}させると、となりの{層|そう}が{互|たが}いの{伸|の}び{縮|ちぢ}みをおさえ{合|あ}うので、どちらの{向|む}きにもほとんど{縮|ちぢ}まず、{強|つよ}さもたて・よこで{近|ちか}くなります。'
        : m.id === 'align'
          ? '{繊維|せんい}{方向|ほうこう}をそろえると、{長|なが}さ{方向|ほうこう}に{強|つよ}い{材|ざい}になります({集成材|しゅうせいざい})。{幅|はば}{方向|ほうこう}の{縮|ちぢ}みは{残|のこ}りますが、{反|そ}りはばらつきが{打|う}ち{消|け}し{合|あ}って{小|ちい}さくなります。'
          : '1{枚|まい}の{板|いた}は、{繊維|せんい}に{直角|ちょっかく}な{向|む}きによく{縮|ちぢ}み、{反|そ}りも{出|で}ます。{繊維|せんい}に{直角|ちょっかく}な{向|む}きの{強|つよ}さはとても{小|ちい}さい。') + '</p>' +
      (s > 0 ? '<p class="small">※{図|ず}の{変形|へんけい}は' + EXG + '{倍|ばい}に{強調|きょうちょう}</p>' : '');
    M2.setR('crossInfo', html);
  }
  function miniBar(label, v, cls) {
    return '<div class="rbar"><span class="rlab">' + label + '</span><span class="rtrack"><span class="rfill ' + cls + '" style="width:' + v + '%"></span></span><span class="rval">' + v + '</span></div>';
  }

  function setKind(k) {
    if (stopAnim) { stopAnim(); stopAnim = null; }
    setPlaying(false);
    st.kind = k; st.step = 0; st.t = 1;
    document.getElementById('mkPly').setAttribute('aria-pressed', String(k === 'ply'));
    document.getElementById('mkGlu').setAttribute('aria-pressed', String(k === 'glu'));
    renderSteps(); redraw();
  }

  M2.labs.panel = {
    init: function () {
      cv = document.getElementById('cvMake');
      cvX = document.getElementById('cvCross');
      redraw = M2.scheduler(draw);
      redrawX = M2.scheduler(drawCross);
      document.getElementById('mkPly').addEventListener('click', function () { setKind('ply'); });
      document.getElementById('mkGlu').addEventListener('click', function () { setKind('glu'); });
      document.getElementById('makeSteps').addEventListener('click', function (e) {
        var b = e.target.closest('[data-step]');
        if (b) { setPlaying(false); playStep(+b.getAttribute('data-step'), false); }
      });
      document.getElementById('makePrev').addEventListener('click', function () { setPlaying(false); playStep(Math.max(0, st.step - 1), false); });
      document.getElementById('makeNext').addEventListener('click', function () { setPlaying(false); playStep(Math.min(STEPS[st.kind].length - 1, st.step + 1), false); });
      document.getElementById('makePlay').addEventListener('click', function () {
        if (st.playing) { if (stopAnim) stopAnim(); stopAnim = null; setPlaying(false); return; }
        setPlaying(true);
        playStep(st.step >= STEPS[st.kind].length - 1 ? 0 : st.step, true);
      });
      var box = document.getElementById('crossMode');
      MODES.forEach(function (m) {
        var lab = document.createElement('label');
        lab.className = 'chip';
        lab.innerHTML = '<input type="radio" name="crossMode" value="' + m.id + '"' + (m.id === st.crossMode ? ' checked' : '') + '> <span>' + M2.rb(m.label) + '</span>';
        box.appendChild(lab);
      });
      box.addEventListener('change', function (e) { st.crossMode = e.target.value; redrawX(); });
      document.getElementById('crossDry').addEventListener('input', function (e) { st.dry = +e.target.value; redrawX(); });
      renderSteps();
    },
    show: function () { redraw(); redrawX(); },
    hide: function () { if (stopAnim) { stopAnim(); stopAnim = null; st.t = 1; setPlaying(false); } },
    refresh: function () { if (!cv) return; renderSteps(); setPlaying(st.playing); redraw(); redrawX(); }
  };
})();
