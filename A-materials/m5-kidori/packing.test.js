// 木取り計算のテスト。実行: node --test packing.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('./packing.js');

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

test('重なり判定は切りしろを含む', () => {
  const a = { board: 0, x: 0, y: 0, dx: 100, dy: 50 };
  assert.equal(K.conflict(a, { board: 0, x: 101, y: 0, dx: 10, dy: 10 }, 1.5), true);
  assert.equal(K.conflict(a, { board: 0, x: 101.5, y: 0, dx: 10, dy: 10 }, 1.5), false);
  assert.equal(K.conflict(a, { board: 1, x: 50, y: 0, dx: 10, dy: 10 }, 1.5), false);
});

test('自動配置(ギロチン法)の結果は、ランダム100ケースで重ならず、はみ出さない', () => {
  const r = rng(42);
  for (let c = 0; c < 100; c++) {
    const stock = { l: 300 + Math.floor(r() * 1700), w: 100 + Math.floor(r() * 500), count: 1 };
    const kerf = [0, 1, 1.5, 2, 3][Math.floor(r() * 5)];
    const n = 1 + Math.floor(r() * 12);
    const parts = [];
    for (let i = 0; i < n; i++) {
      parts.push({ id: 'p' + i, name: 'p' + i, l: 20 + Math.floor(r() * stock.l * 0.7), w: 10 + Math.floor(r() * stock.w * 0.9), qty: 1 + Math.floor(r() * 3), grain: r() < 0.5 });
    }
    const inst = K.expand(parts);
    const res = K.guillotine(inst, stock, kerf, 20);
    const ck = K.check(inst, res.placements, { ...stock, count: 20 }, kerf);
    assert.equal(ck.ok, true, `case ${c}: ${JSON.stringify(ck.bad)}`);
    // 木目の向きを守る
    for (const i of inst) if (res.placements[i.iid] && i.grain) assert.equal(res.placements[i.iid].rot, 0);
    // 入らなかった部品は、本当に1枚の板に入らない大きさのものだけ
    for (const id of res.unplaced) {
      const i = inst.find(x => x.iid === id);
      assert.equal(K.fitsStock(i, stock), false, `case ${c}: ${id} は入るはず`);
    }
  }
});

test('空きをさがして置く(findSpot)を続けても、ランダム100ケースで重ならない', () => {
  const r = rng(7);
  for (let c = 0; c < 100; c++) {
    const stock = { l: 400 + Math.floor(r() * 1500), w: 120 + Math.floor(r() * 300), count: 1 + Math.floor(r() * 3) };
    const kerf = 1.5;
    const parts = [];
    for (let i = 0; i < 8; i++) parts.push({ id: 'p' + i, name: 'p' + i, l: 30 + Math.floor(r() * 400), w: 20 + Math.floor(r() * 150), qty: 1 + Math.floor(r() * 2), grain: r() < 0.3 });
    const inst = K.expand(parts);
    const pl = {};
    for (const i of inst) { const s = K.findSpot(i, pl, inst, stock, kerf); if (s) pl[i.iid] = s; }
    const ck = K.check(inst, pl, stock, kerf);
    assert.equal(ck.ok, true, `case ${c}: ${JSON.stringify(ck.bad)}`);
  }
});

test('歩留まりの計算(手計算: 1820×180 に 600×180 を1枚 → 600/1820)', () => {
  const stock = { l: 1820, w: 180, count: 1 };
  const inst = K.expand([{ id: 'a', name: 'a', l: 600, w: 180, qty: 1 }]);
  const s = K.stats(inst, { 'a#1': { board: 0, x: 0, y: 0, rot: 0 } }, stock, 1.5);
  assert.ok(Math.abs(s.yield - 600 / 1820) < 1e-12);
  assert.equal(s.perBoard[0].restL, 1820 - 600 - 1.5);
});

test('はみ出し・木目の向きの違反を見つける', () => {
  const stock = { l: 500, w: 100, count: 1 };
  const inst = K.expand([{ id: 'a', name: 'a', l: 200, w: 80, qty: 1, grain: true }]);
  const ck = K.check(inst, { 'a#1': { board: 0, x: 350, y: 0, rot: 0 } }, stock, 1.5);
  assert.deepEqual(ck.bad['a#1'], ['はみ出し']);
  const ck2 = K.check(inst, { 'a#1': { board: 0, x: 0, y: 0, rot: 1 } }, stock, 1.5);
  assert.ok(ck2.bad['a#1'].includes('木目'));
});

test('おかしな入力(0・負数・空)でも止まらない', () => {
  const inst = K.expand([{ id: 'a', l: 0, w: -5, qty: -2 }, { id: 'b', l: 100, w: 50, qty: 'x' }, { id: 'c', l: 100, w: 50, qty: 1e9 }]);
  assert.equal(inst.length, 99);
  const res = K.guillotine(inst, { l: 0, w: 0, count: 1 }, 1.5, 3);
  assert.equal(res.unplaced.length, 99);
  K.stats(inst, res.placements, { l: 0, w: 0, count: 1 }, 1.5);
});
