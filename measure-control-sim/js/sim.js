// シミュレーション: 0.1秒きざみで「センサを読む → プログラム → 出力 → 世界が動く」をくり返す
// 自動テスト（想定ケースの合否判定）もここで行う。DOM を使わない。
import { execute } from "./interp.js";
import { CONSTANTS, LangError, fmt, walkProgram, exprNames } from "./lang.js";
import { OUTPUT_KINDS, initialOutputs } from "./models.js";

export const DT = 0.1; // 1回の時間のきざみ（秒）
const BUDGET = 1000; // 1きざみで実行できる文の数（止まらないプログラムの暴走を防ぐ）
const MAX_SAMPLES = 6000; // グラフ用の記録（10分ぶん）
const MAX_LOG = 400;

// 時系列（キーフレーム）から時刻 t の値を求める
export function valueAt(keys, t, interp = "linear") {
  if (!keys || !keys.length) return undefined;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t < t1) {
      const [t0, v0] = keys[i - 1];
      if (interp === "step") return v0;
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return keys[keys.length - 1][1];
}

export class Sim {
  // model: models.js のモデル / program: AST / opts: { timeline, manual }
  constructor(model, program, opts = {}) {
    this.model = model;
    this.program = program;
    this.timeline = opts.timeline || null;
    this.manual = opts.manual || Object.fromEntries(model.env.map((e) => [e.name, e.default]));
    // ログに値を添えるセンサ（プログラムの中で使っているものだけ）
    const used = new Set();
    walkProgram(program, (n) => {
      for (const k of ["value", "cond", "count", "secs"]) if (n[k]) exprNames(n[k], used);
    });
    this.logSensors = model.device.sensors.filter((x) => used.has(x.name));
    this.reset();
  }

  reset() {
    this.tickN = 0;
    this.state = this.model.init();
    this.outputs = initialOutputs(this.model);
    this.vars = {};
    this.sensors = {};
    this.env = {};
    this.samples = [];
    this.log = [];
    this.error = null;
    this.finished = false;
    this.currentId = null;
    this.wakeTick = 0;
    this.inTick = false;
    this.busyWarned = false;
    this.loopStart = new Map();
    this.pressed = new Set(); // 短く押されたボタン（次の1きざみはかならず「オン」として読ませる）
    this.prevDerived = {};
    this.gen = execute(this.program, {
      get: (name) => this.read(name),
      set: (name, v, node) => this.write(name, v, node),
    });
  }

  get t() {
    return this.tickN * DT;
  }

  read(name) {
    if (name in this.sensors) return this.sensors[name];
    if (name in this.outputs) return this.outputs[name];
    if (name in this.vars) return this.vars[name];
    if (name in CONSTANTS) return CONSTANTS[name];
    throw new LangError(`変数「${name}」に値を入れる前に使っています`);
  }

  write(name, v, node) {
    const out = this.model.device.outputs.find((o) => o.name === name);
    if (!out) {
      this.vars[name] = v;
      return;
    }
    const kind = OUTPUT_KINDS[out.kind];
    const fixed = kind.fix(v);
    if (fixed !== this.outputs[name]) {
      this.outputs[name] = fixed;
      this.addLog("out", `${this.sensorNote()}${name} を「${kind.show(fixed)}」にした`, node?.line);
    }
  }

  // 「距離 90cm → 」のように、そのときのセンサの値を文の頭につける
  sensorNote() {
    if (!this.logSensors.length) return "";
    const parts = this.logSensors.map((x) => {
      const v = this.sensors[x.name];
      return `${x.name} ${x.max === 1 ? (v ? "オン" : "オフ") : `${fmt(v)}${x.unit}`}`;
    });
    return `${parts.join("・")} → `;
  }

  // 押しボタン: 押されたことを覚えておき、指をすぐ離しても次の1きざみは「オン」として読ませる
  press(name) {
    this.pressed.add(name);
  }

  addLog(kind, text, line) {
    if (this.log.length >= MAX_LOG) this.log.shift();
    this.log.push({ t: this.t, kind, text, line });
  }

  envAt(t) {
    const env = {};
    for (const e of this.model.env) {
      const keys = this.timeline?.[e.name];
      env[e.name] = keys ? valueAt(keys, t, e.interp) : this.pressed.has(e.name) ? 1 : this.manual[e.name] ?? e.default;
    }
    return env;
  }

  beginTick() {
    this.env = this.envAt(this.t);
    this.sensors = this.model.sensors(this.env, this.state);
    this.pressed.clear();
    this.inTick = true;
    this.stmtsThisTick = 0;
  }

  endTick() {
    const derived = this.model.derived(this.state, this.outputs, this.env);
    const sample = { t: Math.round(this.t * 10) / 10, ...this.env, ...this.sensors, ...this.outputs, ...this.vars, ...derived };
    this.lastSample = sample;
    this.derived = derived;
    // 「ぶつかった」「危ない」も、起きたときにログに残す
    if (derived.ぶつかった && !this.prevDerived.ぶつかった) this.addLog("warn", `人がドアにぶつかった！（距離 ${this.sensors.距離}cm、ドアの開き ${derived.ドアの開き}%）`);
    if (derived.危ない && !this.prevDerived.危ない) this.addLog("warn", "危ない！ 歩行者がわたっているのに、車が横断歩道に入った");
    this.prevDerived = derived;
    if (this.samples.length >= MAX_SAMPLES) this.samples.shift();
    this.samples.push(sample);
    this.model.step(this.state, this.outputs, this.env, DT);
    this.tickN++;
    this.inTick = false;
    return sample;
  }

  // 時間を進めずに、いまのセンサの値などを求める（一時停止中にスライダを動かしたとき用）
  peek() {
    const env = this.envAt(this.t);
    const sensors = this.model.sensors(env, this.state);
    return { env, sensors, derived: this.model.derived(this.state, this.outputs, env) };
  }

  get alive() {
    return !this.finished && !this.error;
  }

  // 1つ yield を進める。返り値: "stmt" | "tick"（このきざみは終わり）| "end"
  pull() {
    let r;
    try {
      r = this.gen.next();
    } catch (e) {
      this.error = e instanceof LangError ? e : new LangError(String(e.message || e));
      this.addLog("error", `エラー: ${this.error.line ? this.error.plain : this.error.message}`, this.error.line); // 行番号はログの「（N行目）」で1回だけ出す
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
      this.stmtsThisTick++;
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
      // 1周のあいだに「待つ」で時間が進んでいればそのまま次へ。進んでいなければ0.1秒進める
      // （「待つ」のないくり返しが一瞬で何万回も回らないようにするため）
      const passed = this.tickN > (this.loopStart.get(v.id) ?? -1);
      this.loopStart.set(v.id, passed ? this.tickN : this.tickN + 1);
      return passed ? "continue" : "tick";
    }
    return "continue";
  }

  // 0.1秒ぶん進める（ふつうの実行）
  tick() {
    if (!this.inTick) this.beginTick();
    if (this.alive && this.tickN >= this.wakeTick) {
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
    return this.endTick();
  }

  // ステップ実行: 次の文の手前まで進める（待っている間は時間を進める）
  step() {
    for (let guard = 0; guard < 100000; guard++) {
      if (!this.inTick) this.beginTick();
      if (this.alive && this.tickN >= this.wakeTick) {
        const k = this.pull();
        if (k === "stmt") return this.lastSample;
        if (k === "continue") continue;
        this.endTick();
        if (k === "end") return this.lastSample;
        continue;
      }
      this.endTick();
      if (!this.alive) return this.lastSample;
    }
    return this.lastSample;
  }

  waiting() {
    return this.alive && this.tickN < this.wakeTick ? (this.wakeTick - this.tickN) * DT : 0;
  }
}

// ---------------- 合否の判定 ----------------
// 条件: ["名前", "演算子", 値] / { all: [...] } / { any: [...] } / { not: 条件 }
export function condHolds(c, s) {
  if (Array.isArray(c)) {
    const [name, op, v] = c;
    const a = s[name];
    switch (op) {
      case "==":
        return a == v; // eslint-disable-line eqeqeq
      case "!=":
        return a != v; // eslint-disable-line eqeqeq
      case "<":
        return a < v;
      case "<=":
        return a <= v;
      case ">":
        return a > v;
      case ">=":
        return a >= v;
      case "in":
        return v.includes(a);
    }
    throw new Error(`不明な演算子 ${op}`);
  }
  if (c.all) return c.all.every((x) => condHolds(x, s));
  if (c.any) return c.any.some((x) => condHolds(x, s));
  if (c.not) return !condHolds(c.not, s);
  throw new Error("不明な条件");
}

// {t} や {ドアの開き} のように、{} の中の名前をその値に置きかえる
const fill = (msg, vars) => msg.replace(/\{([^{}\s]+)\}/g, (_, k) => (k in vars ? (typeof vars[k] === "number" ? fmt(vars[k]) : vars[k]) : `{${k}}`));

function makeChecker(check) {
  const from = check.from ?? 0;
  const to = check.to ?? Infinity;
  const inWin = (t) => t >= from - 1e-9 && t <= to + 1e-9;
  let fail = null;
  const failAt = (t, extra = {}) => {
    if (!fail) fail = { t, msg: fill(check.msg, { t, ...extra }) };
  };
  switch (check.type) {
    case "always": {
      let since = null;
      return {
        feed(s) {
          if (!inWin(s.t)) return;
          const w = check.when ? condHolds(check.when, s) : true;
          if (!w) {
            since = null;
            return;
          }
          if (since === null) since = s.t;
          if (s.t - since + 1e-9 >= (check.delay || 0) && !condHolds(check.expect, s)) failAt(s.t, s); // 文に、そのときの値を入れられる
        },
        result: () => fail,
      };
    }
    case "transitions": {
      let prev = null;
      return {
        feed(s) {
          if (!inWin(s.t)) return;
          const v = s[check.of];
          if (check.ignore && check.ignore.includes(v)) return; // 「そのほか」などは飛ばして、前後の切りかわりだけを見る
          if (prev !== null && v !== prev && !check.allowed.some(([a, b]) => a === prev && b === v)) failAt(s.t, { a: prev, b: v });
          prev = v;
        },
        result: () => fail,
      };
    }
    case "minDuration": {
      let start = null;
      return {
        feed(s) {
          const on = s[check.of] === check.value;
          if (on && start === null) start = s.t;
          if (!on && start !== null) {
            const len = s.t - start;
            if (len + 1e-9 < check.min && inWin(start)) failAt(s.t, { len });
            start = null;
          }
        },
        result: () => fail,
      };
    }
    case "visits": {
      const seen = new Set();
      return {
        feed(s) {
          if (inWin(s.t)) seen.add(s[check.of]);
        },
        result: () => {
          const missing = check.values.filter((v) => !seen.has(v));
          return missing.length ? { t: null, msg: fill(check.msg, { missing: missing.join("・") }) } : null;
        },
      };
    }
    case "respond": {
      let prevTrig = false;
      const pending = [];
      let lastT = 0;
      return {
        feed(s) {
          lastT = s.t;
          const trig = condHolds(check.trigger, s);
          if (trig && !prevTrig && inWin(s.t)) pending.push(s.t);
          prevTrig = trig;
          if (pending.length && condHolds(check.expect, s)) pending.length = 0;
          if (pending.length && s.t - pending[0] > check.within + 1e-9) {
            failAt(s.t, { start: pending[0] });
            pending.length = 0;
          }
        },
        result: () => fail || (pending.length && lastT - pending[0] >= check.within - 1e-9 ? { t: lastT, msg: fill(check.msg, { start: pending[0], t: lastT }) } : null),
      };
    }
    case "at": {
      let done = false;
      return {
        feed(s) {
          if (done || s.t + 1e-9 < check.t) return;
          done = true;
          if (!condHolds(check.expect, s)) failAt(s.t);
        },
        result: () => fail || (done ? null : { t: null, msg: fill(check.msg, { t: check.t }) }),
      };
    }
  }
  throw new Error(`不明な確認の種類 ${check.type}`);
}

// 1つのテストケースを最初から最後まで実行して判定する
export function runTest(model, program, test) {
  const sim = new Sim(model, program, { timeline: test.timeline || {} });
  const checkers = test.checks.map((c) => ({ check: c, ch: makeChecker(c) }));
  const n = Math.round(test.duration / DT);
  for (let i = 0; i <= n; i++) {
    const s = sim.tick();
    for (const { ch } of checkers) ch.feed(s);
  }
  // 理由は時刻の順に並べる（時刻のないものは最後）
  const failures = checkers
    .map(({ check, ch }) => ({ check, fail: ch.result() }))
    .filter((x) => x.fail)
    .sort((a, b) => (a.fail.t ?? 1e9) - (b.fail.t ?? 1e9));
  if (sim.error) failures.unshift({ check: null, fail: { t: null, msg: `プログラムのエラー: ${sim.error.message}` } });
  return { pass: failures.length === 0, failures: failures.map((f) => f.fail), samples: sim.samples, log: sim.log };
}

export function runAllTests(model, program, tests) {
  return tests.map((test) => ({ test, ...runTest(model, program, test) }));
}
