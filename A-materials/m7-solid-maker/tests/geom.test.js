// 実行(A-materials で): node --test m7-solid-maker/tests/geom.test.js
const test = require('node:test');
const assert = require('node:assert');
const G = require('../geom.js');
const S = require('../sheet.js');
global.self = global;
require('../samples.js');
const SAMPLES = global.SolidSamples;

const fill = (U, V) => Array.from({ length: V }, () => '#'.repeat(U));
const build = (o) => G.build(G.modelFromRows(o));
// STL にする三角形が、すき間なく閉じているか(どの辺も、逆向きの辺がもう1つある)
function closed(solid) {
  const k = (p) => p.map((v) => Math.round(v * 1e4)).join(',');
  const E = new Map();
  for (const t of G.triangles(solid, 1)) for (let i = 0; i < 3; i++) {
    const e = k(t.v[i]) + '>' + k(t.v[(i + 1) % 3]);
    E.set(e, (E.get(e) || 0) + 1);
  }
  for (const e of E.keys()) { const [a, b] = e.split('>'); if (!E.has(b + '>' + a)) return false; }
  return true;
}

test('立方体1つ: 体積 1、12 本の辺、正面図は四角', () => {
  const s = build({ W: 1, D: 1, H: 1, front: ['#'], top: ['#'], side: ['#'] });
  assert.strictEqual(Math.round(s.volume * 1000) / 1000, 1);
  assert.strictEqual(s.lines.length, 12);
  const f = G.lineDrawing(s, 'front');
  assert.strictEqual(f.visible.length, 4);
  assert.strictEqual(f.hidden.length, 0);
  // 等角図では、見えない3本がかくれ線
  assert.strictEqual(G.lineDrawing(s, 'iso').hidden.length, 3);
});

test('お手本はすべて、3つの図が合っていて、閉じた立体になる', () => {
  for (const s of SAMPLES) {
    const m = G.modelFromRows(s);
    const solid = G.build(m);
    assert.ok(!solid.empty, s.id);
    assert.strictEqual(G.mismatches(m).count, 0, s.id + ' の合わないマス');
    assert.ok(closed(solid), s.id + ' の STL にすき間');
  }
});

test('体積: L字 18、くさび 13.5、屋根 12', () => {
  const v = (id) => Math.round(G.build(G.modelFromRows(SAMPLES.find((s) => s.id === id))).volume * 100) / 100;
  assert.strictEqual(v('l'), 18);
  assert.strictEqual(v('wedge'), 13.5);
  assert.strictEqual(v('roof'), 12);
});

test('ななめの面: くさびの正面図にななめの線、右側面図はななめの線なし', () => {
  const s = G.build(G.modelFromRows({ W: 2, D: 1, H: 2, front: ['a.', '#a'], top: ['##'], side: ['#', '#'] }));
  const f = G.lineDrawing(s, 'front').visible;
  assert.ok(f.some((q) => Math.abs(q[2] - q[0]) > 0.5 && Math.abs(q[3] - q[1]) > 0.5), 'ななめの線がある');
  const r = G.lineDrawing(s, 'right').visible;
  assert.ok(r.every((q) => Math.abs(q[2] - q[0]) < 1e-6 || Math.abs(q[3] - q[1]) < 1e-6), '右側面図はたて・横の線だけ');
});

test('穴のあいた板: 正面図に穴のかくれ線が2本', () => {
  const s = G.build(G.modelFromRows(SAMPLES.find((x) => x.id === 'hole')));
  const h = G.lineDrawing(s, 'front').hidden;
  assert.strictEqual(h.length, 2);
  assert.ok(h.every((q) => Math.abs(q[0] - q[2]) < 1e-6), 'たてのかくれ線');
});

test('合わないマスを見つける', () => {
  const m = G.modelFromRows({ W: 3, D: 2, H: 2, front: ['#..', '###'], top: ['..#', '###'], side: ['##', '##'] });
  const r = G.mismatches(m);
  assert.strictEqual(r.count, 1);
  assert.deepStrictEqual(r.side, [1 * 2 + 1]); // 右側面図の 上の段・おくの列
});

test('どれかの図が空なら立体にならない', () => {
  const s = build({ W: 2, D: 2, H: 2, front: fill(2, 2), top: ['..', '..'], side: fill(2, 2) });
  assert.ok(s.empty);
});

test('大きさを変えても、重なるマスは残る', () => {
  const m = G.modelFromRows({ W: 2, D: 1, H: 1, front: ['#a'], top: ['##'], side: ['#'] });
  const r = G.resizeModel(m, 3, 2, 1);
  assert.deepStrictEqual(G.modelToRows(r).front, ['#a.']);
  assert.deepStrictEqual(G.modelToRows(r).top, ['...', '##.']);
});

test('STL: 三角形の数と大きさ(mm)', () => {
  const s = build({ W: 1, D: 1, H: 1, front: ['#'], top: ['#'], side: ['#'] });
  const buf = G.stlBinary(s, 10, 'cube');
  const dv = new DataView(buf);
  const n = dv.getUint32(80, true);
  assert.strictEqual(buf.byteLength, 84 + 50 * n);
  let max = 0;
  for (let i = 0; i < n; i++) for (let j = 3; j < 12; j++) max = Math.max(max, dv.getFloat32(84 + i * 50 + j * 4, true));
  assert.strictEqual(Math.round(max), 10);
});

test('図面: 尺度を自動で選び、寸法・表題欄・第三角法を入れる', () => {
  const s = G.build(G.modelFromRows(SAMPLES.find((x) => x.id === 'bracket')));
  const r = S.svg(s, { cell: 10, title: 'ブラケット', name: '山田', grade: '2', cls: '3', no: '15', date: '2026.10.15' });
  assert.strictEqual(r.scale, 1);
  assert.ok(r.svg.includes('第三角法') && r.svg.includes('ブラケット') && r.svg.includes('2年3組15番'));
  assert.ok(r.svg.includes('>60<') && r.svg.includes('>50<') && r.svg.includes('>40<'), '幅・高さ・奥行きの寸法');
  const big = S.svg(s, { cell: 100 });
  assert.ok(big.scale < 1, '大きいものは縮小する');
  assert.strictEqual(S.scaleLabel(0.2), '1:5');
  assert.ok(S.svg(null, {}).svg.includes('まだ立体'));
});

test('PDF: 表の位置(xref)が正しい', () => {
  const pdf = S.buildPDF({ data: new Uint8Array([1, 2, 3]), width: 1, height: 1, filter: 'FlateDecode', color: 'DeviceGray' }, '図面');
  const txt = Buffer.from(pdf).toString('latin1');
  assert.ok(txt.startsWith('%PDF-1.4'));
  const start = +txt.match(/startxref\n(\d+)/)[1];
  assert.ok(txt.slice(start).startsWith('xref'));
  const offs = txt.slice(start).split('\n').slice(3, 9).map((l) => +l.slice(0, 10));
  offs.forEach((o, i) => assert.ok(txt.slice(o).startsWith((i + 1) + ' 0 obj'), 'obj ' + (i + 1)));
});
