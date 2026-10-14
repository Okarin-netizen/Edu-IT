// ふりかえり欄の自動保存のテスト（node --test）。ブラウザの代わりに、小さなにせものの DOM と localStorage を使う。
import { test } from "node:test";
import assert from "node:assert/strict";

// ---- にせものの localStorage ----
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

// ---- にせものの DOM（records.js の reflectionBox が使う分だけ） ----
class Node {
  constructor() {
    this.children = [];
    this._text = "";
  }
  append(...cs) {
    this.children.push(...cs);
  }
  get textContent() {
    return this._text + this.children.map((c) => c.textContent).join("");
  }
  set textContent(v) {
    this.children = [];
    this._text = String(v);
  }
}
class TextNode extends Node {
  constructor(t) {
    super();
    this._text = t;
  }
}
class El extends Node {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this.attrs = {};
    this.style = {};
    this.dataset = {};
    this.className = "";
    this.listeners = {};
    this.value = "";
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  fire(type) {
    for (const fn of this.listeners[type] || []) fn({ type, target: this });
  }
  find(pred) {
    for (const c of this.children) {
      if (!(c instanceof El)) continue;
      if (pred(c)) return c;
      const f = c.find(pred);
      if (f) return f;
    }
    return null;
  }
}
globalThis.Node = Node;
globalThis.document = { createElement: (t) => new El(t), createTextNode: (t) => new TextNode(t) };

const { store } = await import("../js/store.js");
const { reflectionBox, flushReflection } = await import("../js/records.js");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const saved = () => JSON.parse(localStorage.getItem("vcpu.v1") || "{}").reflections || {};
const parts = (box) => ({
  ta: box.find((e) => e.tagName === "TEXTAREA"),
  note: box.find((e) => e.className === "saved-note"),
  btn: box.find((e) => e.tagName === "BUTTON"),
});

test("ふりかえり: 打って 400 ミリ秒後に、ボタンを押さなくても保存される", async () => {
  store.reset();
  const box = reflectionBox("sim");
  const { ta, note } = parts(box);
  assert.match(box.textContent, /書いた文は、自動でこの端末に保存されます。/);
  ta.value = "ACC の値が変わった";
  ta.fire("input");
  assert.equal(store.getReflection("sim"), "", "すぐには保存しない（まとめて保存）");
  await wait(450);
  assert.equal(store.getReflection("sim"), "ACC の値が変わった");
  assert.equal(saved().sim.text, "ACC の値が変わった", "localStorage（書き出しと同じ場所）に入る");
  assert.equal(note.textContent, "保存しました");
});

test("ふりかえり: すぐにページを移っても（flushReflection）消えず、もどると書いた文が出る", () => {
  store.reset();
  const { ta } = parts(reflectionBox("diagram"));
  ta.value = "入力から記憶へ";
  ta.fire("input");
  flushReflection(); // app.js が、ページを移るときと pagehide でよぶ
  assert.equal(saved().diagram.text, "入力から記憶へ");
  const again = parts(reflectionBox("diagram"));
  assert.equal(again.ta.value, "入力から記憶へ");
});

test("ふりかえり: 短い文も消えない。保存ボタンはこれまでどおり 5 文字以上をすすめる", () => {
  store.reset();
  const { ta, note, btn } = parts(reflectionBox("auto"));
  ta.value = "速い";
  ta.fire("input");
  btn.fire("click");
  assert.equal(store.getReflection("auto"), "速い");
  assert.match(note.textContent, /5文字以上/);
  ta.value = "コンピュータは速い";
  btn.fire("click");
  assert.equal(note.textContent, "この端末に保存しました");
  assert.equal(saved().auto.text, "コンピュータは速い");
});

test("ふりかえり: 全部消したら記録も「書いていない」にもどる。ふりかえりのないページでは何もしない", () => {
  store.reset();
  const { ta } = parts(reflectionBox("tasks"));
  ta.value = "1命令ずつ見た";
  flushReflection();
  assert.equal(store.getReflection("tasks"), "1命令ずつ見た");
  ta.value = "";
  flushReflection();
  assert.equal("tasks" in saved(), false);
  ta.value = "取り出し→解読→実行";
  flushReflection();
  store.reset(); // 「この端末の記録をすべて消す」
  flushReflection(); // そのあとに pagehide が来ても、保存ずみの文を書きもどさない
  assert.deepEqual(saved(), {});
  assert.equal(reflectionBox("records"), null);
});
