// 簡易言語「スタジオ・スクリプト」（JavaScript風）の字句解析と構文解析。
// 生徒のプログラムは JavaScript としては実行せず、ここで作った木（AST）を interp.js が1歩ずつ評価する。

export const KEYWORDS = new Set(["let", "if", "else", "while", "repeat", "when", "break", "true", "false", "and", "or", "not"]);

export class LangError extends Error {
  constructor(message, line, col) {
    super(message);
    this.line = line;
    this.col = col;
  }
}

// 全角の記号がまぎれ込んだときに、半角を案内する
const FULLWIDTH = {
  "（": "(", "）": ")", "｛": "{", "｝": "}", "［": "[", "］": "]", "＝": "=", "＋": "+", "－": "-", "−": "-",
  "＊": "*", "／": "/", "＜": "<", "＞": ">", "！": "!", "，": ",", "；": ";", "”": '"', "“": '"', "’": "'", "‘": "'",
  "＆": "&", "｜": "|", "％": "%", "、": ",", "。": ";",
};

const ID_START = /[\p{L}_$]/u;
const ID_PART = /[\p{L}\p{N}_$]/u;
const OPS = ["+=", "-=", "==", "!=", "<=", ">=", "&&", "||", "+", "-", "*", "/", "%", "=", "<", ">", "!", "(", ")", "{", "}", "[", "]", ",", ";"];

export function tokenize(src) {
  const toks = [];
  let i = 0;
  let line = 1;
  let lineStart = 0;
  const err = (msg, at = i) => new LangError(msg, line, at - lineStart + 1);
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") {
      line++;
      i++;
      lineStart = i;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r" || c === "　") {
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      let j = i;
      while (j < src.length && src[j] !== "\n") j++;
      toks.push({ t: "comment", v: src.slice(i + 2, j).trim(), line, start: i, end: j });
      i = j;
      continue;
    }
    if (/[0-9０-９]/.test(c)) {
      if (/[０-９]/.test(c)) throw err(`全角の数字「${c}」が入っています。半角の数字で書きましょう。`);
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      if (src[j] === "." && /[0-9]/.test(src[j + 1] || "")) {
        j++;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
      }
      toks.push({ t: "num", v: Number(src.slice(i, j)), line, start: i, end: j });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let v = "";
      while (true) {
        if (j >= src.length || src[j] === "\n") throw err(`文字の始まりの ${c} に対応する、終わりの ${c} がありません。`);
        const d = src[j];
        if (d === c) break;
        if (d === "\\") {
          const e = src[j + 1];
          if (e === "n") v += "\n";
          else if (e === "t") v += "\t";
          else if (e === "u" && /^[0-9a-fA-F]{4}$/.test(src.slice(j + 2, j + 6))) {
            v += String.fromCharCode(parseInt(src.slice(j + 2, j + 6), 16));
            j += 4;
          } else if (e === undefined) throw err("文字の最後に \\ があります。");
          else v += e;
          j += 2;
          continue;
        }
        v += d;
        j++;
      }
      toks.push({ t: "str", v, line, start: i, end: j + 1 });
      i = j + 1;
      continue;
    }
    if (ID_START.test(c)) {
      let j = i + 1;
      while (j < src.length && ID_PART.test(src[j])) j++;
      // server.save のような「名前.名前」は1つの命令名として読む
      while (src[j] === "." && ID_START.test(src[j + 1] || "")) {
        j++;
        while (j < src.length && ID_PART.test(src[j])) j++;
      }
      const v = src.slice(i, j);
      if (v === "for" && /^[ \t　]*\(/.test(src.slice(j))) throw err("for は使えません。決まった回数くり返すときは repeat (3) { }、条件で続けるときは while ( ) { } を使います。");
      toks.push({ t: KEYWORDS.has(v) ? "kw" : "id", v, line, start: i, end: j });
      i = j;
      continue;
    }
    // ほかの言語の書き方（=== や ++）には、このスタジオでの書き方を案内する（IS-06）
    if (src.startsWith("===", i) || src.startsWith("!==", i)) {
      throw err(src[i] === "=" ? "「===」は使えません。同じかどうかをくらべるときは「==」と書きます。" : "「!==」は使えません。ちがうかどうかをくらべるときは「!=」と書きます。");
    }
    if (src.startsWith("++", i) || src.startsWith("--", i)) {
      const prev = toks[toks.length - 1];
      const after = /^[\p{L}_$][\p{L}\p{N}_$]*/u.exec(src.slice(i + 2));
      const pp = src.slice(i, i + 2);
      const name = prev && prev.t === "id" && prev.end === i ? prev.v : after ? after[0] : "";
      const shown = !name ? pp : prev && prev.t === "id" && prev.end === i ? name + pp : pp + name;
      const how = `${name || "変数"} ${c === "+" ? "+=" : "-="} 1;`;
      throw err(`「${shown}」は使えません。1${c === "+" ? "増やす" : "減らす"}ときは ${how} と書きます。`);
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      toks.push({ t: "op", v: op, line, start: i, end: i + op.length });
      i += op.length;
      continue;
    }
    if (FULLWIDTH[c]) throw err(`全角の「${c}」が入っています。半角の「${FULLWIDTH[c]}」にしましょう（文字の外では記号は半角です）。`);
    throw err(`「${c}」はプログラムでは使えない記号です。`);
  }
  toks.push({ t: "eof", v: "", line, start: src.length, end: src.length });
  return toks;
}

const describe = (tok) => (tok.t === "eof" ? "プログラムの終わり" : tok.t === "str" ? `文字 "${tok.v}"` : `「${tok.v}」`);

export function parse(src) {
  const all = tokenize(src);
  let p = 0;
  const peek = (k = 0) => all[p + k];
  const next = () => all[p++];
  const is = (v, k = 0) => {
    const t = all[p + k];
    return (t.t === "op" || t.t === "kw") && t.v === v;
  };
  const err = (msg, tok = peek()) => new LangError(msg, tok.line, null);
  const expect = (v, what) => {
    if (is(v)) return next();
    const tok = peek();
    throw err(what || `${describe(tok)} の前に「${v}」が必要です。`, tok.t === "eof" ? all[Math.max(0, p - 1)] : tok);
  };
  const skipSemis = () => {
    while (is(";")) next();
  };

  // ---- 式 ----
  function expr() {
    return orExpr();
  }
  function wrap(node, startTok) {
    node.start = startTok.start;
    node.end = all[p - 1].end;
    node.line = startTok.line;
    node.src = src.slice(node.start, node.end);
    return node;
  }
  function orExpr() {
    const s = peek();
    let l = andExpr();
    while (is("or") || is("||")) {
      next();
      l = wrap({ type: "bin", op: "or", l, r: andExpr() }, s);
    }
    return l;
  }
  function andExpr() {
    const s = peek();
    let l = notExpr();
    while (is("and") || is("&&")) {
      next();
      l = wrap({ type: "bin", op: "and", l, r: notExpr() }, s);
    }
    return l;
  }
  function notExpr() {
    const s = peek();
    if (is("not") || is("!")) {
      next();
      return wrap({ type: "un", op: "not", e: notExpr() }, s);
    }
    return cmpExpr();
  }
  function cmpExpr() {
    const s = peek();
    let l = addExpr();
    while (["==", "!=", "<", ">", "<=", ">="].some((o) => is(o))) {
      const op = next().v;
      l = wrap({ type: "bin", op, l, r: addExpr() }, s);
    }
    if (is("=") && inCondition) throw err("条件の中では「=」ではなく「==」を使います（= は変数に入れるときの記号です）。");
    return l;
  }
  function addExpr() {
    const s = peek();
    let l = mulExpr();
    while (is("+") || is("-")) {
      const op = next().v;
      l = wrap({ type: "bin", op, l, r: mulExpr() }, s);
    }
    return l;
  }
  function mulExpr() {
    const s = peek();
    let l = unary();
    while (is("*") || is("/") || is("%")) {
      const op = next().v;
      l = wrap({ type: "bin", op, l, r: unary() }, s);
    }
    return l;
  }
  function unary() {
    const s = peek();
    if (is("-")) {
      next();
      return wrap({ type: "un", op: "-", e: unary() }, s);
    }
    return postfix();
  }
  function postfix() {
    const s = peek();
    let e = primary();
    while (is("[")) {
      next();
      const idx = expr();
      expect("]", "「[」に対応する「]」がありません。");
      e = wrap({ type: "index", obj: e, idx }, s);
    }
    return e;
  }
  function primary() {
    const t = peek();
    if (t.t === "num") {
      next();
      return wrap({ type: "num", v: t.v }, t);
    }
    if (t.t === "str") {
      next();
      return wrap({ type: "str", v: t.v }, t);
    }
    if (is("true") || is("false")) {
      next();
      return wrap({ type: "bool", v: t.v === "true" }, t);
    }
    if (t.t === "id") {
      next();
      if (is("(")) {
        next();
        const args = [];
        if (!is(")")) {
          do {
            if (is(")")) break;
            args.push(expr());
          } while (is(",") && next());
        }
        expect(")", `命令 ${t.v}( の「)」がありません。( ) の中の値は「,」で区切ります。`);
        return wrap({ type: "call", name: t.v, args }, t);
      }
      if (t.v.includes(".")) throw err(`${t.v} は命令なので、後ろに ( ) を付けて使います。`, t);
      return wrap({ type: "var", name: t.v }, t);
    }
    if (is("(")) {
      next();
      const e = expr();
      expect(")", "「(」に対応する「)」がありません。");
      return e;
    }
    if (is("[")) {
      next();
      const items = [];
      if (!is("]")) {
        do {
          if (is("]")) break;
          items.push(expr());
        } while (is(",") && next());
      }
      expect("]", "リストの「]」がありません。要素は「,」で区切ります。");
      return wrap({ type: "list", items }, t);
    }
    if (t.t === "eof") throw err("式がとちゅうで終わっています。", all[Math.max(0, p - 1)]);
    if (t.t === "kw") throw err(`「${t.v}」はここには書けません。`);
    throw err(`${describe(t)} はここには書けません。値や変数が必要です。`);
  }

  let inCondition = false;
  function cond() {
    expect("(", `${describe(all[p - 1])} の後ろに、条件を ( ) でかこんで書きます。`);
    inCondition = true;
    const e = expr();
    inCondition = false;
    expect(")", "条件の「)」がありません。");
    return e;
  }

  // ---- 文 ----
  // 行の先頭の空白の長さ（「}」の閉じ忘れの場所を当てるのに使う）
  const lines = src.split("\n");
  const indentOf = (line) => /^[ \t　]*/.exec(lines[line - 1] || "")[0].length;
  const closed = []; // 閉じたブロック: { owner, line, ok }（ok: 「{」の行と「}」の行の字下げがそろっている）
  function block(owner) {
    const open = expect("{", `${owner} の後ろに「{」が必要です。`);
    const body = [];
    while (!is("}")) {
      if (peek().t === "eof") {
        // 字下げがそろっていない「}」があれば、そのブロックの「}」を忘れている見こみが高い
        const miss = closed.find((b) => !b.ok) || { owner, line: open.line };
        throw new LangError(`${miss.line}行目の ${miss.owner} の「{」に対応する「}」がありません。${miss.owner} の中の最後の行の後ろに } を書こう。`, miss.line, null);
      }
      const s = statement(false);
      if (s) body.push(s);
    }
    const close = next();
    const firstOnLine = /^[ \t　]*$/.test(src.slice(src.lastIndexOf("\n", close.start - 1) + 1, close.start));
    closed.push({ owner, line: open.line, ok: !firstOnLine || indentOf(close.line) === indentOf(open.line) });
    return body;
  }
  function statement(top) {
    skipSemis();
    const t = peek();
    if (t.t === "eof" || is("}")) return null;
    if (t.t === "comment") {
      next();
      return { type: "comment", text: t.v, line: t.line };
    }
    if (is("let")) {
      next();
      const nameTok = next();
      if (nameTok.t !== "id" || nameTok.v.includes(".")) throw err("let の後ろには変数の名前を書きます。", nameTok);
      if (is("=")) {
        next();
        const e = expr();
        skipSemis();
        return { type: "set", name: nameTok.v, op: "=", expr: e, declared: true, line: t.line };
      }
      skipSemis();
      return { type: "set", name: nameTok.v, op: "=", expr: null, declared: true, line: t.line };
    }
    if (is("if")) {
      next();
      const c = cond();
      const then = block("if");
      let otherwise = null;
      let chain = false;
      if (is("else")) {
        next();
        if (is("if")) {
          otherwise = [statement(false)];
          chain = true;
        } else otherwise = block("else");
      }
      return { type: "if", cond: c, then, else: otherwise, chain, line: t.line };
    }
    if (is("else")) throw err("else の前に、対応する if { } がありません。");
    if (is("while")) {
      next();
      const c = cond();
      return { type: "while", cond: c, body: block("while"), line: t.line };
    }
    if (is("repeat")) {
      next();
      expect("(", "repeat の後ろに、回数を ( ) でかこんで書きます。");
      const n = expr();
      expect(")", "回数の「)」がありません。");
      return { type: "repeat", count: n, body: block("repeat"), line: t.line };
    }
    if (is("when")) {
      next();
      if (!top) throw err("when（ボタンが押されたとき）は、ほかのブロックの中ではなく、いちばん外側に置きます。", t);
      expect("(", 'when の後ろに、ボタンの名前を ("名前") のように書きます。');
      const nt = next();
      if (nt.t !== "str") throw err('when のボタンの名前は "go" のように " でかこみます。', nt);
      expect(")", "ボタンの名前の後ろに「)」が必要です。");
      return { type: "when", target: nt.v, body: block("when"), line: t.line };
    }
    if (is("break")) {
      next();
      skipSemis();
      return { type: "break", line: t.line };
    }
    if (t.t === "kw" && !["true", "false", "not"].includes(t.v)) throw err(`「${t.v}」はここには書けません。`);
    const e = expr();
    if (is("=") || is("+=") || is("-=")) {
      const op = next().v;
      if (e.type !== "var" && !(e.type === "index" && e.obj.type === "var")) throw err("「=」の左には変数の名前を書きます。", t);
      const rhs = expr();
      skipSemis();
      if (e.type === "index") return { type: "setitem", name: e.obj.name, index: e.idx, op, expr: rhs, line: t.line };
      return { type: "set", name: e.name, op, expr: rhs, declared: false, line: t.line };
    }
    if (e.type !== "call") throw err(`${e.src} だけでは何もしません。命令（show など）や「=」を使いましょう。`, t);
    skipSemis();
    return { type: "expr", expr: e, line: t.line };
  }

  const body = [];
  while (peek().t !== "eof") {
    if (is("}")) throw err("「}」が多すぎます。対応する「{」がありません。");
    const s = statement(true);
    if (s) body.push(s);
  }
  return { type: "program", body };
}

// 式だけを読む（ブロックの入力欄のチェック用）
export function parseExpr(src) {
  const prog = parse(`__x = ${src}\n`);
  if (prog.body.length !== 1 || prog.body[0].type !== "set" || prog.body[0].name !== "__x") throw new LangError("1つの式にしましょう。", 1);
  return prog.body[0].expr;
}

export function isIdentifier(name) {
  return typeof name === "string" && /^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(name) && !KEYWORDS.has(name);
}

export const strLit = (s) => JSON.stringify(String(s));
