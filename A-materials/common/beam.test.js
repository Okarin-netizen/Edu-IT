// beam.js の単体テスト。実行: node --test beam.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const Beam = require('./beam.js');

const close = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= Math.abs(b) * rel + 1e-12, `${a} ≠ ${b}`);

test('長方形断面 I = b·h³/12(手計算: 200×15 → 56250 mm⁴)', () => {
  const s = Beam.section({ shape: 'rect', b: 200, t: 15 });
  assert.equal(s.ok, true);
  close(s.I, 56250);
  close(s.A, 3000);
  close(s.c, 7.5);
});

test('両端支持・中央集中荷重の手計算と一致', () => {
  // スギ E=7.5GPa=7500 N/mm², 200×15 の板, L=600, 10kg
  // P = 98.0665 N
  // δ = P L³ / (48 E I) = 98.0665×600³ / (48×7500×56250) = 1.04604 mm
  // M = P L / 4 = 14709.975 N·mm, σ = M·c/I = 14709.975×7.5/56250 = 1.96133 MPa
  const r = Beam.analyze({ material: 'sugi', section: { shape: 'rect', b: 200, t: 15 }, span: 600, loadKg: 10 });
  assert.equal(r.ok, true);
  close(r.P, 98.0665);
  close(r.deflection, 98.0665 * 600 ** 3 / (48 * 7500 * 56250));
  close(r.deflection, 1.046043, 1e-6);
  close(r.moment, 14709.975);
  close(r.stress, 1.961330, 1e-6);
  close(r.safety, 65 / r.stress);
  assert.equal(r.level.id, 'ok');
  close(r.mass, 200 * 15 * 600 * 0.38 / 1e6); // 0.684 kg
});

test('教科書的な例: 厚みを2倍にするとたわみは1/8', () => {
  const a = Beam.analyze({ material: 'hinoki', section: { b: 100, t: 10 }, span: 500, load: 100 });
  const b = Beam.analyze({ material: 'hinoki', section: { b: 100, t: 20 }, span: 500, load: 100 });
  close(a.deflection / b.deflection, 8);
  close(a.stress / b.stress, 4);
});

test('幅を2倍にするとたわみは1/2', () => {
  const a = Beam.analyze({ material: 'sugi', section: { b: 100, t: 12 }, span: 500, load: 100 });
  const b = Beam.analyze({ material: 'sugi', section: { b: 200, t: 12 }, span: 500, load: 100 });
  close(a.deflection / b.deflection, 2);
});

test('片持ち・等分布の公式', () => {
  const E = 9000, I = 100 * 10 ** 3 / 12, P = 50, L = 300;
  close(Beam.deflection(P, L, E, I, 'cantilever', 'point'), P * L ** 3 / (3 * E * I));
  close(Beam.deflection(P, L, E, I, 'cantilever', 'uniform'), P * L ** 3 / (8 * E * I));
  close(Beam.deflection(P, L, E, I, 'simple', 'uniform'), 5 * P * L ** 3 / (384 * E * I));
  close(Beam.maxMoment(P, L, 'cantilever', 'point'), P * L);
  close(Beam.maxMoment(P, L, 'cantilever', 'uniform'), P * L / 2);
  close(Beam.maxMoment(P, L, 'simple', 'uniform'), P * L / 8);
});

test('たわみ曲線 shape は端で0、最大点で1', () => {
  for (const [sup, lt, at] of [['simple', 'point', 0.5], ['simple', 'uniform', 0.5], ['cantilever', 'point', 1], ['cantilever', 'uniform', 1]]) {
    close(Beam.shape(at * 100, 100, sup, lt), 1);
    close(Beam.shape(0, 100, sup, lt), 0);
  }
  close(Beam.shape(100, 100, 'simple', 'point'), 0);
});

test('箱形断面: 外形 − 内側 と一致', () => {
  const s = Beam.section({ shape: 'box', b: 40, h: 60, t: 5 });
  close(s.I, (40 * 60 ** 3 - 30 * 50 ** 3) / 12);
  close(s.c, 30);
});

test('コの字断面: 図心と I を手計算と比較', () => {
  // 上板 60×5(y 25〜30)、脚 5×25 ×2(y 0〜25)
  const s = Beam.section({ shape: 'channel', b: 60, h: 30, t: 5 });
  const A = 300 + 2 * 125;
  const yc = (300 * 27.5 + 2 * 125 * 12.5) / A;
  const I = 60 * 125 / 12 + 300 * (27.5 - yc) ** 2 + 2 * (5 * 25 ** 3 / 12 + 125 * (12.5 - yc) ** 2);
  close(s.A, A); close(s.yc, yc); close(s.I, I); close(s.c, Math.max(yc, 30 - yc));
});

test('L形断面: 対称でないので図心は中央からずれる', () => {
  const s = Beam.section({ shape: 'L', b: 30, h: 30, t: 3 });
  assert.equal(s.ok, true);
  assert.ok(s.yc > 15);
});

test('リブを付けると同じ板よりたわみが小さい', () => {
  const plate = Beam.analyze({ material: 'sugi', section: { shape: 'rect', b: 200, t: 9 }, span: 800, loadKg: 10 });
  const rib = Beam.analyze({ material: 'sugi', section: { shape: 'ribbed', b: 200, t: 9, ribs: 2, ribW: 15, ribH: 30 }, span: 800, loadKg: 10 });
  assert.ok(rib.deflection < plate.deflection / 5);
  const zero = Beam.section({ shape: 'ribbed', b: 200, t: 9, ribs: 0 });
  close(zero.I, Beam.section({ b: 200, t: 9 }).I);
});

test('極端な入力でも例外を投げず ok:false を返す', () => {
  const bad = [
    { section: { b: 200, t: 0 } }, { section: { b: 0, t: 10 } }, { section: { b: 200, t: -3 } },
    { section: { b: NaN, t: 10 } }, { section: { b: 200, t: Infinity } }, { section: { b: '200', t: 10 } },
    { span: 0 }, { span: -10 }, { load: -5 }, { load: NaN }, { material: 'unknown' },
    { section: { shape: 'box', b: 10, h: 10, t: 5 } }, { section: { shape: 'channel', b: 10, h: 2, t: 5 } },
    { section: { shape: 'L', b: 3, h: 30, t: 3 } }, { section: { shape: 'ribbed', b: 50, t: 9, ribs: 5, ribW: 15, ribH: 20 } },
    { section: { shape: 'hexagon', b: 10, t: 2 } }, { section: null }
  ];
  for (const o of bad) {
    const opts = Object.assign({ material: 'sugi', section: { b: 200, t: 15 }, span: 600, load: 100 }, o);
    let r;
    assert.doesNotThrow(() => { r = Beam.analyze(opts); }, JSON.stringify(o));
    assert.equal(r.ok, false, JSON.stringify(o));
    assert.equal(typeof r.error, 'string');
  }
  assert.doesNotThrow(() => Beam.analyze());
  assert.equal(Beam.analyze().ok, false);
});

test('荷重0はたわみ0・安全率は無限大', () => {
  const r = Beam.analyze({ material: 'sugi', section: { b: 200, t: 15 }, span: 600, load: 0 });
  assert.equal(r.ok, true);
  assert.equal(r.deflection, 0);
  assert.equal(r.safety, Infinity);
  assert.equal(r.level.id, 'ok');
});

test('とても薄い板では「公式の範囲外」の警告と「こわれる」判定', () => {
  const r = Beam.analyze({ material: 'sugi', section: { b: 100, t: 0.5 }, span: 1000, loadKg: 20 });
  assert.equal(r.ok, true);
  assert.ok(r.warnings.length >= 2);
  assert.equal(r.level.id, 'break');
});

test('材料オブジェクトを直接渡せる(M5 の材質テーブル用)', () => {
  const r = Beam.analyze({ material: { E: 7000, strength: 65, density: 0.38 }, section: { b: 200, t: 15 }, span: 600, loadKg: 10 });
  close(r.deflection, 1.120760, 1e-6);
});

test('kg と N の変換', () => {
  close(Beam.kgToN(1), 9.80665);
  close(Beam.nToKg(Beam.kgToN(3.2)), 3.2);
});
