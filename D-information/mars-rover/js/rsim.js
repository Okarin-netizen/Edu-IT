// ロボットを動かすシミュレーション: 0.1秒きざみで「センサを読む → プログラム → モーター → ロボットが動く」をくり返す
// 計測・制御シミュレータ（D7）と同じ言語・インタプリタを使う。自動テスト（ケースごとの合否）もここで行う。DOM を使わない。
import { execute } from "../../measure-control-sim/js/interp.js";
import { parseProgram, LangError, walkProgram, exprNames, fmt } from "../../measure-control-sim/js/lang.js";
import { SPEEDS, BATTERY, sensorsOf, readSensors, moveRobot, ROBOT_R } from "./world.js";

export const DT = 0.1;
const BUDGET = 1000;
const MAX_LOG = 300;

// 走らせ方（出力）と、決まった言葉
export const DRIVE = { 前進: [1, 1], 後退: [-1, -1], 右に回る: [1, -1], 左に回る: [-1, 1], 止まる: [0, 0] };
export const DRIVE_WORDS = Object.keys(DRIVE);
export const MOTOR = { 前へ: 1, 後ろへ: -1, 止める: 0 };
export const MOTOR_WORDS = Object.keys(MOTOR);
export const OUTPUTS = ["走行", "左のモーター", "右のモーター"];
export const COLOR_WORDS = { 線: 1, 地面: 0 };
export const WORDS = { ...Object.fromEntries(DRIVE_WORDS.map((w) => [w, w])), ...Object.fromEntries(MOTOR_WORDS.map((w) => [w, w])), ...COLOR_WORDS };

// プログラムの木を、設計（センサ）と照らし合わせる
export function validate(program, design) {
  const sensors = sensorsOf(design);
  const sNames = new Set(sensors.map((s) => s.name));
  const allSensorNames = new Set(["前の距離", "左前の距離", "右前の距離", "左の距離", "右の距離", "色", "左の色", "右の色"]);
  const errors = [];
  const vars = new Set();
  walkProgram(program, (n) => {
    if (n.type !== "assign") return;
    if (allSensorNames.has(n.name)) errors.push(new LangError(`「${n.name}」はセンサなので、値を入れることはできません（読むだけ）`, n.line));
    else if (n.name in WORDS) errors.push(new LangError(`「${n.name}」は決まった言葉なので、変数の名前には使えません`, n.line));
    else if (!OUTPUTS.includes(n.name)) vars.add(n.name);
    if (n.name === "走行" && !(n.value.type === "name" && DRIVE[n.value.name])) errors.push(new LangError(`走行は「${DRIVE_WORDS.join("・")}」のどれかにします`, n.line));
    if ((n.name === "左のモーター" || n.name === "右のモーター") && !(n.value.type === "name" && n.value.name in MOTOR)) errors.push(new LangError(`モーターは「${MOTOR_WORDS.join("・")}」のどれかにします`, n.line));
  });
  walkProgram(program, (n) => {
    for (const k of ["value", "cond", "count", "secs"]) {
      if (!n[k]) continue;
      for (const name of exprNames(n[k])) {
        if (sNames.has(name) || vars.has(name) || name in WORDS || OUTPUTS.includes(name)) continue;
        if (allSensorNames.has(name)) errors.push(new LangError(`「${name}」のセンサが付いていません。「ロボットの設計」で付けよう`, n.line));
        else errors.push(new LangError(`「${name}」という名前のセンサ・変数はありません`, n.line));
      }
    }
  });
  return { errors, vars: [...vars] };
}

export function compile(text, design) {
  const { program, errors } = parseProgram(text);
  if (errors.length) return { program, errors };
  return { program, errors: validate(program, design).errors };
}

// フィールドを、走らせるたびに新しく使えるように写す（調べたサンプルの印などを持たせない）
export function cloneField(f) {
  return JSON.parse(JSON.stringify(f));
}

export class RoverSim {
  // field: ステージのケースのフィールド / design: { dist: [...], color, speed } / opts: { limit, battery }
  constructor(field, program, design, opts = {}) {
    this.field0 = field;
    this.program = program;
    this.design = design;
    this.sensorList = sensorsOf(design);
    this.v = (SPEEDS[design.speed] || SPEEDS.normal).v;
    this.limit = opts.limit ?? field.limit ?? 60;
    const used = new Set();
    walkProgram(program, (n) => {
      for (const k of ["value", "cond", "count", "secs"]) if (n[k]) exprNames(n[k], used);
    });
    this.logSensors = this.sensorList.filter((s) => used.has(s.name));
    this.reset();
  }

  reset() {
    const f = cloneField(this.field0);
    this.field = f;
    this.robot = { x: f.start.x, y: f.start.y, a: ((f.start.a || 0) * Math.PI) / 180, dist: 0 };
    this.trail = [[this.robot.x, this.robot.y]];
    this.wheels = [0, 0];
    this.drive = "止まる";
    this.tickN = 0;
    this.battery = 100;
    this.vars = {};
    this.sensors = readSensors(f, this.robot, this.sensorList);
    this.targets = (f.targets || []).map((t) => ({ ...t, done: false, doneAt: null, still: 0 }));
    this.goalReached = false;
    this.crash = null;
    this.outcome = null; // 走り終わった理由: "clear" | "crash" | "battery" | "time" | "stopped"
    this.log = [];
    this.error = null;
    this.finished = false;
    this.currentId = null;
    this.wakeTick = 0;
    this.inTick = false;
    this.busyWarned = false;
    this.loopStart = new Map();
    this.stillTime = 0;
    this.endWait = 0;
    this.gen = execute(this.program, {
      get: (name) => this.read(name),
      set: (name, v, node) => this.write(name, v, node),
    });
  }

  get t() {
    return this.tickN * DT;
  }

  get collected() {
    return this.targets.filter((t) => t.done).length;
  }

  read(name) {
    if (name in this.sensors) return this.sensors[name];
    if (name in this.vars) return this.vars[name];
    if (name in WORDS) return WORDS[name];
    if (name === "走行") return this.drive;
    if (name === "左のモーター") return wordOfWheel(this.wheels[0]);
    if (name === "右のモーター") return wordOfWheel(this.wheels[1]);
    throw new LangError(`変数「${name}」に値を入れる前に使っています`);
  }

  write(name, v, node) {
    if (name === "走行") {
      const w = DRIVE[v];
      if (!w) throw new LangError(`走行は「${DRIVE_WORDS.join("・")}」のどれかにします`, node?.line);
      if (w[0] !== this.wheels[0] || w[1] !== this.wheels[1] || this.drive !== v) this.addLog("out", `${this.sensorNote()}${v}`, node?.line);
      this.wheels = [...w];
      this.drive = v;
      return;
    }
    if (name === "左のモーター" || name === "右のモーター") {
      if (!(v in MOTOR)) throw new LangError(`モーターは「${MOTOR_WORDS.join("・")}」のどれかにします`, node?.line);
      const i = name === "左のモーター" ? 0 : 1;
      if (this.wheels[i] !== MOTOR[v]) this.addLog("out", `${this.sensorNote()}${name}を${v}`, node?.line);
      this.wheels[i] = MOTOR[v];
      this.drive = Object.keys(DRIVE).find((k) => DRIVE[k][0] === this.wheels[0] && DRIVE[k][1] === this.wheels[1]) || "片方だけ";
      return;
    }
    this.vars[name] = v;
  }

  sensorNote() {
    if (!this.logSensors.length) return "";
    return this.logSensors.map((s) => `${s.name} ${s.kind === "dist" ? `${this.sensors[s.name]}cm` : this.sensors[s.name] ? "線" : "地面"}`).join("・") + " → ";
  }

  addLog(kind, text, line) {
    if (this.log.length >= MAX_LOG) this.log.shift();
    this.log.push({ t: this.t, kind, text, line });
  }

  get alive() {
    return !this.outcome;
  }

  get programAlive() {
    return !this.finished && !this.error;
  }

  beginTick() {
    this.sensors = readSensors(this.field, this.robot, this.sensorList);
    this.inTick = true;
  }

  // 0.1秒ぶん、世界を進める（モーター → 動く → ぶつかり・電池・調査）
  endTick() {
    this.inTick = false;
    if (this.outcome) return;
    const [wl, wr] = this.wheels;
    const moving = wl !== 0 || wr !== 0;
    // 電池
    const use = BATTERY.base + BATTERY.sensor * this.sensorList.length + (wl ? BATTERY.wheel(this.v) : 0) + (wr ? BATTERY.wheel(this.v) : 0);
    this.battery = Math.max(0, this.battery - use * DT);
    const hit = moving ? moveRobot(this.field, this.robot, wl, wr, this.v, DT) : null;
    this.tickN++;
    const last = this.trail.at(-1);
    if (Math.hypot(last[0] - this.robot.x, last[1] - this.robot.y) > 3) this.trail.push([this.robot.x, this.robot.y]);
    if (hit) {
      this.crash = { t: this.t, what: hit.type, x: this.robot.x, y: this.robot.y };
      this.wheels = [0, 0];
      return this.end("crash", `${crashWord(hit.type)}にぶつかった！ ロボットがこわれてしまった`);
    }
    // 調査地点（サンプル）
    this.stillTime = moving ? 0 : this.stillTime + DT;
    for (const t of this.targets) {
      if (t.done) continue;
      if (targetHit(t, this.robot, this.field, this.stillTime)) {
        t.done = true;
        t.doneAt = this.t;
        this.addLog("good", `${t.label || "サンプル"}を調査した！（${this.collected}/${this.targets.length}）`);
      }
    }
    const g = this.field.goal;
    if (g && !this.goalReached && (!g.afterTargets || this.targets.every((t) => t.done)) && this.robot.x >= g.x && this.robot.x <= g.x + g.w && this.robot.y >= g.y && this.robot.y <= g.y + g.h) {
      this.goalReached = true;
      this.addLog("good", `${g.label || "ゴール"}に着いた！`);
    }
    if (this.isClear()) return this.end("clear", "ミッション達成！");
    if (this.battery <= 0) {
      this.wheels = [0, 0];
      return this.end("battery", "電池が切れて、動けなくなった");
    }
    if (this.t >= this.limit - 1e-9) return this.end("time", `時間切れ（${this.limit}秒）`);
    // プログラムが終わって、ロボットも止まったまま（調査の待ち時間のあと）
    if (!this.programAlive && !moving) {
      this.endWait += DT;
      if (this.endWait >= 1.5) return this.end("stopped", this.error ? "エラーで止まった" : "プログラムが終わって、ロボットが止まった");
    }
  }

  isClear() {
    const needGoal = Boolean(this.field.goal);
    return (!needGoal || this.goalReached) && this.targets.every((t) => t.done) && (needGoal || this.targets.length > 0);
  }

  end(outcome, msg) {
    this.outcome = outcome;
    this.addLog(outcome === "clear" ? "good" : outcome === "stopped" ? "info" : "warn", msg);
  }

  pull() {
    let r;
    try {
      r = this.gen.next();
    } catch (e) {
      this.error = e instanceof LangError ? e : new LangError(String(e.message || e));
      this.addLog("error", `エラー: ${this.error.line ? this.error.plain : this.error.message}`, this.error.line);
      return "end";
    }
    if (r.done) {
      this.finished = true;
      this.currentId = null;
      this.addLog("info", "プログラムが最後まで終わりました");
      return "end";
    }
    const v = r.value;
    if (v.kind === "stmt") {
      this.currentId = v.id;
      return "stmt";
    }
    if (v.kind === "wait") {
      this.wakeTick = this.tickN + Math.max(1, Math.round(v.secs / DT));
      return "tick";
    }
    if (v.kind === "loopStart") {
      this.loopStart.set(v.id, this.tickN);
      return "continue";
    }
    if (v.kind === "loop" && v.tick) {
      const passed = this.tickN > (this.loopStart.get(v.id) ?? -1);
      this.loopStart.set(v.id, passed ? this.tickN : this.tickN + 1);
      return passed ? "continue" : "tick";
    }
    return "continue";
  }

  tick() {
    if (this.outcome) return;
    if (!this.inTick) this.beginTick();
    if (this.programAlive && this.tickN >= this.wakeTick) {
      let budget = BUDGET;
      for (;;) {
        const k = this.pull();
        if (k === "tick" || k === "end") break;
        if (k === "stmt" && --budget <= 0) {
          if (!this.busyWarned) {
            this.busyWarned = true;
            this.addLog("warn", "注意: 「待つ」のないくり返しが、とても速く回っています");
          }
          break;
        }
      }
    }
    this.endTick();
  }

  // 1ステップ: 次の命令の手前まで進める
  step() {
    for (let guard = 0; guard < 100000 && !this.outcome; guard++) {
      if (!this.inTick) this.beginTick();
      if (this.programAlive && this.tickN >= this.wakeTick) {
        const k = this.pull();
        if (k === "stmt") return;
        if (k === "continue") continue;
        this.endTick();
        if (k === "end") return;
        continue;
      }
      this.endTick();
      if (!this.programAlive) return;
    }
  }

  // 最後まで一気に走らせる（テスト用）
  runToEnd() {
    let guard = Math.ceil(this.limit / DT) + 5;
    while (!this.outcome && guard-- > 0) this.tick();
    if (!this.outcome) this.end("time", `時間切れ（${this.limit}秒）`);
    return this.summary();
  }

  summary() {
    return {
      outcome: this.outcome,
      time: Math.round(this.t * 10) / 10,
      battery: Math.round(this.battery * 10) / 10,
      collected: this.collected,
      targets: this.targets.length,
      goal: this.goalReached,
      crash: this.crash,
      distance: Math.round(this.robot.dist),
      error: this.error ? this.error.message : null,
    };
  }
}

function wordOfWheel(w) {
  return w > 0 ? "前へ" : w < 0 ? "後ろへ" : "止める";
}

function crashWord(type) {
  return { rock: "岩", crater: "クレーターのふち", wall: "岩壁", edge: "崖（フィールドのはし）" }[type] || "何か";
}

// 調査地点に着いたか
// mode "pass": 上を通ればよい / "stop": 中で1秒止まる / "near": その岩の近く（ふちから near cm 以内）で1秒止まる
function targetHit(t, robot, field, still) {
  if (t.mode === "near") {
    const o = field.obstacles[t.obstacle];
    const gap = Math.hypot(robot.x - o.x, robot.y - o.y) - o.r - ROBOT_R;
    return still >= 1 - 1e-9 && gap <= t.near;
  }
  const d = Math.hypot(robot.x - t.x, robot.y - t.y);
  if (t.mode === "stop") return still >= 1 - 1e-9 && d <= t.r;
  return d <= t.r;
}

// ケースの結果を、合格・不合格と理由にする
export function judge(stage, field, sum) {
  const reasons = [];
  if (sum.error) reasons.push(`エラーで止まった（${sum.error}）`);
  if (sum.crash) reasons.push(`${fmt(sum.crash.t)}秒で${crashWord(sum.crash.what)}にぶつかった`);
  if (sum.outcome === "battery") reasons.push(`${fmt(sum.time)}秒で電池が切れた`);
  if (sum.targets && sum.collected < sum.targets) reasons.push(`${field.targetWord || "調査地点"}を ${sum.collected}/${sum.targets} しか調査できなかった`);
  if (field.goal && !sum.goal) reasons.push(`${field.goal.label || "ゴール"}に着かなかった`);
  if (sum.outcome === "time" && !reasons.length) reasons.push(`時間切れ（${fmt(sum.time)}秒）`);
  return { pass: sum.outcome === "clear", reasons };
}

// ステージのすべてのケースで走らせる
export function runTests(stage, program, design) {
  return stage.cases.map((c) => {
    const sim = new RoverSim(c.field, program, design);
    const sum = sim.runToEnd();
    const j = judge(stage, c.field, sum);
    return { id: c.id, name: c.name, pass: j.pass, reasons: j.reasons, summary: sum, reason: j.reasons[0] || "" };
  });
}

// ⑤ の点数: サンプル1つ 100点 ＋ 基地に帰ったら 100点 ＋ 電池の残り（%）＋ 残り時間（秒）。ぶつかったら −50点
export function freeScore(field, sum) {
  const base = sum.collected * 100 + (field.goal && sum.goal ? 100 : 0);
  const bonus = sum.outcome === "clear" ? Math.round(sum.battery) + Math.max(0, Math.round((field.limit || 120) - sum.time)) : 0;
  return Math.max(0, base + bonus - (sum.crash ? 50 : 0));
}
