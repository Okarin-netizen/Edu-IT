// frame.js と challenge.js のテスト。実行: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const Frame = require('./frame.js');
const Challenge = require('./challenge.js');

test('補強なしの枠は押すと変形し、柱の長さは変わらない', () => {
  const d = Frame.deform('none', 40, 200, 200);
  assert.ok(d.shift > 0);
  assert.ok(Math.abs(Frame.dist(d.nodes.bl, d.nodes.tl) - 200) < 1e-9);
  assert.ok(Math.abs(Frame.dist(d.nodes.br, d.nodes.tr) - 200) < 1e-9);
});

test('筋かい・面材の枠は押しても形が変わらない(三角形の拘束)', () => {
  for (const m of ['brace', 'cross', 'panel']) {
    const d = Frame.deform(m, 80, 200, 200);
    assert.equal(d.shift, 0, m);
    assert.deepEqual(d.nodes.tr, [200, 200]);
  }
  assert.equal(Frame.deform('brace', 30, 200, 200).brace, 'tension');
  assert.equal(Frame.deform('brace', -30, 200, 200).brace, 'compression');
});

test('すみ板は少しだけ変形する', () => {
  const a = Frame.deform('none', 50, 200, 200).shift, b = Frame.deform('corner', 50, 200, 200).shift;
  assert.ok(b > 0 && b < a / 3);
});

test('極端な押し量・不正値でも破綻しない', () => {
  for (const p of [1e9, -1e9, NaN, Infinity]) {
    const d = Frame.deform('none', p, 200, 200);
    assert.ok(Number.isFinite(d.nodes.tl[1]) && d.nodes.tl[1] > 0);
  }
  assert.doesNotThrow(() => Frame.deform('unknown', 10, 100, 100));
});

test('どのレベルにもクリアできる組み合わせがある', () => {
  for (const lv of Challenge.LEVELS) {
    const b = Challenge.best(lv);
    assert.ok(b, lv.id);
    assert.equal(Challenge.stars(lv, Challenge.evaluate(lv, b)), 3);
  }
});

test('レベル1: スギ15mmは合格、スギ6mmは不合格', () => {
  const lv = Challenge.level('lv1');
  assert.equal(Challenge.evaluate(lv, { material: 'sugi', t: 15, ribs: 0 }).pass, true);
  assert.equal(Challenge.evaluate(lv, { material: 'sugi', t: 6, ribs: 0 }).pass, false);
  assert.equal(Challenge.stars(lv, Challenge.evaluate(lv, { material: 'sugi', t: 6, ribs: 0 })), 0);
});

test('課題の入力が不正でも例外を投げない', () => {
  const lv = Challenge.level('lv1');
  assert.equal(Challenge.evaluate(lv, { material: 'sugi', t: 0, ribs: 0 }).ok, false);
  assert.equal(Challenge.evaluate(lv, { material: 'nope', t: 9, ribs: 9 }).ok, false);
});
