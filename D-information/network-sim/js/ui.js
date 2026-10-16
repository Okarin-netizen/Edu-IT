// 共通UI部品（要素ビルダー、解説カード、ステップ枠、ふりかえり、クイズ、トースト）
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


// 振り返りを出すか（先生が「振り返りを隠す」設定にしたときは false。shared/eduit-frame.js の EduitFrame.furikaeri）
export function furikaeriOn() {
  return !(globalThis.EduitFrame && globalThis.EduitFrame.furikaeri === false);
}
// 振り返りの欄・文字に付ける属性（隠す設定のときは eduit-frame.css で出なくなる）
export const REFLECT_ATTR = { "data-ef-reflect": "" };

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

// ふりかえりの自動保存。書いている途中の文も、ボタンを押したときと同じ場所（store）に保存する。
// 5文字以上なら、ボタンを押したときと同じように「できた」にする（onSaved）。
export const AUTOSAVE_MS = 400;
export const MIN_REFLECTION = 5;
const pendingDrafts = new Set();
export function makeDraftSaver(moduleId, getText, { onSaved, onStatus, delay = AUTOSAVE_MS } = {}) {
  let timer = null;
  const saveNow = () => {
    clearTimeout(timer);
    timer = null;
    pendingDrafts.delete(saver);
    const text = String(getText() ?? "").trim();
    if (text === store.getReflection(moduleId)) return false;
    store.setReflection(moduleId, text);
    if (text.length >= MIN_REFLECTION) onSaved && onSaved(text);
    onStatus && onStatus("保存しました");
    return true;
  };
  const saver = {
    schedule() {
      clearTimeout(timer);
      pendingDrafts.add(saver);
      timer = setTimeout(saveNow, delay);
    },
    flush: saveNow,
    get pending() {
      return timer !== null;
    },
  };
  return saver;
}
// まだ保存していない下書きを、すぐに保存する（ページを移るとき・閉じるときに呼ぶ）
export function flushDrafts() {
  for (const s of [...pendingDrafts]) s.flush();
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushDrafts);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushDrafts();
  });
}

// ふりかえり。例文とヒントは問いごとに変える（NW-16）
export const REFLECTION_DEFAULTS = { placeholder: "例: 〇〇をためしたら△△になった。それは□□だから。", hint: "ためしたこと・見たことをもとに、「なぜそうなるのか」を自分の言葉で書こう。" };
export function reflectionBox(moduleId, prompt, onSaved, { placeholder = REFLECTION_DEFAULTS.placeholder, hint = REFLECTION_DEFAULTS.hint } = {}) {
  const id = `reflect-${moduleId}`;
  const ta = h("textarea", { id, maxlength: "400", placeholder });
  ta.value = store.getReflection(moduleId);
  const note = h("div", { class: "saved-note", "aria-live": "polite" });
  const setNote = (msg, warn = false) => {
    note.style.color = warn ? "var(--warn)" : "";
    note.textContent = msg;
  };
  const saver = makeDraftSaver(moduleId, () => ta.value, { onSaved, onStatus: (msg) => setNote(msg) });
  ta.addEventListener("input", () => saver.schedule());
  ta.addEventListener("blur", () => saver.pending && saver.flush());
  const saveBtn = h("button", { class: "btn", type: "button" }, "ふりかえりを保存");
  saveBtn.addEventListener("click", () => {
    saver.flush();
    const text = ta.value.trim();
    if (text.length < MIN_REFLECTION) {
      setNote(text ? "保存しました。もう少し書いてみよう（5文字以上）" : "書いてから押そう（5文字以上）", true);
      return;
    }
    setNote("保存しました");
    onSaved && onSaved(text);
  });
  return h(
    "div",
    { class: "reflection" },
    h("label", { for: id }, prompt),
    h("div", { class: "hint" }, hint),
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

// 選択式クイズ（1問）。選択肢は毎回ならびかえる。
// retry: true（確かめよう）… まちがえたら、もう一度えらべる。正解したときだけ onAnswer(true, 何回目で正解したか)。
// retry: false（ドリル）… 1回だけ答える。onAnswer(正解か)。まちがえたら正解を見せる。
export function choiceQuiz({ question, choices, answer, explain }, onAnswer, { retry = false } = {}) {
  const wrap = h("div", { class: "quiz" });
  const fb = h("div", { "aria-live": "polite" });
  const list = h("ul", { class: "choice-list" });
  let answered = false;
  let tries = 0;
  let correctBtn = null;
  const buttons = [];
  for (const [c, i] of shuffled(choices.map((c, i) => [c, i]))) {
    const b = h("button", { type: "button" }, c);
    buttons.push(b);
    if (i === answer) correctBtn = b;
    b.addEventListener("click", () => {
      if (answered || b.disabled) return;
      tries++;
      const ok = i === answer;
      b.classList.add(ok ? "correct" : "wrong");
      b.prepend(ok ? "○ " : "× ");
      if (ok || !retry) {
        answered = true;
        buttons.forEach((x) => x !== b && x !== correctBtn && (x.disabled = true));
        if (!ok) {
          correctBtn.classList.add("correct");
          correctBtn.prepend("○ ");
        }
        fb.replaceChildren(explainCard(ok ? (retry && tries > 1 ? `正解！（${tries}回目）` : "正解！") : "おしい！", explain, ok ? "good" : "warn"));
        onAnswer && onAnswer(ok, tries);
        return;
      }
      // もう一度えらべる（まちがえた選択肢だけ押せなくする）
      b.disabled = true;
      fb.replaceChildren(explainCard("ちがうみたい", "ほかの答えを、もう一度えらんでみよう。この問題は、正解するとクリアになります。", "warn"));
    });
    list.append(h("li", {}, b));
  }
  wrap.append(h("p", {}, h("strong", {}, question)), list, fb);
  return wrap;
}

// 図と、その結果（説明・編集欄など）を左右にならべる（NW-04）。広い画面では右の欄が図と同じ高さで、中だけスクロールする。
export function simSplit(canvas, ...side) {
  const inner = h("div", { class: "sim-side-inner" }, ...side);
  const el = h("div", { class: "sim-split" }, canvas, h("div", { class: "sim-side" }, inner));
  return {
    el,
    side: inner,
    // 右の欄の中だけを、いちばん下（新しく出た文）までスクロールする。ページは動かさない
    scrollSideToEnd() {
      inner.scrollTop = inner.scrollHeight;
    },
  };
}

// ボタン（top）から図（bottom）までが画面に入るように、必要なときだけ少しスクロールする（ボタンが見えなくならない範囲で）
export function revealBetween(top, bottom) {
  if (typeof window === "undefined" || !top || !bottom) return;
  const header = document.querySelector(".app-header");
  const headBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
  const need = bottom.getBoundingClientRect().bottom - window.innerHeight + 8;
  if (need <= 0) return;
  const room = top.getBoundingClientRect().top - headBottom - 8;
  const dy = Math.min(need, Math.max(0, room));
  if (dy <= 0) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollBy({ top: dy, behavior: reduce ? "auto" : "smooth" });
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
