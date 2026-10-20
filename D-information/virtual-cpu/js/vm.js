// 仮想CPU（教育用の小さなコンピュータ）。画面（DOM）には触らない計算だけの部品。
// 記憶装置: memorySize 語。1語に「命令」か「数」が1つ入る（プログラムとデータが同じ記憶装置に入る＝プログラム内蔵方式）。
// レジスタ: PC（プログラムカウンタ＝次に取り出す番地）、IR（命令レジスタ＝いま実行中の命令）、ACC（アキュムレータ＝計算用の箱）。
// 1つの命令は「取り出し → 解読 → 実行」の3段階で進む。

export const UNIT_NAMES = { in: "入力装置", mem: "記憶装置", alu: "演算装置", ctrl: "制御装置", out: "出力装置" };
export const PHASE_NAMES = { fetch: "取り出し", decode: "解読", execute: "実行" };

const LABEL_RE = /^([\p{L}_][\p{L}\p{N}_]*)\s*:\s*(.*)$/u;
const NAME_RE = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const INT_RE = /^[+-]?\d+$/;
const DEC_RE = /^[+-]?\d*\.\d+$/; // 小数（2.5 など）
const JUMP_OPS = new Set(["JUMP", "JZ", "JN"]);

function isaTable(isa) {
  return Object.fromEntries(isa.instructions.map((i) => [i.op, i]));
}

// 全角の英数字・記号（ＬＯＡＤ、＃５、；、：など）を半角にそろえる
export function normalizeSource(src) {
  return String(src ?? "").normalize("NFKC").replace(/\r\n?/g, "\n");
}

// プログラムの文字 → 記憶装置の中身
// 戻り値: { ok, errors: [{ line, message }], memory, labels, addrOfLine, lineOfAddr }
export function assemble(source, isa) {
  const ops = isaTable(isa);
  const size = isa.memorySize;
  const lines = normalizeSource(source).split("\n");
  const errors = [];
  const items = []; // { line, op, operand, labels }
  const labels = {}; // 名前 → 番地
  let pending = []; // まだ番地が決まっていないラベル（名前だけの行）

  lines.forEach((raw, i) => {
    const line = i + 1;
    let text = raw.replace(/(;|\/\/).*$/, "").trim();
    if (!text) return;
    const names = [];
    let m;
    while ((m = text.match(LABEL_RE))) {
      names.push(m[1]);
      text = m[2].trim();
    }
    for (const name of names) {
      if (name.toUpperCase() in ops || name.toUpperCase() === "DATA") errors.push({ line, message: `「${name}」は命令の名前なので、ラベル（番地の名前）には使えません` });
      else if (Object.hasOwn(labels, name) || pending.some((p) => p.name === name)) errors.push({ line, message: `ラベル「${name}」が2回出てきます。名前は1つずつ別にしよう` });
      else pending.push({ name, line });
    }
    if (!text) return;
    // 「LOAD # 5」「LOAD#5」も「LOAD #5」として読む
    text = text.replace(/#\s+/g, "#").replace(/^([A-Za-z]+)#/, "$1 #");
    const parts = text.split(/\s+/);
    const op = parts[0].toUpperCase();
    if (parts.length > 2) {
      errors.push({ line, message: `「${text}」: 1行に書ける命令は1つ、番地や数も1つだけです` });
      return;
    }
    const operand = parts[1];
    if (op.includes("?") || operand?.includes("?")) {
      errors.push({ line, message: "「???」のところを、正しい命令・番地・数に書きかえよう" });
    } else if (op !== "DATA" && !(op in ops)) {
      // ひらがな・カタカナが入っているときは、日本語入力のまま打ったと考えて知らせる
      const kana = /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(parts[0]) ? "。日本語入力になっていませんか？ 英数モードにして打ちなおそう" : "";
      errors.push({ line, message: `「${parts[0]}」という命令はありません（使える命令: ${Object.keys(ops).join(" ")}）${kana}` });
    }
    const addr = items.length;
    for (const p of pending) labels[p.name] = addr;
    pending = [];
    items.push({ line, op, operand });
  });
  // 最後の行が名前だけのときは、次の空き番地につける
  for (const p of pending) labels[p.name] = items.length;

  if (items.length > size) {
    errors.push({ line: items[size].line, message: `記憶装置は ${size} 個（0〜${size - 1}番地）しかありません。命令とデータを合わせて ${size} 個以内にしよう（いま ${items.length} 個）` });
  }

  const memory = new Array(size).fill(0);
  const lineOfAddr = new Array(size).fill(null);
  const addrOfLine = {};

  const resolveAddr = (tok, line, op) => {
    if (INT_RE.test(tok)) {
      const n = Number(tok);
      if (n < 0 || n >= size) {
        errors.push({ line, message: `${n}番地はありません（0〜${size - 1}番地）` });
        return null;
      }
      return n;
    }
    if (NAME_RE.test(tok)) {
      if (Object.hasOwn(labels, tok)) return labels[tok]; // in だと「toString」などの名前が見つかったことになる
      const near = Object.keys(labels).find((k) => k.toLowerCase() === tok.toLowerCase());
      if (near) errors.push({ line, message: `「${tok}」という名前はありません。「${near}」のことかな？（名前は大文字と小文字を区別します）` });
      else if (JUMP_OPS.has(op)) errors.push({ line, message: `「${tok}」という名前の行がありません。とびたい行の先頭に「${tok}:」をつけよう` });
      else errors.push({ line, message: `「${tok}」という箱がありません。HALT のあとに「${tok}: DATA 0」を書いて用意しよう` });
      return null;
    }
    errors.push({ line, message: `「${tok}」は番地として読めません` });
    return null;
  };

  items.slice(0, size).forEach((it, addr) => {
    const { line, op, operand } = it;
    lineOfAddr[addr] = line;
    addrOfLine[line] = addr;
    if (op.includes("?") || operand?.includes("?")) return; // エラーは上で出した
    if (op === "DATA") {
      if (operand === undefined) errors.push({ line, message: "DATA の後ろに、はじめに入れておく数を書こう（例: DATA 0）" });
      else if (DEC_RE.test(operand)) errors.push({ line, message: `「${operand}」: 小数は使えません。整数にしよう` });
      else if (!INT_RE.test(operand)) errors.push({ line, message: `DATA の後ろは整数にしよう（「${operand}」は数ではありません）` });
      else memory[addr] = Number(operand);
      return;
    }
    const spec = ops[op];
    if (!spec) return;
    const word = { op, mode: null, arg: null, ref: null, line };
    if (spec.operand === "none") {
      if (operand !== undefined) errors.push({ line, message: `${op} の後ろには何も書きません（「${operand}」を消そう）` });
    } else if (operand === undefined) {
      errors.push({ line, message: `${op} の後ろに${spec.operand === "addr" ? "番地（またはラベル）" : "番地か #数"}を書こう（例: ${spec.example}）` });
    } else if (operand.startsWith("#")) {
      const num = operand.slice(1);
      if (spec.operand !== "value") errors.push({ line, message: `${op} には # をつけた数は使えません。番地かラベルを書こう（例: ${spec.example}）` });
      else if (DEC_RE.test(num)) errors.push({ line, message: `「${operand}」: 小数は使えません。整数にしよう` });
      else if (!INT_RE.test(num)) errors.push({ line, message: `「${operand}」: # の後ろは整数にしよう` });
      else Object.assign(word, { mode: "imm", arg: Number(num) });
    } else {
      const a = resolveAddr(operand, line, op);
      if (a !== null) Object.assign(word, { mode: "addr", arg: a, ref: INT_RE.test(operand) ? null : operand });
    }
    memory[addr] = word;
  });

  errors.sort((a, b) => a.line - b.line);
  // # のつけ忘れかもしれない所（エラーではない。答えが合わないときに見せる）
  const used = Math.min(items.length, size);
  const notes = [];
  memory.slice(0, used).forEach((w) => {
    if (isInstruction(w) && w.mode === "addr" && w.ref === null && w.arg >= used && ["LOAD", "ADD", "SUB"].includes(w.op)) {
      notes.push({ line: w.line, message: `「${w.op} ${w.arg}」は、${w.arg}番地に入っている数を使います。数 ${w.arg} そのものを使うなら「${w.op} #${w.arg}」のように # をつけよう` });
    }
  });
  return { ok: errors.length === 0, errors, notes, memory, labels, addrOfLine, lineOfAddr, used };
}

export function isInstruction(word) {
  return typeof word === "object" && word !== null;
}

// 記憶装置の中身を短い文字で（LOAD #5、ADD sum、12 など）
export function wordText(word) {
  if (!isInstruction(word)) return String(word);
  if (word.mode === "imm") return `${word.op} #${word.arg}`;
  if (word.mode === "addr") return `${word.op} ${word.ref ?? word.arg}`;
  return word.op;
}

// 命令の意味を日本語で
export function wordMeaning(word) {
  if (!isInstruction(word)) return `数 ${word}`;
  const where = word.mode === "addr" ? (word.ref ? `${word.ref}（${word.arg}番地）` : `${word.arg}番地`) : "";
  const val = word.mode === "imm" ? `数 ${word.arg}` : `${where} の数`;
  switch (word.op) {
    case "LOAD": return `${val}を ACC に読み込む`;
    case "STORE": return `ACC の値を ${where} にしまう`;
    case "ADD": return `ACC に ${val}をたす`;
    case "SUB": return `ACC から ${val}をひく`;
    case "JUMP": return `${where} にとぶ`;
    case "JZ": return `ACC が 0 なら ${where} にとぶ`;
    case "JN": return `ACC がマイナスなら ${where} にとぶ`;
    case "IN": return "入力された数を ACC に入れる";
    case "OUT": return "ACC の値を出力する";
    case "HALT": return "止まる（プログラムの終わり）";
    default: return word.op;
  }
}

export function createMachine(program, { inputs = [], maxSteps = 10000 } = {}) {
  return {
    mem: program.memory.map((w) => (isInstruction(w) ? { ...w } : w)),
    pc: 0,
    acc: 0,
    ir: null,
    irAddr: null,
    inputs: inputs.map(Number),
    inputPos: 0,
    outputs: [],
    phase: "fetch", // 次に行う段階
    status: "ready", // ready | halted | error | limit
    jumped: false, // 直前の命令でとんだか（エラーの説明に使う）
    error: null,
    steps: 0, // 実行し終えた命令の数
    maxSteps,
  };
}

export function isStopped(m) {
  return m.status === "halted" || m.status === "error" || m.status === "limit";
}

// LOAD・ADD・SUB で、読もうとした番地に命令が入っていたときの説明
function notNumberMessage(w) {
  if (w.ref) return `「${w.ref}」（${w.arg}番地）には命令が入っていて、数として読めません。数をしまう箱は、HALT のあとに「x: DATA 0」のように用意しよう`;
  return `${w.arg}番地には命令が入っていて、数として読めません。数そのものを使うなら「#${w.arg}」のように # をつけよう`;
}

function fail(m, message) {
  m.status = "error";
  m.error = message;
  return { phase: "error", units: ["ctrl"], flow: null, read: null, write: null, message };
}

// 1段階だけ進める。quiet=true のときは説明文を作らない（たくさん実行するとき用）
// 戻り値: { phase, units, flow: { from, to, value }, read, write, message }
export function stepPhase(m, quiet = false) {
  if (isStopped(m)) return null;
  const size = m.mem.length;

  if (m.phase === "fetch") {
    if (m.pc < 0 || m.pc >= size) return fail(m, `${m.pc}番地はありません。プログラムの終わりに HALT を書いたか確かめよう`);
    const word = m.mem[m.pc];
    if (!isInstruction(word)) {
      if (!m.mem.some(isInstruction)) return fail(m, "まだ命令がありません。プログラム欄に命令を書こう");
      if (m.pc === 0) return fail(m, `0番地には命令ではなく数（${word}）が入っています。DATA の行は、HALT のあと（いちばん下）に書こう`);
      if (m.jumped) return fail(m, `とび先の ${m.pc}番地には命令ではなく数（${word}）が入っています。とび先の名前（ラベル）が、命令の行についているか確かめよう`);
      return fail(m, `${m.pc}番地には命令ではなく数（${word}）が入っています。命令のおわりに HALT を書いたか確かめよう。DATA の行は HALT のあとに書こう`);
    }
    m.ir = word;
    m.irAddr = m.pc;
    m.pc += 1;
    m.phase = "decode";
    if (quiet) return null;
    return {
      phase: "fetch", units: ["ctrl", "mem"], flow: { from: "mem", to: "ctrl", value: wordText(word) }, read: m.irAddr, write: null,
      message: `制御装置が記憶装置の ${m.irAddr}番地から命令「${wordText(word)}」を取り出し、PC（次の番地）を ${m.pc} にした`,
    };
  }

  if (m.phase === "decode") {
    m.phase = "execute";
    if (quiet) return null;
    return { phase: "decode", units: ["ctrl"], flow: null, read: null, write: null, message: `制御装置が命令「${wordText(m.ir)}」を解読した → 「${wordMeaning(m.ir)}」` };
  }

  // 実行
  const w = m.ir;
  m.jumped = false;
  let ev = { phase: "execute", units: ["ctrl"], flow: null, read: null, write: null, message: "" };
  const readValue = () => {
    if (w.mode === "imm") return w.arg;
    const v = m.mem[w.arg];
    if (isInstruction(v)) return null;
    ev.read = w.arg;
    return v;
  };
  const before = m.acc;
  switch (w.op) {
    case "LOAD": {
      const v = readValue();
      if (v === null) return fail(m, notNumberMessage(w));
      m.acc = v;
      ev.units = ["ctrl", "mem", "alu"];
      ev.flow = { from: w.mode === "imm" ? "ctrl" : "mem", to: "alu", value: String(v) };
      if (!quiet) ev.message = w.mode === "imm" ? `数 ${v} を ACC に入れた` : `記憶装置の ${w.arg}番地の数 ${v} を ACC に読み込んだ`;
      break;
    }
    case "STORE":
      m.mem[w.arg] = m.acc;
      ev.write = w.arg;
      ev.units = ["ctrl", "alu", "mem"];
      ev.flow = { from: "alu", to: "mem", value: String(m.acc) };
      if (!quiet) ev.message = `ACC の値 ${m.acc} を記憶装置の ${w.arg}番地にしまった`;
      break;
    case "ADD":
    case "SUB": {
      const v = readValue();
      if (v === null) return fail(m, notNumberMessage(w));
      m.acc = w.op === "ADD" ? before + v : before - v;
      ev.units = w.mode === "addr" ? ["ctrl", "mem", "alu"] : ["ctrl", "alu"];
      ev.flow = w.mode === "addr" ? { from: "mem", to: "alu", value: String(v) } : null;
      ev.calc = `${before} ${w.op === "ADD" ? "+" : "−"} ${v < 0 ? `(${v})` : v} = ${m.acc}`;
      if (!quiet) ev.message = `演算装置で計算した: ${ev.calc}`;
      break;
    }
    case "JUMP":
      m.pc = w.arg;
      m.jumped = true;
      if (!quiet) ev.message = `次は ${w.arg}番地から実行する（PC を ${w.arg} にした）`;
      break;
    case "JZ":
    case "JN": {
      const jump = w.op === "JZ" ? m.acc === 0 : m.acc < 0;
      if (jump) {
        m.pc = w.arg;
        m.jumped = true;
      }
      ev.units = ["ctrl", "alu"];
      if (!quiet) ev.message = `ACC は ${m.acc}。${w.op === "JZ" ? "0" : "マイナス"}${jump ? `なので ${w.arg}番地にとぶ` : "ではないので、とばずに次の命令へ"}`;
      break;
    }
    case "IN":
      if (m.inputPos >= m.inputs.length) return fail(m, "入力する数がもうありません（入力装置が空っぽ）");
      m.acc = m.inputs[m.inputPos++];
      ev.units = ["ctrl", "in", "alu"];
      ev.flow = { from: "in", to: "alu", value: String(m.acc) };
      if (!quiet) ev.message = `入力装置から数 ${m.acc} を受け取り、ACC に入れた`;
      break;
    case "OUT":
      m.outputs.push(m.acc);
      ev.units = ["ctrl", "alu", "out"];
      ev.flow = { from: "alu", to: "out", value: String(m.acc) };
      if (!quiet) ev.message = `ACC の値 ${m.acc} を出力装置に表示した`;
      break;
    case "HALT":
      m.status = "halted";
      if (!quiet) ev.message = "HALT: プログラムが終わった";
      break;
    default:
      return fail(m, `「${w.op}」は実行できません`);
  }
  m.steps += 1;
  m.phase = "fetch";
  if (m.status !== "halted" && m.steps >= m.maxSteps) {
    m.status = "limit";
    m.error = `${m.maxSteps}回 命令を実行しても終わらないので、自動で止めました。無限ループ（終わらないくり返し）になっていないか確かめよう`;
    if (!quiet) ev.message += `。${m.error}`;
  }
  return quiet ? null : ev;
}

// 1命令分（取り出し→解読→実行）進める。戻り値は段階ごとのできごとの配列
export function stepInstruction(m) {
  const events = [];
  do {
    const ev = stepPhase(m);
    if (ev) events.push(ev);
  } while (m.phase !== "fetch" && !isStopped(m));
  return events;
}

// 止まるまで一気に実行する
export function runToEnd(m) {
  while (!isStopped(m)) stepPhase(m, true);
  return m;
}

// 数を画面に出す文字（大きすぎて表せない数＝Infinity は、ことばで出す）
export function numText(v) {
  if (v === Infinity) return "大きすぎて表せない数";
  if (v === -Infinity) return "マイナスで大きすぎて表せない数";
  return String(v);
}

// 数の並びを短くする（多いときは最初の max 個と「…ほか ○個」）
export function shortList(list, max = 10) {
  if (!list.length) return "（なし）";
  const head = list.slice(0, max).map(numText).join(", ");
  return list.length > max ? `${head} …ほか ${(list.length - max).toLocaleString("ja-JP")} 個` : head;
}

// 課題の答え合わせ。task.tests = [{ inputs, outputs }]、task.minSteps（くり返しを使ったか）
export function checkProgram(source, task, isa) {
  const prog = assemble(source, isa);
  if (!prog.ok) return { ok: false, assembleErrors: prog.errors, notes: [], results: [] };
  const results = task.tests.map((t) => {
    const m = runToEnd(createMachine(prog, { inputs: t.inputs || [], maxSteps: isa.maxSteps }));
    const same = m.status === "halted" && m.outputs.length === t.outputs.length && m.outputs.every((v, i) => v === t.outputs[i]);
    const tooFew = same && task.minSteps && m.steps < task.minSteps;
    return { inputs: t.inputs || [], expected: t.outputs, outputs: m.outputs, status: m.status, error: m.error, steps: m.steps, ok: same && !tooFew, tooFew: Boolean(tooFew) };
  });
  return { ok: results.every((r) => r.ok), assembleErrors: [], notes: prog.notes, results };
}
