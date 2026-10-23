// 火星探査ロボット・シミュレータ（D8）のテスト: センサ・動き・電池・判定・模範プログラム
import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGES } from "../js/stages.js";
import { compile, runTests, RoverSim, freeScore, validate } from "../js/rsim.js";
import { readDistance, DIST_SLOTS, moveRobot, designCost, sensorsOf, mazeWalls } from "../js/world.js";
import { parseProgram, programToText } from "../../measure-control-sim/js/lang.js";

const slot = (id) => DIST_SLOTS.find((x) => x.id === id);

test("距離センサ: 前の岩までの距離（ロボットの前のはしから）", () => {
  const field = { W: 500, H: 200, obstacles: [{ type: "rock", x: 200, y: 100, r: 20 }] };
  const robot = { x: 50, y: 100, a: 0, dist: 0 };
  // 前のはし（x=65）から岩のふち（x=180）まで 115cm
  assert.equal(readDistance(field, robot, slot("front")), 115);
  // 何もない方向は、フィールドのはし（崖）まで
  robot.a = Math.PI;
  assert.equal(readDistance(field, robot, slot("front")), 35);
  // 何もなく遠いときは 300 まで
  const big = { W: 2000, H: 2000, obstacles: [] };
  assert.equal(readDistance(big, { x: 100, y: 1000, a: 0, dist: 0 }, slot("front")), 300);
});

test("距離センサ: 左右のセンサは横の岩壁を見る", () => {
  const field = { W: 300, H: 300, obstacles: [{ type: "wall", x: 0, y: 0, w: 300, h: 60 }] };
  const robot = { x: 150, y: 150, a: 0, dist: 0 };
  // 左のセンサ（y=137）から壁（y=60）まで 77。±8°の広がりでも、まっすぐがいちばん近い
  assert.equal(readDistance(field, robot, slot("left")), 77);
  assert.equal(readDistance(field, robot, slot("right")), 137);
});

test("動き: ふつうの速さで、1秒に 20cm 進み、その場で 90° 回る", () => {
  const field = { W: 1000, H: 1000, obstacles: [] };
  const r = { x: 100, y: 100, a: 0, dist: 0 };
  moveRobot(field, r, 1, 1, 20, 1);
  assert.ok(Math.abs(r.x - 120) < 1e-6);
  moveRobot(field, r, 1, -1, 20, 1);
  assert.ok(Math.abs(r.a - Math.PI / 2) < 1e-6, "右に回ると、向きの角度が 90° 増える");
  assert.ok(Math.abs(r.x - 120) < 1e-6 && Math.abs(r.y - 100) < 1e-6, "その場で回る");
});

test("ぶつかると止まり、テストは不合格", () => {
  const s = STAGES.find((x) => x.id === "rock");
  const { program } = compile("ずっと\n  走行 = 前進\nおわり", s.design);
  const rs = runTests(s, program, s.design);
  assert.ok(rs.every((r) => !r.pass));
  assert.ok(rs.every((r) => /岩にぶつかった/.test(r.reasons[0])), rs.map((r) => r.reasons[0]).join(" / "));
});

test("模範プログラムは、どのステージもすべてのケースに合格する（⑤ は谷のコースで全部集める）", () => {
  for (const s of STAGES) {
    const c = compile(s.model.program, s.model.design);
    assert.deepEqual(c.errors.map((e) => e.message), [], s.id);
    const rs = runTests(s, c.program, s.model.design);
    if (s.free) assert.ok(rs.some((r) => r.pass), s.id);
    else assert.ok(rs.every((r) => r.pass), `${s.id}: ${rs.map((r) => `${r.name} ${r.reasons.join(";")}`).join(" / ")}`);
  }
});

test("はじめのプログラムは読めて、①〜④ では全部は合格しない", () => {
  for (const s of STAGES) {
    const c = compile(s.starter, s.design);
    assert.deepEqual(c.errors.map((e) => e.message), [], s.id);
    if (s.free) continue;
    const rs = runTests(s, c.program, s.design);
    assert.ok(rs.some((r) => !r.pass), s.id);
  }
});

test("② は時間だけで進むプログラムでは、岩の場所が変わると合格できない", () => {
  const s = STAGES.find((x) => x.id === "rock");
  const { program } = compile("走行 = 前進\n6 秒待つ\n走行 = 止まる\n2 秒待つ", s.design);
  const rs = runTests(s, program, s.design);
  assert.ok(rs.every((r) => !r.pass));
});

test("③ は速さを変えたら回る時間も考える（はやいと 1 秒で 135° 回って合格しない。ゆっくりで 2 秒なら合格）", () => {
  const s = STAGES.find((x) => x.id === "maze");
  const fast = { ...s.model.design, speed: "fast" };
  assert.ok(runTests(s, compile(s.model.program, fast).program, fast).every((r) => !r.pass));
  const slow = { ...s.model.design, speed: "slow" };
  const p2 = compile(s.model.program.replace("1 秒待つ", "2 秒待つ"), slow).program;
  assert.ok(runTests(s, p2, slow).every((r) => r.pass));
});

test("付けていないセンサを使うと、設計で付けるように知らせる", () => {
  const { program } = parseProgram("もし 右の距離 > 50 なら\n  走行 = 右に回る\nおわり");
  const v = validate(program, { dist: ["front"], color: 0, speed: "normal" });
  assert.match(v.errors[0].message, /センサが付いていません/);
  assert.equal(validate(program, { dist: ["front", "right"], color: 0, speed: "normal" }).errors.length, 0);
  const bad = parseProgram("走行 = 5").program;
  assert.match(validate(bad, { dist: [], color: 0, speed: "normal" }).errors[0].message, /走行は/);
});

test("電池: 速いほど多く使い、止まっていても少し使う", () => {
  const field = { W: 5000, H: 400, start: { x: 50, y: 200, a: 0 }, obstacles: [], targets: [], limit: 20 };
  const run = (speed) => {
    const prog = parseProgram("走行 = 前進\n10 秒待つ\n走行 = 止まる\n5 秒待つ").program;
    const sm = new RoverSim(field, prog, { dist: ["front"], color: 0, speed });
    return sm.runToEnd();
  };
  const slow = run("slow");
  const fast = run("fast");
  assert.ok(fast.battery < run("normal").battery && run("normal").battery < slow.battery);
  assert.ok(slow.battery < 100);
});

test("色センサ: 線の上なら 1", () => {
  const s = STAGES.find((x) => x.id === "line");
  const f = s.cases[0].field;
  const sm = new RoverSim(f, parseProgram("走行 = 止まる").program, { dist: [], color: 1, speed: "normal" });
  assert.equal(sm.sensors["色"], 1, "スタートでは線の上");
});

test("費用と、プログラムで使える名前", () => {
  const d = { dist: ["front", "left"], color: 2, speed: "fast" };
  assert.equal(designCost(d), 2000 + 2 * 400 + 2 * 250 + 1400);
  assert.deepEqual(sensorsOf(d).map((x) => x.name), ["前の距離", "左の距離", "左の色", "右の色"]);
});

test("⑤ の点数: サンプル100点、全部そろって基地に帰ると +100点と電池・時間", () => {
  const field = { goal: { x: 0, y: 0, w: 1, h: 1 }, limit: 100 };
  assert.equal(freeScore(field, { collected: 2, goal: false, outcome: "time", battery: 50, time: 100, crash: null }), 200);
  assert.equal(freeScore(field, { collected: 4, goal: true, outcome: "clear", battery: 60.4, time: 70, crash: null }), 400 + 100 + 60 + 30);
  assert.equal(freeScore(field, { collected: 1, goal: false, outcome: "crash", battery: 90, time: 10, crash: { t: 10 } }), 50);
});

test("迷路の岩壁: 道のとなりの、つながっていないところに壁がある", () => {
  const w = mazeWalls(2, 2, [[0, 0], [1, 0], [1, 1]]);
  assert.ok(w.some((o) => o.fill && o.x === 0 && o.y === 100), "道でないますは岩でうめる");
  assert.ok(!w.some((o) => !o.fill && o.x === 95 && o.y === -5), "道どうしの間には壁がない");
});

test("プログラムはテキストにして保存でき、読みもどせる（D7 と同じ言語）", () => {
  for (const s of STAGES) {
    const p = parseProgram(s.model.program).program;
    assert.equal(programToText(p), s.model.program);
  }
});
