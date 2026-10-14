// 実行画面（ステージ）: 画面の部品（ラベル・入力ボックス・ボタン）、表示、質問の受け答え、通信中の表示。
// 生徒のプログラムから来る文字は、すべて textContent で出す（HTMLとしては解釈しない）。
import { h } from "./ui.js";
import { OP_NAMES } from "./server.js";

const MAX_LINES = 300;
const MAX_LINE_CHARS = 2000;

export function createStage({ onButton = () => {} } = {}) {
  const partsEl = h("div", { class: "stage-parts" });
  const outEl = h("div", { class: "stage-output", "aria-live": "polite", "aria-label": "表示" });
  const promptEl = h("div", { class: "stage-prompt" });
  const netEl = h("div", { class: "stage-net", "aria-live": "polite" });
  const el = h("div", { class: "stage", role: "region", "aria-label": "作品の実行画面" }, partsEl, outEl, promptEl, netEl);

  let parts = [];
  const live = new Map(); // id -> { def, el, setText, getText }
  let pending = null;
  let netTimer = null;
  let lineCount = 0;
  let scrollQueued = false;
  const trimNote = h("div", { class: "out-trim", "aria-hidden": "true" });
  el.insertBefore(trimNote, outEl);
  // 1行ごとに画面を計算し直すと遅いので、スクロールはまとめて1回
  const scrollDown = () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      outEl.scrollTop = outEl.scrollHeight;
    });
  };

  function renderParts() {
    partsEl.replaceChildren();
    live.clear();
    let row = null;
    for (const p of parts) {
      let node;
      let api;
      if (p.type === "label") {
        node = h("div", { class: "part-label", dataset: { part: p.id } }, p.text);
        api = { setText: (t) => (node.textContent = t), getText: () => node.textContent };
      } else if (p.type === "input") {
        node = h("input", { type: "text", class: "part-input", placeholder: p.text, "aria-label": p.text || p.id, maxlength: "200", dataset: { part: p.id } });
        api = { setText: (t) => (node.value = t), getText: () => node.value };
      } else {
        node = h("button", { type: "button", class: "part-button", dataset: { part: p.id } }, p.text || p.id);
        node.addEventListener("click", () => onButton(p.id));
        api = { setText: (t) => (node.textContent = t), getText: () => node.textContent };
      }
      // 続くボタンは横に並べる
      if (p.type === "button") {
        if (!row) {
          row = h("div", { class: "part-row" });
          partsEl.append(row);
        }
        row.append(node);
      } else {
        row = null;
        partsEl.append(node);
      }
      live.set(p.id, { def: p, el: node, ...api });
    }
    partsEl.hidden = parts.length === 0;
  }

  function cancelRequest() {
    pending = null;
    promptEl.replaceChildren();
  }

  return {
    el,
    setParts(list) {
      parts = list.map((p) => ({ ...p }));
      renderParts();
    },
    resetParts: renderParts,
    part: (id) => live.get(id) || null,
    partIds: () => [...live.keys()],
    output(text) {
      let t = String(text);
      if (t.length > MAX_LINE_CHARS) t = t.slice(0, MAX_LINE_CHARS) + "…（長いので省略）";
      outEl.append(h("div", { class: "out-line" }, t));
      lineCount++;
      while (outEl.childElementCount > MAX_LINES) outEl.firstElementChild.remove();
      if (lineCount > MAX_LINES) trimNote.textContent = `（古い表示は消しました。表示は最新の${MAX_LINES}行まで）`;
      scrollDown();
    },
    // 作品の表示とは別の、スタジオからの注意（ボタンが画面にない・箱がまだない など）
    warn(text) {
      outEl.append(h("div", { class: "out-line out-warn", role: "note" }, `⚠ ${text}`));
      scrollDown();
    },
    clear() {
      outEl.replaceChildren();
      trimNote.textContent = "";
      lineCount = 0;
    },
    // ask / choose の受け答え
    request(y, done) {
      scrollDown();
      cancelRequest();
      const token = (pending = {});
      const finish = (v) => {
        if (pending !== token) return;
        cancelRequest();
        done(v);
      };
      const q = h("div", { class: "prompt-q" }, y.prompt);
      if (y.k === "ask") {
        const input = h("input", { type: "text", class: "prompt-input", "aria-label": y.prompt || "答え", maxlength: "200", autocomplete: "off" });
        const ok = h("button", { type: "button", class: "btn" }, "決定");
        const submit = () => {
          const v = input.value;
          outEl.append(h("div", { class: "out-line out-answer" }, `${y.prompt} → ${v}`));
          finish(v);
        };
        ok.addEventListener("click", submit);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.isComposing) submit();
        });
        promptEl.append(q, h("div", { class: "prompt-row" }, input, ok));
        setTimeout(() => input.focus({ preventScroll: true }), 0);
      } else {
        const row = h("div", { class: "prompt-choices" });
        y.options.forEach((label, i) =>
          row.append(
            h("button", {
              type: "button",
              class: "choice",
              onclick: () => {
                outEl.append(h("div", { class: "out-line out-answer" }, `${y.prompt} → ${label}`));
                finish(i);
              },
            }, label),
          ),
        );
        promptEl.append(q, row);
        setTimeout(() => row.firstElementChild?.focus({ preventScroll: true }), 0);
      }
    },
    cancelRequest,
    net(op, box) {
      netEl.textContent = `📡 サーバーと通信中…（${box} に${OP_NAMES[op] || op}）`;
      netEl.classList.add("on");
      clearTimeout(netTimer);
      netTimer = setTimeout(() => {
        netEl.classList.remove("on");
        netEl.textContent = "";
      }, 700);
    },
  };
}
