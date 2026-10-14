// 分岐型の問題（著作権クイズ・判断ロールプレイ）を表示する共通部品
import { h, explainCard, shuffled } from "./ui.js";

// story: { start, nodes: { id: { text, choices:[{label, next, best?, explain?}] } | { end, title, text } } }
// onFinish({ path, bestCount, askedCount, ending })
// えらんだ答えより、よりよい答え（best）を返す（画面に依存しない）
export function betterChoices(node, choice) {
  if (!node?.choices || choice?.best) return [];
  return node.choices.filter((c) => c.best && c !== choice);
}

export function branchPlayer(story, { onFinish, showBest = false } = {}) {
  const wrap = h("div", { class: "branch" });
  const log = h("ol", { class: "branch-log" });
  const current = h("div", { "aria-live": "polite" });
  wrap.append(log, current);
  const path = [];
  let bestCount = 0;

  const show = (nodeId) => {
    const node = story.nodes[nodeId];
    if (!node) return;
    if (node.end || !node.choices) {
      const kind = node.end === "good" ? "good" : node.end === "ok" ? "info" : node.end === "bad" ? "bad" : "good";
      const mark = node.end === "good" ? "◎ " : node.end === "ok" ? "○ " : node.end === "bad" ? "× " : "";
      current.replaceChildren(explainCard(`${mark}${node.title || "おわり"}`, node.text, kind));
      onFinish && onFinish({ path, bestCount, askedCount: path.length, ending: node.end });
      return;
    }
    const list = h("ul", { class: "choice-list" });
    shuffled(node.choices).forEach((choice) => {
      const b = h("button", { type: "button" }, choice.label);
      b.addEventListener("click", () => {
        path.push({ node: nodeId, choice: choice.label, best: choice.best });
        if (choice.best) bestCount++;
        const entry = h("li", {}, h("p", { class: "branch-q" }, node.text), h("p", { class: "branch-a" }, showBest ? (choice.best ? "○ " : "△ ") : "→ ", choice.label));
        if (choice.explain) entry.append(explainCard(showBest ? (choice.best ? "正解！" : "考えてみよう") : "解説", choice.explain, showBest ? (choice.best ? "good" : "warn") : "info"));
        // △のときは、よりよい答えとその解説も見せる（SEC-70）
        if (showBest && !choice.best) for (const better of betterChoices(node, choice)) entry.append(explainCard(`よりよい答え: ${better.label}`, better.explain || "", "good"));
        log.append(entry);
        if (choice.next) show(choice.next);
        else {
          current.replaceChildren();
          onFinish && onFinish({ path, bestCount, askedCount: path.length, ending: null });
        }
      });
      list.append(h("li", {}, b));
    });
    current.replaceChildren(h("p", { class: "branch-q" }, h("strong", {}, node.text)), list);
  };
  show(story.start);
  return wrap;
}
