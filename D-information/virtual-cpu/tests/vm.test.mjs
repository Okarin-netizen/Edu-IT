// 仮想CPUの命令と、課題データのテスト（node --test）
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assemble, createMachine, runToEnd, stepPhase, stepInstruction, checkProgram, wordText } from "../js/vm.js";

const isa = JSON.parse(readFileSync(new URL("../data/isa.json", import.meta.url)));
const { tasks } = JSON.parse(readFileSync(new URL("../data/tasks.json", import.meta.url)));
const run = (src, inputs = []) => {
  const p = assemble(src, isa);
  assert.deepEqual(p.errors, []);
  return runToEnd(createMachine(p, { inputs, maxSteps: isa.maxSteps }));
};

test("LOAD #n / OUT / HALT", () => {
  const m = run("LOAD #7\nOUT\nHALT");
  assert.equal(m.status, "halted");
  assert.deepEqual(m.outputs, [7]);
  assert.equal(m.steps, 3);
});

test("LOAD 番地 と STORE", () => {
  const m = run("LOAD x\nSTORE y\nLOAD y\nOUT\nHALT\nx: DATA 42\ny: DATA 0");
  assert.deepEqual(m.outputs, [42]);
  assert.equal(m.mem[6], 42);
});

test("ADD / SUB（番地と #数、マイナスも）", () => {
  assert.deepEqual(run("LOAD #3\nADD #4\nOUT\nSUB a\nOUT\nHALT\na: DATA 10").outputs, [7, -3]);
});

test("JUMP は PC を書きかえる", () => {
  assert.deepEqual(run("JUMP skip\nLOAD #1\nskip: OUT\nHALT").outputs, [0]);
});

test("JZ は ACC が 0 のときだけとぶ", () => {
  assert.deepEqual(run("LOAD #0\nJZ a\nOUT\na: LOAD #1\nJZ b\nOUT\nb: HALT").outputs, [1]);
});

test("JN は ACC がマイナスのときだけとぶ", () => {
  assert.deepEqual(run("LOAD #-1\nJN a\nOUT\na: LOAD #0\nJN b\nOUT\nb: HALT").outputs, [0]);
});

test("IN は入力を順に読み、なくなったらエラー", () => {
  assert.deepEqual(run("IN\nOUT\nIN\nOUT\nHALT", [4, 9]).outputs, [4, 9]);
  const m = run("IN\nIN\nHALT", [1]);
  assert.equal(m.status, "error");
  assert.match(m.error, /入力する数がもうありません/);
});

test("1命令は 取り出し→解読→実行 の3段階", () => {
  const p = assemble("LOAD #2\nHALT", isa);
  const m = createMachine(p);
  const evs = stepInstruction(m);
  assert.deepEqual(evs.map((e) => e.phase), ["fetch", "decode", "execute"]);
  assert.equal(evs[0].read, 0);
  assert.equal(m.pc, 1);
  assert.equal(m.acc, 2);
  assert.equal(wordText(m.ir), "LOAD #2");
});

test("無限ループは自動で止まる", () => {
  const p = assemble("loop: JUMP loop", isa);
  const m = runToEnd(createMachine(p, { maxSteps: 500 }));
  assert.equal(m.status, "limit");
  assert.equal(m.steps, 500);
});

test("HALT を忘れて数を実行しようとするとエラー", () => {
  const m = run("LOAD #1\nOUT");
  assert.equal(m.status, "error");
  assert.match(m.error, /HALT/);
});

test("全角で書いても読める", () => {
  assert.deepEqual(run("ＬＯＡＤ　＃５　；メモ\nｏｕｔ\nＨＡＬＴ").outputs, [5]);
});

test("書きまちがいは行番号つきで知らせる", () => {
  const p = assemble("LODE 3\nADD\nSTORE #4\nJUMP nowhere\nIN 5\n???\nOUT\nOUT", isa);
  assert.equal(p.ok, false);
  assert.deepEqual(p.errors.map((e) => e.line), [1, 2, 3, 4, 5, 6]);
});

test("32番地をこえるとエラー", () => {
  const p = assemble(Array(33).fill("OUT").join("\n"), isa);
  assert.equal(p.ok, false);
  assert.match(p.errors[0].message, /32 個/);
});

test("命令表の命令はすべて実行できる", () => {
  for (const { op, operand } of isa.instructions) {
    const line = operand === "none" ? op : `${op} z`;
    const p = assemble(`${line}\nHALT\nz: DATA 1`, isa);
    assert.deepEqual(p.errors, [], op);
    const m = createMachine(p, { inputs: [1] });
    stepInstruction(m);
    assert.notEqual(m.status, "error", op);
  }
});

for (const t of tasks) {
  test(`課題「${t.title}」: 答えの例は正解、はじめのプログラムは不正解`, () => {
    assert.equal(checkProgram(t.answer, t, isa).ok, true);
    assert.equal(checkProgram(t.starter, t, isa).ok, false);
    assert.ok(t.hints.length >= 1);
  });
}

test("sum10 は答えを直接書くだけでは合格にならない", () => {
  const t = tasks.find((x) => x.id === "sum10");
  const r = checkProgram("LOAD #55\nOUT\nHALT", t, isa);
  assert.equal(r.ok, false);
  assert.equal(r.results[0].tooFew, true);
});

test("stepPhase の説明文", () => {
  const m = createMachine(assemble("IN\nHALT", isa), { inputs: [6] });
  const msgs = [stepPhase(m), stepPhase(m), stepPhase(m)].map((e) => e.message);
  assert.match(msgs[0], /0番地から命令「IN」/);
  assert.match(msgs[2], /数 6/);
});

// ---- CPU-01: 判定のすきま（最大値さがし・チャレンジ） ----
const maxTask = tasks.find((x) => x.id === "max");
const maxSource = (jn, st) => maxTask.starter.replace("JN ???", `JN ${jn}`).replace("STORE ???", `STORE ${st}`);
// 決まった乱数（毎回同じ入力でためす）
const rng = (seed) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const randomMaxInputs = (count) => {
  const r = rng(7);
  return Array.from({ length: count }, () => [...Array.from({ length: 1 + Math.floor(r() * 6) }, () => 1 + Math.floor(r() * 20)), 0]);
};

test("最大値さがし: 小さい数で終わる「JN end」「JN 8」は合格にならない", () => {
  for (const jn of ["end", "8"]) for (const st of ["max", "12"]) assert.equal(checkProgram(maxSource(jn, st), maxTask, isa).ok, false, `JN ${jn} / STORE ${st}`);
  assert.deepEqual(run(maxSource("end", "max"), [3, 1, 8, 0]).outputs, [3]);
});

test("最大値さがし: 答えの例と正しい別解（JN loop・JN 0・JN 7、STORE 12）は合格", () => {
  for (const jn of ["loop", "0", "7"]) for (const st of ["max", "12"]) assert.equal(checkProgram(maxSource(jn, st), maxTask, isa).ok, true, `JN ${jn} / STORE ${st}`);
  assert.equal(checkProgram(maxTask.answer, maxTask, isa).ok, true);
});

test("最大値さがし: ??? の埋め方を総当たりして、合格するものはどんな入力でも正しい", () => {
  const cands = ["loop", "end", "x", "max", ...Array.from({ length: 21 }, (_, i) => String(i))];
  const inputsList = randomMaxInputs(200);
  let passed = 0;
  for (const jn of cands) {
    for (const st of cands) {
      const src = maxSource(jn, st);
      if (!checkProgram(src, maxTask, isa).ok) continue;
      passed += 1;
      const p = assemble(src, isa);
      for (const inputs of inputsList) {
        const m = runToEnd(createMachine(p, { inputs, maxSteps: isa.maxSteps }));
        assert.deepEqual(m.outputs, [Math.max(...inputs)], `JN ${jn} / STORE ${st} / 入力 ${inputs}`);
      }
    }
  }
  assert.ok(passed >= 6, `合格した数 ${passed}`);
});

test("チャレンジ: くり返しを使わず2個だけ処理するプログラムは合格にならない", () => {
  const free = tasks.find((x) => x.id === "free");
  const noLoop = "IN\nSTORE x\nADD x\nOUT\nIN\nJZ end\nSTORE x\nADD x\nOUT\nend: HALT\nx: DATA 0";
  assert.equal(checkProgram(noLoop, free, isa).ok, false);
  assert.deepEqual(run(noLoop, [1, 2, 3, 0]).outputs, [2, 4]);
  assert.equal(checkProgram(free.answer, free, isa).ok, true);
});

// ---- CPU-04: エラー文が正しい直し方を教える ----
const errOf = (src) => assemble(src, isa).errors.map((e) => e.message).join("\n");

test("とび先のラベルがないときは「行の先頭に end: をつけよう」と言う（DATA をすすめない）", () => {
  const msg = errOf("loop: IN\nJZ end\nOUT\nJUMP loop\nHALT");
  assert.match(msg, /「end」という名前の行がありません。とびたい行の先頭に「end:」をつけよう/);
  assert.doesNotMatch(msg, /DATA/);
});

test("LOAD・ADD などの箱がないときは「HALT のあとに x: DATA 0」と言う", () => {
  assert.match(errOf("LOAD x\nOUT\nHALT"), /「x」という箱がありません。HALT のあとに「x: DATA 0」を書いて用意しよう/);
});

test("大文字・小文字だけちがう名前は「a のことかな？」と言う", () => {
  const msg = errOf("IN\nSTORE a\nIN\nADD A\nOUT\nHALT\na: DATA 0");
  assert.match(msg, /「A」という名前はありません。「a」のことかな？/);
  assert.doesNotMatch(msg, /A: DATA 0/);
});

test("DATA を先頭に書いたとき・空のときの止まり方の説明", () => {
  const top = run("x: DATA 0\nLOAD #1\nOUT\nHALT");
  assert.equal(top.status, "error");
  assert.match(top.error, /DATA の行は、HALT のあと（いちばん下）に書こう/);
  const empty = run("; ここにプログラムを書こう\n");
  assert.equal(empty.status, "error");
  assert.match(empty.error, /まだ命令がありません/);
  const toData = run("loop: IN\nJZ end\nOUT\nJUMP loop\nx: DATA 0\nend: DATA 0", [0]);
  assert.match(toData.error, /とび先の 5番地には命令ではなく数/);
});

test("# を忘れて命令の番地を読んだときは # の話をする", () => {
  const m = run("LOAD #3\nSUB 1\nOUT\nHALT");
  assert.equal(m.status, "error");
  assert.match(m.error, /「#1」のように # をつけよう/);
  const show = tasks.find((x) => x.id === "show");
  const r = checkProgram("LOAD 12\nOUT\nHALT", show, isa);
  assert.equal(r.ok, false);
  assert.match(r.notes.map((n) => n.message).join(), /「LOAD #12」のように # をつけよう/);
  assert.deepEqual(checkProgram(show.answer, show, isa).notes, []);
});

test("「LOAD # 5」「LOAD#5」もそのまま読める", () => {
  assert.deepEqual(run("LOAD # 5\nOUT\nHALT").outputs, [5]);
  assert.deepEqual(run("LOAD#5\nADD#-2\nOUT\nHALT").outputs, [3]);
  assert.deepEqual(run("ｌｏａｄ＃　７\nOUT\nHALT").outputs, [7]);
});

test("小数は「小数は使えません。整数にしよう」", () => {
  assert.match(errOf("HALT\nx: DATA 2.5"), /小数は使えません。整数にしよう/);
  assert.match(errOf("LOAD #1.5\nHALT"), /小数は使えません。整数にしよう/);
});

// ---- CPU-14: 最大値さがしの説明 ----
test("最大値さがしの説明は「x の値を max にしまう」（逆に読めない）", () => {
  assert.doesNotMatch(maxTask.story + maxTask.starter, /max を x に入れかえ/);
  assert.match(maxTask.starter, /STORE \?\?\?\s+; x の値を max にしまう/);
});
