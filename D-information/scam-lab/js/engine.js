// ネット詐欺 追体験ラボ: 場面を進めるしくみ(画面を使わない計算だけ。tests/unit.test.mjs から Node でも読める)。
//
// 場面(scenario)は「画面(node)」と「おわり(end)」のつながりでできている。
//   node.acts … その画面でできること。画面の中のボタン(screen の act: 'id' で指す)と、右の「あなたの行動」。
//     { id, label, to, step, need, needMsg, say, tone, panel }
//       to    … つぎの画面か、おわり(ends)の id
//       step  … やると「やることリスト」の1つが ✓ になる
//       need  … これをやる前に ✓ になっていないといけない step(なければ needMsg を出してその画面のまま)
//       say   … 押したあとに出す説明。tone は good(よい判断)・meh(それだけでは足りない)・info
//       panel … false なら「あなたの行動」には出さない(画面の中のボタンだけ)
//     acts に文字を書くと、scenario.shared の同じ名前の行動を使う(どの画面でも出したい行動)。
//   end.type … 'bad'(だまされた: その前の画面からやり直せる)・'clear'(クリア)
var ScamEngine = (function () {
  'use strict';

  function acts(sc, nodeId) {
    var node = sc.nodes[nodeId];
    if (!node) return [];
    return (node.acts || []).map(function (a) {
      if (typeof a === 'string') {
        var s = (sc.shared || {})[a];
        if (!s) throw new Error(sc.id + ': shared に ' + a + ' がありません');
        return Object.assign({ id: a }, s);
      }
      return a;
    });
  }
  function findAct(sc, nodeId, actId) {
    return acts(sc, nodeId).filter(function (a) { return a.id === actId; })[0] || null;
  }

  function init(sc) {
    return { started: false, node: sc.start, done: {}, misses: 0, hints: 0, hint: '', cleared: false, clearedAt: '', end: null, back: null, msg: null, log: [] };
  }
  function clone(st) { return JSON.parse(JSON.stringify(st)); }
  function missing(st, need) { return (need || []).filter(function (s) { return !st.done[s]; }); }

  // 行動を1つ行う。st は書きかえずに、新しい状態を返す。
  function apply(sc, st, act, now) {
    var n = clone(st);
    n.hint = '';
    if (n.end) return n;
    if (missing(n, act.need).length) {
      n.msg = { tone: 'need', text: act.needMsg || 'その前に、まだやることがあるよ。「やることリスト」の「？」を見てみよう。' };
      return n;
    }
    if (act.step) n.done[act.step] = true;
    n.msg = act.say ? { tone: act.tone || 'good', text: act.say } : null;
    n.log.push(n.node + ':' + (act.id || act.label));
    if (n.log.length > 60) n.log = n.log.slice(-60);
    if (act.to) {
      var e = sc.ends[act.to];
      if (e) {
        n.end = act.to;
        n.back = n.node;
        if (e.type === 'bad') n.misses += 1;
        else { n.cleared = true; n.clearedAt = n.clearedAt || now || ''; }
      } else {
        n.node = act.to;
      }
    }
    return n;
  }
  // だまされたあと、その前の画面にもどる(やったことの ✓ は残す)
  function back(sc, st) {
    var n = clone(st);
    n.node = n.back || sc.start;
    n.end = null;
    n.back = null;
    n.msg = null;
    return n;
  }
  // 場面をはじめから(クリアの記録・失敗の数・ヒントの数は残す)
  function restart(sc, st) {
    var n = init(sc);
    n.started = true;
    n.misses = st.misses;
    n.hints = st.hints;
    n.cleared = st.cleared;
    n.clearedAt = st.clearedAt;
    return n;
  }
  // つぎにやること(まだ ✓ になっていない、いちばん上の step)
  function nextStep(sc, st) {
    return sc.steps.filter(function (s) { return !st.done[s.id]; })[0] || null;
  }
  function useHint(sc, st) {
    var n = clone(st);
    var s = nextStep(sc, n);
    if (!s) return n;
    n.hints += 1;
    n.hint = s.hint;
    return n;
  }

  // データの点検(テスト用): 行き先があるか、クリアの前に全部の step が要るか
  function validate(sc) {
    var errs = [];
    var stepIds = sc.steps.map(function (s) { return s.id; });
    if (!sc.nodes[sc.start]) errs.push('start がない');
    Object.keys(sc.nodes).forEach(function (nid) {
      var node = sc.nodes[nid];
      var list;
      try { list = acts(sc, nid); } catch (e) { errs.push(e.message); return; }
      var ids = list.map(function (a) { return a.id; }).filter(Boolean);
      screenRefs(node.screen).forEach(function (r) {
        if (ids.indexOf(r) < 0) errs.push(nid + ': 画面のボタン ' + r + ' の行動がない');
      });
      list.forEach(function (a) {
        if (a.to && !sc.nodes[a.to] && !sc.ends[a.to]) errs.push(nid + ': 行き先 ' + a.to + ' がない');
        if (a.step && stepIds.indexOf(a.step) < 0) errs.push(nid + ': step ' + a.step + ' がない');
        (a.need || []).forEach(function (s) { if (stepIds.indexOf(s) < 0) errs.push(nid + ': need ' + s + ' がない'); });
        if (a.to && sc.ends[a.to] && sc.ends[a.to].type === 'clear') {
          var have = (a.need || []).concat(a.step ? [a.step] : []);
          stepIds.forEach(function (s) { if (have.indexOf(s) < 0) errs.push(nid + ': クリアの前に ' + s + ' が要らない'); });
        }
        if (!a.label && a.panel !== false) errs.push(nid + ': 行動の文がない');
      });
    });
    return errs;
  }
  // 画面のデータから act: 'id' を全部ひろう
  function screenRefs(x) {
    var out = [];
    (function walk(v) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { if (k === 'act' && typeof v[k] === 'string') out.push(v[k]); else walk(v[k]); });
    })(x);
    return out;
  }
  // クリアまでの行動の順番を1つさがす(テスト用。状態 = 画面 + ✓ の組み合わせ)
  function solve(sc) {
    var start = init(sc);
    var key = function (st) { return st.node + '|' + Object.keys(st.done).sort().join(','); };
    var queue = [{ st: start, path: [] }];
    var seen = {};
    seen[key(start)] = true;
    while (queue.length) {
      var cur = queue.shift();
      var list = acts(sc, cur.st.node);
      for (var i = 0; i < list.length; i++) {
        var a = list[i];
        var n = apply(sc, cur.st, a, 'test');
        if (n.end && sc.ends[n.end].type === 'clear') return cur.path.concat([a.id || a.label]);
        if (n.end) continue;
        var k = key(n);
        if (seen[k]) continue;
        seen[k] = true;
        queue.push({ st: n, path: cur.path.concat([a.id || a.label]) });
      }
    }
    return null;
  }

  return { acts: acts, findAct: findAct, init: init, apply: apply, back: back, restart: restart, nextStep: nextStep, useHint: useHint, validate: validate, screenRefs: screenRefs, solve: solve };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ScamEngine;
