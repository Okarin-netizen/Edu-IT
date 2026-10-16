/* ① 丸太断面ビューア:年輪・心材/辺材・早材/晩材、板の取り方(柾目/板目) */
(function () {
  'use strict';
  var W = A2.wood;
  var cv, cvFace, ctx, fctx;
  var st = { dn: 0.45, da: 0, rot: 0, t: 0.16, w: 0.7 };
  var LIM = 0.92;
  var S = 228, CX = 260, CY = 260;

  function axes() {
    var th = st.rot * Math.PI / 180;
    return { ax: Math.cos(th), ay: Math.sin(th), nx: -Math.sin(th), ny: Math.cos(th) };
  }
  function fit() {
    st.dn = A2.clamp(st.dn, -(LIM - st.t / 2 - 0.03), LIM - st.t / 2 - 0.03);
    var half = Math.sqrt(Math.max(0, LIM * LIM - Math.pow(Math.abs(st.dn) + st.t / 2, 2)));
    st.w = Math.min(0.72, half * 2);
    st.da = A2.clamp(st.da, -(half - st.w / 2), half - st.w / 2);
  }
  function board() {
    var a = axes();
    return { cx: a.nx * st.dn + a.ax * st.da, cy: a.ny * st.dn + a.ay * st.da, w: st.w, t: st.t, rot: st.rot };
  }
  function map(x, y) { return [CX + x * S, CY - y * S]; }
  function unmap(X, Y) { return [(X - CX) / S, (CY - Y) / S]; }

  var redraw;
  function draw() {
    var out = document.getElementById('cutOffsetOut');
    if (out) { var pc = Math.round(Math.abs(st.dn) * 100); out.textContent = pc ? '半径の' + pc + '%' : '0%(中心)'; }
    ctx = A2.setupCanvas(cv);
    ctx.clearRect(0, 0, ctx.W, ctx.H);
    var layers = document.getElementById('showLayers').checked;
    var early = document.getElementById('showEarly').checked;
    W.drawSection(ctx, { poly: W.circlePoly(0, 0, 1, 200), phi0: 0 }, { map: map, px: S, layers: layers, early: early, s: 0 });

    // 板
    var b = board(), a = axes(), info = W.classify(b);
    var poly = W.rectPoly(b.cx, b.cy, b.w, b.t, st.rot * Math.PI / 180, 4);
    ctx.save();
    W.pathPts(ctx, poly, map, true);
    ctx.fillStyle = A2.col('board-fill'); ctx.fill();
    ctx.setLineDash([7, 4]);
    ctx.lineWidth = 3; ctx.strokeStyle = A2.col('accent'); ctx.stroke();
    ctx.restore();

    // 木表・木裏のラベル
    var sgn = info.omoteSign;
    function faceLabel(sideSign, text) {
      var off = (b.t / 2 + 0.07) * sideSign;
      var p = map(b.cx + a.nx * off, b.cy + a.ny * off);
      A2.text(ctx, text, p[0], p[1] + 5, { size: 14, bold: true, align: 'center', bg: A2.col('label-bg'), color: A2.col('accent') });
    }
    if (!info.hasPith) {
      faceLabel(sgn, '{木表|きおもて}');
      faceLabel(-sgn, '{木裏|きうら}');
    } else {
      faceLabel(1, '{髄|ずい}を{含|ふく}む{板|いた}');
    }

    // 部位の名前(左側)
    if (layers) {
      var items = [
        [0.97, '{樹皮|じゅひ}', 0.86], [0.78, '{辺材|へんざい}', 0.63], [0.35, '{心材|しんざい}', 0.40], [0.0, '{髄|ずい}', 0.17]
      ];
      items.forEach(function (it, i) {
        var ang = Math.PI * (1.08 + i * 0.075);
        var p = map(Math.cos(ang) * it[0], Math.sin(ang) * it[0]);
        var ly = 300 + i * 52, lx = 10;
        ctx.strokeStyle = A2.col('ink'); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(lx + 56, ly - 5); ctx.lineTo(p[0], p[1]); ctx.stroke();
        ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, 7); ctx.fillStyle = A2.col('ink'); ctx.fill();
        A2.text(ctx, it[1], lx, ly, { size: 14, bold: true, bg: A2.col('label-bg') });
      });
    }

    // 結果カード
    var tLabel = W.TYPE_LABEL[info.type];
    A2.setR('cutType', info.hasPith ? tLabel + '({心持|しんも}ち)' : tLabel);
    var desc = {
      masa: '{年輪|ねんりん}が{面|めん}にほぼ{直角|ちょっかく}。{木目|もくめ}がまっすぐ。{収縮|しゅうしゅく}や{反|そ}りが{少|すく}ない。{一本|いっぽん}の{丸太|まるた}から{少|すこ}ししかとれない。',
      ita: '{年輪|ねんりん}が{面|めん}にほぼ{平行|へいこう}。{山形|やまがた}の{木目|もくめ}。{幅|はば}の{広|ひろ}い{板|いた}がとれるが、{幅|はば}{方向|ほうこう}によく{縮|ちぢ}み、{木表|きおもて}{側|がわ}がへこむように{反|そ}りやすい。',
      oimasa: '{柾目|まさめ}と{板目|いため}の{中間|ちゅうかん}。{木目|もくめ}はやや{斜|なな}め。'
    }[info.type];
    if (info.hasPith) desc += '{髄|ずい}を{含|ふく}むので{割|わ}れが{出|で}やすい。';
    A2.setR('cutAngle', '{年輪|ねんりん}と{板|いた}の{面|めん}の{角度|かくど}:{平均|へいきん} 約' + Math.round(info.deg) + '°<br>' + desc);
    drawFace(b, info);
  }

  function drawFace(b, info) {
    fctx = A2.setupCanvas(cvFace);
    fctx.clearRect(0, 0, fctx.W, fctx.H);
    var x0 = 12, y0 = 40, w = fctx.W - 24, h = 140;
    var face = info.hasPith ? 1 : info.omoteSign;
    W.renderFace(fctx, x0, y0, w, h, b, face);
    fctx.strokeStyle = A2.col('ink'); fctx.lineWidth = 1.5; fctx.strokeRect(x0, y0, w, h);
    A2.text(fctx, info.hasPith ? '{板|いた}の{面|めん}' : '{木表|きおもて}の{面|めん}', x0, 24, { size: 14, bold: true });
    // 繊維方向の矢印
    var ay = y0 + h + 22;
    fctx.strokeStyle = A2.col('ink'); fctx.fillStyle = A2.col('ink'); fctx.lineWidth = 2;
    fctx.beginPath(); fctx.moveTo(x0 + 150, ay - 5); fctx.lineTo(x0 + w - 10, ay - 5); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x0 + w - 4, ay - 5); fctx.lineTo(x0 + w - 16, ay - 11); fctx.lineTo(x0 + w - 16, ay + 1); fctx.fill();
    A2.text(fctx, '{繊維|せんい}{方向|ほうこう}({木|き}の{長|なが}さの{向|む}き)', x0, ay, { size: 13 });
  }

  function onPointer(e) {
    var r = cv.getBoundingClientRect();
    var X = (e.clientX - r.left) * (cv._w / r.width), Y = (e.clientY - r.top) * (cv._h / r.height);
    var p = unmap(X, Y), a = axes();
    st.dn = p[0] * a.nx + p[1] * a.ny;
    st.da = p[0] * a.ax + p[1] * a.ay;
    fit();
    document.getElementById('cutOffset').value = st.dn.toFixed(2);
    redraw();
  }

  A2.labs.section = {
    init: function () {
      cv = document.getElementById('cvLog');
      cvFace = document.getElementById('cvFace');
      redraw = A2.scheduler(draw);
      var dragging = false;
      cv.addEventListener('pointerdown', function (e) { dragging = true; cv.setPointerCapture(e.pointerId); onPointer(e); });
      cv.addEventListener('pointermove', function (e) { if (dragging) onPointer(e); });
      cv.addEventListener('pointerup', function () { dragging = false; });
      cv.addEventListener('pointercancel', function () { dragging = false; });
      cv.addEventListener('keydown', function (e) {
        var step = e.shiftKey ? 0.08 : 0.02, used = true;
        if (e.key === 'ArrowUp') st.dn += step;
        else if (e.key === 'ArrowDown') st.dn -= step;
        else if (e.key === 'ArrowRight') st.da += step;
        else if (e.key === 'ArrowLeft') st.da -= step;
        else used = false;
        if (used) { e.preventDefault(); fit(); document.getElementById('cutOffset').value = st.dn.toFixed(2); redraw(); }
      });
      cv.setAttribute('aria-label', '丸太の断面。矢印キーで板の位置を動かせます');
      document.getElementById('cutOffset').addEventListener('input', function (e) { st.dn = +e.target.value; fit(); redraw(); });
      document.getElementById('cutRotate').addEventListener('change', function (e) { st.rot = +e.target.value; fit(); redraw(); });
      ['showLayers', 'showEarly'].forEach(function (id) { document.getElementById(id).addEventListener('change', redraw); });
      fit();
    },
    show: function () { redraw(); },
    refresh: function () { redraw && redraw(); }
  };
})();
