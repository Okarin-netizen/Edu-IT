// ブロックエディタ: プログラムの木を、色分けしたブロックで組み立てる
// ドラッグは使わず「＋（ここに追加）を選ぶ → 上のボタンで命令を入れる」方式（タブレットでも操作しやすい）
import { h } from "./ui.js";
import { newId, parseExpr, exprToText, exprNames, numberFieldText, CONSTANTS, programToText, thresholdsOf } from "./lang.js";
import { OUTPUT_KINDS } from "./models.js";

const CMP = ["<", "<=", ">", ">=", "==", "!="];
const CMP_LABEL = { "<": "＜（より小さい）", "<=": "≦（以下）", ">": "＞（より大きい）", ">=": "≧（以上）", "==": "＝（等しい）", "!=": "≠（等しくない）" };

// ブロックの右の小さなボタンの意味（パレットの下に出す凡例と同じ）
export const TOOL_LEGEND = [
  ["↑↓", "上・下へ"],
  ["↔", "べつの場所へ動かす"],
  ["⧉", "コピー"],
  ["✕", "消す"],
  ["✎", "式で書く"],
];

// ブロックの1行目の文（「もし 明るさ < 30 なら」など）。動かすときや消すときの確認に使う
export function blockLabel(n) {
  return programToText([n]).split("\n")[0].trim();
}

// 中に入っているブロックの数（消す前の確認に使う）
export function innerCount(n) {
  let c = 0;
  for (const k of ["body", "then", "else"]) if (Array.isArray(n[k])) for (const x of n[k]) c += 1 + innerCount(x);
  return c;
}

// 「動かす」: node を list の index の位置へ移す。program は全体の木。
// 自分の中へは動かせない（false を返す）。動かせたら、動かしたあとの { list, index } を返す
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

// list が node の中（node 自身の body/then/else とその下）にあるか
function listInside(node, list) {
  for (const k of ["body", "then", "else"]) {
    if (!Array.isArray(node[k])) continue;
    if (node[k] === list) return true;
    for (const x of node[k]) if (listInside(x, list)) return true;
  }
  return false;
}

// list が program の木の中にあるか（消したブロックの中を選んだままにしない）
function listInProgram(program, list) {
  if (program === list) return true;
  for (const n of program) if (listInside(n, list)) return true;
  return false;
}

// はじめのプログラムの「# ここに…」のメモの下を、はじめから選んでおく（場面4 など）
export function memoCursor(program) {
  let found = null;
  const walk = (list) => list.forEach((n, i) => {
    if (found) return;
    if (n.type === "comment" && /ここに/.test(n.text)) found = { list, index: i + 1 };
    for (const k of ["body", "then", "else"]) if (Array.isArray(n[k])) walk(n[k]);
  });
  walk(program);
  return found;
}

export const PALETTE = [
  ["if", "もし〜なら", "条件で分ける"],
  ["ifelse", "もし〜なら／でなければ", "条件で2つに分ける"],
  ["assign", "出力・変数に入れる", "LEDをオンにする など"],
  ["wait", "〜秒待つ", "時間をあける"],
  ["forever", "ずっとくり返す", ""],
  ["repeat", "〜回くり返す", ""],
  ["while", "〜のあいだくり返す", ""],
  ["comment", "メモ", "説明を書く"],
];

// ed: { program, device, vars(), onChange(), currentId, cursor }
// onInputErrors: 読めない数の欄が増えたり減ったりしたときに呼ぶ（テストを止めるため）
export function createBlockEditor(device, onChange, onInputErrors) {
  const ed = { program: [], device, cursor: null, moving: null, currentId: null, el: h("div", { class: "blk-editor" }) };
  // 読めなかった欄: キー（ブロックのid:欄）→ { raw: 入れた文字, msg: 直し方, label: 欄の名前 }
  // 欄には入れた文字を残したまま、すぐ下に直し方を出す（前の数のまま、だまって動かさない）
  const bad = new Map();
  let shownKeys = new Set();
  let lastBadSig = "";
  const sensors = device.sensors.map((s) => s.name);
  const outputs = device.outputs.map((o) => o.name);
  const outputOf = (name) => device.outputs.find((o) => o.name === name);

  const vars = () => {
    const out = new Set();
    const walk = (list) => list.forEach((n) => {
      if (n.type === "assign" && !outputs.includes(n.name)) out.add(n.name);
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
    if (sensors.length) {
      const s = device.sensors[0];
      // ボタンのような オン/オフ のセンサは「ボタン ＝ オン」で出す
      if (s.max === 1) return { type: "bin", op: "==", left: { type: "name", name: s.name }, right: { type: "name", name: "オン" } };
      // 数は、プログラムですでに使っているしきい値か、その場面で使いそうな数にする
      const used = thresholdsOf(ed.program)[s.name]?.[0];
      const v = used ?? s.typical ?? Math.round((s.min + s.max) / 4);
      return { type: "bin", op: "<", left: { type: "name", name: s.name }, right: v < 0 ? { type: "neg", arg: { type: "num", value: -v } } : { type: "num", value: v } };
    }
    return { type: "bin", op: "==", left: { type: "name", name: outputs[0] }, right: { type: "name", name: "オン" } };
  }

  function makeNode(kind) {
    const id = newId();
    switch (kind) {
      case "if":
        return { id, type: "if", cond: defaultCond(), then: [], else: null };
      case "ifelse":
        return { id, type: "if", cond: defaultCond(), then: [], else: [] };
      case "assign": {
        const o = device.outputs[0];
        const ch = OUTPUT_KINDS[o.kind].choices;
        return { id, type: "assign", name: o.name, value: ch ? { type: "name", name: ch[0] } : { type: "num", value: 0 } };
      }
      case "wait":
        return { id, type: "wait", secs: { type: "num", value: 1 } };
      case "forever":
        return { id, type: "forever", body: [] };
      case "repeat":
        return { id, type: "repeat", count: { type: "num", value: 3 }, body: [] };
      case "while":
        return { id, type: "while", cond: defaultCond(), body: [] };
      case "comment":
        return { id, type: "comment", text: "メモ" };
    }
  }

  // 何も選んでいないとき: 最後の「ずっと」の中の最後（なければ全体の最後）
  function defaultCursor() {
    const last = ed.program.at(-1);
    if (last && last.type === "forever") return { list: last.body, index: last.body.length };
    return { list: ed.program, index: ed.program.length };
  }

  // 選んでいる「＋」（何も選んでいないときは、入る場所を「＋」で見せる）
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
    // 入れ物の命令なら、次はその中に入れられるようにする
    const inner = node.body || node.then;
    ed.cursor = inner ? { list: inner, index: 0 } : { list: cur.list, index: index + 1 };
    changed();
    requestAnimationFrame(() => ed.el.querySelector(`[data-id="${node.id}"]`)?.scrollIntoView({ block: "nearest" }));
  }

  // 式の入力欄（文字で式を書く）
  // opts: { label: 欄の名前, key: 欄を見分けるキー, example: 例の数, cond: 条件を式で書く欄か }
  function exprInput(get, set, opts = {}) {
    const key = opts.key || null;
    const badNow = key ? bad.get(key) : null;
    if (key) shownKeys.add(key);
    const text = badNow ? badNow.raw : exprToText(get());
    const msgId = key ? `blk-bad-${String(key).replace(/[^\w-]/g, "_")}` : null;
    const inp = h("input", { type: "text", class: `blk-expr${badNow ? " bad" : ""}`, value: text, size: Math.max(3, text.length + 1), "aria-label": opts.label || "式", "aria-invalid": badNow ? "true" : null, "aria-describedby": badNow ? msgId : null, spellcheck: "false" });
    inp.addEventListener("change", () => {
      const raw = inp.value;
      // 「150cm」「１５０」「1,000」などは、単位や空白をとって数として読む
      const num = numberFieldText(raw);
      const known = new Set([...sensors, ...outputs, ...vars(), ...Object.keys(CONSTANTS)]);
      try {
        const e = parseExpr(num ?? raw);
        // 「百五十」のように、数でも名前でもない言葉は、プログラムに入れずに知らせる
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
    return sensors.length ? `${sensors[0]} < 30` : `${outputs[0]} == オン`;
  }

  function nameSelect(value, names, onPick, label) {
    const sel = h("select", { class: "blk-sel", "aria-label": label });
    const groups = [
      ["センサ", sensors],
      ["出力", outputs],
      ["変数", vars()],
    ];
    for (const [g, list] of groups) {
      const items = list.filter((n) => names.includes(n));
      if (!items.length) continue;
      const og = h("optgroup", { label: g });
      for (const n of items) og.append(h("option", { value: n, selected: n === value ? "selected" : null }, n));
      sel.append(og);
    }
    sel.addEventListener("change", () => onPick(sel.value));
    return sel;
  }

  // 条件の欄: 「センサ ＜ 数」の形ならえらぶ式、それ以外は文字で
  function condField(node, key) {
    const e = node[key];
    const all = [...sensors, ...outputs, ...vars()];
    const simple = e.type === "bin" && CMP.includes(e.op) && e.left.type === "name" && all.includes(e.left.name) && (e.right.type === "num" || e.right.type === "name" || e.right.type === "neg");
    const wrap = h("span", { class: "blk-cond" });
    if (!simple || node._raw) {
      wrap.append(exprInput(() => node[key], (v) => (node[key] = v), { label: "条件", key: `${node.id}:${key}:raw`, cond: true }));
      if (!simple) return wrap;
      wrap.append(h("button", { type: "button", class: "blk-mini", title: "えらぶ形にもどす", onclick: () => { delete node._raw; render(); } }, "▾"));
      return wrap;
    }
    wrap.append(nameSelect(e.left.name, all, (v) => { e.left = { type: "name", name: v }; changed(); }, "くらべるもの"));
    const op = h("select", { class: "blk-sel blk-op", "aria-label": "くらべ方" }, CMP.map((o) => h("option", { value: o, selected: o === e.op ? "selected" : null }, CMP_LABEL[o])));
    op.addEventListener("change", () => { e.op = op.value; changed(); });
    wrap.append(op);
    const leftOut = outputOf(e.left.name);
    const choices = leftOut ? OUTPUT_KINDS[leftOut.kind].choices : e.left.name === "ボタン" || e.left.name === "人感" ? ["オン", "オフ"] : null;
    if (choices && e.right.type === "name" && choices.includes(e.right.name)) {
      wrap.append(choiceSelect(choices, e.right.name, (v) => { e.right = { type: "name", name: v }; changed(); }));
    } else {
      wrap.append(exprInput(() => e.right, (v) => (e.right = v), { label: "くらべる値", key: `${node.id}:${key}:right`, example: "100" }));
    }
    wrap.append(h("button", { type: "button", class: "blk-mini", title: "式で書く（かつ・または など）", onclick: () => { node._raw = true; render(); } }, "✎"));
    return wrap;
  }

  function choiceSelect(choices, value, onPick) {
    const sel = h("select", { class: "blk-sel", "aria-label": "値" }, choices.map((c) => h("option", { value: c, selected: c === value ? "selected" : null }, c)));
    sel.addEventListener("change", () => onPick(sel.value));
    return sel;
  }

  function assignFields(n) {
    const row = [];
    const sel = h("select", { class: "blk-sel", "aria-label": "入れる先" });
    const og1 = h("optgroup", { label: "出力" }, outputs.map((o) => h("option", { value: o, selected: o === n.name ? "selected" : null }, o)));
    const vs = vars();
    const og2 = h("optgroup", { label: "変数" }, vs.map((v) => h("option", { value: v, selected: v === n.name ? "selected" : null }, v)), h("option", { value: "__new" }, "＋新しい変数…"));
    sel.append(og1, og2);
    sel.addEventListener("change", () => {
      if (sel.value === "__new") {
        const name = (prompt("変数の名前（例: 回数、時間）") || "").trim().normalize("NFKC");
        if (!name || /[\s=<>!()"「」]/.test(name) || /^\d/.test(name) || name in CONSTANTS || sensors.includes(name) || outputs.includes(name)) {
          if (name) alert("その名前は使えません（数字で始まる名前・センサや出力と同じ名前・空白は使えません）");
          render();
          return;
        }
        n.name = name;
        n.value = { type: "num", value: 0 };
      } else {
        n.name = sel.value;
        const o = outputOf(n.name);
        const ch = o && OUTPUT_KINDS[o.kind].choices;
        if (ch && !(n.value.type === "name" && ch.includes(n.value.name))) n.value = { type: "name", name: ch[0] };
      }
      changed();
    });
    row.push(sel);
    const o = outputOf(n.name);
    const ch = o && OUTPUT_KINDS[o.kind].choices;
    if (o) {
      row.push(h("span", { class: "blk-word" }, "を"));
      if (ch && n.value.type === "name" && ch.includes(n.value.name)) {
        row.push(choiceSelect([...ch, "（式で書く）"], n.value.name, (v) => {
          n.value = v === "（式で書く）" ? { type: "num", value: 1 } : { type: "name", name: v };
          changed();
        }));
      } else row.push(exprInput(() => n.value, (v) => (n.value = v), { label: "値", key: `${n.id}:value`, example: "80" }));
      row.push(h("span", { class: "blk-word" }, "にする"));
    } else {
      row.push(h("span", { class: "blk-word" }, "に"));
      row.push(exprInput(() => n.value, (v) => (n.value = v), { label: "値", key: `${n.id}:value`, example: "0" }));
      row.push(h("span", { class: "blk-word" }, "を入れる"));
    }
    return row;
  }

  // inMoving: 動かしているブロックの中の「＋」（自分の中へは動かせない）
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
        // 中にブロックが入っているときは、いっしょに消えることを確かめる
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

  function renderNode(list, i, inMoving = false) {
    const n = list[i];
    const cls = `blk blk-${n.type}${n.id === ed.currentId ? " current" : ""}${n === ed.moving ? " moving" : ""}`;
    const head = h("div", { class: "blk-head" });
    const el = h("div", { class: cls, "data-id": n.id }, head);
    switch (n.type) {
      case "assign":
        head.append(...assignFields(n));
        break;
      case "wait":
        head.append(exprInput(() => n.secs, (v) => (n.secs = v), { label: "秒数", key: `${n.id}:secs`, example: "2" }), h("span", { class: "blk-word" }, "秒待つ"));
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
        head.append(exprInput(() => n.count, (v) => (n.count = v), { label: "回数", key: `${n.id}:count`, example: "3" }), h("span", { class: "blk-word strong" }, "回くり返す"));
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
    const palette = h(
      "div",
      { class: "blk-palette", role: "group", "aria-label": "命令を追加" },
      PALETTE.map(([kind, label, title]) => h("button", { type: "button", class: `blk-add blk-add-${kind}`, title, onclick: () => insert(kind) }, label)),
    );
    // 入れ方（どこに入るか）と、小さなボタンの意味を、いつも見えるところに書いておく
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
    // 消したブロックや、見えなくなった欄のまちがいは忘れる
    for (const k of [...bad.keys()]) if (!shownKeys.has(k)) bad.delete(k);
    const sig = [...bad.entries()].map(([k, v]) => `${k}=${v.raw}`).join("|");
    if (sig !== lastBadSig) {
      lastBadSig = sig;
      onInputErrors?.();
    }
  }

  ed.render = render;
  // opts.memoCursor: はじめの「# ここに…」のメモの下を選んでおく（ページを開いたとき）
  ed.setProgram = (p, opts = {}) => {
    ed.program = p;
    ed.cursor = opts.memoCursor ? memoCursor(p) : null;
    ed.moving = null;
    bad.clear();
    render();
  };
  // 読めなかった欄の一覧（まちがいの箱に出し、テストを止める）
  ed.inputErrors = () => [...bad.values()].map((b) => ({ message: `ブロックの「${b.label}」の欄${String(b.raw).trim() ? `に「${b.raw}」と入っています` : "が空です"}。${b.msg}` }));
  ed.highlight = (id) => {
    ed.currentId = id;
    ed.el.querySelectorAll(".blk.current").forEach((x) => x.classList.remove("current"));
    if (id != null) ed.el.querySelector(`.blk[data-id="${id}"]`)?.classList.add("current");
  };
  return ed;
}
