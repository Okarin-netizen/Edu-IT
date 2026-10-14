// ブロック ⇔ テキストコードの変換。
// プログラムの正本はテキストコード。ブロックはコードを読んで作り、ブロックを編集したらコードを作り直す。
import { parse, parseExpr, strLit } from "./lang.js";

const isStr = (e) => e && e.type === "str";
const isCall = (e, name, n) => e && e.type === "call" && e.name === name && (n === undefined || e.args.length === n);

export function stmtToBlock(s) {
  switch (s.type) {
    case "comment":
      return { kind: "comment", f: { text: s.text }, line: s.line };
    case "set": {
      const e = s.expr;
      if (s.op === "=" && isCall(e, "ask", 1)) return { kind: "ask", f: { name: s.name, prompt: e.args[0].src }, declared: s.declared, line: s.line };
      if (s.op === "=" && e && e.type === "call" && e.name === "choose" && e.args.length >= 2)
        return { kind: "choose", f: { name: s.name, prompt: e.args[0].src, options: e.args.slice(1).map((a) => a.src) }, declared: s.declared, line: s.line };
      if (s.op === "+=" || s.op === "-=") return { kind: "change", f: { name: s.name, op: s.op, expr: e.src }, line: s.line };
      return { kind: "set", f: { name: s.name, expr: e ? e.src : "" }, declared: s.declared, line: s.line };
    }
    case "setitem":
      if (s.op !== "=") return { kind: "code", f: { code: `${s.name}[${s.index.src}] ${s.op} ${s.expr.src}` }, line: s.line };
      return { kind: "setitem", f: { name: s.name, index: s.index.src, expr: s.expr.src }, line: s.line };
    case "if":
      return {
        kind: s.else ? "ifelse" : "if",
        f: { cond: s.cond.src },
        body: s.then.map(stmtToBlock),
        else: s.else ? s.else.map(stmtToBlock) : undefined,
        chain: s.chain,
        line: s.line,
      };
    case "while":
      return { kind: "while", f: { cond: s.cond.src }, body: s.body.map(stmtToBlock), line: s.line };
    case "repeat":
      return { kind: "repeat", f: { count: s.count.src }, body: s.body.map(stmtToBlock), line: s.line };
    case "when":
      return { kind: "when", f: { part: s.target }, body: s.body.map(stmtToBlock), line: s.line };
    case "break":
      return { kind: "break", f: {}, line: s.line };
    case "expr": {
      const e = s.expr;
      if (isCall(e, "show", 1)) return { kind: "show", f: { expr: e.args[0].src }, line: s.line };
      if (isCall(e, "clear", 0)) return { kind: "clear", f: {}, line: s.line };
      if (isCall(e, "wait", 1)) return { kind: "wait", f: { expr: e.args[0].src }, line: s.line };
      if (isCall(e, "setText", 2) && isStr(e.args[0])) return { kind: "settext", f: { part: e.args[0].v, expr: e.args[1].src }, line: s.line };
      // 箱の名前は "朝ごはん" のような文字でも、box のような変数でもよい（IS-08）
      if (isCall(e, "server.save", 2)) return { kind: "save", f: { coll: e.args[0].src, expr: e.args[1].src }, line: s.line };
      if (isCall(e, "server.addScore", 3)) return { kind: "addscore", f: { coll: e.args[0].src, player: e.args[1].src, score: e.args[2].src }, line: s.line };
      if (isCall(e, "push", 2) && e.args[0].type === "var") return { kind: "push", f: { name: e.args[0].name, expr: e.args[1].src }, line: s.line };
      return { kind: "code", f: { code: e.src }, line: s.line };
    }
  }
  throw new Error("unknown statement " + s.type);
}

export function codeToBlocks(code) {
  return parse(code).body.map(stmtToBlock);
}

const or = (s, d) => (String(s ?? "").trim() === "" ? d : String(s).trim());

export function blocksToCode(blocks) {
  const lines = genLines(blocks, "");
  return lines.length ? lines.join("\n") + "\n" : "";
}

function genLines(blocks, indent) {
  const out = [];
  const sub = (list) => genLines(list || [], indent + "  ");
  for (const b of blocks) {
    const f = b.f || {};
    const let_ = b.declared ? "let " : "";
    switch (b.kind) {
      case "comment":
        out.push(`${indent}// ${String(f.text || "").replace(/\n/g, " ")}`);
        break;
      case "set":
        out.push(String(f.expr ?? "").trim() === "" && b.declared ? `${indent}let ${or(f.name, "x")};` : `${indent}${let_}${or(f.name, "x")} = ${or(f.expr, "0")};`);
        break;
      case "change":
        out.push(`${indent}${or(f.name, "x")} ${f.op === "-=" ? "-=" : "+="} ${or(f.expr, "1")};`);
        break;
      case "setitem":
        out.push(`${indent}${or(f.name, "list")}[${or(f.index, "0")}] = ${or(f.expr, "0")};`);
        break;
      case "ask":
        out.push(`${indent}${let_}${or(f.name, "answer")} = ask(${or(f.prompt, '""')});`);
        break;
      case "choose":
        out.push(`${indent}${let_}${or(f.name, "answer")} = choose(${[or(f.prompt, '""'), ...(f.options || []).map((o) => or(o, '""'))].join(", ")});`);
        break;
      case "show":
        out.push(`${indent}show(${or(f.expr, '""')});`);
        break;
      case "clear":
        out.push(`${indent}clear();`);
        break;
      case "wait":
        out.push(`${indent}wait(${or(f.expr, "1")});`);
        break;
      case "settext":
        out.push(`${indent}setText(${strLit(f.part || "")}, ${or(f.expr, '""')});`);
        break;
      case "save":
        out.push(`${indent}server.save(${or(f.coll, '""')}, ${or(f.expr, '""')});`);
        break;
      case "addscore":
        out.push(`${indent}server.addScore(${or(f.coll, '""')}, ${or(f.player, '""')}, ${or(f.score, "0")});`);
        break;
      case "push":
        out.push(`${indent}push(${or(f.name, "list")}, ${or(f.expr, '""')});`);
        break;
      case "break":
        out.push(`${indent}break;`);
        break;
      case "code":
        out.push(`${indent}${or(f.code, "// （空のコード）").replace(/;\s*$/, "")}${String(f.code || "").trim().startsWith("//") ? "" : ";"}`);
        break;
      case "if":
      case "ifelse": {
        out.push(`${indent}if (${or(f.cond, "true")}) {`, ...sub(b.body), `${indent}}`);
        if (b.kind === "ifelse") {
          const els = b.else || [];
          if (b.chain && els.length === 1 && (els[0].kind === "if" || els[0].kind === "ifelse")) {
            const inner = genLines(els, indent);
            out[out.length - 1] = `${indent}} else ${inner[0].trimStart()}`;
            out.push(...inner.slice(1));
          } else {
            out[out.length - 1] = `${indent}} else {`;
            out.push(...sub(els), `${indent}}`);
          }
        }
        break;
      }
      case "while":
        out.push(`${indent}while (${or(f.cond, "false")}) {`, ...sub(b.body), `${indent}}`);
        break;
      case "repeat":
        out.push(`${indent}repeat (${or(f.count, "1")}) {`, ...sub(b.body), `${indent}}`);
        break;
      case "when":
        out.push(`${indent}when (${strLit(f.part || "")}) {`, ...sub(b.body), `${indent}}`);
        break;
    }
  }
  return out;
}

// ---- 条件「左 記号 右」を3つの欄に分ける（IS-05）。分けられないときは null ----
export const COMPARE_OPS = ["==", "!=", ">", "<", ">=", "<="];
export function splitCompare(src) {
  let e;
  try {
    e = parseExpr(src);
  } catch {
    return null;
  }
  if (!e || e.type !== "bin" || !COMPARE_OPS.includes(e.op)) return null;
  // 左右に、さらに比べる式が入っているもの（a == b == c）は分けない
  if ((e.l.type === "bin" && COMPARE_OPS.includes(e.l.op)) || (e.r.type === "bin" && COMPARE_OPS.includes(e.r.op))) return null;
  return { l: e.l.src, op: e.op, r: e.r.src };
}
export const joinCompare = ({ l, op, r }) => `${String(l ?? "").trim()} ${op} ${String(r ?? "").trim()}`;

// 式の中で、変数として読まれる名前の一覧（読めないときは空）
export function exprVarNames(src) {
  let e;
  try {
    e = parseExpr(src);
  } catch {
    return [];
  }
  const out = new Set();
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== "object") return;
    if (n.type === "var") out.add(n.name);
    for (const k of ["l", "r", "e", "args", "obj", "idx", "items"]) if (n[k]) walk(n[k]);
  };
  walk(e);
  return [...out];
}
// 日本語（ひらがな・カタカナ・漢字）がふくまれる名前
export const hasJapanese = (name) => /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(String(name));

// ---- 作品がサーバーとやりとりしているか（先生の決定: どの作品にも server の命令を1つ以上入れる） ----
export const SERVER_COMMANDS = ["server.save", "server.count", "server.list", "server.addScore", "server.ranking"];
export function serverCommands(code) {
  const found = new Set();
  try {
    const walk = (n) => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== "object") return;
      if (n.type === "call" && SERVER_COMMANDS.includes(n.name)) found.add(n.name);
      for (const k of Object.keys(n)) if (k !== "src" && typeof n[k] === "object") walk(n[k]);
    };
    walk(parse(String(code)).body);
  } catch {
    // まちがいがあって読めないときは、メモ（//）と文字（" "）を除いて探す
    const plain = String(code)
      .replace(/"(?:[^"\\\n]|\\.)*"?/g, '""')
      .replace(/\/\/[^\n]*/g, "");
    for (const m of plain.matchAll(/\b(server\.(?:save|count|list|addScore|ranking))\s*\(/g)) found.add(m[1]);
  }
  return SERVER_COMMANDS.filter((c) => found.has(c));
}
