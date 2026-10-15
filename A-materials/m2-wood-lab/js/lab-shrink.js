/* ② 収縮ラボ:乾燥による方向別収縮と断面の変形 */
(function () {
  'use strict';
  var W = M2.wood, PI = Math.PI;
  var cv, ctx, redraw, stopAnim = null;
  var st = { piece: 'ita', s: 0, ex: 2 };

  var PIECES = [
    { id: 'ita', label: '{板目|いため}{板|いた}', make: function () { return { poly: W.rectPoly(0, 0.55, 1.0, 0.2, 0, 70), phi0: PI / 2, board: true }; } },
    { id: 'masa', label: '{柾目|まさめ}{板|いた}', make: function () { return { poly: W.rectPoly(0.52, 0, 0.74, 0.2, 0, 70), phi0: 0, board: true }; } },
    { id: 'kaku', label: '{角材|かくざい}', make: function () { return { poly: W.rectPoly(0.44, 0.44, 0.36, 0.36, 0, 40), phi0: PI / 4 }; } },
    { id: 'maru', label: '{丸棒|まるぼう}', make: function () { return { poly: W.circlePoly(0, -0.6, 0.2, 120), phi0: -PI / 2 }; } },
    { id: 'log', label: '{丸太|まるた}({心持|しんも}ち)', make: function () { var p0 = PI / 3 + PI; return { poly: W.logPoly(p0), phi0: p0, isLog: true }; } },
    { id: 'sewari', label: '{背割|せわ}りした{丸太|まるた}', make: function () { var p0 = PI / 2; return { poly: W.logPoly(p0), phi0: p0, isLog: true, kerf: true }; } }
  ];
  function pieceDef() { return PIECES.filter(function (p) { return p.id === st.piece; })[0]; }

  function bbox(pts) {
    var b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    pts.forEach(function (p) { b.x0 = Math.min(b.x0, p[0]); b.x1 = Math.max(b.x1, p[0]); b.y0 = Math.min(b.y0, p[1]); b.y1 = Math.max(b.y1, p[1]); });
    return b;
  }

  function draw() {
    ctx = M2.setupCanvas(cv);
    var Wd = ctx.W, Hd = ctx.H;
    ctx.clearRect(0, 0, Wd, Hd);
    var def = pieceDef(), piece = def.make();
    var b = bbox(piece.poly);
    var size = Math.max(b.x1 - b.x0, b.y1 - b.y0);
    var S = (piece.isLog ? 400 : 380) / size;
    var c = W.centroid(piece.poly);
    if (piece.isLog) c = [0, 0];
    var CX = Wd / 2, CY = Hd / 2 + 30;
    var dfm = W.deformer(st.s, st.ex, piece.phi0);
    var dc = dfm(c[0], c[1]);
    function mapOrig(x, y) { return [CX + (x - c[0]) * S, CY - (y - c[1]) * S]; }
    function mapDef(x, y) { var q = dfm(x, y); return [CX + (q[0] - dc[0]) * S, CY - (q[1] - dc[1]) * S]; }

    // 乾燥前の形(点線)
    if (st.s > 0.001) W.drawGhost(ctx, piece.isLog ? piece.poly.slice(1) : piece.poly, mapOrig, !piece.isLog);
    // 乾燥後
    piece.s = st.s;
    W.drawSection(ctx, piece, { map: mapDef, px: S, s: st.s, outlineWidth: 2.5 });

    // 木表・木裏などのラベル
    if (st.piece === 'ita') {
      var top = mapDef(c[0], b.y1), bot = mapDef(c[0], b.y0);
      M2.text(ctx, '{木表|きおもて}', top[0], top[1] - 12, { size: 15, bold: true, align: 'center', bg: M2.col('label-bg') });
      M2.text(ctx, '{木裏|きうら}({髄|ずい}の{側|がわ})', bot[0], bot[1] + 28, { size: 15, bold: true, align: 'center', bg: M2.col('label-bg') });
    } else if (st.piece === 'masa') {
      var t2 = mapDef(c[0], b.y1);
      M2.text(ctx, '{柾目|まさめ}の{面|めん}', t2[0], t2[1] - 12, { size: 15, bold: true, align: 'center', bg: M2.col('label-bg') });
    } else if (piece.isLog && st.s > 0.05) {
      var ca = piece.phi0 + PI, cp = mapDef(Math.cos(ca) * 1.08, Math.sin(ca) * 1.08);
      M2.text(ctx, piece.kerf ? '{背割|せわ}りが{開|ひら}く' : '{干割|ひわ}れ', cp[0], cp[1] + (Math.sin(ca) > 0 ? -6 : 20), { size: 15, bold: true, align: 'center', bg: M2.col('label-bg'), color: M2.col('ng') });
    } else if (piece.isLog && piece.kerf) {
      var kp = mapOrig(0, -1.02);
      M2.text(ctx, '{背割|せわ}り({切|き}りこみ)', kp[0], kp[1] + 22, { size: 14, bold: true, align: 'center', bg: M2.col('label-bg') });
    }

    drawMiniMap(piece);
    drawCompass(piece);
    info(piece, dfm);
  }

  /** 左上:丸太のどこから取った材か */
  function drawMiniMap(piece) {
    var cx = 62, cy = 62, R = 50;
    ctx.save();
    ctx.fillStyle = M2.col('panel'); ctx.fillRect(4, 4, 116, 128);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fillStyle = M2.col('sapwood'); ctx.fill();
    ctx.strokeStyle = M2.col('latewood'); ctx.lineWidth = 0.6;
    W.rings.forEach(function (r) { ctx.beginPath(); ctx.arc(cx, cy, r * R, 0, 7); ctx.stroke(); });
    ctx.lineWidth = 1.5; ctx.strokeStyle = M2.col('ink');
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    if (!piece.isLog) {
      W.pathPts(ctx, piece.poly, function (x, y) { return [cx + x * R, cy - y * R]; }, true);
      ctx.fillStyle = M2.col('board-fill-strong'); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = M2.col('accent'); ctx.stroke();
    }
    ctx.restore();
    M2.text(ctx, '{取|と}った{位置|いち}', 14, 128, { size: 12 });
  }

  /** 右上:方向の名前 */
  function drawCompass(piece) {
    var ox = ctx.W - 92, oy = 72, L = 38, a = piece.phi0;
    var rx = Math.cos(a), ry = -Math.sin(a), tx = -ry, ty = rx;
    ctx.save();
    ctx.fillStyle = M2.col('panel'); ctx.fillRect(ctx.W - 180, 4, 176, 128);
    function arrow(dx, dy, dash, label) {
      ctx.setLineDash(dash);
      ctx.strokeStyle = ctx.fillStyle = M2.col('ink'); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(ox - dx * L, oy - dy * L); ctx.lineTo(ox + dx * L, oy + dy * L); ctx.stroke();
      ctx.setLineDash([]);
      [1, -1].forEach(function (sg) {
        var hx = ox + sg * dx * L, hy = oy + sg * dy * L;
        ctx.beginPath(); ctx.moveTo(hx, hy);
        ctx.lineTo(hx - sg * dx * 10 + dy * 5, hy - sg * dy * 10 - dx * 5);
        ctx.lineTo(hx - sg * dx * 10 - dy * 5, hy - sg * dy * 10 + dx * 5); ctx.fill();
      });
      // 矢印の先(画面の右か上にある方)に名前を置く
      var sg = (dx > 0.3 || (Math.abs(dx) <= 0.3 && dy < 0)) ? 1 : -1;
      var lx = ox + sg * dx * (L + 30), ly = oy + sg * dy * (L + 14) + 5;
      M2.text(ctx, label, lx, ly, { size: 12, bold: true, align: 'center', bg: M2.col('label-bg') });
    }
    arrow(rx, ry, [], '{半径|はんけい}');
    arrow(tx, ty, [5, 4], '{接線|せっせん}');
    M2.text(ctx, '{実線|じっせん}={半径|はんけい}{方向|ほうこう} {点線|てんせん}={接線|せっせん}{方向|ほうこう}', ctx.W - 176, 128, { size: 10 });
    ctx.restore();
  }

  function info(piece, dfm) {
    var pct = M2.shrinkPct;
    // 数値は実際の目安(強調なし)。図だけを強調する
    var sT = W.sT * st.s, sR = W.sR * st.s, sL = W.sL * st.s;
    dfm = W.deformer(st.s, 1, piece.phi0);
    var html = '';
    var dryOut = document.getElementById('dryOut');
    if (dryOut) dryOut.textContent = Math.round(st.s * 100) + '%';
    var mc = Math.round(30 - 30 * st.s);
    html += '<div><b>{含水率|がんすいりつ}の{目安|めやす}:約' + mc + '%</b>(' + (st.s < 0.01 ? '{生材|なまざい}' : st.s > 0.99 ? '{全乾|ぜんかん}' : '{乾燥中|かんそうちゅう}') + ')</div>';
    if (st.piece === 'ita') {
      var d = piece.poly.map(function (p) { return dfm(p[0], p[1]); });
      var b0 = bbox(piece.poly), b1 = bbox(d);
      var top = d.filter(function (p, i) { return Math.abs(piece.poly[i][1] - b0.y1) < 1e-6; });
      var mid = top.reduce(function (m, p) { return Math.abs(p[0]) < Math.abs(m[0]) ? p : m; }, top[0]);
      var end = top.reduce(function (m, p) { return p[1] > m[1] ? p : m; }, top[0]);
      var cup = (end[1] - mid[1]) / (b0.y1 - b0.y0) * 100;
      html += '<div>{幅|はば}:' + M2.signedPct((b1.x1 - b1.x0) / (b0.x1 - b0.x0) - 1) + ' {厚|あつ}さ:約 ' + pct(sR) + '</div>';
      html += st.s > 0.02 ? '<div>→ <b>{木表|きおもて}{側|がわ}がへこむ</b>ように{反|そ}る(はしが{約|やく}' + cup.toFixed(0) + '%{上|あ}がる)</div>' : '';
      html += '<p class="small">{木表|きおもて}{側|がわ}は{年輪|ねんりん}に{沿|そ}った{長|なが}さ({接線|せっせん}{方向|ほうこう})が{長|なが}く、{縮|ちぢ}む{量|りょう}が{大|おお}きいためです。</p>';
    } else if (st.piece === 'masa') {
      html += '<div>{幅|はば}({半径|はんけい}{方向|ほうこう}):' + pct(sR) + ' {厚|あつ}さ({接線|せっせん}{方向|ほうこう}):' + pct(sT) + '</div>';
      html += '<div>→ {反|そ}りはほとんど{出|で}ない。{幅|はば}の{縮|ちぢ}みも{板目|いため}より{小|ちい}さい。</div>';
    } else if (st.piece === 'kaku') {
      html += '<div>{半径|はんけい}{方向|ほうこう}の{対角線|たいかくせん}:' + pct(sR) + ' {接線|せっせん}{方向|ほうこう}の{対角線|たいかくせん}:' + pct(sT) + '</div>';
      html += '<div>→ {正方形|せいほうけい}が<b>ひし{形|がた}</b>にゆがむ</div>';
    } else if (st.piece === 'maru') {
      html += '<div>{半径|はんけい}{方向|ほうこう}の{直径|ちょっけい}:' + pct(sR) + ' {接線|せっせん}{方向|ほうこう}の{直径|ちょっけい}:' + pct(sT) + '</div>';
      html += '<div>→ {円|えん}が<b>だ{円|えん}</b>になる</div>';
    } else {
      var gap = 360 * (1 - (1 - sT) / (1 - sR));
      html += '<div>{周|しゅう}の{方向|ほうこう}(' + pct(sT) + ')が{半径|はんけい}{方向|ほうこう}(' + pct(sR) + ')より{多|おお}く{縮|ちぢ}むので、{周|まわ}りの{長|なが}さが{足|た}りなくなり、{約|やく}' + gap.toFixed(0) + '°の{割|わ}れが{開|ひら}く</div>';
      html += piece.kerf
        ? '<div>→ {先|さき}に{背割|せわ}りを{入|い}れておくと、{割|わ}れがそこに{集|あつ}まり、{表|おもて}に{見|み}える{面|めん}が{割|わ}れにくい。</div>'
        : '<div>→ {髄|ずい}を{含|ふく}む{材|ざい}(心持ち材)は{割|わ}れやすい。</div>';
    }
    html += '<div class="small">{繊維|せんい}{方向|ほうこう}({長|なが}さ)の{縮|ちぢ}み:' + pct(sL, 2) + '(ほとんど{縮|ちぢ}まない)</div>';
    if (st.ex > 1) html += '<div class="small">※{図|ず}の{変形|へんけい}は' + st.ex + '{倍|ばい}に{強調|きょうちょう}。{数値|すうち}は{強調|きょうちょう}なしの{目安|めやす}です。</div>';
    M2.setR('shrinkInfo', html);
    ratioBars(sT, sR, sL);
  }

  function ratioBars(sT, sR, sL) {
    var box = document.getElementById('ratioBars');
    var rows = [['{接線|せっせん}{方向|ほうこう}', sT, 'p-stripe'], ['{半径|はんけい}{方向|ほうこう}', sR, 'p-dots'], ['{繊維|せんい}{方向|ほうこう}', sL, 'p-solid']];
    if (!box.firstChild) {
      box.innerHTML = rows.map(function (r) {
        return '<div class="rbar"><span class="rlab">' + M2.rb(r[0]) + '</span><span class="rtrack"><span class="rfill ' + r[2] + '"></span></span><span class="rval"></span></div>';
      }).join('');
    }
    var max = W.sT;
    box.querySelectorAll('.rbar').forEach(function (el, i) {
      var v = rows[i][1];
      el.querySelector('.rfill').style.width = Math.max(0, v / max * 100) + '%';
      el.querySelector('.rval').textContent = (v * 100).toFixed(v < 0.01 && v > 0 ? 2 : 1) + '%';
    });
  }

  function setDry(v) { st.s = v; document.getElementById('dry').value = v; redraw(); }

  M2.labs.shrink = {
    init: function () {
      cv = document.getElementById('cvShrink');
      redraw = M2.scheduler(draw);
      var box = document.getElementById('shrinkPiece');
      PIECES.forEach(function (p) {
        var id = 'pc-' + p.id;
        var lab = document.createElement('label');
        lab.className = 'chip';
        lab.innerHTML = '<input type="radio" name="piece" id="' + id + '" value="' + p.id + '"' + (p.id === st.piece ? ' checked' : '') + '> <span>' + M2.rb(p.label) + '</span>';
        box.appendChild(lab);
      });
      box.addEventListener('change', function (e) { st.piece = e.target.value; redraw(); });
      document.getElementById('dry').addEventListener('input', function (e) { if (stopAnim) stopAnim(); st.s = +e.target.value; redraw(); });
      document.getElementById('exaggerate').addEventListener('change', function (e) { st.ex = +e.target.value; redraw(); });
      document.getElementById('btnDry').addEventListener('click', function () {
        if (stopAnim) stopAnim();
        var from = st.s >= 0.99 ? 0 : st.s;
        stopAnim = M2.animate(2600 * (1 - from), function (t) { setDry(from + (1 - from) * t); }, function () { stopAnim = null; });
      });
      document.getElementById('btnWet').addEventListener('click', function () { if (stopAnim) stopAnim(); setDry(0); });
    },
    show: function () { redraw(); },
    hide: function () { if (stopAnim) { stopAnim(); stopAnim = null; } },
    refresh: function () { var b = document.getElementById('ratioBars'); if (b) b.innerHTML = ''; redraw && redraw(); }
  };
})();
