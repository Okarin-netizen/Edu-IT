// 第1段の直し（2026-10-13 中学生目線レビュー）の回帰テスト: npm test
// DL-01 文字コードの表 / DL-02 全角の答え / DL-06 ふりかえりの自動保存
import { test } from "node:test";
import assert from "node:assert/strict";

// この端末の保存（localStorage）のかわり。ページの読みこみ直しも、同じ入れ物を使って確かめる
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const L = await import("../js/digilib.js");
const { store } = await import("../js/store.js");
const ui = await import("../js/ui.js");
const { buildExport } = await import("../js/records.js");
const { CATALOG } = await import("../js/catalog.js");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- DL-01 ----------
test("DL-01 文字コードの表: 番号（10進数）を2進数にすると、となりの0と1になる", () => {
  const a = L.charCodeRow("あ");
  assert.deepEqual(a.numbers, [227, 129, 130]);
  assert.deepEqual(a.bits, ["11100011", "10000001", "10000010"]);
  assert.equal(a.bytes, 3);
  assert.deepEqual(L.charCodeRow("A"), { ch: "A", numbers: [65], bits: ["01000001"], bytes: 1 });
  assert.equal(L.charCodeRow("Ａ").bytes, 3); // 全角の英字は3バイト（説明文と同じ）
  assert.equal(L.charCodeRow("情").bytes, 3);
  for (const ch of [..."Hi! あ情報ＡＢＣ１２３ｶﾞ"]) {
    const r = L.charCodeRow(ch);
    r.numbers.forEach((n, i) => {
      assert.ok(n >= 0 && n <= 255, `${ch}: 番号は1バイト（0〜255）`);
      assert.equal(L.toBinary(n, 8), r.bits[i], `${ch}: 番号 ${n} → ${r.bits[i]}`);
      assert.equal(L.fromBinary(r.bits[i]), n);
    });
    assert.equal(r.bytes, r.numbers.length);
  }
});

// ---------- DL-02 ----------
test("DL-02 全角で入れた正しい答えも正解になる", () => {
  assert.deepEqual(L.parseNumberAnswer("３１"), { ok: true, value: 31 });
  assert.deepEqual(L.parseNumberAnswer(" 31 "), { ok: true, value: 31 });
  assert.deepEqual(L.parseNumberAnswer("１，０２４"), { ok: true, value: 1024 });
  assert.deepEqual(L.parseNumberAnswer("12KB", ["KB", "MB"]), { ok: true, value: 12 });
  assert.deepEqual(L.parseBinaryAnswer("０００１１１１１"), { ok: true, value: "00011111" });
  assert.deepEqual(L.parseBinaryAnswer("0001 1111"), { ok: true, value: "00011111" });
  assert.deepEqual(L.parseWordAnswer("ＰＣ"), { ok: true, value: "PC" });
  assert.deepEqual(L.parseWordAnswer("pc"), { ok: true, value: "PC" });
  assert.deepEqual(L.parseCountList("８，２，６"), { ok: true, values: [8, 2, 6] });
  assert.deepEqual(L.parseCountList("8、2、6"), { ok: true, values: [8, 2, 6] });
  assert.deepEqual(L.parseCountList("8個 2個 6個"), { ok: true, values: [8, 2, 6] });
});

test("DL-02 空欄や数字でない答えには、入れ方を伝える（NaN などは出さない）", () => {
  const bad = [
    L.parseNumberAnswer(""),
    L.parseNumberAnswer("　"),
    L.parseNumberAnswer("さんじゅういち"),
    L.parseBinaryAnswer(""),
    L.parseBinaryAnswer("102"),
    L.parseWordAnswer(""),
    L.parseWordAnswer("ぴーしー"),
    L.parseCountList(""),
    L.parseCountList("8,a,6"),
  ];
  for (const r of bad) {
    assert.equal(r.ok, false);
    assert.ok(Object.values(L.INPUT_MESSAGES).includes(r.message));
    assert.doesNotMatch(r.message, /NaN|undefined/);
  }
  assert.equal(L.parseNumberAnswer("").message, "答えを入れてから押そう");
  assert.equal(L.parseNumberAnswer("abc").message, "半角の数字で入れよう");
});

// ---------- DL-06 ----------
test("DL-06 ふりかえりは、入力が止まると自動で保存され、書き出しにも入る", async () => {
  store.reset();
  let text = "画素が多いと、記録する数が増えるから";
  let doneCalls = 0;
  const statuses = [];
  const auto = ui.reflectionAutosaver("image", () => text, () => doneCalls++, (m) => statuses.push(m), 30);
  auto.schedule();
  assert.equal(store.getReflection("image"), "", "すぐには保存しない（入力のとちゅう）");
  await wait(80);
  assert.equal(store.getReflection("image"), text);
  assert.equal(doneCalls, 1, "5文字以上なら、保存ボタンと同じく「できた」になる");
  assert.deepEqual(statuses, ["保存しました"]);
  assert.equal(buildExport(CATALOG).modules.find((m) => m.id === "image").reflection, text);
  // 端末に残っている（読みこみ直したことにして確かめる）
  const saved = JSON.parse(mem.get("digilab.v1"));
  assert.equal(saved.reflections.image.text, text);
  text = "";
  auto.schedule();
  await wait(80);
  assert.equal(store.getReflection("image"), "", "全部消したら、消えた状態で保存される");
});

test("DL-06 保存を押さずにページを移っても、書きかけの文は消えない", () => {
  store.reset();
  let calls = 0;
  const auto = ui.reflectionAutosaver("sound", () => "標本化の回数がふえると", () => calls++, null, 10000);
  auto.schedule();
  ui.flushReflections(); // ページを移るとき（route）・ページを閉じるとき（pagehide）に呼ばれる
  assert.equal(store.getReflection("sound"), "標本化の回数がふえると");
  assert.equal(calls, 1);
  // 短い文も下書きとして残す（「できた」にはならない）
  const short = ui.reflectionAutosaver("binary", () => "0と1", () => calls++, null, 10000);
  short.schedule();
  ui.flushReflections();
  assert.equal(store.getReflection("binary"), "0と1");
  assert.equal(calls, 1);
});

test("DL-06 保存ボタンと自動保存は同じ決まり（5文字以上で「できた」）", () => {
  store.reset();
  let calls = 0;
  assert.deepEqual(ui.saveReflectionText("compress", "  短い ", () => calls++), { text: "短い", done: false });
  assert.equal(calls, 0);
  assert.deepEqual(ui.saveReflectionText("compress", "同じ色が続くと縮む", () => calls++), { text: "同じ色が続くと縮む", done: true });
  assert.equal(calls, 1);
  assert.equal(store.getReflection("compress"), "同じ色が続くと縮む");
});
