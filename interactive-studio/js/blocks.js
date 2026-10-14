// ブロックエディタ。ブロックはパレットから「ここに追加」の位置へ入れるか、つまみ（⠿）をドラッグして動かす。
// マウス・タッチ・キーボード（Tab で「ここに追加」を選んで Enter）のどれでも操作できる。
import { h } from "./ui.js";
import { parseExpr, parse, isIdentifier, strLit } from "./lang.js";
import { codeToBlocks, splitCompare, joinCompare, COMPARE_OPS, exprVarNames, hasJapanese } from "./blockmodel.js";

export const CATS = {
  event: "イベント",
  io: "表示と入力",
  var: "変数とリスト",
  ctrl: "分岐と反復（くり返し）",
  ui: "画面の部品",
  server: "サーバー",
  other: "その他",
};

const E = (key, slot) => ({ f: "expr", key, slot });

export const SPECS = {
  show: { cat: "io", parts: [E("expr", "text"), "を表示する"] },
  clear: { cat: "io", parts: ["表示を全部消す"] },
  ask: { cat: "io", parts: [E("prompt", "text"), "とたずねて、答えを", { f: "name", key: "name" }, "に入れる"] },
  choose: { cat: "io", parts: [E("prompt", "text"), "と聞いて", { f: "options" }, "から選んだ答えを", { f: "name", key: "name" }, "に入れる"] },
  wait: { cat: "io", parts: [E("expr", "num"), "秒待つ"] },
  set: { cat: "var", parts: [{ f: "name", key: "name" }, "を", E("expr", "expr"), "にする"] },
  change: { cat: "var", parts: [{ f: "name", key: "name" }, "を", E("expr", "num"), "ずつ", { f: "op" }] },
  setitem: { cat: "var", parts: ["リスト", { f: "name", key: "name" }, "の", E("index", "num"), "番目を", E("expr", "expr"), "にする"] },
  push: { cat: "var", parts: ["リスト", { f: "name", key: "name" }, "に", E("expr", "text"), "を追加する"] },
  if: { cat: "ctrl", parts: ["もし", E("cond", "cond"), "なら"], body: true },
  ifelse: { cat: "ctrl", parts: ["もし", E("cond", "cond"), "なら"], body: true, else: true },
  repeat: { cat: "ctrl", parts: [E("count", "num"), "回くり返す"], body: true },
  while: { cat: "ctrl", parts: [E("cond", "cond"), "のあいだ、くり返す"], body: true },
  break: { cat: "ctrl", parts: ["くり返しをぬける"] },
  when: { cat: "event", parts: ["ボタン", { f: "part", key: "part", type: "button" }, "が押されたとき"], body: true, top: true },
  settext: { cat: "ui", parts: ["部品", { f: "part", key: "part" }, "の文字を", E("expr", "text"), "にする"] },
  save: { cat: "server", parts: ["サーバーの箱", { f: "coll", key: "coll" }, "に", E("expr", "expr"), "を保存する"] },
  addscore: { cat: "server", parts: ["サーバーの箱", { f: "coll", key: "coll" }, "に", E("player", "expr"), "さんの得点", E("score", "num"), "を登録する"] },
  comment: { cat: "other", parts: ["メモ:", { f: "text", key: "text" }] },
  code: { cat: "other", parts: ["コード:", { f: "code", key: "code" }] },
};

// パレット（中身はコードの切れはし。入れるときにブロックに変換する）
export const PALETTE = [
  { cat: "io", label: "表示する", code: 'show("こんにちは");' },
  { cat: "io", label: "文字と変数をつなげて表示", code: 'show("得点は" + score + "点");' },
  { cat: "io", label: "たずねる（入力）", code: 'let answer = ask("名前は？");' },
  { cat: "io", label: "選ばせる（ボタン）", code: 'let answer = choose("どれにする？", "A", "B", "C");' },
  { cat: "io", label: "表示を消す", code: "clear();" },
  { cat: "io", label: "待つ", code: "wait(1);" },
  { cat: "var", label: "変数に入れる", code: "let score = 0;" },
  { cat: "var", label: "変数を増やす", code: "score += 1;" },
  { cat: "var", label: "リストを作る", code: "let names = [];" },
  { cat: "var", label: "リストに追加", code: 'push(names, "たろう");' },
  { cat: "var", label: "リストの1つを変える", code: 'names[0] = "はなこ";' },
  { cat: "ctrl", label: "もし", code: "if (score > 3) {\n}" },
  { cat: "ctrl", label: "もし〜でなければ", code: 'if (answer == "はい") {\n} else {\n}' },
  { cat: "ctrl", label: "回数くり返す", code: "repeat (3) {\n}" },
  { cat: "ctrl", label: "条件でくり返す", code: "while (score < 10) {\n}" },
  { cat: "ctrl", label: "くり返しをぬける", code: "break;" },
  { cat: "event", label: "ボタンが押されたとき", code: 'when ("$button") {\n}' },
  // 画面に部品を置く（ブロックではなく、実行画面に部品を足す。IS-07）
  { cat: "ui", label: "＋ ボタンを置く", part: "button" },
  { cat: "ui", label: "＋ ラベルを置く", part: "label" },
  { cat: "ui", label: "＋ 入力ボックスを置く", part: "input" },
  { cat: "ui", label: "部品の文字を変える", code: 'setText("$part", "こんにちは");' },
  { cat: "ui", label: "入力ボックスの中身を受け取る", code: 'let name = getText("$input");' },
  { cat: "server", label: "サーバーに保存", code: 'server.save("アンケート", answer);' },
  { cat: "server", label: "件数を数える", code: 'let n = server.count("アンケート", "はい");' },
  { cat: "server", label: "保存した値の一覧", code: 'let all = server.list("アンケート");' },
  { cat: "server", label: "得点を登録", code: 'server.addScore("ランキング", name, score);' },
  { cat: "server", label: "ランキングを受け取る", code: 'let top = server.ranking("ランキング", 5);' },
  { cat: "other", label: "メモ", code: "// メモ" },
  { cat: "other", label: "さいころの目を表示する（例）", code: "show(random(1, 6));" },
];

function detectMode(src, slot) {
  if (slot !== "text" && slot !== "expr") return "expr";
  if (String(src).trim() === "") return slot === "text" ? "text" : "expr";
  try {
    return parseExpr(src).type === "str" ? "text" : "expr";
  } catch {
    return "expr";
  }
}

function exprError(src) {
  if (String(src).trim() === "") return "値を入れましょう";
  try {
    parseExpr(src);
    return "";
  } catch (e) {
    return e.message;
  }
}

function codeError(src) {
  try {
    const p = parse(src);
    if (p.body.length !== 1) return "1つの文にしましょう";
    return "";
  } catch (e) {
    return e.message;
  }
}

// 「文字」の欄に、" や変数が打たれている（式にしたいのかもしれない）
function wantsExpr(value, known) {
  if (value.includes('"')) return true;
  try {
    const e = parseExpr(value);
    return e.type !== "str" && exprVarNames(value).some((n) => known.has(n));
  } catch {
    return false;
  }
}

// 「文字」から「式」に切りかえるとき、打った中身をそのまま式として使うか
function rawAsExpr(value, known) {
  if (!value.trim()) return false;
  if (value.includes('"')) return true;
  try {
    const e = parseExpr(value);
    if (e.type !== "var") return true;
    return known.has(e.name) || /^[A-Za-z_$][\w$]*$/.test(e.name);
  } catch {
    return false;
  }
}

const sizeTo = (input) => {
  const n = [...input.value].reduce((s, c) => s + (c.charCodeAt(0) > 255 ? 2 : 1), 0);
  input.size = Math.max(2, Math.min(48, n + 1));
};

const clone = (b) => JSON.parse(JSON.stringify(b));

// タブレットで、名前が大文字になったり、勝手に直されたりしないように（IS-11）
const NO_AUTO = { autocapitalize: "off", autocorrect: "off", spellcheck: "false" };
const SLOT_LABEL = { text: "文字", expr: "値", cond: "条件", condtext: "条件", num: "数", val: "くらべるもの" };
const OP_LABEL = { "==": "==（同じ）", "!=": "!=（ちがう）", ">": ">（より大きい）", "<": "<（より小さい）", ">=": ">=（以上）", "<=": "<=（以下）" };
// 「もし」などの中にいるとき、外に出る位置の名前（IS-04）
const EXIT_LABEL = { if: "「もし」", ifelse: "「もし」", repeat: "「くり返し」", while: "「くり返し」", when: "「ボタンが押されたとき」" };
const PART_TYPE_NAME = { label: "ラベル", input: "入力ボックス", button: "ボタン" };

export class BlockEditor {
  // onChange(structural): ブロックが変わった。getParts(): 画面の部品。readOnly: デバッグ用の表示だけ
  // getVars(): いまのプログラムの変数の名前。onAddPart(type, id): 画面に部品を置いて、その名前を返す
  constructor({ onChange = () => {}, getParts = () => [], getVars = () => [], readOnly = false, varListId = "" } = {}) {
    this.onChange = onChange;
    this.getParts = getParts;
    this.getVars = getVars;
    this.readOnly = readOnly;
    this.varListId = varListId;
    this.blocks = [];
    this.cursor = null; // 最初は、いちばん下（最後のブロックの後ろ）にする（IS-04）
    this.lists = new Map();
    this.el = h("div", { class: "workspace" + (readOnly ? " readonly" : ""), role: "tree", "aria-label": "ブロック" });
  }

  load(blocks) {
    this.blocks = blocks;
    if (!this.cursor || !this.cursorValid()) this.cursor = { path: "r", index: blocks.length };
    this.render();
  }

  cursorValid() {
    if (!this.cursor) return false;
    const list = this.listAt(this.cursor.path);
    return list && this.cursor.index <= list.length;
  }

  // パス "r:2.b:0.e"（いちばん外側の2番目のブロックの中 → その0番目の「でなければ」側）→ リスト
  listAt(path) {
    let list = this.blocks;
    const segs = path.split(":");
    if (segs[0] !== "r") return null;
    for (let k = 1; k < segs.length; k++) {
      const [idx, which] = segs[k].split(".");
      const b = list[Number(idx)];
      if (!b) return null;
      list = which === "e" ? b.else : b.body;
      if (!list) return null;
    }
    return list;
  }

  // リストの場所（パス）を、いまのブロックの並びから探す（動かしたあとで位置を合わせるのに使う）
  pathOf(target) {
    const find = (list, path) => {
      if (list === target) return path;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        for (const [which, sub] of [["b", b.body], ["e", b.else]]) {
          if (!sub) continue;
          const hit = find(sub, `${path}:${i}.${which}`);
          if (hit) return hit;
        }
      }
      return null;
    };
    return find(this.blocks, "r");
  }

  render() {
    this.lists.clear();
    const scrollY = window.scrollY;
    this.el.replaceChildren();
    this.renderList(this.blocks, "r", this.el);
    if (!this.blocks.length && this.readOnly) this.el.append(h("p", { class: "hint" }, "ブロックがありません"));
    window.scrollTo({ top: scrollY });
  }

  renderList(list, path, container) {
    this.lists.set(path, list);
    if (!this.readOnly) container.append(this.gap(path, 0, list.length === 0));
    list.forEach((b, i) => {
      container.append(this.renderBlock(b, path, i));
      if (this.readOnly) return;
      // 位置が、このブロックのすぐ中にあるときは、すぐ下のすき間に「外に入れる」を出す
      const c = this.cursor;
      const inside = c && (c.path === `${path}:${i}.b` || c.path === `${path}:${i}.e`);
      container.append(this.gap(path, i + 1, false, inside ? EXIT_LABEL[b.kind] || "ブロック" : ""));
    });
  }

  // ブロックとブロックのすき間。押すと「▶ ここに追加されます」がそこに動く
  gap(path, index, empty, exit = "") {
    const sel = Boolean(this.cursor) && this.cursor.path === path && this.cursor.index === index;
    const kind = sel ? " cursor" : empty ? " empty" : exit ? " exit" : "";
    const g = h(
      "button",
      {
        type: "button",
        class: "gap" + kind,
        "aria-label": sel ? "追加する位置（選択中）" : exit ? `${exit}の外（この下）に追加する位置を選ぶ` : "ここに追加する位置を選ぶ",
        "aria-pressed": sel ? "true" : "false",
      },
      sel ? "▶ ここに追加されます" : empty ? "（ここにブロックを入れる）" : exit ? `＋ ${exit}の外（この下）に入れる` : h("span", { class: "gap-plus", "aria-hidden": "true" }, "＋"),
    );
    g._path = path;
    g._index = index;
    g.addEventListener("click", () => {
      this.cursor = { path, index };
      this.render();
      this.el.querySelector(".gap.cursor")?.focus();
    });
    return g;
  }

  renderBlock(b, path, i) {
    const spec = SPECS[b.kind] || SPECS.code;
    const bpath = `${path}:${i}`;
    const head = h("div", { class: "block-head", dataset: { line: b.line || "" } });
    const el = h("div", { class: `block cat-${spec.cat}`, role: "treeitem" }, head);
    el._path = bpath;
    if (!this.readOnly) {
      const handle = h("span", { class: "handle", title: "ドラッグして動かす", "aria-hidden": "true" }, "⠿");
      handle.addEventListener("pointerdown", (e) => this.startDrag(e, el, path, i));
      head.append(handle);
    }
    for (const part of spec.parts) {
      if (typeof part === "string") head.append(h("span", { class: "word" }, part));
      else head.append(this.field(b, part));
    }
    if (!this.readOnly) head.append(this.tools(path, i));
    if (spec.body) {
      b.body ||= [];
      const body = h("div", { class: "block-body" });
      this.renderList(b.body, `${bpath}.b`, body);
      el.append(body);
    }
    if (spec.else) {
      b.else ||= [];
      el.append(h("div", { class: "block-mid" }, h("span", { class: "word" }, "でなければ")));
      const body = h("div", { class: "block-body" });
      this.renderList(b.else, `${bpath}.e`, body);
      el.append(body);
    }
    if (spec.body) el.append(h("div", { class: "block-foot" }));
    return el;
  }

  tools(path, i) {
    const list = this.lists.get(path);
    const btn = (label, aria, fn, disabled) => h("button", { type: "button", class: "tool", "aria-label": aria, title: aria, disabled: disabled || null, onclick: fn }, label);
    return h(
      "span",
      { class: "tools" },
      btn("↑", "上へ", () => this.move(path, i, path, i - 1), i === 0),
      btn("↓", "下へ", () => this.move(path, i, path, i + 2), i === list.length - 1),
      btn("⧉", "複製", () => {
        list.splice(i + 1, 0, clone(list[i]));
        // 位置は、できたブロックの下へ（IS-04）
        this.cursor = { path: this.pathOf(list) || path, index: i + 2 };
        this.changed(true);
      }),
      btn("✕", "削除", () => {
        const curList = this.cursor && this.listAt(this.cursor.path);
        const idx = this.cursor ? this.cursor.index : 0;
        list.splice(i, 1);
        const p = curList && this.pathOf(curList);
        if (p) this.cursor = { path: p, index: curList === list && idx > i ? idx - 1 : idx };
        else this.cursor = { path: this.pathOf(list) || "r", index: i }; // 消したブロックの中にあったときは、消した場所へ
        this.changed(true);
      }),
    );
  }

  changed(structural) {
    this.onChange(structural);
  }

  field(b, part) {
    const f = (b.f ||= {});
    const ro = this.readOnly;
    switch (part.f) {
      case "expr":
        return this.slot(f, part.key, part.slot);
      case "name": {
        const input = h("input", { type: "text", class: "fld name", value: f[part.key] || "", "aria-label": "変数の名前", list: this.varListId || null, disabled: ro || null, ...NO_AUTO });
        const check = () => {
          const ok = isIdentifier(input.value);
          input.classList.toggle("invalid", !ok);
          input.title = ok ? "" : "変数の名前は文字で始め、スペースや記号を入れません（例: score, 点数）";
        };
        input.addEventListener("input", () => {
          f[part.key] = input.value.trim();
          sizeTo(input);
          check();
          this.changed(false);
        });
        sizeTo(input);
        check();
        return input;
      }
      case "part": {
        const parts = this.getParts().filter((p) => !part.type || p.type === part.type);
        const sel = h("select", { class: "fld part", "aria-label": part.type === "button" ? "ボタン" : "部品", disabled: ro || null });
        const ids = parts.map((p) => p.id);
        for (const p of parts) sel.append(h("option", { value: p.id }, `${p.id}（${{ label: "ラベル", input: "入力", button: "ボタン" }[p.type]}）`));
        if (f[part.key] && !ids.includes(f[part.key])) sel.append(h("option", { value: f[part.key] }, `${f[part.key]}（画面にない）`));
        if (!sel.options.length) sel.append(h("option", { value: "" }, "部品がありません"));
        sel.value = f[part.key] || "";
        sel.classList.toggle("invalid", !ids.includes(f[part.key]));
        sel.title = ids.includes(f[part.key]) ? "" : "「＋ 画面に置く」か、実行タブの「部品の配置」で部品を置こう";
        sel.addEventListener("change", () => {
          f[part.key] = sel.value;
          this.changed(true);
        });
        if (ro || ids.includes(f[part.key]) || !this.onAddPart) return sel;
        // 画面にない部品は、ここからすぐ置ける（IS-07）
        const want = f[part.key] || "";
        const type = part.type || (/^input/i.test(want) ? "input" : /^button/i.test(want) ? "button" : "label");
        const add = h(
          "button",
          {
            type: "button",
            class: "tool add-part",
            title: `実行画面に${PART_TYPE_NAME[type]}を置きます`,
            onclick: () => {
              const id = this.onAddPart(type, want);
              if (!id) return;
              if (f[part.key] !== id) {
                f[part.key] = id;
                this.changed(true);
              } else this.render();
            },
          },
          `＋ 画面に置く`,
        );
        return h("span", { class: "part-pick" }, sel, add);
      }
      case "coll": {
        // 箱の名前: "朝ごはん" のような文字でも、box のような変数でもよい（IS-08）
        return this.slot(f, part.key, "text");
      }
      case "op": {
        const sel = h("select", { class: "fld", "aria-label": "増やすか減らすか", disabled: ro || null }, h("option", { value: "+=" }, "増やす"), h("option", { value: "-=" }, "減らす"));
        sel.value = f.op === "-=" ? "-=" : "+=";
        sel.addEventListener("change", () => {
          f.op = sel.value;
          this.changed(false);
        });
        return sel;
      }
      case "options": {
        const opts = (f.options ||= ['"A"']);
        const wrap = h("span", { class: "options" });
        opts.forEach((_, k) => {
          wrap.append(this.slot(opts, k, "text"));
          if (!ro && opts.length > 1)
            wrap.append(h("button", { type: "button", class: "tool mini", "aria-label": `選択肢${k + 1}を消す`, title: "この選択肢を消す", onclick: () => (opts.splice(k, 1), this.changed(true)) }, "−"));
        });
        if (!ro && opts.length < 12) wrap.append(h("button", { type: "button", class: "tool mini", "aria-label": "選択肢を増やす", title: "選択肢を増やす", onclick: () => (opts.push(strLit(`選択肢${opts.length + 1}`)), this.changed(true)) }, "＋"));
        return wrap;
      }
      case "text": {
        const input = h("input", { type: "text", class: "fld wide", value: f[part.key] || "", "aria-label": "メモ", disabled: ro || null, autocapitalize: "off", autocorrect: "off" });
        input.addEventListener("input", () => {
          f[part.key] = input.value;
          this.changed(false);
        });
        return input;
      }
      case "code": {
        const input = h("input", { type: "text", class: "fld wide mono", value: f[part.key] || "", "aria-label": "コード", disabled: ro || null, ...NO_AUTO });
        const check = () => {
          const msg = codeError(input.value);
          input.classList.toggle("invalid", Boolean(msg));
          input.title = msg;
        };
        input.addEventListener("input", () => {
          f[part.key] = input.value;
          check();
          this.changed(false);
        });
        check();
        return input;
      }
    }
    return h("span");
  }

  // 値を入れる欄。「文字」モードでは " を自動で付ける。「式」モードでは計算や変数を書ける
  // onSet: 値が変わったとき（条件の3つの欄を、1つの条件にまとめるのに使う）
  slot(obj, key, slot, onSet) {
    const ro = this.readOnly;
    if (slot === "cond" && !ro) return this.condSlot(obj, key);
    let mode = detectMode(obj[key] ?? "", slot);
    let tg = null; // 「文字／式」の切りかえボタン（切りかえられる欄だけ）
    const wrap = h("span", { class: `slot slot-${mode}` });
    const input = h("input", {
      type: "text",
      class: "fld" + (slot === "cond" || slot === "condtext" ? " cond" : ""),
      "aria-label": SLOT_LABEL[slot] || "値",
      list: slot === "val" && this.varListId ? this.varListId : null,
      disabled: ro || null,
      ...NO_AUTO,
    });
    // マウスを乗せなくても見える注意（タブレットでも読めるように）
    const note = h("span", { class: "slot-note", hidden: true, "aria-live": "polite" });
    const set = (v) => {
      obj[key] = v;
      onSet?.();
      this.changed(false);
    };
    const fill = () => {
      const src = obj[key] ?? "";
      if (mode === "text") {
        try {
          const e = parseExpr(src);
          input.value = e.type === "str" ? e.v : src;
        } catch {
          input.value = src;
        }
      } else input.value = src;
      sizeTo(input);
    };
    const known = () => new Set(this.getVars());
    const updateNote = () => {
      if (ro) return;
      let text = "";
      let action = null;
      if (mode === "text") {
        if (wantsExpr(input.value, known())) {
          text = "変数や \" \"、+ を使うときは「式」にしよう。";
          action = h("button", { type: "button", class: "tool note-btn", onclick: () => toggle() }, "式に切りかえる");
        }
      } else {
        const k = known();
        const jp = exprVarNames(obj[key] ?? "").find((n) => hasJapanese(n) && !k.has(n));
        if (jp) {
          text = `「${jp}」は変数の名前として読まれます。文字として使うときは "${jp}" のように " " でかこもう。`;
          // 「文字／式」を切りかえられる欄なら、すぐ「文字」にできる
          if (tg) action = h("button", { type: "button", class: "tool note-btn", onclick: () => toggle() }, "文字にする");
        }
      }
      note.hidden = !text;
      note.replaceChildren(...(text ? [text, action] : []).filter(Boolean));
    };
    const check = () => {
      const msg = mode === "text" ? "" : exprError(obj[key] ?? "");
      input.classList.toggle("invalid", Boolean(msg));
      input.title = msg;
      updateNote();
    };
    fill();
    check();
    input.addEventListener("input", () => {
      sizeTo(input);
      set(mode === "text" ? strLit(input.value) : input.value);
      check();
    });
    wrap.append(input);
    const toggle = () => {
      if (mode === "text") {
        mode = "expr";
        // 「文字」で打った "得点は" + score を、\ を付けずにそのまま「式」へ移す（IS-05）
        if (rawAsExpr(input.value, known())) set(input.value);
      } else {
        mode = "text";
        if (detectMode(obj[key] ?? "", "text") !== "text") set(strLit(input.value));
      }
      wrap.className = `slot slot-${mode}`;
      tg.textContent = mode === "text" ? "文字" : "式";
      tg.setAttribute("aria-label", `入力のしかた: ${tg.textContent}（押すと切りかえ）`);
      fill();
      check();
      input.focus();
    };
    if (slot === "text" || slot === "expr") {
      tg = h("button", { type: "button", class: "mode", disabled: ro || null, title: "押すと「文字」と「式（計算・変数）」を切りかえ", "aria-label": `入力のしかた: ${mode === "text" ? "文字" : "式"}（押すと切りかえ）` }, mode === "text" ? "文字" : "式");
      tg.addEventListener("click", toggle);
      wrap.append(tg);
    }
    updateNote(); // 切りかえボタンができてから、もう一度
    return ro ? wrap : h("span", { class: "slot-outer" }, wrap, note);
  }

  // 「もし」「条件でくり返す」の条件: ［左］［== ▼］［右（文字／式）］の3つの欄（IS-05）。
  // and や or を使うときは「まとめて書く」で1つの欄にする
  condSlot(obj, key) {
    const outer = h("span", { class: "cond-wrap" });
    let free = false;
    const build = (focus) => {
      const parts = free ? null : splitCompare(obj[key] ?? "");
      if (!parts) {
        const back = splitCompare(obj[key] ?? "")
          ? h("button", { type: "button", class: "mode", title: "［左］［記号］［右］の3つの欄にもどす", onclick: () => ((free = false), build(true)) }, "くらべる形")
          : null;
        outer.replaceChildren(this.slot(obj, key, "condtext"), ...(back ? [back] : []));
        if (focus) outer.querySelector("input")?.focus();
        return;
      }
      const sync = () => (obj[key] = joinCompare(parts));
      const op = h("select", { class: "fld op", "aria-label": "くらべる記号" }, ...COMPARE_OPS.map((o) => h("option", { value: o }, OP_LABEL[o])));
      op.value = parts.op;
      op.addEventListener("change", () => {
        parts.op = op.value;
        sync();
        this.changed(false);
      });
      const freeBtn = h("button", { type: "button", class: "mode", title: "and や or を使うときは、条件を1つの欄にまとめて書けます", onclick: () => ((free = true), build(true)) }, "まとめて書く");
      outer.replaceChildren(this.slot(parts, "l", "val", sync), op, this.slot(parts, "r", "expr", sync), freeBtn);
      if (focus) outer.querySelector("input")?.focus();
    };
    build(false);
    return outer;
  }

  move(fromPath, fromIndex, toPath, toIndex) {
    const src = this.listAt(fromPath);
    const dst = this.listAt(toPath);
    if (!src || !dst || toIndex < 0 || toIndex > dst.length + (src === dst ? 1 : 0)) return;
    const node = src[fromIndex];
    if (SPECS[node.kind]?.top && toPath !== "r") {
      this.flash("「ボタンが押されたとき」は、いちばん外側にだけ置けます");
      return;
    }
    src.splice(fromIndex, 1);
    let ti = toIndex;
    if (src === dst && fromIndex < toIndex) ti--;
    dst.splice(ti, 0, node);
    // 位置は、動かしたブロックの下へ（IS-04）
    this.cursor = { path: this.pathOf(dst) || "r", index: ti + 1 };
    this.changed(true);
  }

  flash(msg) {
    this.onMessage?.(msg);
  }

  // パレットから入れる（コードの切れはしをブロックにして、選んだ位置へ）
  insertCode(code) {
    const blocks = codeToBlocks(code);
    if (!this.cursor) this.cursor = { path: "r", index: this.blocks.length };
    let list = this.listAt(this.cursor.path);
    let index = this.cursor.index;
    if (!list) {
      list = this.blocks;
      index = list.length;
    }
    if (blocks.some((b) => SPECS[b.kind]?.top) && this.cursor.path !== "r") {
      this.flash("「ボタンが押されたとき」は、いちばん外側に入れました");
      list = this.blocks;
      index = this.blocks.length;
      this.cursor = { path: "r", index };
    }
    const path = list === this.blocks ? "r" : this.cursor.path;
    list.splice(index, 0, ...blocks);
    const last = blocks[blocks.length - 1];
    if (SPECS[last.kind]?.body) this.cursor = { path: `${path}:${index + blocks.length - 1}.b`, index: 0 };
    else this.cursor = { path, index: index + blocks.length };
    this.changed(true);
  }

  highlight(line, cls = "running") {
    this.el.querySelectorAll(`.block-head.${cls}`).forEach((x) => x.classList.remove(cls));
    if (!line) return;
    const hit = this.el.querySelectorAll(`.block-head[data-line="${line}"]`);
    hit.forEach((x) => x.classList.add(cls));
    hit[0]?.scrollIntoView({ block: "nearest" });
  }

  // ---- ドラッグで動かす（マウス・タッチ共通） ----
  startDrag(e, blockEl, path, index) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let ghost = null;
    let target = null;
    const gaps = [...this.el.querySelectorAll(".gap")].filter((g) => !blockEl.contains(g));
    const move = (ev) => {
      if (!ghost && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
      if (!ghost) {
        ghost = h("div", { class: "drag-ghost" }, blockEl.querySelector(".block-head").textContent.replace(/[↑↓⧉✕⠿]/g, "").slice(0, 40));
        document.body.append(ghost);
        blockEl.classList.add("dragging");
        this.el.classList.add("is-dragging");
      }
      ghost.style.left = ev.clientX + 12 + "px";
      ghost.style.top = ev.clientY + 8 + "px";
      let best = null;
      let bestD = Infinity;
      for (const g of gaps) {
        const r = g.getBoundingClientRect();
        if (ev.clientX < r.left - 30 || ev.clientX > r.right + 30) continue;
        const d = Math.abs(ev.clientY - (r.top + r.height / 2));
        if (d < bestD) {
          bestD = d;
          best = g;
        }
      }
      if (target !== best) {
        target?.classList.remove("drop");
        best?.classList.add("drop");
        target = best;
      }
      if (ev.clientY < 50) window.scrollBy(0, -12);
      else if (ev.clientY > window.innerHeight - 50) window.scrollBy(0, 12);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      ghost?.remove();
      blockEl.classList.remove("dragging");
      this.el.classList.remove("is-dragging");
      target?.classList.remove("drop");
      if (ghost && target) this.move(path, index, target._path, target._index);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }
}
