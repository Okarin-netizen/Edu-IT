/* 「流れを図で表す」ミニ練習(3問)。D6(教科書 p.222〜223)と D7(p.240〜241)の入り口で、同じものを出す。
 * 使い方: window.DFlowPractice.el({ page: 'p.240〜241' }) が <details class="card dfp"> を返す。
 * 答えはこの端末に保存(D6 と D7 で共通)。1ファイル版では build/eduit-inline.mjs が中に入れる。 */
(function () {
  'use strict';
  var KEY = 'eduit-d-flow-practice';
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* --- 図の部品(JIS の流れ図記号に近い形。線は黒の細い線) --- */
  var W = 120, H = 30;
  function t(x, y, s) { return '<text x="' + x + '" y="' + (y + 4.5) + '" text-anchor="middle">' + esc(s) + '</text>'; }
  function term(cx, y, s) { return '<rect x="' + (cx - 50) + '" y="' + y + '" width="100" height="' + H + '" rx="15"/>' + t(cx, y + H / 2, s); }
  function proc(cx, y, s) { return '<rect x="' + (cx - W / 2) + '" y="' + y + '" width="' + W + '" height="' + H + '"/>' + t(cx, y + H / 2, s); }
  function dia(cx, y, s) { var h = 44, w = 120; return '<polygon points="' + cx + ',' + y + ' ' + (cx + w / 2) + ',' + (y + h / 2) + ' ' + cx + ',' + (y + h) + ' ' + (cx - w / 2) + ',' + (y + h / 2) + '"/>' + t(cx, y + h / 2, s); }
  /* ループ端(始め): 上の角を切った形、(終わり): 下の角を切った形 */
  function loopS(cx, y, s) { var x0 = cx - W / 2, x1 = cx + W / 2, c = 8; return '<polygon points="' + (x0 + c) + ',' + y + ' ' + (x1 - c) + ',' + y + ' ' + x1 + ',' + (y + c) + ' ' + x1 + ',' + (y + H) + ' ' + x0 + ',' + (y + H) + ' ' + x0 + ',' + (y + c) + '"/>' + t(cx, y + H / 2, s); }
  function loopE(cx, y, s) { var x0 = cx - W / 2, x1 = cx + W / 2, c = 8; return '<polygon points="' + x0 + ',' + y + ' ' + x1 + ',' + y + ' ' + x1 + ',' + (y + H - c) + ' ' + (x1 - c) + ',' + (y + H) + ' ' + (x0 + c) + ',' + (y + H) + ' ' + x0 + ',' + (y + H - c) + '"/>' + t(cx, y + H / 2, s); }
  function ln(pts, arrow) { return '<polyline class="dfp-ln" points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '"' + (arrow ? ' marker-end="url(#dfp-ar)"' : '') + '/>'; }
  function lab(x, y, s) { return '<text class="dfp-lab" x="' + x + '" y="' + y + '">' + esc(s) + '</text>'; }
  function svg(w, h, label, body) {
    return '<svg class="dfp-svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(label) + '">' +
      '<defs><marker id="dfp-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="dfp-arh"/></marker></defs>' + body + '</svg>';
  }
  /* 分岐: ひし形の左右に はい/いいえ の処理、下で合流する */
  function branch(cx, y, cond, yes, no) {
    var by = y + 60, lx = cx - 75, rx = cx + 75, my = by + H + 18;
    var b = dia(cx, y, cond);
    b += ln([[cx - 60, y + 22], [lx, y + 22], [lx, by]], true) + lab(cx - 72, y + 16, 'はい');
    b += ln([[cx + 60, y + 22], [rx, y + 22], [rx, by]], true) + lab(cx + 58, y + 16, 'いいえ');
    b += '<rect x="' + (lx - 55) + '" y="' + by + '" width="110" height="' + H + '"/>' + t(lx, by + H / 2, yes);
    b += '<rect x="' + (rx - 55) + '" y="' + by + '" width="110" height="' + H + '"/>' + t(rx, by + H / 2, no);
    b += ln([[lx, by + H], [lx, my], [rx, my], [rx, by + H]]);
    return { body: b, bottom: my };
  }

  function chart1() {
    var cx = 150, b = term(cx, 6, '始め') + ln([[cx, 36], [cx, 52]], true) + proc(cx, 52, 'LEDをつける') + ln([[cx, 82], [cx, 98]], true) +
      proc(cx, 98, '1秒待つ') + ln([[cx, 128], [cx, 144]], true) + proc(cx, 144, 'LEDを消す') + ln([[cx, 174], [cx, 190]], true) + term(cx, 190, '終わり');
    return svg(300, 226, '始め、LEDをつける、1秒待つ、LEDを消す、終わり', b);
  }
  function chart2() {
    var cx = 150, b = term(cx, 6, '始め') + ln([[cx, 36], [cx, 52]], true) + proc(cx, 52, '明るさをはかる') + ln([[cx, 82], [cx, 98]], true);
    var br = branch(cx, 98, '暗い?', 'LEDをつける', 'LEDを消す');
    b += br.body + ln([[cx, br.bottom], [cx, br.bottom + 16]], true) + term(cx, br.bottom + 16, '終わり');
    return svg(300, br.bottom + 52, '始め、明るさをはかる、暗いかどうかで、はいならLEDをつける、いいえならLEDを消す、終わり', b);
  }
  function chart3() {
    var cx = 150, b = loopS(cx, 6, 'ずっとくり返す') + ln([[cx, 36], [cx, 52]], true) + proc(cx, 52, '明るさをはかる') + ln([[cx, 82], [cx, 98]], true);
    var br = branch(cx, 98, '暗い?', 'LEDをつける', 'LEDを消す');
    b += br.body + ln([[cx, br.bottom], [cx, br.bottom + 16]], true) + loopE(cx, br.bottom + 16, 'ここまで');
    return svg(300, br.bottom + 52, 'ずっとくり返す、の中で、明るさをはかり、暗いならLEDをつけ、明るいならLEDを消す', b);
  }

  var Q = [
    { fig: chart1, q: 'この流れ図は、どの形?', c: ['順次', '分岐', '反復'], a: 0, e: '上から順に、1つずつ進む。これを順次という。' },
    { fig: chart2, q: 'この流れ図は、どの形?', c: ['順次', '分岐', '反復'], a: 1, e: '「暗い?」で、進む道が2つに分かれる。これを分岐という。' },
    { fig: chart3, q: '街灯の流れ図。使っている形を全部えらぶと?', c: ['順次だけ', '分岐だけ', '分岐と反復'], a: 2, e: '「暗い?」が分岐、「ずっとくり返す」が反復。' }
  ];

  function load() { try { var v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* 保存できなくても練習はできる */ } }

  function el(opt) {
    opt = opt || {};
    var ans = load();
    var box = document.createElement('details');
    box.className = 'card dfp';
    function nOk() { return Q.filter(function (x, i) { return ans[i] === x.a; }).length; }
    function nDone() { return Q.filter(function (x, i) { return ans[i] !== undefined; }).length; }
    if (nDone() < Q.length) box.open = true;
    function render() {
      var h = '<summary><b>練習: 流れを図で表す(3問)</b><span class="dfp-sc">' + nOk() + ' / ' + Q.length + ' 問せいかい</span></summary>';
      h += '<p class="dfp-lead">プログラムの流れは、順次・分岐・反復の3つの形でできている。' + (opt.page ? '教科書 ' + esc(opt.page) + ' を見ながら答えよう。' : '') + '</p><div class="dfp-qs">';
      Q.forEach(function (x, i) {
        var v = ans[i], done = v !== undefined;
        h += '<div class="dfp-q"><div class="dfp-fig">' + x.fig() + '</div><div class="dfp-body"><p class="dfp-qt">問' + (i + 1) + ' ' + esc(x.q) + '</p><div class="btn-row">';
        x.c.forEach(function (c, j) {
          var cls = done ? (j === x.a ? ' dfp-ok' : (j === v ? ' dfp-ng' : '')) : '';
          h += '<button type="button" class="btn secondary small' + cls + '" data-dfp-q="' + i + '" data-dfp-c="' + j + '"' + (done ? ' disabled' : '') + '>' + (done && j === x.a ? '○ ' : (done && j === v ? '× ' : '')) + esc(c) + '</button>';
        });
        h += '</div>' + (done ? '<p class="dfp-res"><b>' + (v === x.a ? 'せいかい。' : 'ざんねん。') + '</b>' + esc(x.e) + '</p>' : '') + '</div></div>';
      });
      h += '</div>' + (nDone() ? '<div class="btn-row"><button type="button" class="btn secondary small" data-dfp-reset>もう一度とく</button></div>' : '');
      box.innerHTML = h;
    }
    box.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b || !box.contains(b)) return;
      if (b.hasAttribute('data-dfp-reset')) { ans = {}; save(ans); render(); return; }
      var i = b.getAttribute('data-dfp-q'); if (i === null) return;
      ans[i] = +b.getAttribute('data-dfp-c'); save(ans); render();
    });
    render();
    return box;
  }
  window.DFlowPractice = { el: el, questions: Q.length };
})();
