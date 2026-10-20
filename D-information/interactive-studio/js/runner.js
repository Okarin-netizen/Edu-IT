// 実行の制御: 普通に実行・ゆっくり・1つずつ（ステップ実行）・一時停止・停止・ブレークポイント。
// 少しずつ実行して画面に返すので、無限ループでも画面は固まらない。時間・歩数の上限で自動的に止める。
import { parse, LangError } from "./lang.js";
import { Interp, RunError } from "./interp.js";

export const RUN_LIMITS = { maxSteps: 2_000_000, maxActiveMs: 4000, sliceMs: 12, netMs: 250, queue: 20 };

const nextTick = (() => {
  if (typeof MessageChannel === "undefined") return (fn) => setTimeout(fn, 0);
  const ch = new MessageChannel();
  const q = [];
  ch.port1.onmessage = () => q.shift()?.();
  return (fn) => {
    q.push(fn);
    ch.port2.postMessage(0);
  };
})();

export class Runner {
  // host: interp の host に加えて request(y, done) / cancelRequest() / net(op, box)
  constructor({ code, host, workTitle, onEvent = () => {} }) {
    this.code = code;
    this.host = host;
    this.workTitle = workTitle;
    this.emit = onEvent;
    this.state = "idle";
    this.mode = "run";
    this.delay = 400;
    this.breakpoints = new Set();
    this.queue = [];
    this.line = 0;
    this.gen = null;
    this.timer = null;
    this.serial = 0;
  }

  setState(s) {
    this.state = s;
    this.emit("state", s);
  }

  // 実行を始める。構文の誤りがあれば false
  start(mode = "run") {
    this.stop(true);
    this.mode = mode;
    let program;
    try {
      program = parse(this.code);
    } catch (e) {
      if (e instanceof LangError) {
        this.fail(e);
        return false;
      }
      throw e;
    }
    this.interp = new Interp(program, this.host, { workTitle: this.workTitle });
    this.host.clear();
    this.host.resetParts?.();
    this.emit("vars", this.interp.vars);
    this.begin(this.interp.main());
    return true;
  }

  begin(gen) {
    this.gen = gen;
    this.resume = undefined;
    this.resetBudget();
    this.setState("running");
    this.pump();
  }

  resetBudget() {
    this.steps = 0;
    this.activeMs = 0;
  }

  get handlerIds() {
    return this.interp ? [...this.interp.handlers.keys()] : [];
  }

  pump() {
    if (this.state !== "running" || !this.gen) return;
    const serial = ++this.serial;
    const t0 = performance.now();
    try {
      while (true) {
        const r = this.gen.next(this.resume);
        this.resume = undefined;
        if (r.done) return this.segmentDone();
        const y = r.value;
        if (y.k === "step") {
          this.line = y.line;
          if (++this.steps > RUN_LIMITS.maxSteps) throw new RunError(`命令を ${RUN_LIMITS.maxSteps.toLocaleString()} 回実行しても終わらないので、止めました。終わらないくり返し（無限ループ）かもしれません。くり返しが終わる条件を確かめよう。`, y.line);
          const used = this.activeMs + (performance.now() - t0);
          if (used > RUN_LIMITS.maxActiveMs) throw new RunError(`${RUN_LIMITS.maxActiveMs / 1000}秒たっても終わらないので、止めました。終わらないくり返し（無限ループ）になっていないか確かめよう。`, y.line);
          if (this.breakpoints.has(y.line) && this.mode !== "step") {
            this.activeMs = used;
            this.emit("break", y.line);
            return this.pauseHere();
          }
          if (this.mode === "step" || this.pauseRequested) {
            this.activeMs = used;
            return this.pauseHere();
          }
          if (this.mode === "slow") {
            this.activeMs = used;
            this.emit("line", y.line);
            this.emit("vars", this.interp.vars);
            this.timer = setTimeout(() => this.pump(), this.delay);
            return;
          }
          if (performance.now() - t0 > RUN_LIMITS.sliceMs) {
            this.activeMs = used;
            this.emit("line", y.line);
            this.emit("vars", this.interp.vars);
            nextTick(() => serial === this.serial && this.pump());
            return;
          }
        } else if (y.k === "ask" || y.k === "choose") {
          this.emit("vars", this.interp.vars);
          this.emit("line", this.line);
          this.setState("waiting");
          this.host.request(y, (value) => {
            if (this.state !== "waiting") return;
            this.resume = value;
            this.resetBudget();
            this.setState("running");
            this.pump();
          });
          return;
        } else if (y.k === "wait" || y.k === "net") {
          this.activeMs += performance.now() - t0;
          this.emit("vars", this.interp.vars);
          if (y.k === "net") this.host.net?.(y.op, y.box);
          this.timer = setTimeout(() => {
            if (y.k === "wait") this.resetBudget();
            this.pump();
          }, y.k === "wait" ? y.ms : RUN_LIMITS.netMs);
          return;
        }
      }
    } catch (e) {
      if (e instanceof RunError || e instanceof LangError) return this.fail(e);
      if (e instanceof RangeError) return this.fail(new RunError("入れ子が深すぎます。", this.line));
      throw e;
    }
  }

  pauseHere() {
    this.pauseRequested = false;
    this.emit("line", this.line);
    this.emit("vars", this.interp.vars);
    this.setState("paused");
  }

  segmentDone() {
    this.gen = null;
    this.emit("vars", this.interp.vars);
    this.emit("line", 0);
    if (this.queue.length) {
      const id = this.queue.shift();
      return this.begin(this.interp.handler(id));
    }
    this.setState(this.interp.handlers.size ? "listening" : "done");
  }

  fail(e) {
    clearTimeout(this.timer);
    this.gen = null;
    this.queue = [];
    this.host.cancelRequest?.();
    this.emit("error", { message: e.message, line: e.line || 0 });
    this.emit("line", e.line || 0);
    if (this.interp) this.emit("vars", this.interp.vars);
    this.setState("error");
  }

  // ボタンが押された
  click(id) {
    if (!this.interp || !this.interp.handlers.has(id)) return false;
    if (this.state === "listening") {
      this.begin(this.interp.handler(id));
      return true;
    }
    if (["running", "paused", "waiting"].includes(this.state) && this.queue.length < RUN_LIMITS.queue) {
      this.queue.push(id);
      return true;
    }
    return false;
  }

  // 1つ進む（止まっているとき）
  step() {
    if (this.state !== "paused") return;
    this.mode = "step";
    this.setState("running");
    this.pump();
  }

  // 続きを実行する
  continue(mode = "run") {
    if (this.state !== "paused") return;
    this.mode = mode;
    this.setState("running");
    this.pump();
  }

  pause() {
    if (this.state === "running") this.pauseRequested = true;
  }

  setMode(mode) {
    this.mode = mode;
  }

  stop(silent = false) {
    clearTimeout(this.timer);
    this.serial++;
    this.pauseRequested = false;
    if (this.gen) {
      try {
        this.gen.return();
      } catch {
        /* 止めるときの後始末だけなので無視 */
      }
    }
    this.gen = null;
    this.queue = [];
    this.host.cancelRequest?.();
    if (!silent && this.state !== "idle") {
      this.emit("line", 0);
      this.setState("stopped");
    }
  }
}
