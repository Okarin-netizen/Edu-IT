// node --test tests/   (M6 の判定ロジックとデータの検査)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../logic.js');

const dir = path.join(__dirname, '..');
function load(file, key) {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(dir, file), 'utf8'), ctx);
  return ctx.window[key];
}
const D = JSON.parse(JSON.stringify(load('tools-data.js', 'M6_DATA')));

/* ---------- KYT ---------- */
const hz = [
  { id: 'a', regions: [{ cx: 50, cy: 50, r: 10 }, { cx: 200, cy: 50, r: 10 }] },
  { id: 'b', regions: [{ cx: 100, cy: 100, r: 20 }] },
  { id: 'c', regions: [{ x: 300, y: 0, w: 20, h: 20 }] }
];
test('KYT: 正解が複数あっても全部見つければ満点', () => {
  const r = L.judgeKyt(hz, [{ x: 52, y: 48 }, { x: 105, y: 95 }, { x: 310, y: 10 }]);
  assert.deepStrictEqual(r.found, ['a', 'b', 'c']);
  assert.strictEqual(r.perfect, true);
});
test('KYT: 1つの危険に正解の場所が2つ。どちらでも正解', () => {
  const r = L.judgeKyt(hz, [{ x: 200, y: 55 }]);
  assert.deepStrictEqual(r.found, ['a']);
  assert.deepStrictEqual(r.missed, ['b', 'c']);
});
test('KYT: 同じ危険を2回タップしても1つと数える', () => {
  const r = L.judgeKyt(hz, [{ x: 50, y: 50 }, { x: 200, y: 50 }]);
  assert.strictEqual(r.found.length, 1);
  assert.strictEqual(r.wrongTaps.length, 0);
});
test('KYT: 外れた印は wrongTaps に入り、満点にならない', () => {
  const r = L.judgeKyt(hz, [{ x: 50, y: 50 }, { x: 100, y: 100 }, { x: 310, y: 10 }, { x: 390, y: 250 }]);
  assert.deepStrictEqual(r.wrongTaps, [3]);
  assert.strictEqual(r.perfect, false);
});
test('KYT: 印がないときは全部見のがし', () => {
  const r = L.judgeKyt(hz, []);
  assert.strictEqual(r.found.length, 0);
  assert.strictEqual(r.missed.length, 3);
});
test('KYT: 重なった領域では中心に近い危険を選ぶ', () => {
  const two = [{ id: 'x', regions: [{ cx: 0, cy: 0, r: 30 }] }, { id: 'y', regions: [{ cx: 20, cy: 0, r: 30 }] }];
  assert.strictEqual(L.hitHazard(two, { x: 18, y: 0 }), 'y');
  assert.strictEqual(L.hitHazard(two, { x: 2, y: 0 }), 'x');
});

/* ---------- ならべかえ ---------- */
test('ならべかえ: 判定', () => {
  assert.strictEqual(L.judgeOrder([0, 1, 2, 3]).allCorrect, true);
  const r = L.judgeOrder([1, 0, 2, 3]);
  assert.deepStrictEqual(r.positions, [false, false, true, true]);
  assert.strictEqual(r.correctCount, 2);
});
test('ならべかえ: まぜた結果は正しい順序にならず、全部の番号を含む', () => {
  for (let n = 2; n <= 6; n++) {
    for (let k = 0; k < 50; k++) {
      const a = L.shuffledOrder(n);
      assert.deepStrictEqual(a.slice().sort(), [...Array(n).keys()]);
      assert.ok(!a.every((v, i) => v === i));
    }
  }
});
test('ならべかえ: move は範囲外を無視する', () => {
  assert.deepStrictEqual(L.move([0, 1, 2], 0, 1), [1, 0, 2]);
  assert.deepStrictEqual(L.move([0, 1, 2], 0, -1), [0, 1, 2]);
  assert.deepStrictEqual(L.move([0, 1, 2], 2, 3), [0, 1, 2]);
});

/* ---------- チェックリスト・評価 ---------- */
test('チェックリスト: 全部確かめるまで完了にならない', () => {
  const items = D.checklist;
  const some = {}; items.slice(0, -1).forEach((it) => (some[it.id] = true));
  assert.strictEqual(L.checklistDone(items, some), false);
  some[items[items.length - 1].id] = true;
  assert.strictEqual(L.checklistDone(items, some), true);
  assert.strictEqual(L.checklistDone([], {}), false);
});
test('評価: 3観点すべて選ぶまで保存できない', () => {
  const c = D.rubric.criteria;
  assert.strictEqual(L.rubricComplete(c, { posture: 'A', safety: 'B' }), false);
  assert.strictEqual(L.rubricComplete(c, { posture: 'A', safety: 'B', accuracy: 'D' }), false);
  assert.strictEqual(L.rubricComplete(c, { posture: 'A', safety: 'B', accuracy: 'C' }), true);
});

/* ---------- データ ---------- */
test('データ: 8種の工具に手順・注意・図・クイズがある', () => {
  assert.deepStrictEqual(D.tools.map((t) => t.id), ['saw', 'plane', 'hammer', 'awl', 'file', 'scriber', 'square', 'clamp']);
  D.tools.forEach((t) => {
    assert.ok(t.steps.length >= 4, t.id);
    t.steps.forEach((s) => assert.ok(s.title && s.text && s.caution && s.fig.length, t.id + ' ' + s.title));
    assert.ok(t.quiz.length >= 4 && new Set(t.quiz).size === t.quiz.length, t.id + ' quiz');
  });
});
test('データ: 図の部品名はすべて描ける', () => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(dir, 'figures.js'), 'utf8'), ctx);
  const F = ctx.window.M6Fig;
  D.tools.forEach((t) => [t.icon].concat(t.steps.map((s) => s.fig)).forEach((fig) => fig.forEach((p) => assert.ok(F.parts[p[0]], t.id + ': ' + p[0]))));
  D.kyt.forEach((k) => assert.ok(F.scene(k.scene).length > 500, k.scene));
});
test('データ: KYT は危険が2つ以上、正解の場所が絵の中にある', () => {
  D.kyt.forEach((k) => {
    assert.ok(k.hazards.length >= 2);
    k.hazards.forEach((h) => {
      assert.ok(h.regions.length >= 1 && h.label && h.explain, h.id);
      h.regions.forEach((r) => assert.ok(r.cx >= 0 && r.cx <= 400 && r.cy >= 0 && r.cy <= 260 && r.r > 8, h.id));
    });
  });
});
test('データ: tools.json と tools-data.js が同じ', () => {
  const json = JSON.parse(fs.readFileSync(path.join(dir, 'tools.json'), 'utf8'));
  assert.deepStrictEqual(json, JSON.parse(JSON.stringify(D)));
});

/* ---------- ルビ ---------- */
function rubyCoverage(text, dict) {
  const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
  const re = new RegExp('\\{([^{}|]+)\\|([^{}]+)\\}|(' + keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
  let out = '', last = 0, m;
  while ((m = re.exec(text))) { out += text.slice(last, m.index) + ' '.repeat(m[0].length); last = re.lastIndex; }
  out += text.slice(last);
  return (out.match(/[㐀-鿿々]/g) || []);
}
function allTexts(D) {
  const t = [D.notice];
  D.tools.forEach((x) => { t.push(x.name, x.kind, x.summary, ...x.quiz); x.steps.forEach((s) => t.push(s.title, s.text, s.caution)); });
  D.checklist.forEach((c) => t.push(c.group, c.text, c.hint));
  D.kyt.forEach((k) => { t.push(k.title, k.intro); k.hazards.forEach((h) => t.push(h.label, h.explain)); });
  D.rubric.criteria.forEach((c) => t.push(c.name, c.levels.A, c.levels.B, c.levels.C));
  return t;
}
function uiTexts() {
  // app.js / index.html の画面に出る日本語(コメントを除く)
  const src = fs.readFileSync(path.join(dir, 'app.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/<title>.*<\/title>/, '');
  return (src.match(/'[^'\n]*'/g) || []).map((s) => s.slice(1, -1)).concat(html.replace(/<[^>]+>/g, '\n').split('\n'));
}
test('ルビ: 画面に出る漢字にはすべて読みがある(総ルビ)', () => {
  const dict = Object.assign({}, load('../common/ruby-dict.js', 'RUBY_DICT') || {}, D.ruby);
  const missing = new Set();
  allTexts(D).concat(uiTexts()).forEach((s) => rubyCoverage(s, dict).forEach((k) => missing.add(k + '(' + s.slice(0, 18) + ')')));
  assert.deepStrictEqual([...missing], []);
});
test('ルビ: 図の中の文字はかなで書く(SVG にはルビが付かないため)', () => {
  const bad = [];
  D.tools.forEach((t) => t.steps.forEach((s) => s.fig.forEach((p) => {
    const tx = p[1] && p[1].t;
    if (tx && /[㐀-鿿々]/.test(tx)) bad.push(t.id + ': ' + tx);
  })));
  assert.deepStrictEqual(bad, []);
});
