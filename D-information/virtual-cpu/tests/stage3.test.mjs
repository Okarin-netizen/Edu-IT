// 第3段（仕上げ）のテスト: 答え合わせの表の短い表示、入力の読み方、仲間分けの理由、手計算くらべの時間、日本語入力の知らせ
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const { assemble, checkProgram, numText, shortList } = await import("../js/vm.js");
const { readInputs, parseInputs } = await import("../js/sim.js");
const { DEVICES, wrongReasons } = await import("../js/diagram.js");
const { CLOCKS, runSeconds, randomManualN, sumTo, recordN, N_MIN, N_MAX } = await import("../js/auto.js");
const isa = JSON.parse(readFileSync(new URL("../data/isa.json", import.meta.url)));
const { tasks } = JSON.parse(readFileSync(new URL("../data/tasks.json", import.meta.url)));

test("CPU-08: 出力が多いときは最初の10個と「…ほか ○個」。Infinity はことばで出す", () => {
  assert.equal(shortList([]), "（なし）");
  assert.equal(shortList([1, 2, 3]), "1, 2, 3");
  const long = Array.from({ length: 2000 }, (_, i) => i);
  assert.equal(shortList(long), "0, 1, 2, 3, 4, 5, 6, 7, 8, 9 …ほか 1,990 個");
  assert.equal(numText(Infinity), "大きすぎて表せない数");
  assert.equal(numText(-5), "-5");
  // 課題4を SUB #2 にすると終わらない。表に出す文字は短い
  const countdown = tasks.find((t) => t.id === "countdown");
  const bad = countdown.answer.replace(/SUB\s+#1/, "SUB #2");
  const r = checkProgram(bad, countdown, isa);
  const lim = r.results.find((x) => x.status === "limit");
  assert.ok(lim, "終わらない入力がある");
  assert.ok(shortList(lim.outputs).length < 120);
});

test("CPU-11: −（数学のマイナス）・ー（長音）もマイナス。1.5・abc は読めないものとして返す", () => {
  assert.deepEqual(readInputs("−4, ー4, －4, ３, 1.5, abc"), { values: [-4, -4, -4, 3], dropped: ["1.5", "abc"] });
  assert.deepEqual(parseInputs("3、5，0"), [3, 5, 0]);
  assert.deepEqual(readInputs(""), { values: [], dropped: [] });
  assert.deepEqual(readInputs("+7 -2"), { values: [7, -2], dropped: [] });
});

test("CPU-16: × の機器には理由が1行ずつ出る。名前に答えが入っていない", () => {
  const picks = DEVICES.map((d) => d.answer);
  assert.deepEqual(wrongReasons(picks), []);
  picks[DEVICES.findIndex((d) => d.name === "プリンタ")] = "in";
  assert.deepEqual(wrongReasons(picks), ["プリンタ: 紙に印刷して、人に伝える → 出力装置"]);
  assert.deepEqual(wrongReasons(DEVICES.map(() => "")), [], "えらんでいない機器は × にしない");
  for (const d of DEVICES) {
    assert.ok(d.why, d.name);
    assert.doesNotMatch(d.name, /記憶装置|入力|出力|撮像/, d.name);
  }
});

test("CPU-17: 昔のパソコンは 4 MHz・1命令に4クロックとして計算する", () => {
  const old = CLOCKS.find((c) => c.label.includes("1980"));
  assert.match(old.note, /4 MHz/);
  assert.match(old.note, /合図（クロック）/);
  assert.equal(runSeconds(1e6, old), 1);
  const now = CLOCKS.find((c) => c.label.includes("いま"));
  assert.match(now.note, /3 GHz/);
});

test("CPU-20: ひらがなの命令は「英数モード」を知らせる。日本語のラベルとコメントはこれまでどおり使える", () => {
  const p = assemble("ぉあd #1\nHALT", isa);
  assert.match(p.errors[0].message, /英数モード/);
  const q = assemble("LODE #1\nHALT", isa);
  assert.doesNotMatch(q.errors[0].message, /英数モード/);
  const ok = assemble("ループ: IN   ; にゅうりょく\n JZ おわり\n OUT\n JUMP ループ\nおわり: HALT", isa);
  assert.deepEqual(ok.errors, []);
});

test("手計算くらべ: N はスタートのたびに 15〜25 から選ばれ、答え合わせはその N の合計（いつも 210 ではない）", async () => {
  const { createMachine, runToEnd } = await import("../js/vm.js");
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const counts = {};
  let prev = null;
  const N = 11000;
  for (let i = 0; i < N; i++) {
    const n = randomManualN(rand, prev);
    assert.ok(Number.isInteger(n) && n >= N_MIN && n <= N_MAX);
    assert.notEqual(n, prev, "やり直すと N が変わる");
    counts[n] = (counts[n] || 0) + 1;
    prev = n;
  }
  assert.equal(Object.keys(counts).length, 11);
  for (const c of Object.values(counts)) assert.ok(c / N > 0.07 && c / N < 0.11, JSON.stringify(counts));
  // 答え合わせの値は、仮想CPUのプログラムの答えと同じ
  const prog = assemble(tasks.find((t) => t.id === "sumN").answer, isa);
  for (let n = N_MIN; n <= N_MAX; n++) assert.equal(runToEnd(createMachine(prog, { inputs: [n], maxSteps: 1e6 })).outputs[0], sumTo(n));
  assert.equal(sumTo(20), 210);
  // 前の版の記録（n なし）は 20 として読む
  assert.equal(recordN({ seconds: 30 }), 20);
  assert.equal(recordN({ seconds: 30, n: 17 }), 17);
  const src = readFileSync(new URL("../js/auto.js", import.meta.url), "utf8");
  assert.ok(!src.includes("N_MANUAL"));
  assert.ok(src.includes("sumTo(nManual)"));
});
