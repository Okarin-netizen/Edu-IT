// 第3段の直し（2026-10-13 中学生目線レビュー）の回帰テスト: npm test
// DL-09 ビットカード / DL-10 ちがう行 / DL-14 ドリルの種類ごとの最高点 / DL-18 表記
import { test } from "node:test";
import assert from "node:assert/strict";

const L = await import("../js/digilib.js");
const seeded = (seed = 11) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

test("DL-09 ビットカードのお題は小さい数から順に出る", () => {
  const rand = seeded();
  for (let i = 0; i < 200; i++) {
    const t = L.pickCardTargets(rand);
    assert.equal(t.length, 4);
    assert.ok(t[0] < 10, "最初は1けた");
    for (let k = 1; k < t.length; k++) assert.ok(t[k] > t[k - 1], `やさしい順: ${t}`);
    t.forEach((v, k) => assert.ok(L.CARD_TARGET_TIERS[k].includes(v)));
  }
});

test("DL-09 カードの点は数を正しく表す", () => {
  assert.equal(L.cardDots(1), "●");
  assert.equal(L.cardDots(8), "●●●●●●●●");
  assert.equal(L.cardDots(16), "●×16");
  assert.equal(L.cardDots(128), "●×128");
});

test("DL-10 お題とちがう行を示す", () => {
  const target = ["00000000", "01100110", "11111111"];
  assert.deepEqual(L.wrongRows(target, target), []);
  const now = ["00000000", "01100111", "11111110"];
  assert.deepEqual(L.wrongRows(target, now), [1, 2]);
  assert.equal(L.wrongRowsMessage([2, 4]), "3行目と5行目がちがいます。お題と今の絵の0と1を、1行ずつ見くらべよう。");
  assert.equal(L.wrongRowsMessage([]), "");
  assert.equal(L.wrongRowsMessage([0, 1, 2, 3, 4]), "5つの行（1行目、2行目、3行目 など）がちがいます。お題と今の絵の0と1を、1行ずつ見くらべよう。");
});

test("DL-18 割り切れる小数には「約」を付けない", () => {
  const bits = L.imageBits(64, 64, 3); // 1,536バイト ＝ 1.5KB
  assert.equal(L.unitSteps(bits).at(-1), "÷ 1024 ＝ 1.5 KB");
  assert.equal(L.formatBits(bits), "1.5KB");
  assert.equal(L.inUnit(L.imageBits(1920, 1080, 24), "MB"), "約5.93MB");
  assert.equal(L.inUnit(1024 * 8 * 3, "KB"), "3KB");
});

test("DL-18 べき乗は上付きの数字で書く", () => {
  assert.equal(L.pow2Text(4), "2⁴");
  assert.equal(L.pow2Text(16), "2¹⁶");
  const rand = seeded(3);
  for (let i = 0; i < 2000; i++) {
    const p = L.makeDrill("levels", rand);
    assert.ok(!p.explain.includes("^"), p.explain);
  }
});

test("DL-18 「2通り」の問題に「0ビット」を出さない", () => {
  const rand = seeded(5);
  let seen = 0;
  for (let i = 0; i < 4000; i++) {
    const p = L.makeDrill("levels", rand);
    assert.ok(!p.choices.includes("0ビット"), p.question);
    assert.ok(!/(^|[^0-9])0ビット/.test(p.explain), p.explain);
    assert.equal(new Set(p.choices).size, p.choices.length);
    if (p.question.startsWith("2通り")) {
      seen++;
      assert.equal(p.choices[p.answer], "1ビット");
      assert.ok(p.choices.length >= 3);
    }
  }
  assert.ok(seen > 0);
});

test("DL-14 ドリルの最高点は種類ごとに残る", () => {
  let b = {};
  b = L.updateDrillBests(b, "levels", 10, 10, "t1");
  b = L.updateDrillBests(b, "mix", 6, 10, "t2");
  b = L.updateDrillBests(b, "mix", 5, 10, "t3"); // 下がったときは残さない
  b = L.updateDrillBests(b, "mix", 8, 10, "t4");
  assert.deepEqual(b.mix, { correct: 8, total: 10, at: "t4" });
  assert.equal(b.levels.correct, 10);
  assert.equal(L.drillBestText({ bests: b }), "いろいろ 8 / 10問、ビット数と表せる数 10 / 10問");
  assert.equal(L.drillBestText({ bests: b }, true), "いろいろ 8/10・ビット数と表せる数 10/10");
  // 前の版の記録
  assert.equal(L.drillBestText({ best: { correct: 9, total: 10 } }), "9 / 10問（種類の記録なし）");
  assert.equal(L.drillBestText({}), "");
});

test("ドリル: 正解が大きさの順でいつも同じ位置にならない（いちばん小さい・真ん中などで当てられない）", () => {
  const rand = seeded(17);
  const val = (s) => Number(s.replace(/[約,]/g, "").match(/[\d.]+/)[0]);
  const ranks = {};
  for (const kind of ["unit", "levels", "image", "audio", "video"]) {
    for (let i = 0; i < 6000; i++) {
      const p = L.makeDrill(kind, rand);
      const sub = `${kind}:${p.question.replace(/[\d,.]+/g, "#").slice(0, 12)}`;
      const vs = p.choices.map(val);
      const r = vs.filter((v) => v < vs[p.answer]).length;
      (ranks[sub] ??= [0, 0, 0, 0])[r]++;
    }
  }
  for (const [sub, c] of Object.entries(ranks)) {
    const t = c.reduce((a, b) => a + b);
    // 「何ビット必要？」は 2通り・4通りで小さいまちがいが作れないので、少しだけゆるめる
    const max = sub.includes("区別") ? 0.42 : 0.32;
    for (const x of c) {
      assert.ok(x / t <= max && x / t >= 0.15, `${sub}: 正解の順位がかたよっている ${c}`);
    }
  }
});

test("ステップの確かめ: pickAround で正解が真ん中に固定されない", () => {
  const rand = seeded(23);
  const counts = [0, 0, 0];
  for (let i = 0; i < 6000; i++) {
    const w = L.pickAround([1, 2], [100, 1000], rand);
    assert.equal(w.length, 2);
    assert.equal(new Set(w).size, 2);
    counts[w.filter((v) => v < 10).length]++;
  }
  for (const c of counts) assert.ok(c / 6000 > 0.28 && c / 6000 < 0.39, `${counts}`);
});
