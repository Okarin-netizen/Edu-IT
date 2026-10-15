/*
 * M6 判定ロジック(画面に依存しない。node --test でも読める)
 */
(function (root) {
  'use strict';

  function inRegion(p, r) {
    if (r.w !== undefined) return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    var dx = p.x - r.cx, dy = p.y - r.cy;
    return dx * dx + dy * dy <= r.r * r.r;
  }

  // 1つのタップが当たった危険の id(どれにも当たらなければ null)。
  // 重なっているときは、中心にいちばん近い危険を選ぶ。
  function hitHazard(hazards, p) {
    var best = null, bestD = Infinity;
    hazards.forEach(function (h) {
      (h.regions || []).forEach(function (r) {
        if (!inRegion(p, r)) return;
        var cx = r.cx !== undefined ? r.cx : r.x + r.w / 2, cy = r.cy !== undefined ? r.cy : r.y + r.h / 2;
        var d = (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy);
        if (d < bestD) { bestD = d; best = h.id; }
      });
    });
    return best;
  }

  // KYT の判定。危険がいくつあっても、1つの危険に正解の場所がいくつあってもよい。
  // 同じ危険を何回タップしても1つと数える。
  function judgeKyt(hazards, taps) {
    var tapHits = (taps || []).map(function (p) { return hitHazard(hazards, p); });
    var found = [], missed = [];
    hazards.forEach(function (h) {
      if (tapHits.indexOf(h.id) >= 0) found.push(h.id); else missed.push(h.id);
    });
    var wrong = [];
    tapHits.forEach(function (id, i) { if (id === null) wrong.push(i); });
    return {
      found: found, missed: missed, wrongTaps: wrong, tapHits: tapHits,
      total: hazards.length, perfect: missed.length === 0 && wrong.length === 0
    };
  }

  // 並べかえの判定。answer は正しい順序での番号(0, 1, 2…)の並び。
  function judgeOrder(answer) {
    var positions = answer.map(function (v, i) { return v === i; });
    return {
      positions: positions,
      correctCount: positions.filter(Boolean).length,
      allCorrect: positions.every(Boolean)
    };
  }

  // 0..n-1 をまぜる。最初から正しい順序にはしない(n>1 のとき)。
  function shuffledOrder(n, rnd) {
    rnd = rnd || Math.random;
    var a = [], i;
    for (i = 0; i < n; i++) a.push(i);
    if (n < 2) return a;
    do {
      for (i = n - 1; i > 0; i--) {
        var j = Math.floor(rnd() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
    } while (a.every(function (v, k) { return v === k; }));
    return a;
  }

  function move(arr, from, to) {
    var a = arr.slice();
    if (to < 0 || to >= a.length || from === to) return a;
    var x = a.splice(from, 1)[0];
    a.splice(to, 0, x);
    return a;
  }

  // チェックリストがすべて確認済みか
  function checklistDone(items, checked) {
    return items.length > 0 && items.every(function (it) { return !!(checked && checked[it.id]); });
  }

  // 評価(A/B/C)がすべての観点で選ばれているか
  function rubricComplete(criteria, scores) {
    return criteria.every(function (c) { return scores && /^[ABC]$/.test(scores[c.id] || ''); });
  }

  var api = {
    inRegion: inRegion, hitHazard: hitHazard, judgeKyt: judgeKyt, judgeOrder: judgeOrder,
    shuffledOrder: shuffledOrder, move: move, checklistDone: checklistDone, rubricComplete: rubricComplete
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.M6Logic = api;
})(typeof self !== 'undefined' ? self : this);
