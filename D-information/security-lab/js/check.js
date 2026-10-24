// 理解度チェック（事前テスト・事後テスト・練習）と、まちがえた問題の復習
import { h, explainCard, toast, shuffled as shuffle } from "./ui.js";
import { loadData } from "./data.js";
import { store } from "./store.js";
import { CATALOG } from "./catalog.js";

const ID = "check";
const MODES = [
  { id: "事前テスト", desc: "学習を始める前に1回。①〜⑨から1問ずつ。1回目の点が記録になります。" },
  { id: "事後テスト", desc: "学習のあとに。事前テストと同じ問題で、伸びを確かめます。1回目の点が記録になります。" },
  { id: "練習", desc: "練習したい項目にチェックを入れて始めよう。1回に10問まで出ます（毎回ちがう問題が出ます）。" },
  { id: "復習", desc: "これまでにまちがえた問題だけに挑戦します。" },
];

const reviewIds = () => new Set((store.getScore(ID, "復習リスト") || "").split(",").filter(Boolean));

// 事前・事後テストの決まり（SEC-55）。画面に依存しない。
// scores: { pre: "5/11" | undefined, post: ... }
//  - 事前テスト・事後テストは、1回目の点だけを記録する。2回目からは練習として採点する（記録は変わらない）
//  - 事後テストが終わるまでは、事前テストの答えと解説を見せない。
//    練習・復習にも、事前・事後テストの問題（core）は出さない（事後テストが「覚えた答え」のテストにならないように）
//  - 事前テストがまだのときに事後テストを始めようとしたら、知らせる
export function testPolicy(mode, scores = {}) {
  const postDone = Boolean(scores.post);
  const isTest = mode === "事前テスト" || mode === "事後テスト";
  const key = mode === "事前テスト" ? "pre" : mode === "事後テスト" ? "post" : null;
  return {
    record: isTest && !scores[key],
    retake: isTest && Boolean(scores[key]),
    showAnswers: mode === "事前テスト" ? postDone : true,
    addToReview: mode !== "事前テスト",
    hideCore: !postDone && !isTest,
    needsPreNotice: mode === "事後テスト" && !scores.pre,
  };
}

// 練習は1回に10問まで（SEC-69: 34問が一度に出ると終わらない）
export const PRACTICE_MAX = 10;

// 練習の問題を選ぶ（画面に依存しない）。chosen: 選んだモジュールのid
export function practiceSet(pool, chosen, limit = PRACTICE_MAX, mix = shuffle) {
  const ids = new Set(chosen);
  return mix(pool.filter((q) => ids.has(q.module))).slice(0, limit);
}

// 問題を章の順（モジュールの番号順）にならべる。同じモジュールの中は元の順（SEC-69）
export function orderByModules(questions, moduleOrder) {
  const rank = (m) => {
    const i = moduleOrder.indexOf(m);
    return i < 0 ? moduleOrder.length : i;
  };
  return questions.map((q, i) => [q, i]).sort((a, b) => rank(a[0].module) - rank(b[0].module) || a[1] - b[1]).map(([q]) => q);
}

// 点の文字「3/5」→ 正答率 0.6。読めない値・分母が0のときは null（records.js の集計でも使う）
export function scoreRate(s) {
  const [a, b] = String(s ?? "").split("/").map(Number);
  return s && Number.isFinite(a) && b > 0 ? a / b : null;
}
const currentScores = () => ({ pre: store.getScore(ID, "事前テスト"), post: store.getScore(ID, "事後テスト") });

export async function renderCheck(view, available, easy = "") {
  const { questions: all } = await loadData("quiz");
  const enabledIds = new Set(available.map((c) => c.id));
  const questions = orderByModules(all.filter((q) => enabledIds.has(q.module)), CATALOG.map((c) => c.id));
  const titleOf = (id) => CATALOG.find((c) => c.id === id)?.title || id;
  const stage = h("div");

  const history = () => {
    const pre = store.getScore(ID, "事前テスト");
    const post = store.getScore(ID, "事後テスト");
    const diff = scoreRate(pre) !== null && scoreRate(post) !== null ? Math.round((scoreRate(post) - scoreRate(pre)) * 100) : null;
    return h(
      "div",
      { class: "table-wrap" },
      h(
        "table",
        { class: "data" },
        h("tbody", {}, h("tr", {}, h("th", {}, "事前テスト"), h("td", {}, pre ? `${pre}（1回目の点）` : "まだ")), h("tr", {}, h("th", {}, "事後テスト"), h("td", {}, post ? `${post}（1回目の点）` : "まだ")), diff !== null ? h("tr", {}, h("th", {}, "正答率の変化"), h("td", {}, `${diff >= 0 ? "+" : ""}${diff} ポイント`)) : null, h("tr", {}, h("th", {}, "復習リスト"), h("td", {}, `${reviewIds().size} 問`))),
      ),
    );
  };

  // 復習リストの問題から、体験したステップへ戻るリンク（SEC-69）
  const reviewLinks = () => {
    const ids = reviewIds();
    const list = questions.filter((q) => ids.has(q.id));
    if (!list.length) return "";
    return h(
      "details",
      { class: "review-links" },
      h("summary", {}, `復習リストの問題（${list.length}問）: 体験したステップへ戻る`),
      h("ul", { class: "feedback-list" }, list.map((q) => h("li", { class: "missed" }, h("span", { class: "tag" }, "復習"), h("a", { href: `#/${q.module}/${q.step}` }, `${titleOf(q.module)}：${q.question}`)))),
    );
  };

  // 練習のモジュールは、はじめはどれも選んでいない（SEC-69）
  const moduleBoxes = available.map((c) => ({ id: c.id, input: h("input", { type: "checkbox" }) }));

  const start = (mode, { skipNotice = false } = {}) => {
    const policy = testPolicy(mode, currentScores());
    if (policy.needsPreNotice && !skipNotice) return preNotice();
    let set;
    const pool = policy.hideCore ? questions.filter((q) => !q.core) : questions;
    if (mode === "事前テスト" || mode === "事後テスト") set = questions.filter((q) => q.core);
    else if (mode === "復習") set = pool.filter((q) => reviewIds().has(q.id));
    else {
      const chosen = moduleBoxes.filter((b) => b.input.checked).map((b) => b.id);
      if (!chosen.length) return toast("練習したい項目にチェックを入れよう");
      set = practiceSet(pool, chosen);
      if (!set.length && policy.hideCore) return toast("この項目の練習問題は、事後テストのあとで出ます。ほかの項目も選ぼう");
    }
    if (!set.length) return toast(mode === "復習" ? "復習する問題はありません" : "問題がありません");
    runQuiz(mode, set, policy);
  };

  // 事前テストの前に事後テストを押したとき（SEC-55）
  const preNotice = () => {
    stage.replaceChildren(
      h(
        "section",
        { class: "card" },
        h("h2", {}, "事前テストがまだです"),
        explainCard("先に事前テストをしますか？", "事後テストは、学習のあとに受けるテストです。事前テスト（学習の前の力）とくらべて、伸びを確かめます。", "warn"),
        h("div", { class: "btn-row" }, h("button", { class: "btn", type: "button", onclick: () => start("事前テスト") }, "事前テストをする"), h("button", { class: "btn secondary", type: "button", onclick: () => start("事後テスト", { skipNotice: true }) }, "このまま事後テストをする")),
      ),
    );
    stage.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const runQuiz = (mode, set, policy) => {
    const form = h("form", { class: "check-form", novalidate: true });
    const recorded = mode === "事前テスト" ? currentScores().pre : mode === "事後テスト" ? currentScores().post : "";
    set.forEach((q, i) => {
      form.append(
        h(
          "fieldset",
          { class: "card check-q", id: `q-${q.id}` },
          h("legend", {}, h("span", { class: "badge" }, `第${i + 1}問`), " ", q.question, h("span", { class: "hint" }, `（${titleOf(q.module)}）`)),
          // 選択肢の順番は毎回入れかえる（位置で答えを覚えないように）
          h("div", { class: "check-list" }, shuffle(q.choices.map((c, ci) => [c, ci])).map(([c, ci]) => h("label", { class: "check-item" }, h("input", { type: "radio", name: q.id, value: ci }), h("span", {}, c)))),
          h("div", { class: "q-feedback", "aria-live": "polite" }),
        ),
      );
    });
    const submit = h("button", { class: "btn", type: "submit" }, "採点する");
    form.append(h("div", { class: "btn-row" }, submit));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const unanswered = set.filter((q) => !form.querySelector(`input[name="${q.id}"]:checked`));
      if (unanswered.length && !confirm(`まだ答えていない問題が ${unanswered.length} 問あります。採点しますか？`)) return;
      const review = reviewIds();
      let score = 0;
      const wrong = [];
      for (const q of set) {
        const sel = form.querySelector(`input[name="${q.id}"]:checked`);
        const ok = sel && Number(sel.value) === q.answer;
        if (ok) score++;
        else wrong.push(q);
        if (policy.addToReview) ok ? review.delete(q.id) : review.add(q.id);
        form.querySelectorAll(`input[name="${q.id}"]`).forEach((r) => (r.disabled = true));
        const fs = form.querySelector(`#q-${CSS.escape(q.id)}`);
        // 事後テストが終わるまでは、事前テストの答え・解説・○×を見せない
        if (!policy.showAnswers) continue;
        fs.classList.add(ok ? "is-correct" : "is-wrong");
        fs.querySelector(".q-feedback").replaceChildren(explainCard(ok ? "○ 正解" : `× 正解は「${q.choices[q.answer]}」`, q.explain, ok ? "good" : "warn"));
      }
      submit.disabled = true;
      if (policy.addToReview) store.setScore(ID, "復習リスト", [...review].join(","));
      if (policy.record) store.setScore(ID, mode, `${score}/${set.length}`);
      const result = h(
        "section",
        { class: "card check-result" },
        h("h2", {}, `${set.length}問中 ${score}問 正解`),
        policy.retake ? explainCard("練習として採点しました", `${mode}の記録は、1回目の「${recorded}」のままです。`) : "",
        !policy.showAnswers
          ? explainCard("答えと解説は、事後テストのあとで", "これは学習する前の力です。答えと解説は、事後テストが終わると見られます。まちがえた問題は、学習のあとの事後テストで確かめよう。", "good")
          : wrong.length
          ? h(
              "div",
              {},
              h("p", {}, "まちがえた問題は、もう一度そのステップで体験して復習しよう。"),
              h("ul", { class: "feedback-list" }, wrong.map((q) => h("li", { class: "missed" }, h("span", { class: "tag" }, "復習"), h("a", { href: `#/${q.module}/${q.step}` }, `${titleOf(q.module)}：${q.question}`)))),
            )
          : explainCard("全問正解！", "すばらしい！学んだことを毎日の行動で続けよう。", "good"),
        h("div", { class: "btn-row" }, h("button", { class: "btn secondary", type: "button", onclick: () => renderCheck(view, available) }, "チェックのトップへ")),
      );
      form.after(result);
      result.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    stage.replaceChildren(
      h("h2", {}, policy.retake ? `${mode}（練習）` : mode),
      policy.retake ? explainCard("2回目からは練習です", `${mode}は、1回目の点（${recorded}）を記録しています。今回は練習として採点します（${mode}の記録は変わりません）。`, "warn") : "",
      policy.hideCore && mode !== "事前テスト" && mode !== "事後テスト" ? h("p", { class: "hint" }, "事後テストが終わるまでは、事前・事後テストと同じ問題は出ません。") : "",
      form,
    );
    stage.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  view.replaceChildren(
    h("div", { class: "module-head" }, h("h1", {}, "理解度チェック"), h("p", { class: "meta" }, "選択式の問題で、学んだことを確かめよう。まちがえた問題は「復習リスト」に入り、体験したステップにすぐ戻れます。"), easy),
    h("section", { class: "card" }, h("h2", {}, "これまでの結果"), history(), reviewLinks()),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "チェックを選ぶ"),
      h(
        "div",
        { class: "module-grid" },
        MODES.map((m) =>
          h(
            "div",
            { class: m.id === "練習" ? "module-card practice-card" : "module-card" },
            h("span", { class: "mc-title" }, m.id),
            h("span", { class: "mc-desc" }, m.desc),
            m.id === "練習" ? h("details", { open: true, class: "practice-picker" }, h("summary", {}, "項目を選ぶ"), h("div", { class: "check-list" }, moduleBoxes.map((b) => h("label", { class: "check-item" }, b.input, h("span", {}, titleOf(b.id)))))) : "",
            h("button", { class: "btn", type: "button", onclick: () => start(m.id) }, "はじめる"),
          ),
        ),
      ),
    ),
    stage,
  );
}
