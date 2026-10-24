/* ④ 強度比較:繊維方向に対する力の向きと強さ(荷重スライダ+棒グラフ) */
(function () {
  'use strict';
  // 強さの目安(針葉樹の乾燥材のおよその値を、繊維方向の引張りを100とした相対値)
  var TESTS = [
    { id: 'tenL', name: '{繊維|せんい}{方向|ほうこう}に{引|ひ}っぱる', v: 100, kind: 'tension', grain: 'L' },
    { id: 'bendL', name: '{繊維|せんい}が{長|なが}さ{方向|ほうこう}の{棒|ぼう}を{曲|ま}げる', v: 75, kind: 'bend', grain: 'L' },
    { id: 'compL', name: '{繊維|せんい}{方向|ほうこう}に{押|お}す', v: 42, kind: 'comp', grain: 'L' },
    { id: 'shear', name: '{繊維|せんい}に{沿|そ}ってずらす(せん{断|だん})', v: 9, kind: 'shear', grain: 'L' },
    { id: 'compT', name: '{繊維|せんい}に{直角|ちょっかく}に{押|お}す(めりこみ)', v: 8, kind: 'press', grain: 'L' },
    { id: 'bendT', name: '{繊維|せんい}が{幅|はば}{方向|ほうこう}の{棒|ぼう}を{曲|ま}げる', v: 5, kind: 'bend', grain: 'T' },
    { id: 'tenT', name: '{繊維|せんい}に{直角|ちょっかく}に{引|ひ}っぱる', v: 4, kind: 'tension', grain: 'T' }
  ];
  var load = 0;

  function grainLines(x, y, w, h, dir, cls) {
    var s = '';
    if (dir === 'L') for (var i = 1; i < 5; i++) { var yy = y + h * i / 5; s += '<line x1="' + x + '" y1="' + yy + '" x2="' + (x + w) + '" y2="' + yy + '" class="' + (cls || 'grain') + '"/>'; }
    else for (var j = 1; j < 10; j++) { var xx = x + w * j / 10; s += '<line x1="' + xx + '" y1="' + y + '" x2="' + xx + '" y2="' + (y + h) + '" class="' + (cls || 'grain') + '"/>'; }
    return s;
  }
  function arrow(x1, y1, x2, y2) {
    var a = Math.atan2(y2 - y1, x2 - x1), h = 9;
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="force"/>' +
      '<path class="force-head" d="M' + x2 + ' ' + y2 + ' L' + (x2 - h * Math.cos(a - 0.45)) + ' ' + (y2 - h * Math.sin(a - 0.45)) + ' L' + (x2 - h * Math.cos(a + 0.45)) + ' ' + (y2 - h * Math.sin(a + 0.45)) + 'Z"/>';
  }
  function block(x, y, w, h, grain) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" class="spec"/>' + grainLines(x, y, w, h, grain);
  }

  /** 状態 k(0〜1)、broken に応じた試験片の図 */
  function svgFor(t, k, broken) {
    var s = '', g = t.grain;
    var aLen = 14 + 18 * Math.min(1, load / 100);
    if (t.kind === 'tension') {
      if (t.grain === 'T') {
        // 繊維に直角に引っぱる(上下に引く)
        var gap = broken ? 10 : 0;
        s += block(60, 30 - gap / 2, 80, 25, 'L') + block(60, 55 + gap / 2, 80, 25, 'L');
        if (!broken) s += '<line x1="60" y1="55" x2="140" y2="55" class="grain"/>';
        else s += '<path class="crack" d="M60 ' + (55 - gap / 2) + ' H140"/>';
        s += arrow(100, 28 - gap / 2, 100, 28 - gap / 2 - aLen) + arrow(100, 82 + gap / 2, 100, 82 + gap / 2 + aLen);
      } else {
        var d = broken ? 8 : 0;
        s += block(30 - d, 42, 70, 26, g) + block(100 + d, 42, 70, 26, g);
        if (broken) s += '<path class="crack" d="M' + (100 - d) + ' 42 l6 6 -8 5 7 5 -6 5 5 5"/><path class="crack" d="M' + (100 + d) + ' 42 l6 6 -8 5 7 5 -6 5 5 5"/>';
        s += arrow(28 - d, 55, 28 - d - aLen, 55) + arrow(172 + d, 55, 172 + d + aLen, 55);
      }
    } else if (t.kind === 'comp') {
      var sq = k * 6;
      s += '<rect x="' + (55 + sq) + '" y="' + (40 - sq / 2) + '" width="' + (90 - 2 * sq) + '" height="' + (30 + sq) + '" class="spec"/>' + grainLines(55 + sq, 40 - sq / 2, 90 - 2 * sq, 30 + sq, 'L');
      if (broken) s += '<path class="crack" d="M95 ' + (40 - sq / 2) + ' l10 10 -10 10 10 ' + (10 + sq) + '"/>';
      s += arrow(55 + sq - aLen - 2, 55, 53 + sq, 55) + arrow(145 - sq + aLen + 2, 55, 147 - sq, 55);
    } else if (t.kind === 'press') {
      var dep = Math.min(1, k) * 8 + (broken ? 4 : 0);
      s += '<path class="spec" d="M30 50 H75 Q100 ' + (50 + dep * 2) + ' 125 50 H170 V85 H30 Z"/>' + grainLines(30, 50, 140, 35, 'L');
      s += '<rect x="78" y="' + (34 + dep) + '" width="44" height="14" class="plate"/>' + arrow(100, 6 + dep, 100, 32 + dep);
    } else if (t.kind === 'shear') {
      var sl = broken ? 10 : k * 3;
      s += block(40 + sl, 35, 120, 22, 'L') + block(40 - sl, 57, 120, 22, 'L');
      if (broken) s += '<path class="crack" d="M' + (40 - sl) + ' 57 H' + (160 + sl) + '"/>';
      s += arrow(40 + sl - 4 - aLen, 46, 36 + sl, 46) + arrow(160 - sl + 4 + aLen, 68, 164 - sl, 68);
    } else if (t.kind === 'bend') {
      var defl = broken ? 22 : k * 14;
      var top = 'M30 40 Q100 ' + (40 + defl * 2) + ' 170 40';
      if (!broken) {
        s += '<path class="spec" d="' + top + ' L170 62 Q100 ' + (62 + defl * 2) + ' 30 62 Z"/>';
        if (g === 'L') for (var i = 1; i < 4; i++) { var o = 40 + i * 5.5; s += '<path class="grain" fill="none" d="M30 ' + o + ' Q100 ' + (o + defl * 2) + ' 170 ' + o + '"/>'; }
        else for (var j = 1; j < 12; j++) { var x = 30 + j * 140 / 12, yy = 40 + defl * 2 * (1 - Math.pow((x - 100) / 70, 2)) / 2; s += '<line class="grain" x1="' + x + '" y1="' + (yy) + '" x2="' + x + '" y2="' + (yy + 22) + '"/>'; }
      } else {
        s += '<path class="spec" d="M30 40 L98 ' + (40 + defl) + ' L96 ' + (62 + defl) + ' L30 62 Z"/><path class="spec" d="M170 40 L102 ' + (40 + defl) + ' L104 ' + (62 + defl) + ' L170 62 Z"/>';
        s += '<path class="crack" d="M98 ' + (40 + defl) + ' l-4 6 5 5 -5 5 4 6"/>';
      }
      s += '<path class="support" d="M30 64 l-8 14 h16 Z"/><path class="support" d="M170 64 l-8 14 h16 Z"/>';
      s += arrow(100, 6, 100, 32 + defl);
    }
    return '<svg viewBox="0 0 200 100" class="spec-svg" aria-hidden="true">' + s + '</svg>';
  }

  function render() {
    document.getElementById('loadOut').textContent = load;
    var cards = document.getElementById('strengthCards');
    if (!cards.firstChild) {
      cards.innerHTML = TESTS.map(function (t) {
        return '<div class="ef-box scard" id="sc-' + t.id + '"><div class="sc-title">' + A2.rb(t.name) + '</div><div class="sc-fig"></div><div class="sc-state" aria-live="polite"></div></div>';
      }).join('');
    }
    TESTS.forEach(function (t) {
      var el = document.getElementById('sc-' + t.id);
      var k = load / t.v, broken = load >= t.v && load > 0;
      el.classList.toggle('broken', broken);
      el.querySelector('.sc-fig').innerHTML = svgFor(t, Math.min(1, k), broken);
      var state = broken ? '<span class="ef-tag is-ng">✕ こわれた</span>' : load === 0 ? '<span class="ef-tag">{力|ちから}なし</span>' : k > 0.75 ? '<span class="ef-tag is-warn">△ もう{少|すこ}しで{限界|げんかい}</span>' : '<span class="ef-tag is-ok">○ たえている</span>';
      A2.setR(el.querySelector('.sc-state'), state + ' <span class="small">{強|つよ}さ ' + t.v + '</span>');
    });
    // 棒グラフ
    var bars = document.getElementById('strengthBars');
    bars.innerHTML = TESTS.map(function (t) {
      var broken = load >= t.v && load > 0;
      return '<div class="sbar' + (broken ? ' broken' : '') + '"><span class="slab">' + A2.rb(t.name) + '</span>' +
        '<span class="strack"><span class="sfill" style="width:' + t.v + '%"></span><span class="sload" style="left:' + load + '%"></span></span>' +
        '<span class="sval">' + t.v + (broken ? ' ✕' : '') + '</span></div>';
    }).join('');
    var brokenN = TESTS.filter(function (t) { return load >= t.v && load > 0; }).length;
    bars.setAttribute('aria-label', '強さの比較。荷重 ' + load + ' で ' + brokenN + ' 種類がこわれた。' + TESTS.map(function (t) { return A2.plain(t.name) + ' ' + t.v; }).join('、'));
  }

  A2.labs.strength = {
    init: function () {
      var inp = document.getElementById('load');
      inp.addEventListener('input', function () { load = +inp.value; render(); });
      document.getElementById('btnLoadReset').addEventListener('click', function () { load = 0; inp.value = 0; render(); });
      render();
    },
    show: function () {},
    refresh: function () { document.getElementById('strengthCards').innerHTML = ''; render(); }
  };
})();
