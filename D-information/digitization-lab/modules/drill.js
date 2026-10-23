// モジュール④: データ量の計算ドリル（問題は毎回自動で作る）
import { h, explainCard, stepCard, shuffled, toast } from "../js/ui.js";
import { store } from "../js/store.js";
import { makeDrill, DRILL_KINDS, updateDrillBests, drillBestText } from "../js/digilib.js";

const ID = "drill";
const STEPS = [
  { id: "try", title: "10問に挑戦しよう" },
  { id: "good", title: "8問以上の正解をめざそう" },
];
const ROUND = 10;

export const drillModule = {
  id: ID,
  minutes: "15〜20分",
  lead: "画像・音のデータ量や、単位の計算を練習します。問題は毎回ちがうものが出ます。まちがえたら、解き方を見てもう一度挑戦しよう。",
  steps: STEPS,
  async render(root) {
    const [c1, c2] = STEPS.map((s, i) => stepCard(ID, s, i));
    let kind = "mix";
    let round = null;
    const area = h("div");
    const tabs = h("div", { class: "scenario-tabs", role: "group", "aria-label": "問題の種類" });
    const best = h("div", { class: "hint", "aria-live": "polite" });
    const kindNote = h("p", { class: "hint drill-kind-note", "aria-live": "polite" });
    const showBest = () => {
      const t = drillBestText(store.state.modules[ID]?.score);
      best.textContent = t ? `これまでの最高（種類ごと）: ${t}` : "";
    };
    const setKind = (k) => {
      kind = k;
      kindNote.textContent = k === "video" ? "動画は発展の問題です。けたがとても大きくなるので、電卓を使って計算しよう。" : k === "mix" ? "「いろいろ」には、動画の問題は出ません（動画は発展）。" : "";
      for (const b of tabs.querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.key === k ? "true" : "false");
      start();
    };
    for (const [k, label] of [["mix", "いろいろ"], ...DRILL_KINDS.map((d) => [d.id, d.label])]) tabs.append(h("button", { type: "button", dataset: { key: k }, onclick: () => setKind(k) }, label));

    function start() {
      round = { n: 0, correct: 0, seen: new Set() };
      next();
    }
    function next() {
      if (round.n >= ROUND) return finish();
      let p;
      for (let tries = 0; tries < 20; tries++) {
        p = makeDrill(kind);
        if (!round.seen.has(p.question)) break;
      }
      round.seen.add(p.question);
      round.n++;
      const fb = h("div", { "aria-live": "polite" });
      const list = h("ul", { class: "choice-list" });
      let answered = false;
      let correctBtn;
      for (const [text, i] of shuffled(p.choices.map((t, i) => [t, i]))) {
        const b = h("button", { type: "button" }, text);
        if (i === p.answer) correctBtn = b;
        b.addEventListener("click", () => {
          if (answered) return;
          answered = true;
          const ok = i === p.answer;
          if (ok) round.correct++;
          b.classList.add(ok ? "correct" : "wrong");
          b.prepend(ok ? "○ " : "× ");
          if (!ok) {
            correctBtn.classList.add("correct");
            correctBtn.prepend("○ ");
          }
          const nextBtn = h("button", { class: "btn", type: "button", onclick: next }, round.n >= ROUND ? "結果を見る" : "次の問題 →");
          fb.replaceChildren(explainCard(ok ? "正解！" : "解き方", p.explain, ok ? "good" : "warn"), h("div", { class: "btn-row" }, nextBtn));
          nextBtn.focus();
        });
        list.append(h("li", {}, b));
      }
      area.replaceChildren(
        h("div", { class: "drill-head" }, h("span", { class: "badge" }, `${round.n} / ${ROUND}問`), h("span", { class: "hint" }, `正解 ${round.correct}`)),
        h("p", {}, h("strong", {}, p.question)),
        list,
        fb,
      );
    }
    function finish() {
      const { correct } = round;
      const at = new Date().toISOString();
      const prev = store.getScore(ID, "best");
      if (!prev || correct > prev.correct) store.setScore(ID, "best", { correct, total: ROUND, at, kind });
      store.setScore(ID, "bests", updateDrillBests(store.getScore(ID, "bests"), kind, correct, ROUND, at));
      c1.done();
      // ステップ2は「いろいろ」（画像・音・単位がまざる）で8問以上
      if (correct >= 8 && kind === "mix") c2.done();
      showBest();
      area.replaceChildren(
        h("p", {}, "結果: ", h("strong", { class: "big-number" }, `${correct} / ${ROUND}問`)),
        correct >= 8
          ? kind === "mix"
            ? explainCard("すばらしい！", "データ量の計算がしっかりできています。ほかの種類の問題にも挑戦してみよう。", "good")
            : explainCard("よくできました", "ステップ2のクリアには、「いろいろ」で8問以上の正解が必要です。「いろいろ」にも挑戦しよう。", "good")
          : explainCard("もう一度やってみよう", "上の「計算のコツ」を見直してから、もう一度挑戦しよう。", "warn"),
        h("div", { class: "btn-row" }, h("button", { class: "btn", type: "button", onclick: start }, "もう一度（新しい問題）")),
      );
      if (correct === ROUND) toast("全問正解！");
    }

    // 計算のコツは、問題の上でいつでも開ける（下までスクロールしなくてよいように）
    const tips = h(
      "details",
      { class: "advanced drill-tips" },
      h("summary", {}, "計算のコツ・単位の決まりを見る"),
      explainCard(
        "計算のコツ",
        "<strong>画像</strong>: 横の画素数 × 縦の画素数 × 1画素のビット数<br><strong>音</strong>: 標本化周波数 × 量子化ビット数 × 秒数 × チャンネル数<br><strong>動画</strong>: 1枚の画像のデータ量 × 1秒あたりの枚数 × 秒数<br><strong>単位</strong>: 8ビット ＝ 1バイト、1024バイト ＝ 1KB、1024KB ＝ 1MB、1024MB ＝ 1GB<br><strong>ビット数</strong>: nビットで 2<sup>n</sup>通り（1ビット増えると2倍）",
      ),
      h("p", { class: "hint" }, "このラボでは 1KB ＝ 1024バイトで計算します。1KB ＝ 1000バイトで計算する教科書もあります。どちらでも、およその大きさは同じです。"),
    );
    c1.body.append(
      h("p", {}, "問題の種類を選んで、10問に挑戦しよう。", h("strong", { class: "calc-ok" }, "電卓を使ってもよい。")),
      tabs,
      kindNote,
      tips,
      area,
      best,
    );
    c2.body.append(
      h("p", {}, "「いろいろ」で、10問中8問以上できたらクリアです。まちがえた問題は、「解き方」の式をノートに書いてたしかめよう。"),
      explainCard("よくあるまちがい", "8でわるのを忘れる・ステレオの「× 2」を忘れる・「× 3色」を2回かける。答えを出したら、単位を見直そう。", "warn"),
    );
    root.append(c1.el, c2.el);
    showBest();
    setKind("mix");
  },
};
