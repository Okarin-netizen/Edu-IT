// 文章をつくるAIの小さな模型(n-gram)と、トークンに分けるしくみ。
// 画面を使わない計算だけを書く(tests/unit.test.mjs から Node でも読める)。
var GenaiLM = (function () {
  'use strict';
  var START = '^';
  var ENDS = ['。', '！', '？'];

  // ---- トークンに分ける ----
  // 知っている言葉(vocab)のうち、いちばん長く合うものから切る。知らない文字は1文字ずつ。
  // 英字・数字のならびは5文字ずつのかけらにする。
  function makeVocab(words) {
    var list = [];
    var seen = {};
    words.forEach(function (w) {
      if (w && !seen[w]) { seen[w] = true; list.push(w); }
    });
    var index = {};
    list.forEach(function (w, i) { index[w] = i + 1; });
    var maxLen = list.reduce(function (m, w) { return Math.max(m, Array.from(w).length); }, 1);
    return { list: list, index: index, maxLen: maxLen };
  }

  function charKind(c) {
    if (/[A-Za-z0-9Ａ-Ｚａ-ｚ０-９]/.test(c)) return 'ascii';
    if (/\s/.test(c)) return 'space';
    return 'other';
  }

  function tokenId(vocab, t) {
    if (vocab.index[t]) return vocab.index[t];
    var cp = 0;
    Array.from(t).forEach(function (c) { cp = (cp * 31 + c.codePointAt(0)) % 4000; });
    return 5000 + cp;
  }

  function tokenize(text, vocab) {
    var chars = Array.from(String(text || ''));
    var out = [];
    var i = 0;
    while (i < chars.length) {
      var c = chars[i];
      var kind = charKind(c);
      if (kind === 'space') { i++; continue; }
      if (kind === 'ascii') {
        var j = i;
        while (j < chars.length && charKind(chars[j]) === 'ascii' && j - i < 5) j++;
        var w = chars.slice(i, j).join('');
        out.push({ text: w, id: tokenId(vocab, w), known: !!vocab.index[w] });
        i = j;
        continue;
      }
      var found = null;
      for (var len = Math.min(vocab.maxLen, chars.length - i); len >= 2; len--) {
        var cand = chars.slice(i, i + len).join('');
        if (vocab.index[cand]) { found = cand; break; }
      }
      if (!found) found = c;
      out.push({ text: found, id: tokenId(vocab, found), known: !!vocab.index[found] });
      i += Array.from(found).length;
    }
    return out;
  }

  // ---- n-gram の模型 ----
  // sentences: ["わたし は 学校 へ 行きます 。", …](トークンは空白で区切る)
  function splitSentence(s) {
    var toks = String(s).trim().split(/\s+/).filter(Boolean);
    if (toks.length && ENDS.indexOf(toks[toks.length - 1]) < 0) toks.push('。');
    return toks;
  }

  function buildModel(sentences) {
    var m = { c1: {}, c2: {}, sentences: [], texts: {} };
    sentences.forEach(function (s) {
      var toks = Array.isArray(s) ? s.slice() : splitSentence(s);
      if (!toks.length) return;
      m.sentences.push(toks);
      m.texts[toks.join('')] = true;
      var seq = [START, START].concat(toks);
      for (var k = 2; k < seq.length; k++) {
        add(m.c1, seq[k - 1], seq[k]);
        add(m.c2, seq[k - 2] + '|' + seq[k - 1], seq[k]);
      }
    });
    return m;
  }
  function add(table, key, next) {
    var row = table[key] || (table[key] = {});
    row[next] = (row[next] || 0) + 1;
  }

  // 前の言葉(history)から、つぎの言葉の候補と回数を出す。order: 1 か 2(見る言葉の数)
  function candidates(m, history, order) {
    var seq = [START, START].concat(history);
    var a = seq[seq.length - 2];
    var b = seq[seq.length - 1];
    var row = null;
    var used = order;
    if (order >= 2) row = m.c2[a + '|' + b];
    if (!row) { row = m.c1[b]; used = 1; }
    if (!row) return { list: [], used: 0, context: [] };
    var total = 0;
    var list = Object.keys(row).map(function (w) { total += row[w]; return { word: w, count: row[w] }; });
    list.forEach(function (c) { c.p = c.count / total; });
    list.sort(function (x, y) { return y.count - x.count || (x.word < y.word ? -1 : 1); });
    var context = used === 2 ? [a, b] : [b];
    return { list: list, used: used, context: context.filter(function (w) { return w !== START; }) };
  }

  // ランダムさ(温度)をかけた割合。t が小さいほど多いものに集まる
  function withTemperature(list, t) {
    var temp = Math.max(0.05, t);
    var ws = list.map(function (c) { return Math.pow(c.p, 1 / temp); });
    var sum = ws.reduce(function (s, w) { return s + w; }, 0) || 1;
    return list.map(function (c, i) { return { word: c.word, count: c.count, p: c.p, q: ws[i] / sum }; });
  }

  function pick(list, rnd) {
    var r = rnd();
    var acc = 0;
    for (var i = 0; i < list.length; i++) {
      acc += list[i].q;
      if (r < acc) return list[i].word;
    }
    return list.length ? list[list.length - 1].word : null;
  }

  function isEnd(w) { return ENDS.indexOf(w) >= 0; }

  // 文を1つ最後まで作る
  function generate(m, opts) {
    var hist = (opts.start || []).slice();
    var rnd = opts.rnd || Math.random;
    for (var n = 0; n < (opts.maxLen || 30); n++) {
      if (hist.length && isEnd(hist[hist.length - 1])) break;
      var c = candidates(m, hist, opts.order || 2);
      if (!c.list.length) break;
      hist.push(pick(withTemperature(c.list, opts.temperature == null ? 1 : opts.temperature), rnd));
    }
    return hist;
  }

  function inData(m, toks) { return !!m.texts[toks.join('')]; }

  // はじめに来る言葉の一覧
  function starters(m) {
    var row = m.c2[START + '|' + START] || {};
    return Object.keys(row).sort(function (x, y) { return row[y] - row[x]; });
  }

  // 決まった種から同じ数を出す乱数(テストと「もう一度」用)
  function seeded(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return (s % 1000000) / 1000000;
    };
  }

  return {
    START: START, makeVocab: makeVocab, tokenize: tokenize, splitSentence: splitSentence,
    buildModel: buildModel, candidates: candidates, withTemperature: withTemperature,
    pick: pick, generate: generate, inData: inData, starters: starters, isEnd: isEnd, seeded: seeded
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = GenaiLM;
