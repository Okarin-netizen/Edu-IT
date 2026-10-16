// node --test teacher-viewer/summary.test.js
const test = require('node:test');
const assert = require('node:assert');
require('./summary.js');
const TV = globalThis.TV;
const art = (app, data, extra) => Object.assign({ schema: 'gijutsu-artifact/1', id: app + '-1', app, title: 't', updatedAt: '2026-10-01T00:00:00Z', data }, extra || {});

test('まとめファイルは組・番号・名前で名前を付ける', () => {
  const r = TV.parseFile('a.json', JSON.stringify({ schema: 'gijutsu-bundle/1', student: { class: '2', no: '5', name: '南 花子' }, artifacts: [art('kidori', {})] }));
  assert.strictEqual(r.label, '2組5番 南 花子');
  assert.strictEqual(r.artifacts.length, 1);
});
test('1つずつ書き出したファイルの組・番号・名前も使う', () => {
  const r = TV.parseFile('wood-lab.json', JSON.stringify(art('wood-lab', {}, { student: { class: '1', no: '3', name: '北 一郎' } })));
  assert.strictEqual(r.label, '1組3番 北 一郎');
});
test('名前がないときは M4 の名前、なければファイル名', () => {
  assert.strictEqual(TV.parseFile('x.json', JSON.stringify(art('drawing-trainer', { name: '太郎' }))).label, '太郎');
  const r = TV.parseFile('dir/山田.json', JSON.stringify([art('kidori', {})]));
  assert.strictEqual(r.label, '山田'); assert.ok(r.fromFile);
});
test('読めないファイルはエラーにする', () => {
  assert.ok(TV.parseFile('b.json', '{').error);
  assert.ok(TV.parseFile('c.json', '{"a":1}').error);
});
test('同じ生徒のファイルはまとめ、同じ id は新しいほうを残す', () => {
  const s = { class: '1', no: '2', name: 'A' };
  const f1 = TV.parseFile('1.json', JSON.stringify({ schema: 'gijutsu-bundle/1', student: s, artifacts: [art('kidori', { v: 1 }, { updatedAt: '2026-10-01' })] }));
  const f2 = TV.parseFile('2.json', JSON.stringify({ schema: 'gijutsu-bundle/1', student: s, artifacts: [art('kidori', { v: 2 }, { updatedAt: '2026-10-05' })] }));
  const g = TV.group([f1, f2]);
  assert.strictEqual(g.length, 1);
  assert.strictEqual(g[0].artifacts.length, 1);
  assert.strictEqual(g[0].artifacts[0].data.v, 2);
});
test('組・番号の順に並ぶ(全角数字も)', () => {
  const mk = (c, n, nm) => TV.parseFile(nm + '.json', JSON.stringify({ schema: 'gijutsu-bundle/1', student: { class: c, no: n, name: nm }, artifacts: [art('kidori', {})] }));
  const g = TV.group([mk('2', '1', 'C'), mk('1', '１０', 'B'), mk('1', '2', 'A')]);
  assert.deepStrictEqual(g.map(s => s.student.name), ['A', 'B', 'C']);
});
test('アプリごとの要約とふりかえりの有無', () => {
  assert.ok(TV.summarize(art('material-navi', { chosenName: 'スギ', chosenReason: '軽い' })).reflected);
  assert.ok(!TV.summarize(art('material-navi', { chosenName: 'スギ', chosenReason: ' ' })).reflected);
  assert.ok(TV.summarize(art('wood-lab', { notes: { nt2: '木表を外に' }, quizLog: [] })).reflected);
  assert.ok(TV.summarize(art('structure-lab', { challenge: { reflect: '三角形' } })).reflected);
  assert.ok(TV.summarize(art('drawing-trainer', { reflect: { learned: 'わかった' } })).reflected);
  assert.ok(TV.summarize(art('kidori', { review: { improve: '次は' } })).reflected);
  const m6 = TV.summarize(art('tool-safety', { type: 'self', toolName: 'のこぎり', scores: { posture: 'A' }, comment: '線を見る' }, { kind: 'rubric' }));
  assert.ok(m6.reflected);
  assert.ok(m6.fields.some(f => f[1].indexOf('姿勢 A') >= 0));
  const q = TV.summarize(art('wood-lab', { notes: {}, quizLog: [{ correct: true }, { correct: false }] }));
  assert.deepStrictEqual(q.fields[0], ['反りの予測', '1 / 2 回 正解']);
});

test('M7 立体メーカー: 大きさ・図面・自己評価・ふりかえり', () => {
  const s = TV.summarize(art('solid-maker', { size: { W: 6, D: 4, H: 5, cell: 10 }, done: { pdf: 1, stl: 2 }, reflect: { self: { match: '3' }, learned: 'そろう' } }));
  assert.ok(s.reflected);
  assert.ok(s.fields.some((f) => f[0] === '三面図の大きさ' && f[1].includes('6×4×5')));
  assert.ok(s.fields.some((f) => f[0] === 'STL' && f[1] === '2 回'));
});
