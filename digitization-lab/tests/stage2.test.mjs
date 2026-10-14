// 第2段の直し（2026-10-13 中学生目線レビュー）の回帰テスト: npm test
// DL-03 動画は発展・解き方は答えの単位まで / DL-05 聞きくらべの図と説明 / DL-15 書き出しの前の確認 / DL-16 目安時間
import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const L = await import("../js/digilib.js");
const { missingFields, fileName, EXPORT_MESSAGES } = await import("../js/records.js");
const { store } = await import("../js/store.js");
const { SOUNDS, splitByRate, listenMessage } = await import("../modules/sound.js");
const { CATALOG } = await import("../js/catalog.js");

const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// ---------- DL-03 ----------
test("DL-03 「いろいろ」には動画の問題が出ない（動画は「動画」を選んだときだけ）", () => {
  const rand = seeded();
  const kinds = new Set();
  for (let i = 0; i < 2000; i++) kinds.add(L.makeDrill("mix", rand).kind);
  assert.ok(!kinds.has("video"));
  assert.deepEqual([...kinds].sort(), ["audio", "image", "levels", "unit"]);
  assert.equal(L.makeDrill("video", rand).kind, "video");
  assert.ok(L.DRILL_KINDS.find((d) => d.id === "video").advanced);
});

test("DL-03 解き方は、答えの単位（GB も）まで割り算を続ける", () => {
  // 1,280 × 720 × 24 × 60 × 60 ＝ 79,626,240,000ビット → 約9.27GB
  const bits = L.videoBits(1280, 720, 24, 60, 60);
  const steps = L.unitSteps(bits);
  assert.equal(steps.at(-1), "÷ 1024 ＝ 約9.27 GB");
  assert.equal(L.inUnit(bits, "GB"), "約9.27GB");
  const rand = seeded(3);
  for (let i = 0; i < 600; i++) {
    const p = L.makeDrill(["video", "image", "audio"][i % 3], rand);
    const unit = p.choices[0].match(/(バイト|KB|MB|GB)$/)[1];
    const last = p.explain.split("　").at(-1);
    assert.ok(last.endsWith(` ${unit}`), `解き方が答えの単位で終わる: ${p.choices[0]} / ${last}`);
    assert.equal(last.replace(/^÷ (8|1024) ＝ /, "").replace(" ", ""), p.choices[0], "解き方の最後の値が正解と同じ");
  }
});

// ---------- DL-05 ----------
test("DL-05 記録できない設定では、音が出ない理由を説明する", () => {
  const bell = SOUNDS.bell.make();
  const melody = SOUNDS.melody.make();
  const b2000 = splitByRate(bell, 2000);
  assert.equal(b2000.kept.length, 0);
  const m = listenMessage(SOUNDS.bell.label, 2000, 16, b2000);
  assert.equal(m.silent, true);
  assert.match(m.lines[0], /1,000Hz より低い音だけ/);
  assert.match(m.lines[0], /何も聞こえません/);
  assert.equal(splitByRate(melody, 1000).kept.length, 0, "メロディ×1,000Hz も無音");
  assert.equal(listenMessage(SOUNDS.melody.label, 1000, 16, splitByRate(melody, 1000)).silent, true);
  // こもる設定（一部だけ記録できる）と、すべて記録できる設定
  const m8000 = listenMessage(SOUNDS.melody.label, 8000, 8, splitByRate(melody, 8000));
  assert.equal(m8000.silent, false);
  assert.match(m8000.lines[0], /こもって/);
  const cd = listenMessage(SOUNDS.melody.label, 44100, 16, splitByRate(melody, 44100));
  assert.match(cd.lines[0], /すべて記録できます/);
  assert.equal(cd.lines.length, 1);
  assert.match(listenMessage(SOUNDS.melody.label, 44100, 3, splitByRate(melody, 44100)).lines[1], /ザラザラ/);
});

// ---------- DL-15 ----------
test("DL-15 組か番号が空なら書き出さない（同じ言い方で知らせる）", () => {
  assert.deepEqual(missingFields({ cls: "", num: "", name: "" }), ["cls", "num"]);
  assert.deepEqual(missingFields({ cls: "2年1組", num: " ", name: "" }), ["num"]);
  assert.deepEqual(missingFields({ cls: "2年1組", num: "15" }), []);
  assert.equal(EXPORT_MESSAGES.missing, "組と番号を入れてから書き出そう");
  store.setStudent({ cls: "2年1組", num: "15", name: "" });
  const name = fileName("json");
  assert.equal(name, "デジタル化ラボ_2年1組_15.json");
  assert.equal(EXPORT_MESSAGES.saved(name), "ファイルを保存しました（ファイル名: デジタル化ラボ_2年1組_15.json）。先生に言われた場所に出そう。");
});

// ---------- DL-16 ----------
test("DL-16 目安時間: 2進数 20〜25分、ドリル 15〜20分", () => {
  const min = Object.fromEntries(CATALOG.map((c) => [c.id, c.module.minutes]));
  assert.equal(min.binary, "20〜25分");
  assert.equal(min.drill, "15〜20分");
});
