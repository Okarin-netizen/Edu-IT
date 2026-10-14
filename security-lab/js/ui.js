// 共通UI部品（解説カード、3ステップ、ステップ枠、ふりかえり、トースト）
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

// 「立ち止まる→確認する→相談する」の3ステップ（各モジュールで反復する判断の手順）
export function threeSteps(texts = {}) {
  return h(
    "ol",
    { class: "three-steps", "aria-label": "判断の3ステップ" },
    h("li", {}, h("strong", {}, "立ち止まる"), texts.stop || "すぐに押さない・答えない"),
    h("li", {}, h("strong", {}, "確認する"), texts.check || "公式の方法で本当か確かめる"),
    h("li", {}, h("strong", {}, "相談する"), texts.ask || "迷ったら家族や先生に聞く"),
  );
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
  const card = h("section", { class: "card", "aria-labelledby": `step-${moduleId}-${step.id}` }, head, body);
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

// ふりかえり（「なぜその対策が有効か」を一言で書く）
// 書いた文は、入力のたび（少し待ってから）・ページを移るとき・画面を閉じるときに自動で保存する。
// 自動保存も「ふりかえりを保存」ボタンと同じ決まり: 同じ場所に保存し、5文字以上ならステップを「できた」にする。
export const REFLECTION_MIN = 5;
export const REFLECTION_AUTOSAVE_MS = 400;
export const REFLECTION_AUTOSAVE_HINT = "書いた文は、自動でこの端末に保存されます。";

// ふりかえりの文を保存する（ボタンでも自動保存でも同じ）。画面に依存しない。
// 戻り値: { text, changed: 保存した内容が変わったか, enough: 5文字以上か }
export function saveReflectionText(moduleId, raw) {
  const text = String(raw ?? "").trim();
  const before = store.getReflection(moduleId);
  const changed = text !== before;
  if (changed) store.setReflection(moduleId, text); // 空にしたときは記録から消える
  return { text, changed, enough: text.length >= REFLECTION_MIN };
}

// 画面に出ているふりかえり欄（ページを移る前などに、まとめて保存するため）
const liveReflections = new Set();
export function flushReflections() {
  for (const box of [...liveReflections]) {
    // 画面から消えた欄は保存しない（「記録をすべて消す」のあとに古い文を書きもどさないため）
    if (!box.isConnected()) liveReflections.delete(box);
    else box.flush();
  }
}

export function reflectionBox(moduleId, prompt, onSaved) {
  const id = `reflect-${moduleId}`;
  const ta = h("textarea", { id, maxlength: "400", placeholder: "例: 〇〇だから、△△すると安全になる", "aria-describedby": `${id}-auto` });
  ta.value = store.getReflection(moduleId);
  const note = h("div", { class: "saved-note", "aria-live": "polite" });
  const saveBtn = h("button", { class: "btn", type: "button" }, "ふりかえりを保存");
  let timer = null;
  const setNote = (text, warn = false) => {
    note.style.color = warn ? "var(--warn)" : "";
    note.textContent = text;
  };
  // byButton: ボタンを押したとき true。自動保存のときは、短くても注意は出さない
  const save = (byButton) => {
    clearTimeout(timer);
    timer = null;
    const r = saveReflectionText(moduleId, ta.value);
    if (r.enough) onSaved && onSaved(r.text);
    if (byButton) {
      if (r.enough) setNote("この端末に保存しました");
      else setNote(r.text ? "保存しました。もう少し書いてみよう（5文字以上）" : "もう少し書いてみよう（5文字以上）", true);
    } else if (r.changed) {
      setNote("保存しました");
    }
  };
  const box = { isConnected: () => ta.isConnected, flush: () => save(false) };
  liveReflections.add(box);
  ta.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => save(false), REFLECTION_AUTOSAVE_MS);
  });
  ta.addEventListener("blur", () => save(false));
  saveBtn.addEventListener("click", () => save(true));
  return h(
    "div",
    { class: "reflection" },
    h("label", { for: id }, prompt),
    h("div", { class: "hint" }, "用語を覚えるだけでなく、「なぜ効くのか」を自分の言葉で書こう。"),
    ta,
    h("div", { class: "hint", id: `${id}-auto` }, REFLECTION_AUTOSAVE_HINT),
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

// ---- 選択式クイズ（1問）。やり直せる（SEC-13）----
// 問題: { question, choices, answer, explain, danger? }（danger: 危ない行動の選択肢の番号の配列）。選択肢は毎回ならびかえる。
//  - まちがえたら、答えを見せる前に1回だけ「もう一度えらぶ」ことができる（選んだものは押せなくなる）。2回目で答えと解説を出す
//  - 見出しは「おしい！」ではなく「ちがいます」。danger を選んだときは「それは危ない選び方です」
//  - onAnswer(ok, tries) は、正解したとき、または2回目を答えたときに1回だけ呼ぶ（ステップの「できた」はそこで付ける）
export const QUIZ_MAX_TRIES = 2;
// 画面に依存しない判定。tries: 何回目の答えか（1から）
export function quizVerdict({ answer, danger = [] }, picked, tries) {
  const ok = picked === answer;
  const isDanger = !ok && (danger || []).includes(picked);
  const final = ok || tries >= QUIZ_MAX_TRIES;
  let heading = "正解！";
  let kind = "good";
  if (!ok) {
    heading = isDanger ? "それは危ない選び方です" : final ? "ちがいます。ここが大事" : "ちがいます";
    kind = isDanger ? "bad" : "warn";
  }
  const retryText = isDanger ? "どうして危ないのか考えて、もう一度えらんでみよう。" : "もう一度考えて、えらび直してみよう。";
  return { ok, danger: isDanger, final, heading, kind, retryText };
}

export function choiceQuiz(q, onAnswer) {
  const wrap = h("div", { class: "retry-quiz" });
  const fb = h("div", { "aria-live": "polite" });
  const list = h("ul", { class: "choice-list" });
  let tries = 0;
  let finished = false;
  const buttons = [];
  for (const [c, i] of shuffled(q.choices.map((c, i) => [c, i]))) {
    const b = h("button", { type: "button" }, c);
    buttons[i] = b;
    b.addEventListener("click", () => {
      if (finished || b.disabled) return;
      tries++;
      const v = quizVerdict(q, i, tries);
      b.classList.add(v.ok ? "correct" : "wrong");
      b.prepend(v.ok ? "○ " : "× ");
      b.disabled = true;
      if (!v.final) {
        fb.replaceChildren(explainCard(v.heading, v.retryText, v.kind));
        return;
      }
      finished = true;
      buttons.forEach((x) => (x.disabled = true));
      if (!v.ok) {
        buttons[q.answer].classList.add("correct");
        buttons[q.answer].prepend("○ ");
      }
      fb.replaceChildren(explainCard(v.heading, v.ok ? q.explain : `正しいのは「${escapeHtml(q.choices[q.answer])}」です。${q.explain}`, v.kind));
      onAnswer && onAnswer(v.ok, tries);
    });
    list.append(h("li", {}, b));
  }
  wrap.append(h("p", {}, h("strong", {}, q.question)), list, fb);
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
