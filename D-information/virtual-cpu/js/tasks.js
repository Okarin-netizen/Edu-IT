// 課題: 一覧と、1つの課題のページ（シミュレーター＋答え合わせ＋ヒント）
import { h, explain, toast, requestReflectionFocus, furikaeriOn, REFLECT_ATTR, recordsTitle } from "./ui.js";
import { store } from "./store.js";
import { checkProgram, shortList } from "./vm.js";
import { createSimulator, isaTable, readingCard } from "./sim.js";

const stars = (n) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));

// 課題の区分（先生の決定: 課題1〜4 必修、5〜7 発展、8 チャレンジ）
export const TIERS = [
  { id: "must", label: "必修", note: "全員がやる課題" },
  { id: "adv", label: "発展", note: "必修が終わったらやる課題" },
  { id: "challenge", label: "チャレンジ", note: "自分で全部書く課題" },
];
export const tierLabel = (id) => TIERS.find((x) => x.id === id)?.label || "";
export function tierCount(tasks, tier) {
  const list = tasks.filter((t) => (t.tier || "must") === tier);
  return { done: list.filter((t) => store.isCleared(t.id)).length, total: list.length };
}
// 進み具合の文（例: 必修 2/4・発展 0/3・チャレンジ 0/1）
export function tierSummary(tasks) {
  return TIERS.map((x) => [x, tierCount(tasks, x.id)])
    .filter(([, c]) => c.total > 0)
    .map(([x, c]) => `${x.label} ${c.done}/${c.total}`)
    .join("・");
}
const clearedText = (id) => (store.isCleared(id) ? (store.answerViewed(id) ? "✓ クリア（答えの例を見た）" : "✓ クリア") : "");

export function renderTaskList(view, { tasks }) {
  const must = tierCount(tasks, "must");
  const card = (t) => {
    const i = tasks.indexOf(t);
    return h(
      "a",
      { class: `module-card ${store.isCleared(t.id) ? "cleared" : ""}`, href: `#/task/${t.id}` },
      h("span", { class: "mc-num" }, `課題 ${i + 1}　`, h("span", { class: "stars", "aria-label": `難しさ ${t.level}` }, stars(t.level))),
      h("span", { class: "mc-title" }, t.title, store.isCleared(t.id) ? h("span", { class: "status good small-status" }, clearedText(t.id)) : null),
      h("span", { class: "mc-desc" }, t.goal),
      t.concept ? h("span", { class: "concept" }, `考え方: ${t.concept}`) : null,
    );
  };
  view.replaceChildren(
    h(
      "div",
      { class: "page-head" },
      h("h2", {}, "課題"),
      h("p", { class: "muted" }, `進み具合: ${tierSummary(tasks)}。まず必修の課題1〜4をやろう。はじめのプログラムは途中まで書いてあり、「???」のところを考えて書きかえます。`),
      must.done === must.total ? h("p", { class: "status good" }, "✓ 必修クリア！ 発展・チャレンジにも挑戦しよう") : null,
    ),
    readingCard(true),
    ...TIERS.flatMap((tier) => {
      const list = tasks.filter((t) => (t.tier || "must") === tier.id);
      if (!list.length) return [];
      const c = tierCount(tasks, tier.id);
      return [
        h("div", { class: "tier-head" }, h("h3", {}, h("span", { class: `tier-badge ${tier.id}` }, tier.label), " ", `課題${tasks.indexOf(list[0]) + 1}${list.length > 1 ? `〜${tasks.indexOf(list[list.length - 1]) + 1}` : ""}`), h("span", { class: "hint" }, `${tier.note}（クリア ${c.done} / ${c.total}）`)),
        h("div", { class: "module-grid" }, list.map(card)),
      ];
    }),
    h("p", { class: "hint concept-note" }, "考え方: 「順次」は上から順に1つずつ、「反復」はくり返し、「分岐」は条件によって進む道を変えることです（教科書の「順次・分岐・反復」）。"),
    h("p", { class: "hint next-guide" }, "課題を上から順にやろう。課題1〜4（必修）が終わったら（先生に言われたところまで）、", h("span", REFLECT_ATTR, "下のふりかえりを書いて、"), "記録を書き出そう。"),
    h("div", { class: "btn-row next-link" }, h("a", { class: "btn", href: "#/records" }, `次: ${recordsTitle()}へ →`)),
  );
}

export function renderTask(view, { tasks, isa }, id) {
  const index = tasks.findIndex((t) => t.id === id);
  const task = tasks[index];
  if (!task) {
    view.replaceChildren(h("p", {}, "課題が見つかりません。"), h("a", { href: "#/tasks" }, "課題の一覧へ"));
    return () => {};
  }
  const nextTask = tasks[index + 1];
  let hintsShown = 0;
  let saveTimer;

  const sim = createSimulator({
    isa,
    title: "プログラム",
    source: store.getDraft(task.id) ?? task.starter,
    inputs: task.sampleInputs || [],
    onSourceChange(text) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => store.setDraft(task.id, text === task.starter ? null : text), 400);
    },
  });

  const resultBox = h("div", { class: "check-result", "aria-live": "polite" });
  const clearedBadge = h("span", { class: "status good" }, "✓ クリア");
  clearedBadge.hidden = !store.isCleared(task.id);

  function check() {
    sim.stop();
    // 前の答え合わせで出た赤い枠（書きまちがい）は、直っていれば消す
    sim.showErrors();
    const r = checkProgram(sim.source, task, isa);
    resultBox.replaceChildren();
    if (r.assembleErrors.length) {
      resultBox.append(explain("まだ答え合わせできません", "プログラムの書きまちがいを先に直そう（プログラム欄の下の赤い枠に、何行目がおかしいか出ています）。", "bad"));
      // 赤い枠が見えるところまで動かす
      sim.el.querySelector(".asm-errors")?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      return;
    }
    const fmt = (list) => shortList(list);
    // × の行の入力を、プログラムの入力欄に入れて見せる
    const tryBtn = (x) =>
      h("button", { class: "btn small secondary try-input", type: "button", onclick: () => { sim.setInputs(x.inputs); sim.focusInputs(); toast(x.inputs.length ? `入力に ${x.inputs.join(", ")} を入れました。「1命令すすむ」でためそう` : "入力を空にしました。「1命令すすむ」でためそう"); } }, "この入力でためす");
    const statusText = (x) => (x.ok ? "○" : x.tooFew ? "△ くり返しを使っていない" : x.status === "halted" ? "×" : x.status === "limit" ? "× 終わらない" : "× 途中で止まった");
    resultBox.append(
      h(
        "div",
        { class: "table-wrap" },
        h(
          "table",
          { class: "data check-table" },
          h("thead", {}, h("tr", {}, h("th", {}, "入力"), h("th", {}, "出てほしい答え"), h("th", {}, "あなたのプログラム"), h("th", {}, "結果"))),
          h("tbody", {}, r.results.map((x) => h("tr", { class: x.ok ? "ok" : "ng" }, h("td", {}, fmt(x.inputs)), h("td", {}, fmt(x.expected)), h("td", {}, fmt(x.outputs), x.status === "limit" ? h("div", { class: "hint" }, "くり返しが終わらず自動で止めました。ぬける条件（JZ/JN）ととび先を確かめよう") : x.error && !x.ok ? h("div", { class: "hint" }, x.error) : null), h("td", {}, statusText(x), !x.ok && !x.tooFew ? tryBtn(x) : null)))),
        ),
      ),
    );
    if (r.ok) {
      const first = !store.isCleared(task.id);
      store.clear(task.id);
      clearedBadge.hidden = false;
      resultBox.append(
        explain(
          first ? "クリア！" : "正解です",
          h("div", {}, h("p", {}, r.results.length > 1 ? `ちがう入力でためしても、すべて正しい答えが出ました。いちばん多いときで命令を ${Math.max(...r.results.map((x) => x.steps))} 回実行しています。` : `答えが正しく出ました。命令を ${r.results[0].steps} 回実行しています。`), nextTask ? h("a", { class: "btn", href: `#/task/${nextTask.id}` }, `次の課題「${nextTask.title}」へ →`) : furikaeriOn() ? h("a", { class: "btn", href: "#/tasks", onclick: requestReflectionFocus }, "課題の一覧へもどって、ふりかえりを書こう →") : h("a", { class: "btn", href: "#/tasks" }, "課題の一覧へもどる →")),
          "good",
        ),
      );
      if (first) {
        toast(`課題「${task.title}」をクリアしました`);
        document.dispatchEvent(new CustomEvent("vcpu:progress"));
      }
    } else {
      const tooFew = r.results.some((x) => x.tooFew);
      const advice = tooFew ? "答えは合っていますが、答えを直接書くのではなく、くり返しを使ってコンピュータに計算させよう。" : "× の行の「この入力でためす」を押して、「1命令すすむ」で、どこで思った動きとちがうか確かめよう。";
      const notes = tooFew ? [] : r.notes || [];
      resultBox.append(explain("もう少し", notes.length ? h("div", {}, h("p", {}, advice), h("ul", {}, notes.map((n) => h("li", {}, `${n.line}行目: ${n.message}`)))) : advice, "warn"));
    }
  }

  const hintList = h("ol", { class: "hint-list" });
  const hintBtn = h("button", { class: "btn secondary small", type: "button" }, "ヒントを見る");
  // 答えの例は見られるが、プログラム欄に入れるボタンはない（自分で打ちこむ）。開いたことは記録に残る
  const answerBox = h(
    "details",
    { class: "answer", hidden: true },
    h("summary", {}, "答えの例を見る"),
    h("p", { class: "answer-note" }, "答えの例を見たことは、記録に残ります。見ただけで終わりにせず、なぜこう書くのかを考えながら、自分でプログラム欄に打ちこもう。"),
    h("pre", { class: "code-block" }, task.answer),
  );
  answerBox.addEventListener("toggle", () => {
    if (answerBox.open) store.markAnswerViewed(task.id);
  });
  // 答え合わせをして、結果（またはエラーの赤い枠）が見えるところまで動かす
  function checkAndShow() {
    check();
    if (!resultBox.querySelector(".explain.bad")) resultBox.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }
  hintBtn.addEventListener("click", () => {
    if (hintsShown < task.hints.length) hintList.append(h("li", {}, task.hints[hintsShown++]));
    if (hintsShown >= task.hints.length) {
      hintBtn.hidden = true;
      answerBox.hidden = false;
    } else hintBtn.textContent = `次のヒント（${hintsShown}/${task.hints.length}）`;
  });

  view.replaceChildren(
    h("div", { class: "page-head" }, h("p", { class: "crumb" }, h("a", { href: "#/tasks" }, "課題"), ` ／ 課題 ${index + 1}　`, task.tier ? h("span", { class: `tier-badge ${task.tier}` }, tierLabel(task.tier)) : null, task.concept ? h("span", { class: "concept" }, `　考え方: ${task.concept}`) : null), h("h2", {}, task.title, " ", clearedBadge)),
    h("div", { class: "card task-card" }, explain("めあて", task.goal), h("p", {}, task.story), h("div", { class: "btn-row" }, h("button", { class: "btn", type: "button", onclick: checkAndShow }, "答え合わせ"), hintBtn, h("button", { class: "btn secondary small", type: "button", onclick: () => confirm("はじめのプログラムにもどしますか？（いまのプログラムは消えます）") && (sim.setSource(task.starter), store.setDraft(task.id, null)) }, "はじめのプログラムにもどす")), hintList, answerBox),
    // 答え合わせの結果は、プログラムのすぐ上に出す（直しながら見られるように）
    h("div", { class: "card sim-card" }, h("div", { class: "check-bar" }, h("button", { class: "btn", type: "button", onclick: checkAndShow }, "答え合わせ"), h("p", { class: "hint" }, "結果はこのすぐ下に出ます。")), resultBox, sim.el),
    readingCard(false),
    isaTable(isa),
    h("p", { class: "hint reflect-pointer", ...REFLECT_ATTR }, "④のふりかえりは、", h("a", { href: "#/tasks", onclick: requestReflectionFocus }, "課題の一覧のいちばん下"), "で書きます。先生に言われたところまで終わったら書こう。"),
  );
  return () => {
    sim.stop();
    clearTimeout(saveTimer);
    store.setDraft(task.id, sim.source === task.starter ? null : sim.source);
  };
}
