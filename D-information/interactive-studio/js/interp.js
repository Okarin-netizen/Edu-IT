// インタプリタ: lang.js が作った木を、ジェネレーターで1文ずつ評価する。
// 文を実行する前に必ず { k: "step" } を返すので、ステップ実行・一時停止・時間制限ができる。
// 生徒のプログラムが触れられるのは、下の BUILTINS にある命令だけ（ページや通信には触れられない）。

export class RunError extends Error {
  constructor(message, line) {
    super(message);
    this.line = line;
  }
}

export const LIMITS = { maxString: 20000, maxList: 10000, maxChoices: 12, maxWaitSec: 60 };

class BreakSignal {}

// ---- 値のあつかい ----
export function formatNumber(n) {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toPrecision(12)));
}

// リストの中に自分自身が入っている（push(a, a) など）ときは […] と出す（そのままだと終わらない）
function listText(v, each, seen) {
  if (seen.has(v)) return "[…]";
  seen.add(v);
  const s = "[" + v.map((x) => each(x, seen)).join(", ") + "]";
  seen.delete(v);
  return s;
}

export function toText(v, seen = new Set()) {
  if (typeof v === "number") return formatNumber(v);
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return listText(v, toText, seen);
  if (v === null || v === undefined) return "";
  return String(v);
}

// 変数ウォッチ用の表示（文字は " でかこむ）
export function toDisplay(v, seen = new Set()) {
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return listText(v, toDisplay, seen);
  return toText(v);
}

export function typeName(v) {
  if (typeof v === "number") return "数";
  if (typeof v === "string") return "文字";
  if (typeof v === "boolean") return "はい／いいえ（true / false）";
  if (Array.isArray(v)) return "リスト";
  return "なし";
}

const NUM_RE = /^[-+]?\d+(\.\d+)?$/;
// 入力された文字が数字だけなら数として受け取る（全角数字もOK）
export function autoNumber(s) {
  const t = String(s).trim();
  const n = t.normalize("NFKC");
  return NUM_RE.test(n) ? Number(n) : t;
}

function numericString(v) {
  if (typeof v !== "string") return null;
  const n = v.trim().normalize("NFKC");
  return NUM_RE.test(n) ? Number(n) : null;
}

export function equals(a, b) {
  if (typeof a === typeof b) {
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equals(x, b[i]));
    return a === b;
  }
  if (typeof a === "number" && typeof b === "string") return numericString(b) === a;
  if (typeof b === "number" && typeof a === "string") return numericString(a) === b;
  return false;
}

const short = (v) => {
  const s = toText(v);
  return s.length > 20 ? s.slice(0, 20) + "…" : s;
};

function asNumber(v, what, line) {
  if (typeof v === "number") return v;
  const n = numericString(v);
  if (n !== null) return n;
  if (typeof v === "string") throw new RunError(`「${short(v)}」は数ではないので、${what}できません。`, line);
  if (Array.isArray(v)) throw new RunError(`リストは、そのままでは${what}できません。`, line);
  throw new RunError(`${toText(v)} は数ではないので、${what}できません。`, line);
}

function asBool(v, where, line) {
  if (typeof v === "boolean") return v;
  throw new RunError(`${where}の条件が「${short(v)}」になっています。条件は、正しいか正しくないか（true か false）が決まる式にしましょう（例: score > 3、answer == "はい"）。`, line);
}

function checkString(s, line) {
  if (s.length > LIMITS.maxString) throw new RunError(`文字が長くなりすぎました（${LIMITS.maxString}文字まで）。くり返しで文字をつなげすぎていないか確かめよう。`, line);
  return s;
}

function checkList(list, line) {
  if (list.length > LIMITS.maxList) throw new RunError(`リストが長くなりすぎました（${LIMITS.maxList}個まで）。`, line);
  return list;
}

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export function suggest(name, candidates) {
  let best = null;
  let bestD = 3;
  for (const c of candidates) {
    const dist = editDistance(name.toLowerCase(), c.toLowerCase());
    if (dist < bestD && dist <= Math.max(1, Math.floor(c.length / 3))) {
      best = c;
      bestD = dist;
    }
  }
  return best;
}

function textArg(v, what, line) {
  if (typeof v !== "string" || !v.trim()) throw new RunError(`${what}は "名前" のように文字で書きます。`, line);
  return v.trim();
}

// ---- 命令の一覧（ヘルプ画面にもこのまま出る） ----
// gen: true の命令は、画面への入力待ちなどのために途中で止まる
export const BUILTINS = {
  show: { cat: "表示と入力", args: [1, 1], sig: "show(値)", help: "値を画面に1行表示する", fn: (ctx, [v]) => ctx.host.output(toText(v)) },
  clear: { cat: "表示と入力", args: [0, 0], sig: "clear()", help: "表示をすべて消す", fn: (ctx) => ctx.host.clear() },
  ask: {
    cat: "表示と入力",
    args: [1, 1],
    sig: "ask(質問)",
    help: "質問を出し、入力された答えを返す（数字だけなら数になる）",
    gen: true,
    *fn(ctx, [q]) {
      const v = yield { k: "ask", prompt: toText(q) };
      return autoNumber(v ?? "");
    },
  },
  choose: {
    cat: "表示と入力",
    args: [2, LIMITS.maxChoices + 1],
    sig: "choose(質問, 選択肢1, 選択肢2, …)",
    help: "質問とボタンを出し、選ばれた選択肢を返す。選択肢はリストでもよい",
    gen: true,
    *fn(ctx, [q, ...opts], line) {
      if (opts.length === 1 && Array.isArray(opts[0])) opts = opts[0];
      if (opts.length < 1) throw new RunError("choose の選択肢が空です。", line);
      if (opts.length > LIMITS.maxChoices) throw new RunError(`choose の選択肢は${LIMITS.maxChoices}個までです。`, line);
      const i = yield { k: "choose", prompt: toText(q), options: opts.map((o) => toText(o)) };
      return opts[Math.max(0, Math.min(opts.length - 1, Number(i) || 0))];
    },
  },
  wait: {
    cat: "表示と入力",
    args: [1, 1],
    sig: "wait(秒)",
    help: "指定した秒数だけ待つ",
    gen: true,
    *fn(ctx, [s], line) {
      const sec = asNumber(s, "待つ秒数に", line);
      if (sec < 0 || sec > LIMITS.maxWaitSec) throw new RunError(`待つ秒数は 0〜${LIMITS.maxWaitSec} にしましょう。`, line);
      yield { k: "wait", ms: sec * 1000 };
    },
  },
  setText: {
    cat: "画面の部品",
    args: [2, 2],
    sig: 'setText("部品名", 値)',
    help: "ラベル・ボタン・入力ボックスの文字を変える",
    fn: (ctx, [id, v], line) => ctx.part(id, line).setText(toText(v)),
  },
  getText: {
    cat: "画面の部品",
    args: [1, 1],
    sig: 'getText("部品名")',
    help: "部品の文字（入力ボックスなら入力された内容）を返す",
    fn: (ctx, [id], line) => autoNumber(ctx.part(id, line).getText()),
  },
  random: {
    cat: "計算",
    args: [2, 2],
    sig: "random(最小, 最大)",
    help: "最小〜最大の整数を1つ、でたらめに返す",
    fn: (ctx, [a, b], line) => {
      let lo = Math.ceil(asNumber(a, "random に", line));
      let hi = Math.floor(asNumber(b, "random に", line));
      if (lo > hi) [lo, hi] = [hi, lo];
      return lo + Math.floor(ctx.random() * (hi - lo + 1));
    },
  },
  round: { cat: "計算", args: [1, 1], sig: "round(数)", help: "四捨五入して整数にする", fn: (ctx, [v], line) => Math.round(asNumber(v, "四捨五入", line)) },
  number: { cat: "計算", args: [1, 1], sig: "number(値)", help: "文字を数に変える", fn: (ctx, [v], line) => asNumber(v, "数に変換", line) },
  text: { cat: "計算", args: [1, 1], sig: "text(値)", help: "値を文字に変える", fn: (ctx, [v]) => toText(v) },
  length: {
    cat: "リスト",
    args: [1, 1],
    sig: "length(リストか文字)",
    help: "リストの個数、または文字数を返す",
    fn: (ctx, [v], line) => {
      if (Array.isArray(v) || typeof v === "string") return v.length;
      throw new RunError("length にはリストか文字をわたします。", line);
    },
  },
  push: {
    cat: "リスト",
    args: [2, 2],
    sig: "push(リスト, 値)",
    help: "リストの最後に値を追加する",
    fn: (ctx, [list, v], line) => {
      if (!Array.isArray(list)) throw new RunError("push の1つ目にはリストをわたします（例: let names = []; push(names, \"たろう\")）。", line);
      list.push(v);
      checkList(list, line);
    },
  },
  includes: {
    cat: "リスト",
    args: [2, 2],
    sig: "includes(リストか文字, 値)",
    help: "値がふくまれていれば true を返す",
    fn: (ctx, [hay, v], line) => {
      if (Array.isArray(hay)) return hay.some((x) => equals(x, v));
      if (typeof hay === "string") return hay.includes(toText(v));
      throw new RunError("includes の1つ目にはリストか文字をわたします。", line);
    },
  },
  "server.save": {
    cat: "サーバー",
    args: [2, 2],
    sig: 'server.save("箱の名前", 値)',
    help: "サーバーの箱に値を保存する（アンケートの回答など）",
    gen: true,
    *fn(ctx, [name, v], line) {
      const box = textArg(name, "サーバーの箱の名前", line);
      if (Array.isArray(v)) throw new RunError("サーバーに保存できるのは数か文字です。", line);
      yield { k: "net", op: "save", box };
      return ctx.host.server.save(ctx.workTitle, box, v);
    },
  },
  "server.count": {
    cat: "サーバー",
    args: [1, 2],
    sig: 'server.count("箱の名前", 値)',
    help: "箱の中で値と同じものの件数を返す（値を省くと全部の件数）",
    gen: true,
    *fn(ctx, [name, ...v], line) {
      const box = textArg(name, "サーバーの箱の名前", line);
      yield { k: "net", op: "count", box };
      return ctx.host.server.count(ctx.workTitle, box, v.length ? v[0] : undefined, equals);
    },
  },
  "server.list": {
    cat: "サーバー",
    args: [1, 1],
    sig: 'server.list("箱の名前")',
    help: "箱に保存された値を、古い順のリストで返す",
    gen: true,
    *fn(ctx, [name], line) {
      const box = textArg(name, "サーバーの箱の名前", line);
      yield { k: "net", op: "list", box };
      return ctx.host.server.list(ctx.workTitle, box).slice(-LIMITS.maxList);
    },
  },
  "server.addScore": {
    cat: "サーバー",
    args: [3, 3],
    sig: 'server.addScore("箱の名前", 名前, 得点)',
    help: "ランキングの箱に、名前と得点を登録する",
    gen: true,
    *fn(ctx, [name, player, score], line) {
      const box = textArg(name, "サーバーの箱の名前", line);
      const s = asNumber(score, "得点として登録", line);
      yield { k: "net", op: "addScore", box };
      return ctx.host.server.addScore(ctx.workTitle, box, toText(player).trim() || "（名なし）", s);
    },
  },
  "server.ranking": {
    cat: "サーバー",
    args: [1, 2],
    sig: 'server.ranking("箱の名前", 人数)',
    help: "得点の高い順に「1位 名前 得点」のリストを返す（人数を省くと5人）",
    gen: true,
    *fn(ctx, [name, n], line) {
      const box = textArg(name, "サーバーの箱の名前", line);
      const k = n === undefined ? 5 : Math.max(1, Math.min(100, Math.floor(asNumber(n, "人数に", line))));
      yield { k: "net", op: "ranking", box };
      return ctx.host.server.ranking(ctx.workTitle, box, k).map((r, i) => `${i + 1}位 ${r.name} ${formatNumber(r.score)}点`);
    },
  },
};

export class Interp {
  // host: { output, clear, part(id) -> {setText, getText} | null, partIds(), server }
  constructor(program, host, { workTitle = "", random = Math.random } = {}) {
    this.program = program;
    this.host = host;
    this.workTitle = workTitle;
    this.random = random;
    this.vars = new Map();
    this.handlers = new Map();
    this.line = 0;
    this.loopDepth = 0;
    for (const s of program.body) if (s.type === "when" && !this.handlers.has(s.target)) this.handlers.set(s.target, s);
  }

  part(id, line) {
    const name = textArg(id, "部品の名前", line);
    const p = this.host.part(name);
    if (p) return p;
    const ids = this.host.partIds();
    const hint = suggest(name, ids);
    throw new RunError(
      `部品「${name}」が画面にありません。` + (hint ? `もしかして「${hint}」？` : ids.length ? `今ある部品: ${ids.join("、")}` : "実行タブで部品を追加しましょう。"),
      line,
    );
  }

  *main() {
    yield* this.runTop(this.program.body.filter((s) => s.type !== "when"));
  }

  *handler(id) {
    const h = this.handlers.get(id);
    if (h) yield* this.runTop(h.body);
  }

  *runTop(list) {
    try {
      yield* this.execList(list);
    } catch (e) {
      if (e instanceof BreakSignal) throw new RunError("break（くり返しをぬける）は、くり返しの中で使います。", this.line);
      throw e;
    }
  }

  *execList(list) {
    for (const s of list) yield* this.exec(s);
  }

  *exec(s) {
    if (s.type === "comment") return;
    this.line = s.line;
    yield { k: "step", line: s.line };
    switch (s.type) {
      case "set": {
        if (s.expr === null) {
          if (!this.vars.has(s.name)) this.vars.set(s.name, 0);
          return;
        }
        const v = yield* this.ev(s.expr);
        this.line = s.line;
        if (s.op === "=") this.vars.set(s.name, v);
        else {
          const cur = this.getVar(s.name, s.line);
          this.vars.set(s.name, this.arith(s.op === "+=" ? "+" : "-", cur, v, s.line));
        }
        return;
      }
      case "setitem": {
        const list = this.getVar(s.name, s.line);
        const idx = yield* this.ev(s.index);
        const v = yield* this.ev(s.expr);
        const i = this.indexOf(list, idx, s.line, true);
        list[i] = s.op === "=" ? v : this.arith(s.op === "+=" ? "+" : "-", list[i], v, s.line);
        return;
      }
      case "if": {
        const c = asBool(yield* this.ev(s.cond), "もし", s.line);
        if (c) yield* this.execList(s.then);
        else if (s.else) yield* this.execList(s.else);
        return;
      }
      case "while": {
        this.loopDepth++;
        try {
          while (asBool(yield* this.ev(s.cond), "くり返し", s.line)) {
            yield* this.execList(s.body);
            this.line = s.line;
            yield { k: "step", line: s.line };
          }
        } catch (e) {
          if (!(e instanceof BreakSignal)) throw e;
        } finally {
          this.loopDepth--;
        }
        return;
      }
      case "repeat": {
        const n = asNumber(yield* this.ev(s.count), "くり返す回数に", s.line);
        if (n < 0 || !Number.isFinite(n)) throw new RunError("くり返す回数は 0 以上の数にしましょう。", s.line);
        this.loopDepth++;
        try {
          for (let i = 0; i < Math.floor(n); i++) {
            if (i > 0) {
              this.line = s.line;
              yield { k: "step", line: s.line };
            }
            yield* this.execList(s.body);
          }
        } catch (e) {
          if (!(e instanceof BreakSignal)) throw e;
        } finally {
          this.loopDepth--;
        }
        return;
      }
      case "break":
        if (this.loopDepth === 0) throw new RunError("break（くり返しをぬける）は、くり返しの中で使います。", s.line);
        throw new BreakSignal();
      case "expr":
        yield* this.ev(s.expr);
        return;
      case "when":
        return;
    }
  }

  getVar(name, line) {
    if (this.vars.has(name)) return this.vars.get(name);
    if (BUILTINS[name]) throw new RunError(`${name} は命令なので、${name}( ) のように ( ) を付けて使います。`, line);
    const hint = suggest(name, [...this.vars.keys()]);
    if (hint) throw new RunError(`変数「${name}」にはまだ値が入っていません。もしかして「${hint}」？`, line);
    // 日本語の名前は、" " の付け忘れであることが多い（IS-06）
    if (/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]/u.test(name)) {
      throw new RunError(`「${name}」は変数の名前として読まれました。文字として使うときは "${name}" のように " でかこもう。`, line);
    }
    throw new RunError(`変数「${name}」にはまだ値が入っていません。先に ${name} = 0; のように値を入れましょう。`, line);
  }

  indexOf(list, idx, line, forWrite) {
    if (!Array.isArray(list) && !(typeof list === "string" && !forWrite)) throw new RunError(forWrite ? "[ ] で書きかえられるのはリストだけです。" : "[ ] で取り出せるのはリストか文字だけです。", line);
    const i = asNumber(idx, "番号に", line);
    if (!Number.isInteger(i)) throw new RunError("リストの番号は整数にしましょう。", line);
    if (i < 0 || i >= list.length)
      throw new RunError(`${list.length === 0 ? "空のリスト" : `長さ ${list.length} のリスト`}に ${i} 番はありません。番号は 0 から ${Math.max(0, list.length - 1)} までです（0から数えます）。`, line);
    return i;
  }

  arith(op, a, b, line) {
    if (op === "+") {
      if (typeof a === "number" && typeof b === "number") return a + b;
      if (Array.isArray(a) || Array.isArray(b)) throw new RunError("リストに + は使えません。追加するときは push(リスト, 値) を使います。", line);
      if (typeof a === "string" || typeof b === "string") return checkString(toText(a) + toText(b), line);
      throw new RunError(`${toText(a)} と ${toText(b)} は足せません。`, line);
    }
    const names = { "-": "ひき算", "*": "かけ算", "/": "わり算", "%": "わり算のあまりを計算" };
    const x = asNumber(a, names[op], line);
    const y = asNumber(b, names[op], line);
    if (op === "-") return x - y;
    if (op === "*") return x * y;
    if (y === 0) throw new RunError("0 でわることはできません。", line);
    return op === "/" ? x / y : x % y;
  }

  *ev(e) {
    switch (e.type) {
      case "num":
      case "str":
      case "bool":
        return e.v;
      case "var":
        return this.getVar(e.name, e.line);
      case "list": {
        const out = [];
        for (const it of e.items) out.push(yield* this.ev(it));
        return checkList(out, e.line);
      }
      case "index": {
        const obj = yield* this.ev(e.obj);
        const idx = yield* this.ev(e.idx);
        return obj[this.indexOf(obj, idx, e.line, false)];
      }
      case "un": {
        const v = yield* this.ev(e.e);
        if (e.op === "-") return -asNumber(v, "マイナスに", e.line);
        return !asBool(v, "not", e.line);
      }
      case "bin": {
        if (e.op === "and" || e.op === "or") {
          const l = asBool(yield* this.ev(e.l), e.op === "and" ? "and" : "or", e.line);
          if (e.op === "and" ? !l : l) return l;
          return asBool(yield* this.ev(e.r), e.op === "and" ? "and" : "or", e.line);
        }
        const l = yield* this.ev(e.l);
        const r = yield* this.ev(e.r);
        switch (e.op) {
          case "==":
            return equals(l, r);
          case "!=":
            return !equals(l, r);
          case "<":
          case ">":
          case "<=":
          case ">=": {
            let a = l;
            let b = r;
            if (!(typeof a === "string" && typeof b === "string" && numericString(a) === null && numericString(b) === null)) {
              a = asNumber(a, "大きさを比べることが", e.line);
              b = asNumber(b, "大きさを比べることが", e.line);
            }
            return e.op === "<" ? a < b : e.op === ">" ? a > b : e.op === "<=" ? a <= b : a >= b;
          }
          default:
            return this.arith(e.op, l, r, e.line);
        }
      }
      case "call": {
        const b = BUILTINS[e.name];
        if (!b) {
          const hint = suggest(e.name, Object.keys(BUILTINS));
          throw new RunError(`「${e.name}」という命令はありません。` + (hint ? `もしかして「${hint}」？` : "ヘルプで命令の一覧を見てみよう。"), e.line);
        }
        const [min, max] = b.args;
        if (e.args.length < min || e.args.length > max)
          throw new RunError(`${e.name} には値を${min === max ? `${min}つ` : `${min}〜${max}つ`}わたします（今は${e.args.length}つ）。書き方: ${b.sig}`, e.line);
        const args = [];
        for (const a of e.args) args.push(yield* this.ev(a));
        this.line = e.line;
        if (b.gen) return yield* b.fn(this, args, e.line);
        return b.fn(this, args, e.line);
      }
    }
    throw new RunError("よくわからない式です。", e.line);
  }
}
