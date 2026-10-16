// 共通UI部品（解説カード、ステップ枠、ふりかえり、クイズ、トースト）
import { store } from "./store.js";

// 小さな要素ビルダー: h("div", { class: "card" }, "text", child)
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

// 振り返りを出すか（先生が「振り返りを隠す」設定にしたときは false。shared/eduit-frame.js の EduitFrame.furikaeri）
export function furikaeriOn() {
  return !(globalThis.EduitFrame && globalThis.EduitFrame.furikaeri === false);
}
// 振り返りの欄・文字に付ける属性（隠す設定のときは eduit-frame.css で出なくなる）
export const REFLECT_ATTR = { "data-ef-reflect": "" };

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// 解説カード。kind: "info" | "warn" | "good" | "bad"
export function explainCard(label, body, kind = "info") {
  const card = h("div", { class: `explain ${kind === "info" ? "" : kind}`, role: kind === "warn" ? "note" : null });
  card.append(h("span", { class: "explain-label" }, label));
  if (typeof body === "string") card.append(h("p", { html: body }));
  else card.append(body);
  return card;
}

// ステップ枠。done() を呼ぶとチェックが付き、進捗に記録される
export function stepCard(moduleId, step, index) {
  const check = h("span", { class: "check", "aria-live": "polite" });
  const head = h(
    "h2",
    { class: "step-title", id: `step-${moduleId}-${step.id}` },
    h("span", { class: "badge" }, `ステップ${index + 1}`),
    h("span", {}, step.title),
    check,
  );
  const body = h("div");
  const card = h("section", { class: "card", "aria-labelledby": `step-${moduleId}-${step.id}`, "data-ef-reflect": step.id === "reflect" ? "" : null }, head, body);
  const refresh = () => {
    check.textContent = store.isStepDone(moduleId, step.id) ? "✓ できた" : "";
  };
  refresh();
  return {
    el: card,
    body,
    done() {
      if (store.completeStep(moduleId, step.id)) toast(`「${step.title}」をクリアしました`);
      refresh();
    },
  };
}

// ---------- ふりかえりの自動保存 ----------
// 書いた文は「保存」を押さなくても、この端末に自動で保存する（「保存」ボタンを押したときと同じ保存先）。
// 入力が止まって約0.4秒後・ほかのページへ移るとき・ページを閉じるときに保存する。
export const AUTOSAVE_MS = 400;
export const REFLECTION_MIN = 5; // 5文字以上で「できた」になる
const pendingReflections = new Set();

// ふりかえりの文を保存する。ボタンでも自動でも同じ決まり（5文字以上なら onSaved で「できた」の印を付ける）
export function saveReflectionText(moduleId, raw, onSaved) {
  const text = String(raw ?? "").trim();
  store.setReflection(moduleId, text);
  const done = text.length >= REFLECTION_MIN;
  if (done && onSaved) onSaved(text);
  return { text, done };
}

// 入力のたびに呼ぶ schedule() と、すぐに保存する flush() を返す
export function reflectionAutosaver(moduleId, getText, onSaved, onStatus, delay = AUTOSAVE_MS) {
  let timer = null;
  const flush = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    pendingReflections.delete(flush);
    if (String(getText() ?? "").trim() === store.getReflection(moduleId)) return;
    saveReflectionText(moduleId, getText(), onSaved);
    onStatus && onStatus("保存しました");
  };
  return {
    schedule() {
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
      pendingReflections.add(flush);
    },
    flush,
  };
}

// まだ保存していない入力を、すぐに保存する（ページを移るとき・閉じるときに呼ぶ）
export function flushReflections() {
  for (const f of [...pendingReflections]) f();
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushReflections);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushReflections());
}

// ふりかえり（「なぜそうなるのか」を一言で書く）
export function reflectionBox(moduleId, prompt, onSaved) {
  const id = `reflect-${moduleId}`;
  const ta = h("textarea", { id, maxlength: "400", placeholder: "例: 〇〇を増やすと、△△なので、データ量が□□になる" });
  ta.value = store.getReflection(moduleId);
  const note = h("div", { class: "saved-note", "aria-live": "polite" });
  const setNote = (msg, warn = false) => {
    note.style.color = warn ? "var(--warn)" : "";
    note.textContent = msg;
  };
  const auto = reflectionAutosaver(moduleId, () => ta.value, onSaved, (msg) => setNote(msg));
  ta.addEventListener("input", () => auto.schedule());
  ta.addEventListener("blur", () => auto.flush());
  const saveBtn = h("button", { class: "btn", type: "button" }, "ふりかえりを保存");
  saveBtn.addEventListener("click", () => {
    auto.flush();
    const { done } = saveReflectionText(moduleId, ta.value, onSaved);
    if (!done) return setNote(`もう少し書いてみよう（${REFLECTION_MIN}文字以上）`, true);
    setNote("この端末に保存しました");
  });
  return h(
    "div",
    { class: "reflection" },
    h("label", { for: id }, prompt),
    h("div", { class: "hint" }, "用語を覚えるだけでなく、「なぜそうなるのか」を自分の言葉で書こう。"),
    ta,
    h("div", { class: "hint autosave-hint" }, "書いた文は、自動でこの端末に保存されます。"),
    h("div", { class: "btn-row" }, saveBtn),
    note,
  );
}

// 選択肢の順番を入れかえる（位置で答えを覚えないように）
export function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 選択式クイズ（1問）。選択肢は毎回ならびかえる。onAnswer(isCorrect)
export function choiceQuiz({ question, choices, answer, explain }, onAnswer) {
  const wrap = h("div");
  const fb = h("div", { "aria-live": "polite" });
  const list = h("ul", { class: "choice-list" });
  let answered = false;
  let correctBtn = null;
  for (const [c, i] of shuffled(choices.map((c, i) => [c, i]))) {
    const b = h("button", { type: "button" }, c);
    if (i === answer) correctBtn = b;
    b.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      const ok = i === answer;
      b.classList.add(ok ? "correct" : "wrong");
      b.prepend(ok ? "○ " : "× ");
      if (!ok) {
        correctBtn.classList.add("correct");
        correctBtn.prepend("○ ");
      }
      fb.replaceChildren(explainCard(ok ? "正解！" : "おしい！", explain, ok ? "good" : "warn"));
      onAnswer && onAnswer(ok);
    });
    list.append(h("li", {}, b));
  }
  wrap.append(h("p", {}, h("strong", {}, question)), list, fb);
  return wrap;
}

let toastTimer;
export function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = h("div", { class: "toast", role: "status" });
    document.body.append(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// 端末内でファイルを作ってダウンロードさせる（送信はしない）
export function downloadFile(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
