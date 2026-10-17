// ハッシュ関数の模型と、教材のデータの点検。実行: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const HL = require("../js/hash.js");
const D = require("../js/data.js");
const real = (s) => createHash("sha256").update(s, "utf8").digest("hex");

test("SHA-256: 決まった値(テストベクトル)と同じになる", () => {
  assert.equal(HL.sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(HL.sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("SHA-256: 日本語・絵文字・長い文も node の計算と同じ", () => {
  const list = [...D.presets, D.original, ...D.copies.map((c) => c.text || ""), "😀", "a".repeat(55), "a".repeat(56), "a".repeat(64), "あ".repeat(500)];
  for (const s of list) assert.equal(HL.sha256(s), real(s), JSON.stringify(s.slice(0, 20)));
});

test("手作りハッシュ: 順番を入れかえると衝突する。値は00〜99", () => {
  assert.equal(HL.toyHash("あい"), HL.toyHash("いあ"));
  assert.match(HL.toyHash("ねこ"), /^\d\d$/);
  assert.notEqual(HL.toyHash(D.toyStart[0]), HL.toyHash(D.toyStart[1]), "はじめの例は衝突していない");
});

test("1文字だけちがうかの判定", () => {
  assert.ok(HL.oneCharApart(D.pairStart[0], D.pairStart[1]));
  assert.ok(HL.oneCharApart("abc", "abcd"));
  assert.ok(HL.oneCharApart("abc", "ac"));
  assert.ok(!HL.oneCharApart("abc", "abc"));
  assert.ok(!HL.oneCharApart("abc", "cba"));
});

test("会員表: 同じパスワードは sora と mei だけ。辞書で4人見つかり、ソルトでは0人", () => {
  const dict = new Set(D.dictionary.map(HL.sha256));
  const plain = D.users.map((u) => HL.sha256(u.password));
  assert.equal(new Set(plain).size, D.users.length - 1);
  assert.equal(plain.filter((x) => dict.has(x)).length, 4);
  const salted = D.users.map((u) => HL.sha256(u.salt + u.password));
  assert.equal(new Set(salted).size, D.users.length);
  assert.equal(salted.filter((x) => dict.has(x)).length, 0);
});

test("配布ファイル: A だけが本物", () => {
  const off = HL.sha256(D.original);
  assert.deepEqual(D.copies.map((c) => HL.sha256(c.text == null ? D.original : c.text) === off), [true, false, false]);
});

test("総当たりの時間の表示", () => {
  assert.equal(HL.duration(1000 / D.triesPerSec), "1秒より短い(一瞬)");
  assert.equal(HL.duration(26 ** 8 / D.triesPerSec), "約20.9秒");
  assert.equal(HL.duration(62 ** 8 / D.triesPerSec), "約6.1時間");
  assert.equal(HL.bigNumber(10000), "1万");
});

test("クイズ: 正解の番号が選択肢の中にあり、位置がばらばら", () => {
  for (const q of D.quiz) assert.ok(q.c >= 0 && q.c < q.a.length && q.why);
  assert.ok(new Set(D.quiz.map((q) => q.c)).size >= 3);
  assert.deepEqual(D.reflQ.map((r) => r.id), ["r1", "r2", "r3"]);
});
test("クイズ: いちばん長い選択肢を選べば正解、にならない(正解だけがいちばん長い問題は4割以下)", () => {
  const len = (s) => [...s].length;
  const hits = D.quiz.filter((q) => q.a.every((t, i) => i === q.c || len(q.a[q.c]) > len(t)));
  assert.ok(hits.length / D.quiz.length <= 0.4, `正解だけがいちばん長い問題 ${hits.length}/${D.quiz.length}`);
});
