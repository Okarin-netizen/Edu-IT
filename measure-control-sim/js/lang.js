// 簡易テキスト言語（日本語）: テキスト ⇔ プログラムの木（AST）の相互変換と、式の計算
//
// 書き方の例:
//   ずっと
//     もし 明るさ < 30 なら
//       街灯 = オン
//     でなければ
//       街灯 = オフ
//     おわり
//     0.5 秒待つ
//   おわり
//
// 文: ずっと / N 回くり返す / 条件 のあいだくり返す / もし 条件 なら … でなければ … / おわり
//     N 秒待つ / 名前 = 式 / # コメント

export const CONSTANTS = { オン: 1, オフ: 0, 開く: 1, 閉じる: -1, 止める: 0 };

let nextId = 1;
export function newId() {
  return nextId++;
}

export class LangError extends Error {
  constructor(message, line) {
    super(line ? `${line}行目: ${message}` : message);
    this.line = line;
    this.plain = message;
  }
}

// ---- 字句解析 ----
const OPS = ["<=", ">=", "==", "!=", "<", ">", "=", "+", "-", "*", "/", "%", "(", ")"];
const WORD_OPS = ["かつ", "または"];
const STOP = new Set([..." \t<>=!+-*/%()\"「」"]);

export function normalize(s) {
  return String(s)
    .normalize("NFKC")
    .replace(/[≦≤]/g, "<=")
    .replace(/[≧≥]/g, ">=")
    .replace(/≠/g, "!=")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–ー](?=\d)/g, (m, i, all) => (i === 0 || /[\s(=<>+*/%-]/.test(all[i - 1]) ? "-" : m));
}

// ブロックの数の欄: 生徒が実際に入れる形（全角・空白・「1,000」・「150cm」「2秒」など）をそろえる。
// 数（とうしろの単位）だけなら、その数の文字列（例: "150"）を返す。数ではないときは null（式として読む）。
const UNIT_RE = /^([+-]?(?:\d+\.?\d*|\.\d+))(cm|センチメートル|センチ|°C|℃|度|秒|びょう|%|回|°)?$/i;
export function numberFieldText(v) {
  const s = String(v ?? "").normalize("NFKC").trim().replace(/\s+/g, "").replace(/,/g, "").replace(/^[−ー–]/, "-");
  const m = UNIT_RE.exec(s);
  return m ? m[1] : null;
}

export function tokenize(src, line) {
  const s = normalize(src);
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (/\d/.test(c) || (c === "." && /\d/.test(s[i + 1] || ""))) {
      const m = /^\d*\.?\d+|^\d+/.exec(s.slice(i));
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (c === '"' || c === "「") {
      const close = c === '"' ? '"' : "」";
      const j = s.indexOf(close, i + 1);
      if (j < 0) throw new LangError(`文字列の終わりの ${close} がありません`, line);
      out.push({ t: "str", v: s.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    const op = OPS.find((o) => s.startsWith(o, i));
    if (op) {
      out.push({ t: "op", v: op });
      i += op.length;
      continue;
    }
    if (c === "!") throw new LangError("「!」の使い方がちがいます（等しくないは != ）", line);
    const w = WORD_OPS.find((o) => s.startsWith(o, i));
    if (w) {
      out.push({ t: "op", v: w });
      i += w.length;
      continue;
    }
    let j = i;
    while (j < s.length && !STOP.has(s[j]) && !WORD_OPS.some((o) => s.startsWith(o, j))) j++;
    out.push({ t: "name", v: s.slice(i, j) });
    i = j;
  }
  return out;
}

// ---- 式 ----
const PREC = { または: 1, かつ: 2, "<": 3, ">": 3, "<=": 3, ">=": 3, "==": 3, "!=": 3, "+": 4, "-": 4, "*": 5, "/": 5, "%": 5 };

export function parseExpr(src, line) {
  const toks = tokenize(src, line);
  if (!toks.length) throw new LangError("数か名前を入れよう", line);
  let p = 0;
  const peek = () => toks[p];
  function primary() {
    const t = toks[p++];
    if (!t) throw new LangError("式が途中で終わっています", line);
    if (t.t === "num") return { type: "num", value: t.v };
    if (t.t === "str") return { type: "str", value: t.v };
    if (t.t === "name") return { type: "name", name: t.v };
    if (t.t === "op" && t.v === "(") {
      const e = expr(0);
      const c = toks[p++];
      if (!c || c.v !== ")") throw new LangError("「)」が足りません", line);
      return e;
    }
    if (t.t === "op" && t.v === "-") return { type: "neg", arg: primary() };
    throw new LangError(`「${t.v}」の位置がおかしいです`, line);
  }
  function expr(minPrec) {
    let left = primary();
    for (;;) {
      const t = peek();
      if (!t || t.t !== "op" || t.v === "(" || t.v === ")") break;
      const op = t.v === "=" ? "==" : t.v; // 条件の中の「=」は「==」とみなす
      const prec = PREC[op];
      if (!prec || prec <= minPrec) break;
      p++;
      const right = expr(prec);
      left = { type: "bin", op, left, right };
    }
    return left;
  }
  const e = expr(0);
  if (p < toks.length) {
    const t = toks[p];
    if (t.t !== "op") throw new LangError(`「${t.v}」の前に記号（< や + など）が必要です`, line);
    throw new LangError(`「${t.v}」がよけいです`, line);
  }
  return e;
}

export function exprToText(e, parentPrec = 0, isRight = false) {
  switch (e.type) {
    case "num":
      return String(e.value);
    case "str":
      return `"${e.value}"`;
    case "name":
      return e.name;
    case "neg":
      return `-${exprToText(e.arg, 9)}`;
    case "bin": {
      const prec = PREC[e.op];
      const s = `${exprToText(e.left, prec)} ${e.op} ${exprToText(e.right, prec, true)}`;
      return prec < parentPrec || (isRight && prec === parentPrec) ? `(${s})` : s;
    }
  }
  return "?";
}

export function exprNames(e, out = new Set()) {
  if (!e) return out;
  if (e.type === "name") out.add(e.name);
  if (e.type === "bin") {
    exprNames(e.left, out);
    exprNames(e.right, out);
  }
  if (e.type === "neg") exprNames(e.arg, out);
  return out;
}

export const truthy = (v) => (typeof v === "string" ? v !== "" : Boolean(v) && !Number.isNaN(v));

export function evalExpr(e, get) {
  switch (e.type) {
    case "num":
    case "str":
      return e.value;
    case "name":
      return get(e.name);
    case "neg":
      return -toNum(evalExpr(e.arg, get));
    case "bin": {
      if (e.op === "かつ") return truthy(evalExpr(e.left, get)) && truthy(evalExpr(e.right, get)) ? 1 : 0;
      if (e.op === "または") return truthy(evalExpr(e.left, get)) || truthy(evalExpr(e.right, get)) ? 1 : 0;
      const a = evalExpr(e.left, get);
      const b = evalExpr(e.right, get);
      switch (e.op) {
        case "+":
          return typeof a === "string" || typeof b === "string" ? fmt(a) + fmt(b) : a + b;
        case "-":
          return toNum(a) - toNum(b);
        case "*":
          return toNum(a) * toNum(b);
        case "/":
        case "%":
          if (toNum(b) === 0) throw new LangError("0 で割ることはできません");
          return e.op === "/" ? toNum(a) / toNum(b) : toNum(a) % toNum(b);
        case "<":
          return a < b ? 1 : 0;
        case ">":
          return a > b ? 1 : 0;
        case "<=":
          return a <= b ? 1 : 0;
        case ">=":
          return a >= b ? 1 : 0;
        case "==":
          return a == b ? 1 : 0; // eslint-disable-line eqeqeq
        case "!=":
          return a != b ? 1 : 0; // eslint-disable-line eqeqeq
      }
    }
  }
  throw new LangError("計算できない式です");
}

function toNum(v) {
  if (typeof v === "number") return v;
  const n = Number(v);
  if (Number.isNaN(n)) throw new LangError(`「${v}」は数ではありません`);
  return n;
}

export function fmt(v) {
  if (typeof v !== "number") return String(v);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

// ---- 文 ----
const RE = {
  forever: /^ずっと(くり返す|繰り返す|くりかえす)?$/,
  repeat: /^(.+?)\s*回(くり返す|繰り返す|くりかえす)$/,
  while: /^(.+?)\s*の(あいだ|間)(くり返す|繰り返す|くりかえす)$/,
  if: /^もし\s*(.+?)\s*なら$/,
  else: /^(でなければ|そうでなければ|ちがえば)$/,
  end: /^(おわり|終わり|ここまで)$/,
  wait: /^(.+?)\s*秒(待つ|まつ)$/,
  assign: /^([^\s=<>!()"「」]+)\s*=(?!=)\s*(.+)$/,
};

export function parseProgram(text) {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const root = [];
  const stack = [{ list: root, node: null, line: 0 }];
  const errors = [];
  lines.forEach((raw, idx) => {
    const line = idx + 1;
    const s = normalize(raw).trim();
    if (!s) return;
    const top = stack[stack.length - 1];
    try {
      if (s.startsWith("#")) {
        top.list.push({ id: newId(), type: "comment", text: s.slice(1).trim(), line });
        return;
      }
      let m;
      if (RE.end.test(s)) {
        if (stack.length === 1) throw new LangError("「おわり」に対応する始まり（ずっと・もし など）がありません", line);
        stack.pop();
        return;
      }
      if (RE.else.test(s)) {
        if (!top.node || top.node.type !== "if" || top.inElse) throw new LangError("「でなければ」は「もし」の中でだけ使えます", line);
        top.node.else = [];
        top.list = top.node.else;
        top.inElse = true;
        return;
      }
      let node;
      if (RE.forever.test(s)) node = { type: "forever", body: [] };
      else if ((m = RE.if.exec(s))) node = { type: "if", cond: parseExpr(m[1], line), then: [], else: null };
      else if ((m = RE.while.exec(s))) node = { type: "while", cond: parseExpr(m[1], line), body: [] };
      else if ((m = RE.repeat.exec(s))) node = { type: "repeat", count: parseExpr(m[1], line), body: [] };
      else if ((m = RE.wait.exec(s))) node = { type: "wait", secs: parseExpr(m[1], line) };
      else if ((m = RE.assign.exec(s))) node = { type: "assign", name: m[1], value: parseExpr(m[2], line) };
      else if (/^もし/.test(s)) throw new LangError("「もし 条件 なら」の形で書きます", line);
      else if (/秒/.test(s)) throw new LangError("「3 秒待つ」の形で書きます", line);
      else if (/くり返す|繰り返す|くりかえす/.test(s)) throw new LangError("「ずっと」「5 回くり返す」「条件 のあいだくり返す」のどれかの形で書きます", line);
      else throw new LangError(`「${s}」の意味がわかりません`, line);
      node.id = newId();
      node.line = line;
      top.list.push(node);
      if (node.type === "if") stack.push({ list: node.then, node, line });
      else if (node.body) stack.push({ list: node.body, node, line });
    } catch (e) {
      if (e instanceof LangError) errors.push(e);
      else throw e;
    }
  });
  for (let i = stack.length - 1; i > 0; i--) {
    errors.push(new LangError(`${stack[i].line}行目の「${labelOf(stack[i].node)}」に対応する「おわり」が足りません`, lines.length));
  }
  return { program: root, errors };
}

function labelOf(node) {
  return { forever: "ずっと", repeat: "くり返す", while: "くり返す", if: "もし" }[node.type] || node.type;
}

// AST → テキスト。各文の行番号（line）も付け直す
export function programToText(program) {
  const out = [];
  const walk = (list, depth) => {
    const ind = "  ".repeat(depth);
    for (const n of list) {
      n.line = out.length + 1;
      switch (n.type) {
        case "comment":
          out.push(`${ind}# ${n.text}`);
          break;
        case "assign":
          out.push(`${ind}${n.name} = ${exprToText(n.value)}`);
          break;
        case "wait":
          out.push(`${ind}${exprToText(n.secs)} 秒待つ`);
          break;
        case "forever":
          out.push(`${ind}ずっと`);
          walk(n.body, depth + 1);
          out.push(`${ind}おわり`);
          break;
        case "repeat":
          out.push(`${ind}${exprToText(n.count)} 回くり返す`);
          walk(n.body, depth + 1);
          out.push(`${ind}おわり`);
          break;
        case "while":
          out.push(`${ind}${exprToText(n.cond)} のあいだくり返す`);
          walk(n.body, depth + 1);
          out.push(`${ind}おわり`);
          break;
        case "if":
          out.push(`${ind}もし ${exprToText(n.cond)} なら`);
          walk(n.then, depth + 1);
          if (n.else) {
            out.push(`${ind}でなければ`);
            walk(n.else, depth + 1);
          }
          out.push(`${ind}おわり`);
          break;
      }
    }
  };
  walk(program, 0);
  return out.join("\n");
}

export function walkProgram(list, fn) {
  for (const n of list) {
    fn(n);
    for (const k of ["body", "then", "else"]) if (Array.isArray(n[k])) walkProgram(n[k], fn);
  }
}

// グラフ用: 「明るさ < 30」のように、名前と数をくらべている所から、名前ごとのしきい値（数）を集める
const CMP_OPS = new Set(["<", "<=", ">", ">=", "==", "!="]);
export function thresholdsOf(program) {
  const out = {};
  const add = (name, v) => {
    out[name] ??= [];
    if (!out[name].includes(v)) out[name].push(v);
  };
  const num = (e) => (e.type === "num" ? e.value : e.type === "neg" && e.arg.type === "num" ? -e.arg.value : null);
  const visit = (e) => {
    if (!e || e.type !== "bin") return;
    if (CMP_OPS.has(e.op)) {
      if (e.left.type === "name" && num(e.right) !== null) add(e.left.name, num(e.right));
      if (e.right.type === "name" && num(e.left) !== null) add(e.right.name, num(e.left));
    }
    visit(e.left);
    visit(e.right);
  };
  walkProgram(program, (n) => visit(n.cond));
  for (const k in out) out[k].sort((a, b) => a - b);
  return out;
}

// プログラムで使っている名前を、場面の装置（センサ・出力）と照らし合わせる
// device: { sensors: [{name}], outputs: [{name}] }
export function validate(program, device) {
  const errors = [];
  const sensors = new Set(device.sensors.map((s) => s.name));
  const outputs = new Set(device.outputs.map((o) => o.name));
  const vars = new Set();
  walkProgram(program, (n) => {
    if (n.type !== "assign") return;
    if (sensors.has(n.name)) errors.push(new LangError(`「${n.name}」はセンサなので、値を入れることはできません（読むだけ）`, n.line));
    else if (n.name in CONSTANTS) errors.push(new LangError(`「${n.name}」は決まった言葉なので、変数の名前には使えません`, n.line));
    else if (/^\d/.test(n.name)) errors.push(new LangError(`変数の名前は数字で始められません`, n.line));
    else if (!outputs.has(n.name)) vars.add(n.name);
  });
  const known = (name) => sensors.has(name) || outputs.has(name) || vars.has(name) || name in CONSTANTS;
  walkProgram(program, (n) => {
    for (const k of ["value", "cond", "count", "secs"]) {
      if (!n[k]) continue;
      for (const name of exprNames(n[k])) {
        if (!known(name)) errors.push(new LangError(`「${name}」という名前のセンサ・出力・変数はありません`, n.line));
      }
    }
  });
  return { errors, vars: [...vars] };
}

// 自動テスト・保存用: テキストを読み、装置と照らし合わせる
export function compile(text, device) {
  const { program, errors } = parseProgram(text);
  if (errors.length) return { program, errors, vars: [] };
  const v = validate(program, device);
  return { program, errors: v.errors, vars: v.vars };
}
