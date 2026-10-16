/* ③ 反りシミュレーション:木表/木裏を選び、乾燥後に反る向きを予測 → 確認 */
(function () {
  'use strict';
  var W = A2.wood, PI = Math.PI;
  var cv, ctx, redraw, stopAnim = null;
  var EX = 3; // 反りが見えるように強調
  var q = null;          // 今の問題
  var st = { faceUp: 'omote', s: 0, answered: null, hint: false };
  var session = { n: 0, ok: 0 };

  var CHOICES = [
    { id: 'concave', label: '{上|うえ}の{面|めん}がへこむ', svg: '<path d="M6 10 Q30 30 54 10" />' },
    { id: 'convex', label: '{上|うえ}の{面|めん}がふくらむ', svg: '<path d="M6 26 Q30 6 54 26" />' },
    { id: 'flat', label: 'ほとんど{反|そ}らない', svg: '<path d="M6 18 L54 18" />' }
  ];

  function newQuestion() {
    var r = Math.random();
    if (r < 0.75) {
      var d = 0.42 + Math.random() * 0.25;
      q = { type: 'ita', cx: 0, cy: d, w: 0.9 - (d - 0.42) * 0.9, t: 0.17, phi0: PI / 2 };
    } else {
      var dm = 0.45 + Math.random() * 0.15;
      q = { type: 'masa', cx: dm, cy: 0, w: 0.62, t: 0.17, phi0: 0 };
    }
    q.poly = W.rectPoly(q.cx, q.cy, q.w, q.t, 0, 70);
    st.s = 0; st.answered = null;
    renderChoices();
    document.getElementById('quizFb').innerHTML = '';
    document.getElementById('quizFb').className = 'feedback';
    updateFaceButtons();
    redraw();
  }

  function correctAnswer() {
    if (q.type === 'masa') return 'flat';
    return st.faceUp === 'omote' ? 'concave' : 'convex';
  }

  function updateFaceButtons() {
    var o = document.getElementById('faceUpOmote'), u = document.getElementById('faceUpUra');
    o.setAttribute('aria-pressed', String(st.faceUp === 'omote'));
    u.setAttribute('aria-pressed', String(st.faceUp === 'ura'));
    var lock = !!st.answered;
    o.disabled = u.disabled = lock;
  }

  function renderChoices() {
    var box = document.getElementById('quizChoices');
    box.innerHTML = '';
    CHOICES.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn choice';
      b.setAttribute('data-choice', c.id);
      b.innerHTML = '<svg viewBox="0 0 60 36" aria-hidden="true" class="ico">' + c.svg + '</svg><span>' + A2.rb(c.label) + '</span>';
      b.addEventListener('click', function () { answer(c.id); });
      box.appendChild(b);
    });
  }

  function answer(choice) {
    if (st.answered) return;
    st.answered = choice;
    var right = correctAnswer(), ok = choice === right;
    session.n++; if (ok) session.ok++;
    updateFaceButtons();
    document.querySelectorAll('#quizChoices .choice').forEach(function (b) {
      var id = b.getAttribute('data-choice');
      b.disabled = true;
      if (id === right) b.classList.add('is-right');
      if (id === choice && !ok) b.classList.add('is-wrong');
      if (id === choice) b.setAttribute('aria-pressed', 'true');
    });
    if (stopAnim) stopAnim();
    stopAnim = A2.animate(1800, function (t) { st.s = A2.ease(t); redraw(); }, function () {
      stopAnim = null;
      feedback(ok, choice, right);
    });
    A2.loadRecords().then(function (rec) {
      rec.data.quizLog.push({ at: new Date().toISOString(), board: q.type === 'ita' ? '板目' : '柾目', faceUp: st.faceUp === 'omote' ? '木表' : '木裏', answer: choice, correct: ok });
      if (rec.data.quizLog.length > 500) rec.data.quizLog = rec.data.quizLog.slice(-500);
      return A2.saveRecords(rec);
    }).then(function () { if (A2.labs.notes) A2.labs.notes.refreshLog(); });
  }

  function label(id) { return CHOICES.filter(function (c) { return c.id === id; })[0].label; }

  function feedback(ok, choice, right) {
    var fb = document.getElementById('quizFb');
    var why, point;
    if (q.type === 'masa') {
      point = '柾目板は、反りはほとんど出ません。';
      why = '{柾目|まさめ}{板|いた}は、{上|うえ}と{下|した}の{面|めん}で{年輪|ねんりん}の{向|む}きが{同|おな}じです。どちらの{面|めん}も{同|おな}じように{縮|ちぢ}むので、{反|そ}りはほとんど{出|で}ません。';
    } else {
      point = '板目板は、<b>木表側がへこむ</b>ように反ります。' +
        (st.faceUp === 'omote' ? '今は木表が上なので、上の面がへこみます。' : '今は木裏が上なので、下の木表がへこみ、上の面はふくらみます。');
      why = '{接線|せっせん}{方向|ほうこう}の{収縮率|しゅうしゅくりつ}(約10%)は、{半径|はんけい}{方向|ほうこう}(約5%)の{約|やく}2{倍|ばい}です。' +
        '{年輪|ねんりん}に{沿|そ}う{向|む}きが{大|おお}きく{縮|ちぢ}むので、{板|いた}の{中|なか}の{年輪|ねんりん}({図|ず}の{赤|あか}い{線|せん})は、{弓|ゆみ}のつるのように{短|みじか}くなろうとして、{板|いた}の{両|りょう}はしを{木表|きおもて}の{側|がわ}へ{引|ひ}き{上|あ}げます。' +
        'そのため<b>{木表|きおもて}{側|がわ}がへこむ</b>ように{反|そ}ります。';
    }
    var head = ok
      ? '<p class="fb-head ok">◎ {正解|せいかい}!</p>'
      : '<p class="fb-head ng">✕ {予測|よそく}とちがいました</p><p>あなたの{予測|よそく}:' + label(choice) + '<br>{実際|じっさい}:<b>' + label(right) + '</b></p>';
    var use = q.type === 'ita' ? '<p class="small">{使|つか}い{方|かた}のヒント:{板目|いため}{板|いた}は{反|そ}りを{考|かんが}えて{木表|きおもて}・{木裏|きうら}の{向|む}きを{決|き}めます。{木口|こぐち}の{年輪|ねんりん}を{見|み}れば、{木表|きおもて}・{木裏|きうら}を{見分|みわ}けられます。</p>' : '';
    // 結論を先に短く。理由は「くわしく」を開くと読める
    A2.setR(fb, head + '<p class="fb-point">' + point + '</p>' +
      '<details class="fb-more"><summary>くわしく(なぜそうなるの?)</summary><p>' + why + '</p>' + use + '</details>');
    fb.className = 'feedback ' + (ok ? 'is-ok' : 'is-ng');
    A2.setR('quizScore', 'この{時間|じかん}の{成績|せいせき}:' + session.n + '{問|もん}{中|ちゅう} ' + session.ok + '{問|もん}{正解|せいかい}');
    redraw();
  }

  function draw() {
    ctx = A2.setupCanvas(cv);
    var Wd = ctx.W, Hd = ctx.H;
    ctx.clearRect(0, 0, Wd, Hd);
    var flip = (q.type === 'ita' && st.faceUp === 'ura') ? -1 : 1;
    var S = 420 / q.w;
    var CX = Wd / 2, CY = Hd / 2 + 20;
    var c = [q.cx, q.cy];
    var dfm = W.deformer(st.s, EX, q.phi0), dc = dfm(c[0], c[1]);
    function mapOrig(x, y) { return [CX + (x - c[0]) * S * flip, CY - (y - c[1]) * S * flip]; }
    function mapDef(x, y) { var p = dfm(x, y); return [CX + (p[0] - dc[0]) * S * flip, CY - (p[1] - dc[1]) * S * flip]; }

    // 机(基準の水平線)
    ctx.save(); ctx.strokeStyle = A2.col('line'); ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20, CY); ctx.lineTo(Wd - 20, CY); ctx.stroke(); ctx.restore();

    if (st.s > 0.001) W.drawGhost(ctx, q.poly, mapOrig, true);
    W.drawSection(ctx, { poly: q.poly, phi0: q.phi0 }, { map: mapDef, px: S, s: st.s, outlineWidth: 2.5 });

    // 面の名前
    var topY = mapDef(c[0], q.cy + q.t / 2 * flip)[1], botY = mapDef(c[0], q.cy - q.t / 2 * flip)[1];
    var upName, downName;
    if (q.type === 'ita') {
      upName = st.faceUp === 'omote' ? '{木表|きおもて}' : '{木裏|きうら}';
      downName = st.faceUp === 'omote' ? '{木裏|きうら}' : '{木表|きおもて}';
    } else { upName = '{柾目|まさめ}の{面|めん}'; downName = '{柾目|まさめ}の{面|めん}'; }
    A2.text(ctx, '{上|うえ}:' + upName, CX, Math.min(topY, CY - q.t / 2 * S) - 20, { size: 16, bold: true, align: 'center', bg: A2.col('label-bg') });
    A2.text(ctx, '{下|した}:' + downName, CX, Math.max(botY, CY + q.t / 2 * S) + 34, { size: 16, bold: true, align: 'center', bg: A2.col('label-bg') });
    A2.text(ctx, '{木口|こぐち}({板|いた}のはしの{断面|だんめん})', 16, 28, { size: 13 });
    if (st.s > 0.001) A2.text(ctx, '{点線|てんせん}:{乾燥|かんそう}{前|まえ} / {反|そ}りは' + EX + '{倍|ばい}に{強調|きょうちょう}', 16, Hd - 14, { size: 12, color: A2.col('muted') });

    if (st.hint) drawHint(flip);
    if (st.answered && st.s > 0.99) drawWhy(mapDef, flip);
  }

  /** ヒント:丸太の中のどこから取った板か */
  function drawHint(flip) {
    var cx = ctx.W - 70, cy = 70, R = 54;
    ctx.save();
    ctx.translate(cx, cy);
    if (flip < 0) ctx.rotate(PI);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fillStyle = A2.col('sapwood'); ctx.fill();
    ctx.strokeStyle = A2.col('latewood'); ctx.lineWidth = 0.6;
    W.rings.forEach(function (r) { ctx.beginPath(); ctx.arc(0, 0, r * R, 0, 7); ctx.stroke(); });
    ctx.strokeStyle = A2.col('ink'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
    ctx.fillStyle = A2.col('pith'); ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill();
    ctx.fillStyle = A2.col('board-fill-strong'); ctx.strokeStyle = A2.col('accent'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect((q.cx - q.w / 2) * R, -(q.cy + q.t / 2) * R, q.w * R, q.t * R); ctx.fill(); ctx.stroke();
    ctx.restore();
    A2.text(ctx, '{髄|ずい}', cx + 6, cy + 4 + (flip < 0 ? 0 : 0), { size: 11, bg: A2.col('label-bg') });
  }

  /** 理由の図:板の中の年輪1本を太線で示し、乾燥前(点線)と乾燥後をくらべる */
  function drawWhy(mapDef, flip) {
    var x0 = q.cx - q.w / 2, x1 = q.cx + q.w / 2, y0 = q.cy - q.t / 2, y1 = q.cy + q.t / 2;
    var pts = [], i, n = 80;
    if (q.type === 'ita') {
      var r = q.cy + q.t * 0.3;
      for (i = 0; i <= n; i++) { var x = x0 + (x1 - x0) * i / n; if (r > Math.abs(x)) pts.push([x, Math.sqrt(r * r - x * x)]); }
    } else {
      var rx = q.cx + q.w * 0.3;
      for (i = 0; i <= n; i++) { var y = y0 + (y1 - y0) * i / n; pts.push([Math.sqrt(Math.max(0, rx * rx - y * y)), y]); }
    }
    pts = pts.filter(function (p) { return p[1] >= y0 - 1e-9 && p[1] <= y1 + 1e-9 && p[0] >= x0 && p[0] <= x1; });
    if (pts.length < 2) return;
    function line(map, color, w, dash) {
      ctx.save(); ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
      W.pathPts(ctx, pts, map, false); ctx.stroke(); ctx.restore();
    }
    var CX = ctx.W / 2;
    line(mapDef, A2.col('label-bg'), 8, []);
    line(mapDef, A2.col('ng'), 4.5, []);
    ctx.save();
    ctx.fillStyle = ctx.strokeStyle = A2.col('ng');
    if (q.type === 'ita') {
      // 年輪の両はしに「縮む向き」の矢印(弓のつるのように短くなろうとする)
      [[0, 1], [pts.length - 1, -1]].forEach(function (e) {
        var p0 = mapDef(pts[e[0]][0], pts[e[0]][1]), p1 = mapDef(pts[e[0] + e[1] * 6][0], pts[e[0] + e[1] * 6][1]);
        var ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), hx = p0[0] + Math.cos(ang) * 26, hy = p0[1] + Math.sin(ang) * 26;
        ctx.beginPath(); ctx.moveTo(hx + Math.cos(ang) * 4, hy + Math.sin(ang) * 4);
        ctx.lineTo(hx - Math.cos(ang) * 12 - Math.sin(ang) * 8, hy - Math.sin(ang) * 12 + Math.cos(ang) * 8);
        ctx.lineTo(hx - Math.cos(ang) * 12 + Math.sin(ang) * 8, hy - Math.sin(ang) * 12 - Math.cos(ang) * 8);
        ctx.closePath(); ctx.fill();
      });
      // 板の両はしが木表側へ持ち上がる
      var omoteUp = flip > 0;
      [x0, x1].forEach(function (xx) {
        var c = mapDef(xx, omoteUp ? y1 : y0), dir = omoteUp ? -1 : 1, yA = c[1] + dir * 10, yB = c[1] + dir * 42;
        ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c[0], yA); ctx.lineTo(c[0], yB); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c[0], yB + dir * 10); ctx.lineTo(c[0] - 7, yB - dir * 2); ctx.lineTo(c[0] + 7, yB - dir * 2); ctx.fill();
      });
    }
    ctx.restore();
    var msg = q.type === 'ita'
      ? '{赤|あか}い{年輪|ねんりん}が{短|みじか}くなろうとして、{両|りょう}はしを{木表|きおもて}{側|がわ}へ{引|ひ}く'
      : '{年輪|ねんりん}の{向|む}きは{上|うえ}と{下|した}の{面|めん}で{同|おな}じ';
    A2.text(ctx, msg, CX, 66, { size: 14, bold: true, align: 'center', color: A2.col('ng'), bg: A2.col('label-bg') });
  }

  A2.labs.quiz = {
    init: function () {
      cv = document.getElementById('cvQuiz');
      redraw = A2.scheduler(draw);
      document.getElementById('faceUpOmote').addEventListener('click', function () { if (!st.answered) { st.faceUp = 'omote'; updateFaceButtons(); redraw(); } });
      document.getElementById('faceUpUra').addEventListener('click', function () { if (!st.answered) { st.faceUp = 'ura'; updateFaceButtons(); redraw(); } });
      document.getElementById('quizHint').addEventListener('change', function (e) { st.hint = e.target.checked; redraw(); });
      document.getElementById('quizNext').addEventListener('click', function () { if (stopAnim) stopAnim(); newQuestion(); });
      A2.setR('quizDesc', '{板|いた}を{木口|こぐち}({端|はし}の{断面|だんめん})から{見|み}た{図|ず}。{年輪|ねんりん}の{曲|ま}がり{方|かた}にも{注目|ちゅうもく}しよう。');
      newQuestion();
    },
    show: function () { redraw(); },
    hide: function () { if (stopAnim) { stopAnim(); stopAnim = null; st.s = st.answered ? 1 : 0; } },
    refresh: function () {
      if (!q) return;
      renderChoices();
      if (st.answered) {
        var right = correctAnswer();
        document.querySelectorAll('#quizChoices .choice').forEach(function (b) {
          var id = b.getAttribute('data-choice'); b.disabled = true;
          if (id === right) b.classList.add('is-right');
          if (id === st.answered && id !== right) b.classList.add('is-wrong');
        });
      }
      redraw();
    }
  };
})();
