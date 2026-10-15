// 第2段（つまずきを減らす）のテスト: 時間の表し方、ヒント、課題の区分、✓ の条件、書き出しの中身
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const { formatSeconds } = await import("../js/auto.js");
const { store } = await import("../js/store.js");
const { tierCount, tierSummary } = await import("../js/tasks.js");
const { exportData, missingStudent, progressText } = await import("../js/records.js");
const { normalizeSource } = await import("../js/vm.js");
const { tasks } = JSON.parse(readFileSync(new URL("../data/tasks.json", import.meta.url), "utf8"));

test("CPU-06: 時間は指数表記（2.0e+2）にならない", () => {
  assert.equal(formatSeconds(200e-6), "約200マイクロ秒（100万分の1秒が1マイクロ秒）");
  assert.equal(formatSeconds(270e-9), "約270ナノ秒（10億分の1秒が1ナノ秒）");
  assert.equal(formatSeconds(0.2), "約200ミリ秒（1000分の1秒が1ミリ秒）");
  assert.equal(formatSeconds(4.5e-6), "約4.5マイクロ秒（100万分の1秒が1マイクロ秒）");
  for (let e = -10; e < 9; e += 0.37) assert.doesNotMatch(formatSeconds(10 ** e), /e[+-]/i, `10^${e}`);
});

// 答えの例の行のうち、はじめのプログラムにない行（??? を埋めた行）
const fills = (t) => {
  const lines = (src) => normalizeSource(src).split("\n").map((l) => l.replace(/;.*/, "").replace(/^\s*[\p{L}_][\p{L}\p{N}_]*\s*:/u, "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const start = new Set(lines(t.starter));
  return lines(t.answer).filter((l) => !start.has(l));
};

test("CPU-03: 最後のヒントは答えそのものではない（??? を埋めた行を書いていない）。どのヒントも全部の答えは書いていない", () => {
  for (const t of tasks) {
    const f = fills(t);
    assert.ok(f.length > 0, t.id);
    const last = t.hints[t.hints.length - 1].replace(/\s+/g, " ");
    // ??? を埋める課題では、最後のヒントに埋めた行をそのまま書かない（チャレンジは全部を書かない、だけを見る）
    if (t.tier !== "challenge") for (const line of f) assert.ok(!last.includes(line), `${t.id}: 最後のヒントに「${line}」`);
    for (const hint of t.hints) assert.ok(!f.every((line) => hint.replace(/\s+/g, " ").includes(line)), `${t.id}: ${hint}`);
  }
});

test("CPU-03: 課題1〜4 必修、5〜7 発展、8 チャレンジ", () => {
  assert.deepEqual(tasks.map((t) => t.tier), ["must", "must", "must", "must", "adv", "adv", "adv", "challenge"]);
  store.reset();
  assert.deepEqual(tierCount(tasks, "must"), { done: 0, total: 4 });
  store.clear("show");
  store.clear("sum10");
  assert.equal(tierSummary(tasks), "必修 1/4・発展 1/3・チャレンジ 0/1");
});

test("CPU-03/19: 答えの例を開いたことが記録され、書き出しに各課題のプログラムが入る", () => {
  store.reset();
  store.setDraft("add", "IN\nSTORE a\nIN\nADD a\nOUT\nHALT\na: DATA 0");
  store.markAnswerViewed("add");
  const first = store.answerViewed("add");
  store.markAnswerViewed("add"); // 2回目は時刻を変えない
  assert.equal(store.answerViewed("add"), first);
  store.clear("add");
  const data = exportData(tasks);
  assert.equal(data.tasks.length, 8);
  const add = data.tasks.find((t) => t.id === "add");
  assert.equal(add.tier, "必修");
  assert.ok(add.cleared && add.answerViewed && add.edited);
  assert.match(add.program, /ADD a/);
  const show = data.tasks.find((t) => t.id === "show");
  assert.equal(show.edited, false);
  assert.equal(show.program, tasks[0].starter);
  assert.equal(show.answerViewed, null);
  assert.ok(data.answerViewed.add);
  assert.match(progressText("tasks", tasks), /答えの例を見た: 1問/);
  // 保存された中身にも入っている（pagehide などで丸ごと書いても消えない）
  const saved = JSON.parse(localStorage.getItem("vcpu.v1"));
  assert.ok(saved.answerViewed.add);
});

test("CPU-19: ✓ は開いただけではつかない", () => {
  store.reset();
  store.markVisited("diagram");
  store.markVisited("auto");
  assert.equal(store.isDone("diagram"), false);
  assert.equal(progressText("diagram", tasks), "開いた（とちゅう）");
  store.markDone("diagram", { score: 8, total: 10 });
  assert.equal(progressText("diagram", tasks), "✓ やった");
  assert.equal(store.state.done.diagram.score, 8);
  assert.equal(progressText("auto", tasks), "開いた（とちゅう）");
});

test("記録: 組と番号が空なら書き出さない", () => {
  assert.equal(missingStudent({ cls: "", num: "3", name: "" }), true);
  assert.equal(missingStudent({ cls: "2-1", num: " ", name: "a" }), true);
  assert.equal(missingStudent({ cls: "2-1", num: "3", name: "" }), false);
});

test("CPU-18: 仮想CPUページのサンプル番号と入力の数を保存する（古い記録でも読める）", () => {
  store.reset();
  assert.equal(store.state.sim, null);
  store.setSimMeta({ sample: 1, inputs: [4, 7, 1, 0] });
  store.setSimMeta({ inputs: [4, 7] });
  assert.deepEqual(JSON.parse(localStorage.getItem("vcpu.v1")).sim, { sample: 1, inputs: [4, 7] });
});
