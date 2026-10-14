// モジュール9: 判断ロールプレイ（分岐型ストーリー）
import { h, explainCard, stepCard, reflectionBox, threeSteps } from "../js/ui.js";
import { loadData } from "../js/data.js";
import { store } from "../js/store.js";
import { branchPlayer } from "../js/branch.js";
import { consultCard } from "../js/consult.js";

const ID = "roleplay";
const STEPS = [
  { id: "first", title: "あなたならどうする？" },
  { id: "all", title: "ほかの選択肢も試そう" },
  { id: "reflect", title: "ふりかえり" },
];
const END_LABEL = { good: "◎ 安全", ok: "○ 途中で気づけた", bad: "× 危ない" };
const END_RANK = { bad: 1, ok: 2, good: 3 };
// 記録のキー: ストーリーのid →「最初に選んだ結末」、id + BEST_SUFFIX →「いちばんよかった結末」（SEC-62）
export const BEST_SUFFIX = "_best";
export const GRADE_NOTE = "この表は、先生に出す記録にも入ります。先生は、クラスでどんな選び方が多かったかを見るために使います。成績にはしません。";

// 新しい結末を記録に入れたあとの { first, best } を返す（画面に依存しない）
export function nextEndings(prev, ending) {
  const first = prev.first || ending || "";
  const best = !prev.best || (END_RANK[ending] || 0) > (END_RANK[prev.best] || 0) ? ending || prev.best || "" : prev.best;
  return { first, best };
}

export const roleplayModule = {
  id: ID,
  minutes: "15分",
  lead: "ネットで起こりそうな場面で、自分ならどうするかを選んでみよう。選んだ道によって、結末が変わります。",
  steps: STEPS,
  async render(root) {
    const { stories } = await loadData("roleplay");
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));
    const picker = h("div", { class: "scenario-tabs case-picker", role: "group", "aria-label": "ストーリーを選ぶ" });
    const stage = h("div");
    const summary = h("div");
    let current = 0;
    // 記録: 「最初に選んだ結末」と「いちばんよかった結末」
    const record = (s) => store.getScore(ID, s.id);
    const best = (s) => store.getScore(ID, s.id + BEST_SUFFIX) || record(s);
    const label = (e) => (e ? END_LABEL[e] || e : "—");

    const refresh = () => {
      picker.replaceChildren(
        ...stories.map((s, i) => {
          const b = h("button", { type: "button", "aria-pressed": i === current ? "true" : "false", class: record(s) ? "done" : "" }, `${i + 1}. ${s.title}`);
          b.addEventListener("click", () => {
            current = i;
            refresh();
            play();
          });
          return b;
        }),
      );
      const done = stories.filter(record).length;
      summary.replaceChildren(
        h("p", {}, `挑戦したストーリー: ${done} / ${stories.length}`),
        h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "ストーリー"), h("th", {}, "最初に選んだ結末"), h("th", {}, "いちばんよかった結末"))), h("tbody", {}, stories.map((s) => h("tr", {}, h("td", {}, s.title), h("td", {}, label(record(s))), h("td", {}, label(record(s) ? best(s) : ""))))))),
        h("p", { class: "hint grade-note" }, GRADE_NOTE),
      );
      if (done >= 1) cards[0].done();
      if (done === stories.length) cards[1].done();
    };
    const play = () => {
      const s = stories[current];
      const after = h("div");
      stage.replaceChildren(
        branchPlayer(s, {
          onFinish: ({ ending }) => {
            const r = nextEndings({ first: record(s), best: store.getScore(ID, s.id + BEST_SUFFIX) || record(s) }, ending);
            if (!record(s)) store.setScore(ID, s.id, r.first);
            if (store.getScore(ID, s.id + BEST_SUFFIX) !== r.best) store.setScore(ID, s.id + BEST_SUFFIX, r.best);
            refresh();
            after.replaceChildren(
              ending === "good" ? "" : explainCard("別の道も考えよう", "どこで立ち止まれば、もっと安全だったかな？ もう一度やって、ほかの選択肢を選んでみよう。"),
              threeSteps(),
              h("div", { class: "btn-row" }, h("button", { class: "btn secondary", type: "button", onclick: play }, "もう一度やる"), current < stories.length - 1 ? h("button", { class: "btn", type: "button", onclick: () => ((current += 1), refresh(), play(), picker.scrollIntoView({ behavior: "smooth", block: "start" })) }, "次のストーリーへ →") : ""),
            );
          },
        }),
        after,
      );
    };

    cards[0].body.append(h("p", {}, "ストーリーを選んで、自分ならどうするかを選ぼう。正解を当てるのではなく、自分が本当にしそうな行動を選んでみよう。"), h("p", { class: "hint grade-note" }, "選んだ結末は記録に残りますが、成績にはしません。"), picker, stage);
    cards[1].body.append(summary, explainCard("どのストーリーにも共通すること", "おかしいと感じたら、<strong>立ち止まる → 確認する → 相談する</strong>。途中で気づいて相談すれば、被害を小さくできます。「もう遅い」と思っても、相談することが大切です。", "good"), await consultCard());
    cards[2].body.append(reflectionBox(ID, "どの場面で、どう立ち止まればよいと思った？", () => cards[2].done()));
    refresh();
    play();
    root.append(...cards.map((c) => c.el));
  },
};
