// 実行: node --test tests/unit.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseProgram, programToText, compile, parseExpr, evalExpr, exprToText, numberFieldText } from "../js/lang.js";
import { attachAutosave, flushAutosaves, AUTOSAVE_HINT } from "../js/autosave.js";
import { Sim, runAllTests, valueAt } from "../js/sim.js";
import { MODELS } from "../js/models.js";

const data = JSON.parse(readFileSync(new URL("../data/scenarios.json", import.meta.url), "utf8"));

test("式の計算と優先順位", () => {
  const get = (n) => ({ 明るさ: 20, x: 3 })[n];
  assert.equal(evalExpr(parseExpr("1 + 2 * 3"), get), 7);
  assert.equal(evalExpr(parseExpr("(1 + 2) * 3"), get), 9);
  assert.equal(evalExpr(parseExpr("明るさ < 30 かつ x == 3"), get), 1);
  assert.equal(evalExpr(parseExpr("明るさ<30かつx=4"), get), 0, "空白なし・条件の = も読める");
  assert.equal(evalExpr(parseExpr("明るさ ＜ ３０"), get), 1, "全角でも読める");
  assert.equal(evalExpr(parseExpr("-x + 10"), get), 7);
  assert.equal(exprToText(parseExpr("(1 + 2) * 3")), "(1 + 2) * 3");
  assert.equal(exprToText(parseExpr("10 - (3 - 2)")), "10 - (3 - 2)");
});

test("テキスト → 木 → テキスト がもとにもどる", () => {
  for (const s of data.scenarios) {
    for (const src of [s.starter, s.model_answer].filter(Boolean)) {
      const { program, errors } = parseProgram(src);
      assert.deepEqual(errors, [], `${s.id}: ${errors.map((e) => e.message)}`);
      const again = programToText(program);
      assert.equal(programToText(parseProgram(again).program), again);
    }
  }
});

test("書きまちがいを行番号つきで知らせる", () => {
  const r = parseProgram("ずっと\n  もし 明るさ < 30\n    街灯 = オン\n");
  assert.ok(r.errors.length >= 1);
  assert.equal(r.errors[0].line, 2);
  const v = compile("明るさ = 3\nずっと\n  街灯 = くらい\nおわり", MODELS.streetlight.device);
  assert.equal(v.errors.length, 2);
  assert.match(v.errors[0].message, /センサ/);
  assert.match(v.errors[1].message, /くらい/);
});

test("時系列の補間", () => {
  assert.equal(valueAt([[0, 0], [10, 100]], 5), 50);
  assert.equal(valueAt([[0, 0], [10, 100]], 5, "step"), 0);
  assert.equal(valueAt([[0, 0], [10, 100]], 20), 100);
});

test("止まらないくり返しでも固まらない", () => {
  const { program } = parseProgram("x = 0\nずっと\n  x = x + 1\nおわり");
  const sim = new Sim(MODELS.sandbox, program);
  for (let i = 0; i < 20; i++) sim.tick();
  assert.equal(sim.t.toFixed(1), "2.0");
  const { program: p2 } = parseProgram("x = 0\n5 回くり返す\n  x = x + 1\nおわり");
  const s2 = new Sim(MODELS.sandbox, p2);
  s2.tick();
  assert.equal(s2.vars.x, 5);
});

test("ステップ実行で1文ずつ進む", () => {
  const { program } = parseProgram("LED = オン\n1 秒待つ\nLED = オフ");
  const sim = new Sim(MODELS.sandbox, program);
  sim.step();
  assert.equal(sim.currentId, program[0].id);
  assert.equal(sim.outputs.LED, 0);
  sim.step();
  assert.equal(sim.outputs.LED, 1);
  assert.equal(sim.currentId, program[1].id);
  sim.step();
  assert.equal(sim.currentId, program[2].id);
  assert.ok(sim.t >= 1, "待っている間に時間が進む");
});

test("0で割るとエラーになり、止まる", () => {
  const { program } = parseProgram("x = 1 / 0");
  const sim = new Sim(MODELS.sandbox, program);
  sim.tick();
  assert.ok(sim.error);
  assert.match(sim.error.message, /0 で割る/);
});

for (const s of data.scenarios) {
  const model = MODELS[s.model];
  test(`場面「${s.title}」のデータが正しい`, () => {
    assert.ok(model, `モデル ${s.model}`);
    const st = compile(s.starter, model.device);
    assert.deepEqual(st.errors.map((e) => e.message), []);
    for (const t of s.tests) {
      for (const k of Object.keys(t.timeline || {})) assert.ok(model.env.some((e) => e.name === k), `${t.id}: ${k}`);
    }
  });
  if (!s.tests.length) continue;
  test(`場面「${s.title}」: 模範プログラムは全テストに合格する`, () => {
    const c = compile(s.model_answer, model.device);
    assert.deepEqual(c.errors.map((e) => e.message), []);
    for (const r of runAllTests(model, c.program, s.tests)) {
      assert.ok(r.pass, `${r.test.name}: ${r.failures.map((f) => f.msg).join(" / ")}`);
    }
  });
  test(`場面「${s.title}」: はじめのプログラムは不合格がある（直す余地がある）`, () => {
    const c = compile(s.starter, model.device);
    const results = runAllTests(model, c.program, s.tests);
    assert.ok(results.some((r) => !r.pass));
  });
}

test("自動ドア: 開き始めが遅いとぶつかる", () => {
  const s = data.scenarios.find((x) => x.id === "door");
  const c = compile("ずっと\n  もし 距離 < 80 なら\n    ドア = 開く\n  でなければ\n    ドア = 閉じる\n  おわり\nおわり", MODELS.door.device);
  const r = runAllTests(MODELS.door, c.program, s.tests).find((x) => x.test.id === "walk");
  assert.equal(r.pass, false);
  assert.match(r.failures[0].msg, /ぶつかり/);
});

test("信号機: 歩行者と車が同時に青だと危険と判定する", () => {
  const s = data.scenarios.find((x) => x.id === "traffic");
  const c = compile("車の青 = オン\n歩行者の青 = オン\nずっと\n  1 秒待つ\nおわり", MODELS.traffic.device);
  const [r] = runAllTests(MODELS.traffic, c.program, s.tests);
  assert.ok(r.failures.some((f) => /危険/.test(f.msg)));
});

// ---------------- 2026-10-13 レビュー第1段の直し（回帰テスト） ----------------
const scn = (id) => data.scenarios.find((x) => x.id === id);
const runScn = (id, src) => {
  const s = scn(id);
  const model = MODELS[s.model];
  const c = compile(src, model.device);
  assert.deepEqual(c.errors.map((e) => e.message), [], src);
  return runAllTests(model, c.program, s.tests);
};
const msgs = (results) => results.flatMap((r) => r.failures.map((f) => f.msg));

// MC-01: 信号機のテストが、歩行者の安全（青の長さ・全赤・「危ない！」）を確かめる
const TRAFFIC_SHORT_PED = "歩行者の赤 = オン\nずっと\n  車の青 = オン\n  6 秒待つ\n  車の青 = オフ\n  車の黄 = オン\n  3 秒待つ\n  車の黄 = オフ\n  車の赤 = オン\n  歩行者の赤 = オフ\n  歩行者の青 = オン\n  0.5 秒待つ\n  歩行者の青 = オフ\n  歩行者の赤 = オン\n  車の赤 = オフ\nおわり";
test("MC-01 信号機: 歩行者の青0.5秒・全赤なし（レビューの危ないプログラム）は不合格", () => {
  const rs = runScn("traffic", TRAFFIC_SHORT_PED);
  assert.equal(rs[0].pass, false);
  const m = msgs(rs).join("\n");
  assert.match(m, /歩行者の青が短すぎます（0.5秒）/);
  assert.match(m, /危険！ 横断歩道に歩行者がいるのに、車が進んできました/);
  assert.match(m, /「車が黄」から「歩行者が青」になりました（車が赤になってから1秒待って/);
});
test("MC-01 信号機: 全赤はあっても歩行者の青0.5秒は不合格", () => {
  const rs = runScn("traffic", scn("traffic").model_answer.replace("5 秒待つ", "0.5 秒待つ"));
  assert.equal(rs[0].pass, false);
  assert.match(msgs(rs).join("\n"), /歩行者の青が短すぎます/);
});
test("MC-01 信号機: 歩行者の青5秒でも全赤なしは不合格、全赤0.5秒も不合格", () => {
  const noAllRed = runScn("traffic", scn("traffic").model_answer.replace(/  1 秒待つ\n/g, ""));
  assert.equal(noAllRed[0].pass, false);
  assert.match(msgs(noAllRed).join("\n"), /から「歩行者が青」になりました|から「車が青」になりました/);
  const shortAllRed = runScn("traffic", scn("traffic").model_answer.replace(/1 秒待つ/g, "0.5 秒待つ"));
  assert.equal(shortAllRed[0].pass, false);
  assert.match(msgs(shortAllRed).join("\n"), /全赤（車も歩行者も赤）が短すぎます（0.5秒）/);
});
test("MC-01 信号機: 歩行者の青4秒・全赤1秒なら合格（模範に近い別の答え）", () => {
  const rs = runScn("traffic", scn("traffic").model_answer.replace("5 秒待つ", "4 秒待つ"));
  assert.ok(rs.every((r) => r.pass), msgs(rs).join(" / "));
});
test("MC-01 押しボタン式: 歩行者の青0.5秒・全赤なしは不合格、全赤なしだけでも不合格", () => {
  const short = "車の青 = オン\n歩行者の赤 = オン\nずっと\n  もし ボタン == オン なら\n    2 秒待つ\n    車の青 = オフ\n    車の黄 = オン\n    3 秒待つ\n    車の黄 = オフ\n    車の赤 = オン\n    歩行者の赤 = オフ\n    歩行者の青 = オン\n    0.5 秒待つ\n    歩行者の青 = オフ\n    歩行者の赤 = オン\n    車の赤 = オフ\n    車の青 = オン\n  おわり\nおわり";
  const rs = runScn("traffic-button", short);
  assert.equal(rs.find((r) => r.test.id === "push").pass, false);
  assert.equal(rs.find((r) => r.test.id === "twice").pass, false);
  assert.match(msgs(rs).join("\n"), /危険！ 横断歩道に歩行者がいるのに/);
  const noAllRed = runScn("traffic-button", scn("traffic-button").model_answer.replace(/    1 秒待つ\n/g, ""));
  assert.equal(noAllRed.find((r) => r.test.id === "push").pass, false);
});
test("MC-01 信号機: テストの「危ない」は絵の「危ない！」と同じ条件", () => {
  for (const id of ["traffic", "traffic-button"]) {
    const s = scn(id);
    const model = MODELS[s.model];
    const src = id === "traffic" ? TRAFFIC_SHORT_PED : s.model_answer.replace("5 秒待つ", "0.5 秒待つ").replace(/    1 秒待つ\n/g, "");
    const { program } = compile(src, model.device);
    const sim = new Sim(model, program, { timeline: s.tests.at(-1).timeline });
    let seen = 0;
    for (let i = 0; i < 400; i++) {
      sim.tick();
      const d = model.derived(sim.state, sim.outputs, sim.env);
      const svg = model.draw(sim.state, sim.outputs, sim.env, sim.sensors, d);
      assert.equal(svg.includes("危ない！"), d.危ない === 1, `${id} ${sim.t}秒`);
      seen += d.危ない;
    }
    assert.ok(seen > 0, `${id}: 危ない場面が一度は出る`);
  }
});

// MC-05: テストが目的の両側を見る
test("MC-05 自動ドア: 早く開きすぎ（しきい値300・400）は不合格、110〜240は合格", () => {
  const door = (t) => runScn("door", `ずっと\n  もし 距離 < ${t} なら\n    ドア = 開く\n  でなければ\n    ドア = 閉じる\n  おわり\nおわり`);
  for (const t of [110, 150, 200, 240]) assert.ok(door(t).every((r) => r.pass), `しきい値 ${t}: ${msgs(door(t)).join(" / ")}`);
  for (const t of [300, 400]) {
    const r = door(t).find((x) => x.test.id === "passby");
    assert.equal(r.pass, false, `しきい値 ${t}`);
    assert.match(r.failures[0].msg, /通りすぎるだけの人に、ドアが開いてしまいました/);
  }
});
test("MC-05 街灯★: はじめのプログラムは★も不合格、「でなければ→待つ→たしかめて消す」は合格", () => {
  const star = (src) => runScn("streetlight", src).find((r) => r.test.id === "headlight");
  assert.equal(star(scn("streetlight").starter).pass, false);
  assert.equal(star("ずっと\n  もし 明るさ < 30 なら\n    街灯 = オン\n  でなければ\n    街灯 = オフ\n  おわり\nおわり").pass, false);
  assert.equal(star("ずっと\n  もし 明るさ < 30 なら\n    街灯 = オン\n  でなければ\n    2 秒待つ\n    もし 明るさ >= 30 なら\n      街灯 = オフ\n    おわり\n  おわり\nおわり").pass, true);
});
test("MC-05 信号機: 1回だけ切りかえて車を青のままにすると不合格", () => {
  const once = "歩行者の赤 = オン\n車の青 = オン\n6 秒待つ\n車の青 = オフ\n車の黄 = オン\n3 秒待つ\n車の黄 = オフ\n車の赤 = オン\n1 秒待つ\n歩行者の赤 = オフ\n歩行者の青 = オン\n5 秒待つ\n歩行者の青 = オフ\n歩行者の赤 = オン\n1 秒待つ\n車の赤 = オフ\n車の青 = オン\nずっと\n  1 秒待つ\nおわり";
  const rs = runScn("traffic", once);
  assert.equal(rs[0].pass, false);
  assert.match(msgs(rs).join("\n"), /車の青が20秒以上続いています/);
});

// MC-04: ぶつかったときの文に、ドアの開きと基準（30cm・80%）を入れる
test("MC-04 自動ドア: しきい値100の不合格の文に、開き具合と基準が入る", () => {
  const r = runScn("door", "ずっと\n  もし 距離 < 100 なら\n    ドア = 開く\n  でなければ\n    ドア = 閉じる\n  おわり\nおわり").find((x) => x.test.id === "walk");
  assert.equal(r.pass, false);
  assert.match(r.failures[0].msg, /30cm手前まで来たのに、ドアがまだ70%しか開いていなくて/);
  assert.match(r.failures[0].msg, /80%以上/);
  assert.doesNotMatch(r.failures[0].msg, /\{|undefined|NaN/);
});

// MC-03: ブロックの数の欄は、単位・全角・空白・桁区切りを取りのぞいて読む
test("MC-03 数の欄: 「150cm」などを数として読み、読めないものは null", () => {
  const cases = { "150cm": "150", "１５０": "150", " 150 ": "150", "150 cm": "150", "１５０ｃｍ": "150", "2秒": "2", "30℃": "30", "1,000": "1000", "50%": "50", "-5": "-5", "0.5": "0.5", "3回": "3" };
  for (const [k, v] of Object.entries(cases)) assert.equal(numberFieldText(k), v, k);
  for (const k of ["", "百五十", "1e9", "30.5.5", "abc", "明るさ", "150m"]) assert.equal(numberFieldText(k), null, k);
});

// MC-07: ふりかえり・改善メモは、書いているそばから自動で保存される
test("MC-07 自動保存: 入力のあと約0.4秒で保存し、ページを移るときはすぐ保存する", async () => {
  const el = new EventTarget();
  el.value = "";
  const saved = [];
  let shown = 0;
  attachAutosave(el, (t) => saved.push(t), { delay: 50, onSaved: () => shown++ });
  el.value = "明るさが30より小さいときにつける";
  el.dispatchEvent(new Event("input"));
  assert.equal(saved.length, 0, "すぐには保存しない（打っているあいだ）");
  await new Promise((r) => setTimeout(r, 120));
  assert.deepEqual(saved, ["明るさが30より小さいときにつける"]);
  assert.equal(shown, 1);
  el.value = "書きかけ";
  el.dispatchEvent(new Event("input"));
  flushAutosaves(); // 「つぎはこれ」などでページを移ったとき
  assert.deepEqual(saved.at(-1), "書きかけ");
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(saved.length, 2, "移ったあとに、もう一度保存しない");
  assert.equal(AUTOSAVE_HINT, "書いた文は、自動でこの端末に保存されます。");
});

// ---- 第2段（MC-02・09・14） ----
import { moveNode, innerCount, memoCursor, blockLabel } from "../js/blocks.js";

test("MC-02 ブロックを動かす: 「もし」の外から中へ、自分の中へは動かせない", () => {
  const { program } = parseProgram("ずっと\n  もし 明るさ < 30 なら\n    街灯 = オン\n  おわり\n  1 秒待つ\nおわり");
  const loop = program[0];
  const [ifNode, wait] = loop.body;
  assert.ok(moveNode(program, wait, ifNode.then, 0));
  assert.equal(programToText(program), "ずっと\n  もし 明るさ < 30 なら\n    1 秒待つ\n    街灯 = オン\n  おわり\nおわり");
  // 同じ列の中で後ろへ動かすとき、位置がずれない
  assert.ok(moveNode(program, ifNode.then[0], ifNode.then, 2));
  assert.equal(ifNode.then.map((n) => n.type).join(","), "assign,wait");
  // 自分の中（「ずっと」の中）へは動かせない
  assert.equal(moveNode(program, loop, ifNode.then, 0), false);
  assert.equal(programToText(program), "ずっと\n  もし 明るさ < 30 なら\n    街灯 = オン\n    1 秒待つ\n  おわり\nおわり");
});

test("MC-14 消す前の確認に使う: 中のブロックの数と、ブロックの1行目", () => {
  const { program } = parseProgram("ずっと\n  もし 明るさ < 30 なら\n    街灯 = オン\n  でなければ\n    街灯 = オフ\n  おわり\nおわり");
  assert.equal(innerCount(program[0]), 3);
  assert.equal(innerCount(program[0].body[0].then[0]), 0);
  assert.equal(blockLabel(program[0].body[0]), "もし 明るさ < 30 なら");
});

test("MC-09 場面4: はじめのプログラムは黄・赤まで入っていて、「# ここに…」の下（「もし」の中）が選ばれる", () => {
  const s = data.scenarios.find((x) => x.id === "traffic-button");
  const { program } = compile(s.starter, MODELS[s.model].device);
  const cur = memoCursor(program);
  const ifNode = program[2].body[0];
  assert.equal(ifNode.type, "if");
  assert.equal(cur.list, ifNode.then);
  assert.equal(cur.index, ifNode.then.length);
  // 続き（全赤・歩行者の青・車を青にもどす）を足せば全部合格する
  const rest = "    1 秒待つ\n    歩行者の赤 = オフ\n    歩行者の青 = オン\n    5 秒待つ\n    歩行者の青 = オフ\n    歩行者の赤 = オン\n    1 秒待つ\n    車の赤 = オフ\n    車の青 = オン\n";
  const done = s.starter.replace(/(    # ここに[^\n]*\n)/, `$1${rest}`);
  const rs = runAllTests(MODELS[s.model], compile(done, MODELS[s.model].device).program, s.tests);
  assert.ok(rs.every((r) => r.pass), rs.map((r) => r.failures.map((f) => f.msg)).flat().join(" / "));
});

test("MC-09 目安時間: どの場面にも time と period（1〜3時間目）がある", () => {
  for (const s of data.scenarios) {
    assert.match(s.time, /分$/, s.id);
    assert.ok([1, 2, 3].includes(s.period), s.id);
  }
});

// ---- 第3段（MC-11・17・18） ----
import { thresholdsOf } from "../js/lang.js";
import { outputWordWarnings } from "../js/models.js";
import { condText } from "../js/flow.js";
import { runTest } from "../js/sim.js";

test("MC-11: しきい値を集める・ログにセンサの値と「ぶつかった」が出る・理由は時刻の順", () => {
  const { program } = parseProgram("ずっと\n  もし 距離 < 150 かつ 距離 >= 10 なら\n    ドア = 開く\n  おわり\nおわり");
  assert.deepEqual(thresholdsOf(program), { 距離: [10, 150] });
  const door = MODELS.door;
  const sim = new Sim(door, program, { manual: { 人の位置: 100 } });
  sim.tick();
  const out = sim.log.find((l) => l.kind === "out");
  assert.match(out.text, /^距離 100cm → ドア を「開く」にした$/);
  // 開けないプログラムで人が来ると、ログに「ぶつかった」が出る
  const none = parseProgram("ずっと\n  1 秒待つ\nおわり").program;
  const s2 = new Sim(door, none, { manual: { 人の位置: 10 } });
  s2.tick();
  assert.ok(s2.log.some((l) => l.kind === "warn" && l.text.includes("ぶつかった")));
  // テストの理由は時刻の順
  const scn = data.scenarios.find((x) => x.id === "door");
  for (const t of scn.tests) {
    const r = runTest(door, parseProgram(scn.starter).program, t);
    const ts = r.failures.map((f) => f.t ?? 1e9);
    assert.deepEqual(ts, [...ts].sort((a, b) => a - b), t.id);
  }
});

test("MC-17: 押しボタンを短く押しても、次の1きざみはオンと読む", () => {
  const m = MODELS["traffic-button"];
  const { program } = parseProgram("ずっと\n  もし ボタン == オン なら\n    回数 = 1\n  おわり\nおわり");
  const sim = new Sim(m, program, { manual: { ボタン: 0 } });
  sim.tick();
  sim.press("ボタン"); // きざみの間に押して、すぐ離した（manual は 0 のまま）
  const s = sim.tick();
  assert.equal(s.ボタン, 1);
  assert.equal(sim.vars.回数, 1);
  assert.equal(sim.tick().ボタン, 0, "覚えておくのは1きざみだけ");
});

test("MC-18: ことば・記号", () => {
  assert.equal(condText(parseExpr("明るさ >= 30 かつ ボタン == オン")), "明るさ ≧ 30 かつ ボタン ＝ オン");
  assert.equal(condText(parseExpr("距離 != 0")), "距離 ≠ 0");
  assert.throws(() => parseExpr(""), /数か名前を入れよう/);
  assert.throws(() => parseExpr("距離 cm"), /記号（< や \+ など）/);
  // エラーのログの行番号は1回だけ
  const sim = new Sim(MODELS.sandbox, parseProgram("1000000 回くり返す\n  LED = オン\nおわり").program);
  sim.tick();
  const e = sim.log.find((l) => l.kind === "error");
  assert.equal(e.text, "エラー: くり返す回数が多すぎます（10万回まで）");
  assert.equal(e.line, 1);
  // 「複数」ではなく「2つ以上ついている」
  const tm = MODELS.traffic;
  const d = tm.derived(tm.init(), { 車の青: 1, 車の黄: 0, 車の赤: 1, 歩行者の青: 0, 歩行者の赤: 1 });
  assert.equal(d.車信号, "2つ以上ついている");
  // ドアに「オフ」→ 注意
  const w = outputWordWarnings(parseProgram("ドア = オフ\nドア = 閉じる").program, MODELS.door.device);
  assert.equal(w.length, 1);
  assert.match(w[0].message, /^1行目: 「ドア」には「開く」「閉じる」「止める」を使おう（「オフ」は「止める」と同じ意味/);
  assert.equal(outputWordWarnings(parseProgram("街灯 = 開く").program, MODELS.streetlight.device).length, 1);
  assert.equal(outputWordWarnings(parseProgram(data.scenarios.find((x) => x.id === "door").model_answer).program, MODELS.door.device).length, 0);
});
