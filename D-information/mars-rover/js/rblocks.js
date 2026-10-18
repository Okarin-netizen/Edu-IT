// ブロックエディタ（計測・制御シミュレータ D7 の blocks.js と同じ見た目・同じ使い方）
// 「① ＋ ここに入れる を押す → ② 命令のボタンを押す」方式（タブレットでも使いやすい）。ドラッグは使わない。
import { h } from "../../measure-control-sim/js/ui.js";
import { newId, parseExpr, exprToText, exprNames, numberFieldText, programToText } from "../../measure-control-sim/js/lang.js";
import { DRIVE_WORDS, MOTOR_WORDS, OUTPUTS, WORDS } from "./rsim.js";

const CMP = ["<", "<=", ">", ">=", "==", "!="];
const CMP_LABEL = { "<": "＜（より小さい）", "<=": "≦（以下）", ">": "＞（より大きい）", ">=": "≧（以上）", "==": "＝（等しい）", "!=": "≠（等しくない）" };
const DRIVE_LABEL = { 前進: "前進する", 後退: "後退する", 右に回る: "右に回る", 左に回る: "左に回る", 止まる: "止まる" };
const MOTOR_LABEL = { 前へ: "前へ回す", 後ろへ: "後ろへ回す", 止める: "止める" };

export const TOOL_LEGEND = [
  ["↑↓", "上・下へ"],
  ["↔", "べつの場所へ動かす"],
  ["⧉", "コピー"],
  ["✕", "消す"],
  ["✎", "式で書く"],
];

// パレット: [種類, ボタンの名前, 説明, グループ]
export const PALETTE = [
  ["drive:前進", "前進する", "前へ進む", "move"],
  ["drive:後退", "後退する", "後ろへ進む", "move"],
  ["drive:右に回る", "右に回る", "その場で右に回る", "move"],
  ["drive:左に回る", "左に回る", "その場で左に回る", "move"],
  ["drive:止まる", "止まる", "モーターを止める", "move"],
  ["wait", "〜秒待つ", "今の動きを続けたまま待つ", "move"],
  ["forever", "ずっとくり返す", "", "ctrl"],
  ["ifelse", "もし〜なら／でなければ", "条件で2つに分ける", "ctrl"],
  ["if", "もし〜なら", "条件で分ける", "ctrl"],
  ["repeat", "〜回くり返す", "", "ctrl"],
  ["while", "〜のあいだくり返す", "", "ctrl"],
  ["var", "変数に入れる", "distance など", "etc"],
  ["motor", "モーターを1つずつ", "左右のモーターを別々に動かす", "etc"],
  ["comment", "メモ", "説明を書く", "etc"],
];

export function blockLabel(n) {
  if (n.type === "assign" && n.name === "走行" && n.value.type === "name") return DRIVE_LABEL[n.value.name] || programToText([n]);
  return programToText([n]).split("\n")[0].trim();
}

export function innerCount(n) {
  let c = 0;
  for (const k of ["body", "then", "else"]) if (Array.isArray(n[k])) for (const x of n[k]) c += 1 + innerCount(x);
  return c;
}

// フローチャートの名前（「前進する」「左のモーター：前へ回す」）
export function flowLabel(n) {
  if (n.type !== "assign") return undefined;
  if (n.name === "走行" && n.value.type === "name") return DRIVE_LABEL[n.value.name];
  if ((n.name === "左のモーター" || n.name === "右のモーター") && n.value.type === "name") return `${n.name}を${MOTOR_LABEL[n.value.name] || n.value.name}`;
  return `${n.name} ← ${exprToText(n.value)}`;
}

function parentListOf(list, node) {
  if (list.includes(node)) return list;
  for (const n of list) {
    for (const k of ["body", "then", "else"]) {
      if (!Array.isArray(n[k])) continue;
      const f = parentListOf(n[k], node);
      if (f) return f;
    }
  }
  return null;
}
function listInside(node, list) {
  for (const k of ["body", "then", "else"]) {
    if (!Array.isArray(node[k])) continue;
    if (node[k] === list) return true;
    for (const x of node[k]) if (listInside(x, list)) return true;
  }
  return false;
}
function listInProgram(program, list) {
  if (program === list) return true;
  for (const n of program) if (listInside(n, list)) return true;
  return false;
}
export function moveNode(program, node, list, index) {
  const src = parentListOf(program, node);
  if (!src || listInside(node, list)) return false;
  const i = src.indexOf(node);
  src.splice(i, 1);
  if (src === list && index > i) index--;
  index = Math.max(0, Math.min(index, list.length));
  list.splice(index, 0, node);
  return { list, index };
}
function memoCursor(program) {
  let found = null;
  const walk = (list) => list.forEach((n, i) => {
    if (found) return;
    if (n.type === "comment" && /ここに/.test(n.text)) found = { list, index: i + 1 };
    for (const k of ["body", "then", "else"]) if (Array.isArray(n[k])) walk(n[k]);
  });
  walk(program);
  return found;
}

// sensors: [{ name, kind: "dist"|"color" }]（設計を変えたら ed.setSensors で入れかえる）
export function createBlockEditor(onChange, onInputErrors) {
  const ed = { program: [], sensors: [], cursor: null, moving: null, currentId: null, el: h("div", { class: "blk-editor" }) };
  const bad = new Map();
  let shownKeys = new Set();
  let lastBadSig = "";
  const sensorNames = () => ed.sensors.map((s) => s.name);
  const isColor = (name) => ed.sensors.some((s) => s.name === name && s.kind === "color") || /の色$|^色$/.test(name);

  const vars = () => {
    const out = new Set();
    const walk = (list) => list.forEach((n) => {
      if (n.type === "assign" && !OUTPUTS.includes(n.name)) out.add(n.name);
      for (const k of ["body", "then", "else"]) if (Array.isArray(n[k])) walk(n[k]);
    });
    walk(ed.program);
    return [...out];
  };

  const changed = () => {
    onChange();
    render();
  };

  function defaultCond() {
    const s = ed.sensors[0];
    if (s && s.kind === "color") return { type: "bin", op: "==", left: { type: "name", name: s.name }, right: { type: "name", name: "線" } };
    if (s) return { type: "bin", op: "<", left: { type: "name", name: s.name }, right: { type: "num", value: 30 } };
    return { type: "bin", op: "<", left: { type: "name", name: "前の距離" }, right: { type: "num", value: 30 } };
  }

  function makeNode(kind) {
    const id = newId();
    if (kind.startsWith("drive:")) return { id, type: "assign", name: "走行", value: { type: "name", name: kind.slice(6) } };
    switch (kind) {
      case "if":
        return { id, type: "if", cond: defaultCond(), then: [], else: null };
      case "ifelse":
        return { id, type: "if", cond: defaultCond(), then: [], else: [] };
      case "var": {
        const vs = vars();
        const s = ed.sensors.find((x) => x.kind === "dist") || ed.sensors[0];
        return { id, type: "assign", name: vs[0] || "distance", value: s ? { type: "name", name: s.name } : { type: "num", value: 0 } };
      }
      case "motor":
        return { id, type: "assign", name: "左のモーター", value: { type: "name", name: "前へ" } };
      case "wait":
        return { id, type: "wait", secs: { type: "num", value: 1 } };
      case "forever":
        return { id, type: "forever", body: [] };
      case "repeat":
        return { id, type: "repeat", count: { type: "num", value: 4 }, body: [] };
      case "while":
        return { id, type: "while", cond: defaultCond(), body: [] };
      case "comment":
        return { id, type: "comment", text: "メモ" };
    }
  }

  function defaultCursor() {
    const last = ed.program.at(-1);
    if (last && last.type === "forever") return { list: last.body, index: last.body.length };
    return { list: ed.program, index: ed.program.length };
  }
  function currentCursor() {
    if (ed.cursor && ed.cursor.list && listInProgram(ed.program, ed.cursor.list)) return ed.cursor;
    ed.cursor = null;
    return defaultCursor();
  }

  function insert(kind) {
    ed.moving = null;
    const node = makeNode(kind);
    const cur = currentCursor();
    const index = Math.min(cur.index, cur.list.length);
    cur.list.splice(index, 0, node);
    const inner = node.body || node.then;
    ed.cursor = inner ? { list: inner, index: 0 } : { list: cur.list, index: index + 1 };
    changed();
    requestAnimationFrame(() => ed.el.querySelector(`[data-id="${node.id}"]`)?.scrollIntoView({ block: "nearest" }));
  }

  function exprInput(get, set, opts = {}) {
    const key = opts.key || null;
    const badNow = key ? bad.get(key) : null;
    if (key) shownKeys.add(key);
    const text = badNow ? badNow.raw : exprToText(get());
    const msgId = key ? `blk-bad-${String(key).replace(/[^\w-]/g, "_")}` : null;
    const inp = h("input", { type: "text", class: `blk-expr${badNow ? " bad" : ""}`, value: text, size: Math.max(3, text.length + 1), "aria-label": opts.label || "式", "aria-invalid": badNow ? "true" : null, "aria-describedby": badNow ? msgId : null, spellcheck: "false", inputmode: opts.cond || opts.anyExpr ? null : "decimal" });
    inp.addEventListener("change", () => {
      const raw = inp.value;
      const num = numberFieldText(raw);
      const known = new Set([...sensorNames(), ...vars(), ...Object.keys(WORDS)]);
      try {
        const e = parseExpr(num ?? raw);
        if (!opts.cond && [...exprNames(e)].some((n) => !known.has(n))) throw new Error("unknown name");
        set(e);
        if (key) bad.delete(key);
        changed();
      } catch {
        const old = exprToText(get());
        const empty = !String(raw).normalize("NFKC").trim();
        const ex = opts.example ?? "10";
        const how = empty ? `数を入れよう（例: ${ex}）` : opts.cond ? `条件の書き方がちがいます（例: ${condExample()}）` : `半角の数字で入れよう（例: ${ex}）`;
        if (key) bad.set(key, { raw, label: opts.label || "式", msg: `${how}。直すまで、前の「${old}」のままです。` });
        render();
      }
    });
    inp.addEventListener("input", () => {
      inp.size = Math.max(3, inp.value.length + 1);
    });
    if (!badNow) return inp;
    return h("span", { class: "blk-expr-wrap" }, inp, h("span", { class: "blk-bad-msg", id: msgId }, badNow.msg));
  }

  function condExample() {
    const s = ed.sensors[0];
    return s && s.kind === "color" ? `${s.name} == 線` : `${s ? s.name : "前の距離"} < 30`;
  }

  function select(options, value, onPick, label, cls = "blk-sel") {
    const sel = h("select", { class: cls, "aria-label": label }, options.map(([v, t]) => h("option", { value: v, selected: v === value ? "selected" : null }, t)));
    sel.addEventListener("change", () => onPick(sel.value));
    return sel;
  }

  function nameSelect(value, onPick, label) {
    const sel = h("select", { class: "blk-sel", "aria-label": label });
    const groups = [
      ["センサ", sensorNames()],
      ["変数", vars()],
    ];
    let found = false;
    for (const [g, list] of groups) {
      if (!list.length) continue;
      const og = h("optgroup", { label: g });
      for (const n of list) {
        if (n === value) found = true;
        og.append(h("option", { value: n, selected: n === value ? "selected" : null }, n));
      }
      sel.append(og);
    }
    // 設計から外したセンサを使っているときも、名前は出しておく（まちがいの箱で知らせる）
    if (!found) sel.prepend(h("option", { value, selected: "selected" }, `${value}（付いていない）`));
    sel.addEventListener("change", () => onPick(sel.value));
    return sel;
  }

  function condField(node, key) {
    const e = node[key];
    const simple = e.type === "bin" && CMP.includes(e.op) && e.left.type === "name" && !(e.left.name in WORDS) && (e.right.type === "num" || e.right.type === "name" || e.right.type === "neg");
    const wrap = h("span", { class: "blk-cond" });
    if (!simple || node._raw) {
      wrap.append(exprInput(() => node[key], (v) => (node[key] = v), { label: "条件", key: `${node.id}:${key}:raw`, cond: true }));
      if (!simple) return wrap;
      wrap.append(h("button", { type: "button", class: "blk-mini", title: "えらぶ形にもどす", onclick: () => { delete node._raw; render(); } }, "▾"));
      return wrap;
    }
    wrap.append(nameSelect(e.left.name, (v) => {
      e.left = { type: "name", name: v };
      if (isColor(v)) { e.op = "=="; e.right = { type: "name", name: "線" }; }
      else if (e.right.type === "name" && e.right.name in WORDS) { e.op = "<"; e.right = { type: "num", value: 30 }; }
      changed();
    }, "くらべるもの"));
    wrap.append(select(CMP.map((o) => [o, CMP_LABEL[o]]), e.op, (v) => { e.op = v; changed(); }, "くらべ方", "blk-sel blk-op"));
    if (isColor(e.left.name) && (e.right.type === "name" || e.right.type === "num")) {
      const cur = e.right.type === "name" ? e.right.name : e.right.value ? "線" : "地面";
      wrap.append(select([["線", "線（1）"], ["地面", "地面（0）"]], cur, (v) => { e.right = { type: "name", name: v }; changed(); }, "色"));
    } else {
      wrap.append(exprInput(() => e.right, (v) => (e.right = v), { label: "くらべる値", key: `${node.id}:${key}:right`, example: "30", anyExpr: true }));
      if (/距離/.test(e.left.name)) wrap.append(h("span", { class: "blk-word" }, "cm"));
    }
    wrap.append(h("button", { type: "button", class: "blk-mini", title: "式で書く（かつ・または など）", onclick: () => { node._raw = true; render(); } }, "✎"));
    return wrap;
  }

  function assignFields(n) {
    if (n.name === "走行") {
      return [
        h("span", { class: "blk-word strong", "aria-hidden": "true" }, "🚙"),
        select(DRIVE_WORDS.map((w) => [w, DRIVE_LABEL[w]]), n.value.name, (v) => { n.value = { type: "name", name: v }; changed(); }, "動き"),
      ];
    }
    if (n.name === "左のモーター" || n.name === "右のモーター") {
      return [
        select([["左のモーター", "左のモーター"], ["右のモーター", "右のモーター"]], n.name, (v) => { n.name = v; changed(); }, "モーター"),
        h("span", { class: "blk-word" }, "を"),
        select(MOTOR_WORDS.map((w) => [w, MOTOR_LABEL[w]]), n.value.name, (v) => { n.value = { type: "name", name: v }; changed(); }, "回し方"),
      ];
    }
    const vs = vars();
    const sel = h("select", { class: "blk-sel", "aria-label": "変数" }, vs.map((v) => h("option", { value: v, selected: v === n.name ? "selected" : null }, v)), h("option", { value: "__new" }, "＋新しい変数…"));
    sel.addEventListener("change", () => {
      if (sel.value === "__new") {
        const name = (prompt("変数の名前（例: distance、回数）") || "").trim().normalize("NFKC");
        if (!name || /[\s=<>!()"「」]/.test(name) || /^\d/.test(name) || name in WORDS || OUTPUTS.includes(name) || /距離$|色$/.test(name)) {
          if (name) alert("その名前は使えません（数字で始まる名前・センサや決まった言葉と同じ名前・空白は使えません）");
          render();
          return;
        }
        n.name = name;
      } else n.name = sel.value;
      changed();
    });
    return [h("span", { class: "blk-word strong" }, "変数"), sel, h("span", { class: "blk-word" }, "を"), exprInput(() => n.value, (v) => (n.value = v), { label: "値", key: `${n.id}:value`, example: "前の距離", anyExpr: true }), h("span", { class: "blk-word" }, "にする")];
  }

  function slot(list, index, inMoving) {
    if (ed.moving) {
      return h(
        "button",
        {
          type: "button",
          class: "blk-slot move-target",
          disabled: inMoving ? "disabled" : null,
          "aria-label": "ここへ動かす",
          onclick: () => {
            const r = moveNode(ed.program, ed.moving, list, index);
            ed.moving = null;
            if (r) ed.cursor = { list: r.list, index: r.index + 1 };
            changed();
          },
        },
        h("span", { class: "blk-slot-pill" }, inMoving ? "（この中へは動かせません）" : "▶ ここへ動かす"),
      );
    }
    const cur = currentCursor();
    const active = cur.list === list && cur.index === index;
    return h(
      "button",
      {
        type: "button",
        class: `blk-slot${active ? " active" : ""}`,
        "aria-pressed": active ? "true" : "false",
        "aria-label": active ? "ここに入れる（えらんでいます）" : "ここに入れる",
        onclick: () => {
          ed.cursor = { list, index };
          render();
        },
      },
      h("span", { class: "blk-slot-pill" }, active ? "▶ ここに入れる（上のボタンで命令をえらぶ）" : "＋ ここに入れる"),
    );
  }

  function tools(list, i) {
    const n = list[i];
    const mk = (label, title, fn, disabled) => h("button", { type: "button", class: "blk-tool", title, "aria-label": title, disabled: disabled ? "disabled" : null, onclick: fn }, label);
    return h(
      "span",
      { class: "blk-tools" },
      mk("↑", "上へ", () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; changed(); }, i === 0),
      mk("↓", "下へ", () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; changed(); }, i === list.length - 1),
      mk("↔", "べつの場所へ動かす", () => { ed.moving = ed.moving === n ? null : n; render(); }),
      mk("⧉", "コピー", () => { list.splice(i + 1, 0, clone(n)); changed(); }),
      mk("✕", "消す", () => {
        const inner = innerCount(n);
        if (inner && !confirm(`「${blockLabel(n)}」の中のブロック（${inner}こ）も、いっしょに消えます。消してもいいですか？\n（まちがえて消したときは「↶ 元にもどす」でもどせます）`)) return;
        list.splice(i, 1);
        ed.cursor = { list, index: i };
        changed();
      }),
    );
  }

  function clone(n) {
    const c = JSON.parse(JSON.stringify(n, (k, v) => (k === "_raw" ? undefined : v)));
    const re = (x) => {
      x.id = newId();
      for (const k of ["body", "then", "else"]) if (Array.isArray(x[k])) x[k].forEach(re);
    };
    re(c);
    return c;
  }

  function renderList(list, inMoving = false) {
    const box = h("div", { class: "blk-list" });
    list.forEach((n, i) => {
      box.append(slot(list, i, inMoving));
      box.append(renderNode(list, i, inMoving || n === ed.moving));
    });
    box.append(slot(list, list.length, inMoving));
    return box;
  }

  function kindClass(n) {
    if (n.type !== "assign") return `blk-${n.type}`;
    if (n.name === "走行") return "blk-assign blk-drive";
    if (n.name === "左のモーター" || n.name === "右のモーター") return "blk-assign blk-motor";
    return "blk-assign blk-var";
  }

  function renderNode(list, i, inMoving = false) {
    const n = list[i];
    const cls = `blk ${kindClass(n)}${n.id === ed.currentId ? " current" : ""}${n === ed.moving ? " moving" : ""}`;
    const head = h("div", { class: "blk-head" });
    const el = h("div", { class: cls, "data-id": n.id }, head);
    switch (n.type) {
      case "assign":
        head.append(...assignFields(n));
        break;
      case "wait":
        head.append(exprInput(() => n.secs, (v) => (n.secs = v), { label: "秒数", key: `${n.id}:secs`, example: "1" }), h("span", { class: "blk-word" }, "秒待つ"));
        break;
      case "comment": {
        const inp = h("input", { type: "text", class: "blk-expr blk-comment-text", value: n.text, "aria-label": "メモ" });
        inp.addEventListener("change", () => { n.text = inp.value.replace(/\n/g, " "); changed(); });
        head.append(h("span", { class: "blk-word" }, "メモ:"), inp);
        break;
      }
      case "forever":
        head.append(h("span", { class: "blk-word strong" }, "ずっとくり返す"));
        break;
      case "repeat":
        head.append(exprInput(() => n.count, (v) => (n.count = v), { label: "回数", key: `${n.id}:count`, example: "4" }), h("span", { class: "blk-word strong" }, "回くり返す"));
        break;
      case "while":
        head.append(condField(n, "cond"), h("span", { class: "blk-word strong" }, "のあいだくり返す"));
        break;
      case "if":
        head.append(h("span", { class: "blk-word strong" }, "もし"), condField(n, "cond"), h("span", { class: "blk-word strong" }, "なら"));
        break;
    }
    head.append(tools(list, i));
    if (n.body) el.append(h("div", { class: "blk-inner" }, renderList(n.body, inMoving)), h("div", { class: "blk-foot" }, "ここまで"));
    if (n.type === "if") {
      el.append(h("div", { class: "blk-inner" }, renderList(n.then, inMoving)));
      if (n.else) {
        el.append(
          h("div", { class: "blk-mid" }, h("span", { class: "blk-word strong" }, "でなければ"), h("button", { type: "button", class: "blk-mini", onclick: () => { n.else = null; changed(); } }, "「でなければ」を外す")),
          h("div", { class: "blk-inner" }, renderList(n.else, inMoving)),
        );
      } else {
        el.append(h("div", { class: "blk-mid" }, h("button", { type: "button", class: "blk-mini", onclick: () => { n.else = []; ed.cursor = { list: n.else, index: 0 }; changed(); } }, "＋「でなければ」を付ける")));
      }
      el.append(h("div", { class: "blk-foot" }, "ここまで"));
    }
    return el;
  }

  function render() {
    const scroll = ed.el.querySelector(".blk-canvas")?.scrollTop || 0;
    shownKeys = new Set();
    const group = (g, title) =>
      h(
        "div",
        { class: "blk-pgroup" },
        h("span", { class: "blk-pgroup-title" }, title),
        PALETTE.filter((p) => p[3] === g).map(([kind, label, title2]) => h("button", { type: "button", class: `blk-add blk-add-${kind.replace(/:.*/, "")}`, title: title2, "data-kind": kind, onclick: () => insert(kind) }, label)),
      );
    const palette = h("div", { class: "blk-palette", role: "group", "aria-label": "命令を追加" }, group("move", "動き"), group("ctrl", "判断・くり返し"), group("etc", "そのほか"));
    const howto = ed.moving
      ? h(
          "div",
          { class: "blk-howto moving", role: "status" },
          h("span", {}, "「", h("strong", {}, blockLabel(ed.moving)), "」を動かします。動かしたい場所の「▶ ここへ動かす」を押そう。"),
          h("button", { type: "button", class: "btn secondary small", onclick: () => { ed.moving = null; render(); } }, "やめる"),
        )
      : h("p", { class: "blk-howto" }, h("strong", {}, "入れ方: "), "①入れたい場所の「＋ ここに入れる」を押す → ②下の命令のボタンを押す");
    const legend = h("p", { class: "blk-legend" }, "右のボタン: ", TOOL_LEGEND.map(([k, v]) => h("span", { class: "blk-legend-item" }, h("b", { "aria-hidden": "true" }, k), " ", v)));
    const canvas = h("div", { class: "blk-canvas" }, renderList(ed.program));
    ed.el.replaceChildren(h("div", { class: "blk-top" }, howto, palette, legend), canvas);
    canvas.scrollTop = scroll;
    for (const k of [...bad.keys()]) if (!shownKeys.has(k)) bad.delete(k);
    const sig = [...bad.entries()].map(([k, v]) => `${k}=${v.raw}`).join("|");
    if (sig !== lastBadSig) {
      lastBadSig = sig;
      onInputErrors?.();
    }
  }

  ed.render = render;
  ed.setSensors = (list) => {
    ed.sensors = list;
    render();
  };
  ed.setProgram = (p, opts = {}) => {
    ed.program = p;
    ed.cursor = opts.memoCursor ? memoCursor(p) : null;
    ed.moving = null;
    bad.clear();
    render();
  };
  ed.inputErrors = () => [...bad.values()].map((b) => ({ message: `ブロックの「${b.label}」の欄${String(b.raw).trim() ? `に「${b.raw}」と入っています` : "が空です"}。${b.msg}` }));
  ed.highlight = (id) => {
    ed.currentId = id;
    ed.el.querySelectorAll(".blk.current").forEach((x) => x.classList.remove("current"));
    if (id != null) ed.el.querySelector(`.blk[data-id="${id}"]`)?.classList.add("current");
  };
  return ed;
}
