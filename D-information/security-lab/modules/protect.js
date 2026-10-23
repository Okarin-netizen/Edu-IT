// モジュール①: 情報を守るしくみ（教科書 4編1章5）
// 守る3つの見方（もれない・こわれない・使える）と、守る道具（対策ソフト・ファイアウォール・フィルタリング・多要素認証）を場面で選ぶ
import { h, explainCard, stepCard, reflectionBox, choiceQuiz } from "../js/ui.js";

const ID = "protect";
const STEPS = [
  { id: "view", title: "守る3つの見方" },
  { id: "tools", title: "守る道具を選ぼう" },
  { id: "reflect", title: "ふりかえり" },
];

// 3つの見方: 何が起きると困るか
export const VIEWS = [
  { id: "leak", name: "もれない", say: "見てよい人だけが見られる。" },
  { id: "keep", name: "こわれない", say: "書きかえられたり、消されたりしない。" },
  { id: "use", name: "使える", say: "使いたいときに、いつでも使える。" },
];
const VIEW_CHOICES = VIEWS.map((v) => `${v.name}（${v.say}）`);
export const VIEW_QUIZ = [
  { question: "友だちに送った写真を、知らない人に見られてしまった。守れなかったのはどれ？", choices: VIEW_CHOICES, answer: 0, explain: "見てよい人だけが見られる、が守れませんでした。" },
  { question: "学校のホームページの文が、だれかに勝手に書きかえられた。守れなかったのはどれ？", choices: VIEW_CHOICES, answer: 1, explain: "正しい内容のまま、が守れませんでした。" },
  { question: "大量のアクセスでサーバーが止まり、予約サイトが使えなくなった。守れなかったのはどれ？", choices: VIEW_CHOICES, answer: 2, explain: "使いたいときに使える、が守れませんでした。" },
];

// 守る道具: 場面カード
export const TOOLS = ["ウイルス対策ソフト", "ファイアウォール", "フィルタリング", "多要素認証"];
export const TOOL_QUIZ = [
  { question: "メールについてきたファイルに、コンピュータウイルスが入っているかもしれない。", choices: TOOLS, answer: 0, explain: "ウイルス対策ソフトは、ウイルスを見つけて取りのぞきます。最新の状態にしておこう。" },
  { question: "外のネットワークから、学校のコンピュータへのあやしい通信を止めたい。", choices: TOOLS, answer: 1, explain: "ファイアウォールは、通してよい通信だけを通す「防火かべ」です。" },
  { question: "小学生の弟が、危ないサイトを開かないようにしたい。", choices: TOOLS, answer: 2, explain: "フィルタリングは、有害なサイトを見られないようにします。" },
  { question: "パスワードを知られても、ほかの人にログインされないようにしたい。", choices: TOOLS, answer: 3, explain: "多要素認証は、パスワードのほかにスマホへのコードなども使って確かめます。" },
];

export const protectModule = {
  id: ID,
  minutes: "15分",
  lead: "情報を守るには、3つの見方があります。場面に合う守り方を選ぼう。",
  steps: STEPS,
  async render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));
    const quizSet = (card, list) => {
      const answered = new Set();
      return list.map((q, i) =>
        choiceQuiz(q, () => {
          answered.add(i);
          if (answered.size === list.length) card.done();
        }),
      );
    };
    cards[0].body.append(
      h("p", {}, "情報を守るとは、次の3つを守ることです。"),
      h("ul", {}, ...VIEWS.map((v) => h("li", {}, h("strong", {}, `${v.name}: `), v.say))),
      ...quizSet(cards[0], VIEW_QUIZ),
    );
    cards[1].body.append(
      h("p", {}, "場面を読んで、いちばん合う道具を選ぼう。"),
      ...quizSet(cards[1], TOOL_QUIZ),
      explainCard(
        "用語",
        "<strong>サイバー攻撃</strong>: ネットワークを使って、情報をぬすんだり、こわしたりすること。<br><strong>サイバーセキュリティ</strong>: サイバー攻撃から、情報やコンピュータを守ること。",
      ),
    );
    cards[2].body.append(reflectionBox(ID, "家で使っている機器で、どの守り方が使われているかな？", () => cards[2].done()));
    root.append(...cards.map((c) => c.el));
  },
};
