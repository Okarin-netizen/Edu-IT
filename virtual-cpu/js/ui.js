// 共通の小さな部品
// 要素ビルダー: h("div", { class: "card" }, "text", child)
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const SVG_NS = "http://www.w3.org/2000/svg";
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// 解説カード。kind: "info" | "warn" | "good" | "bad"
export function explain(label, body, kind = "info") {
  return h("div", { class: `explain ${kind === "info" ? "" : kind}` }, h("span", { class: "explain-label" }, label), typeof body === "string" ? h("p", {}, body) : body);
}

let toastTimer;
export function toast(text) {
  let el = document.getElementById("toast");
  if (!el) {
    el = h("div", { id: "toast", class: "toast", role: "status", "aria-live": "polite" });
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

export const reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 用語の説明: 指でも押して読める（マウスを乗せるだけの説明にしない）。押すと下に説明が出て、もう一度押すと閉じる
let termSeq = 0;
export function term(label, note, cls = "") {
  const id = `term-note-${++termSeq}`;
  const noteEl = h("span", { class: "term-note", id, hidden: true }, note);
  const btn = h("button", { class: `term-btn ${cls}`, type: "button", "aria-expanded": "false", "aria-controls": id }, label, h("span", { class: "term-mark", "aria-hidden": "true" }, "?"));
  btn.addEventListener("click", () => {
    noteEl.hidden = !noteEl.hidden;
    btn.setAttribute("aria-expanded", String(!noteEl.hidden));
  });
  return { btn, note: noteEl };
}

// 次に開くページで、ふりかえり欄まで動かしてもらう（課題8クリア後の「ふりかえりを書こう」ボタンなど）
let reflectionFocus = false;
export function requestReflectionFocus() {
  reflectionFocus = true;
}
export function takeReflectionFocus() {
  const v = reflectionFocus;
  reflectionFocus = false;
  return v;
}
