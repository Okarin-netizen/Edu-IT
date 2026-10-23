// 選択クイズで「いちばん長い選択肢を選べば正解」にならないかの点検。実行: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const json = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url)));
// ルビ {漢字|かんじ} と HTML タグは、画面に出る文字だけを数える
const len = (s) => [...s.replace(/\{([^{}|]*)\|[^{}]*\}/g, "$1").replace(/<[^>]+>/g, "")].length;
const correctIsLongest = (choices, answer) => choices.every((c, i) => i === answer || len(choices[answer]) > len(c));
function assertRatio(name, items) {
  const hits = items.filter((q) => correctIsLongest(q.choices, q.answer));
  assert.ok(items.length > 0, `${name}: 問題がない`);
  assert.ok(hits.length / items.length <= 0.4, `${name}: 正解だけがいちばん長い問題が ${hits.length}/${items.length}`);
}

test("理解度チェック(quiz.json): 正解だけがいちばん長い問題は4割以下", () => {
  assertRatio("quiz.json", json("data/quiz.json").questions);
});

test("フィッシングの「どうする？」: 正解だけがいちばん長い問題は4割以下", () => {
  assertRatio("phishing.json", json("data/phishing.json").scenarios.map((s) => s.action));
});

test("モジュールの中の選択クイズ: 正解だけがいちばん長い問題は4割以下", () => {
  const dir = new URL("../modules/", import.meta.url);
  const items = [];
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), "utf8");
    for (const m of src.matchAll(/choices:\s*(\[[^\]]*\]),\s*answer:\s*(\d+)/g)) items.push({ choices: JSON.parse(m[1]), answer: Number(m[2]) });
  }
  assert.ok(items.length >= 6, `選択クイズ ${items.length} 問`);
  assertRatio("modules", items);
});
