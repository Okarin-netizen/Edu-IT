// 問題解決ノート(4分野共通)の計算とデータのテスト: node --test shared/mondai-note/mondai-note.test.js
const test = require('node:test');
const assert = require('node:assert');
require('./mondai-note-data.js');
require('./mondai-note.js');
const MN = globalThis.MondaiNote;

// 重み 0〜3 のすべての組み合わせ
function* weightSets(crit) {
  const n = crit.length, w = new Array(n).fill(0);
  for (let i = 0; i < Math.pow(4, n); i++) {
    let x = i; for (let j = 0; j < n; j++) { w[j] = x % 4; x = Math.floor(x / 4); }
    const o = {}; crit.forEach((c, j) => { o[c.k] = w[j]; }); yield o;
  }
}

for (const d of ['A', 'B', 'C', 'D']) {
  test(d + ': データがそろっている', () => {
    const dom = MN.DOMAINS[d];
    assert.ok(dom.samples.length >= 4);
    assert.strictEqual(dom.quiz.length, 6);
    assert.strictEqual(dom.quiz.filter(q => q.t === 'mondai').length, 3, '問題と課題は3問ずつ');
    assert.ok(dom.evalCrit.length >= 5 && dom.evalCrit.length <= 7);
    assert.strictEqual(dom.products.length, 3);
    dom.samples.forEach(s => s.vp.forEach(k => assert.ok(MN.VP.some(v => v.k === k), k)));
    for (const p of dom.products) {
      const crit = MN.critOf(dom, p);
      for (const o of p.options) for (const c of crit) assert.ok(o.s[c.k] >= 1 && o.s[c.k] <= 5, p.id + '.' + o.id + '.' + c.k);
      for (const ps of MN.presetsOf(dom, p)) for (const c of crit) assert.ok(ps.w[c.k] !== undefined, p.id + ' 立場 ' + ps.label + ' に ' + c.k);
      for (const l of p.limits || []) assert.ok(crit.some(c => c.k === l.k), p.id + ' 制約条件 ' + l.k);
    }
  });
  test(d + ': どの製品も、重みを変えればどの案も1位になれる(最適化の体験)', () => {
    const dom = MN.DOMAINS[d];
    for (const p of dom.products) {
      const won = new Set();
      for (const w of weightSets(MN.critOf(dom, p))) { const r = MN.rank(dom, p, w, []); if (r.best) won.add(r.best); }
      assert.deepStrictEqual([...won].sort(), p.options.map(o => o.id).sort(), p.id);
      // 同じ重みのときに同点にならない(はじめの画面で1位が決まる)
      const eq = {}; MN.critOf(dom, p).forEach(c => { eq[c.k] = 1; });
      assert.ok(MN.rank(dom, p, eq, []).best, p.id + ' 同じ重みで同点');
    }
  });
}

test('点数と制約条件', () => {
  const dom = MN.DOMAINS.A, p = dom.products[0];
  const w = { func: 0, strong: 0, cost: 0, safety: 0, env: 1 };
  let r = MN.rank(dom, p, w, []);
  assert.strictEqual(r.best, 'glass');
  assert.strictEqual(r.list[0].score, 100);
  r = MN.rank(dom, p, w, [0]);  // 割れてはいけない → ガラスびんは選べない
  assert.strictEqual(r.best, 'can');
  assert.ok(!r.list.find(x => x.id === 'glass').ok);
  r = MN.rank(dom, p, { func: 0, strong: 0, cost: 0, safety: 0, env: 0 }, []);
  assert.strictEqual(r.best, '');
});

test('こわれた中身もノートの形にそろう・要約が作れる', () => {
  const d = MN.normalize({ cards: [{ text: 'せまい', vp: ['society'], star: 1 }, null], task: { kadai: '本立てを作る' }, ev: { res: { func: 4 } } }, 'A');
  assert.strictEqual(d.cards.length, 1);
  assert.strictEqual(d.cards[0].star, true);
  assert.ok(d.cards[0].id);
  assert.deepStrictEqual(d.task.limits, []);
  const s = MN.summary(d, 'A');
  assert.strictEqual(s.length, 4);
  assert.match(s[0].rows.find(r => r[0] === '集めた付箋')[1], /★せまい\(社会\)/);
  assert.match(s[1].rows.find(r => r[0] === '観点ごとの評価(5段階)')[1], /機能 4/);
  assert.ok(MN.radarSVG(['a', 'b', 'c'], [{ values: [1, 2, 3] }]).startsWith('<svg'));
});
