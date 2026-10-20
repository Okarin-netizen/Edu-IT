// モジュール⑧: 著作権・利用ルールクイズ（分岐型）
import { h, explainCard, stepCard, reflectionBox, choiceQuiz } from "../js/ui.js";
import { loadData } from "../js/data.js";
import { store } from "../js/store.js";
import { branchPlayer } from "../js/branch.js";

const ID = "copyright";
const STEPS = [
  { id: "first", title: "場面ごとに考えよう" },
  { id: "all", title: "すべての場面に挑戦しよう" },
  { id: "responsibility", title: "発信者としての責任" },
  { id: "reflect", title: "ふりかえり" },
];

export const copyrightModule = {
  id: ID,
  minutes: "15分",
  lead: "歌詞・文章・写真・イラストには、作った人の権利（著作権）があります。「使っていいの？」を、身近な場面で考えよう。",
  steps: STEPS,
  async render(root) {
    const { cases } = await loadData("copyright");
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));
    const picker = h("div", { class: "scenario-tabs case-picker", role: "group", "aria-label": "場面を選ぶ" });
    const stage = h("div");
    const summary = h("div");
    let current = 0;
    const isDone = (c) => Boolean(store.getScore(ID, c.id));

    const refresh = () => {
      picker.replaceChildren(
        ...cases.map((c, i) => {
          const b = h("button", { type: "button", "aria-pressed": i === current ? "true" : "false", class: isDone(c) ? "done" : "" }, `${i + 1}. ${c.title}`);
          b.addEventListener("click", () => {
            current = i;
            refresh();
            play();
          });
          return b;
        }),
      );
      const done = cases.filter(isDone).length;
      summary.replaceChildren(
        h("p", {}, `挑戦した場面: ${done} / ${cases.length}`),
        h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("tbody", {}, cases.map((c) => h("tr", {}, h("td", {}, c.title), h("td", {}, store.getScore(ID, c.id) || "—")))))),
      );
      if (done >= 3) cards[0].done();
      if (done === cases.length) cards[1].done();
    };
    const play = () => {
      const c = cases[current];
      const next = h("div");
      stage.replaceChildren(
        h("div", { class: "result-box" }, h("strong", {}, "場面: "), c.situation),
        branchPlayer(c, {
          showBest: true,
          onFinish: ({ bestCount, askedCount }) => {
            store.setScore(ID, c.id, `${bestCount}/${askedCount}`);
            refresh();
            const nextIdx = cases.findIndex((x, i) => i !== current && !isDone(x));
            // この場面をもう一度（SEC-70）。まだの場面があれば「次の場面へ」も出す
            next.replaceChildren(
              h(
                "div",
                { class: "btn-row" },
                h("button", { class: "btn secondary", type: "button", onclick: play }, "この場面をもう一度"),
                nextIdx < 0
                  ? ""
                  : h(
                    "button",
                    {
                      class: "btn",
                      type: "button",
                      onclick: () => {
                        current = nextIdx;
                        refresh();
                        play();
                        picker.scrollIntoView({ behavior: "smooth", block: "start" });
                      },
                    },
                    "次の場面へ →",
                  ),
              ),
            );
          },
        }),
        next,
      );
    };

    cards[0].body.append(h("p", {}, "場面を読んで、どうするのがよいかを選ぼう。答えによって次の問いが変わります。まずは3つの場面に挑戦しよう。"), picker, stage);
    cards[1].body.append(
      h("p", {}, `ステップ1の場面ボタンから、残りの場面にも挑戦しよう。${cases.length}つの場面ぜんぶで ✓ になります。`),
      summary,
      h("h3", {}, "おぼえておきたいルール"),
      h(
        "ul",
        {},
        h("li", {}, h("strong", {}, "著作物には作った人の権利がある: "), "文章・歌詞・音楽・絵・写真・動画・プログラムなど。ネット上のものも同じ。"),
        h("li", {}, h("strong", {}, "引用: "), "公表された作品から使う。自分の文章が中心で、引用は一部だけ。かぎかっこで区別して、変えずに使う。出典を書く。必要な範囲だけ。"),
        h("li", {}, h("strong", {}, "私的使用: "), "自分や家族の範囲で楽しむためのコピーはOK。でも、違法にアップロードされたものと知りながらダウンロードすることはダメ。コピーガードを外してコピーすることもダメ。ネットに上げるのもダメ。"),
        h("li", {}, h("strong", {}, "授業での利用: "), "授業に必要な範囲なら使える特別なルールがある。ただし外に公開するときは別。"),
        h("li", {}, h("strong", {}, "フリー素材: "), "利用規約の条件（クレジット表記・加工の可否など）を必ず確認。"),
        h("li", {}, h("strong", {}, "人の写真: "), "写っている人には、勝手に写真を公開されない権利（肖像権）がある。撮った人には著作権がある。両方を大切に。有名人の写真には、さらに別の権利（パブリシティ権）もある。"),
      ),
      explainCard("迷ったら", "「作った人だったら、こう使われてうれしいかな？」と考え、わからないときは先生に相談しよう。"),
    );
    // ステップ3: 発信者としての責任（知的財産権）
    {
      const c = cards[2];
      const answered = new Set();
      const mark = (k) => {
        answered.add(k);
        if (answered.size >= 2) c.done();
      };
      c.body.append(
        h("p", {}, "ネットに作品や文章をのせると、あなたは「発信者」になります。人の作品を使う側としても、自分の作品を守る側としても、責任と権利があります。"),
        choiceQuiz(
          {
            question: "人気マンガの1ページを撮影して、自分のSNSにのせた。だれの責任になる？",
            choices: ["のせた（発信した）自分の責任", "マンガを買った書店の責任", "SNSの会社の責任なので、自分は関係ない"],
            answer: 0,
            explain: "作者の許可なくのせると、著作権の侵害になるおそれがあります。責任を負うのは、発信したあなたです。「みんなやっている」「出典を書いた」だけでは許可をもらったことになりません。",
          },
          () => mark("upload"),
        ),
        choiceQuiz(
          {
            question: "自分で描いたイラストをSNSで公開した。すると、知らない人が「自分の作品」として投稿していた。あなたの権利は？",
            choices: ["登録の手続きをしていないので、権利はない", "作品を作った時点で、あなたに著作権がある", "公開した時点で、だれでも自由に使えるようになる"],
            answer: 1,
            explain: "著作権は、作品を作った時点で自動的に生まれます（届け出はいりません）。中学生の作品も同じです。無断で使われたら、家族や先生に相談し、サービスの通報機能を使おう。",
          },
          () => mark("own"),
        ),
        explainCard(
          "知的財産権",
          "人が頭を使って生み出したものを守る権利をまとめて<strong>知的財産権</strong>といいます。作品を守る<strong>著作権</strong>のほかにも、いろいろあります。発明を守る特許権、商品のマークを守る商標権、デザインを守る意匠権などです。",
        ),
      );
    }
    cards[3].body.append(reflectionBox(ID, "作った人の権利を守ることが大切なのは、なぜだと思う？ 発信者として気をつけることは？", () => cards[3].done()));
    refresh();
    play();
    root.append(...cards.map((c) => c.el));
  },
};
