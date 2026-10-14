// モジュール10: まとめ・行動宣言
import { h, explainCard, stepCard, reflectionBox, threeSteps, toast } from "../js/ui.js";
import { store } from "../js/store.js";
import { consultCard } from "../js/consult.js";

const ID = "declare";
const STEPS = [
  { id: "choose", title: "今日から実行する3つを選ぼう" },
  { id: "card", title: "行動宣言カードを作ろう" },
  { id: "reflect", title: "ふりかえり" },
];
const ACTIONS = [
  { group: "パスワード", items: ["パスワードを長くする（12文字以上、またはランダムな単語5〜6個のパスフレーズ）", "サービスごとに違うパスワードにする", "2段階認証を設定する", "メールやメッセージでパスワードを聞かれても答えない"] },
  { group: "フィッシング・通信", items: ["メッセージのリンクではなく、公式アプリやブックマークから確かめる", "パスワードを入力する前に、アドレスのドメイン名を確認する", "フリーWi-Fiで大切な操作をしない"] },
  { group: "アプリ・機器", items: ["アプリの権限は、必要なものだけ許可する", "OSやアプリを最新の状態にする", "知らない人からのDMには返信しない"] },
  { group: "SNS・投稿", items: ["投稿の前に、写りこみと位置情報を確認する", "学校名や生活がわかる情報を投稿しない", "友達の写真は、本人に聞いてから投稿する", "人を傷つける投稿は広げない"] },
  { group: "著作権・ルール", items: ["引用するときは出典を書く", "フリー素材は利用規約を確認する"] },
  { group: "相談", items: ["困ったら、一人でかかえずに家族や先生に相談する", "家族とスマホ・ネットの使い方のルールを話し合う"] },
];

export const declareModule = {
  id: ID,
  minutes: "10〜15分",
  lead: "これまでに学んだ対策から、自分が今日から実行するものを3つ選んで宣言しよう。",
  steps: STEPS,
  async render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));
    const saved = (store.getScore(ID, "宣言") || "").split(" / ").filter(Boolean);
    const chosen = new Set(saved);
    const counter = h("p", { "aria-live": "polite" });
    const cardView = h("div");
    const boxes = [];

    const updateCounter = () => {
      counter.replaceChildren("選んだ数: ", h("strong", {}, `${chosen.size}`), " / 3", chosen.size > 3 ? h("span", { class: "status warn", style: "margin-left:8px" }, "3つまでにしぼろう") : "");
      boxes.forEach(({ input, text }) => (input.disabled = chosen.size >= 3 && !chosen.has(text)));
    };
    const groups = ACTIONS.map((g) =>
      h(
        "fieldset",
        { class: "action-group" },
        h("legend", {}, g.group),
        h(
          "div",
          { class: "check-list" },
          g.items.map((text) => {
            const input = h("input", { type: "checkbox", checked: chosen.has(text) ? true : null });
            input.addEventListener("change", () => {
              input.checked ? chosen.add(text) : chosen.delete(text);
              updateCounter();
            });
            boxes.push({ input, text });
            return h("label", { class: "check-item" }, input, h("span", {}, text));
          }),
        ),
      ),
    );
    const saveBtn = h("button", { class: "btn", type: "button" }, "この3つで宣言する");
    saveBtn.addEventListener("click", () => {
      if (chosen.size !== 3) return toast("ちょうど3つ選んでください");
      store.setScore(ID, "宣言", [...chosen].join(" / "));
      cards[0].done();
      drawCard();
      cardView.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const drawCard = () => {
      const list = (store.getScore(ID, "宣言") || "").split(" / ").filter(Boolean);
      if (list.length !== 3) {
        cardView.replaceChildren(h("p", { class: "hint" }, "ステップ1で3つ選んで宣言すると、カードができます。"));
        return;
      }
      const s = store.state.student;
      cardView.replaceChildren(
        h(
          "div",
          { class: "declare-card", id: "declare-card" },
          h("p", { class: "declare-title" }, "わたしの情報セキュリティ 行動宣言"),
          h("p", { class: "hint" }, [s.cls, s.num && `${s.num}番`, s.name].filter(Boolean).join(" ") || "（記録ページでクラス・番号を入れると表示されます）", "　", new Date().toLocaleDateString("ja-JP")),
          h("ol", {}, list.map((t) => h("li", {}, t))),
          threeSteps(),
        ),
        h(
          "div",
          { class: "btn-row" },
          h(
            "button",
            {
              class: "btn",
              type: "button",
              onclick: () => {
                document.body.classList.add("print-card");
                window.print();
                setTimeout(() => document.body.classList.remove("print-card"), 500);
                cards[1].done();
              },
            },
            "カードを印刷する",
          ),
          h("button", { class: "btn secondary", type: "button", onclick: () => cards[1].done() }, "画面で見て確認した"),
        ),
      );
    };

    // これまでのふりかえり
    const past = Object.entries(store.state.reflections).filter(([k]) => k !== ID);
    cards[0].body.append(
      past.length
        ? h("details", {}, h("summary", {}, `これまでのふりかえりを見る（${past.length}件）`), h("ul", { class: "feedback-list" }, past.map(([, r]) => h("li", {}, r.text))))
        : "",
      h("p", {}, "全部できたら理想ですが、まずは「確実に続けられる3つ」を選ぼう。"),
      ...groups,
      counter,
      h("div", { class: "btn-row" }, saveBtn),
    );
    cards[1].body.append(cardView);
    cards[2].body.append(
      explainCard("続けるコツ", "家族にカードを見せて、宣言したことを一緒に確かめてもらおう。1か月後に、できているかふりかえってみよう。"),
      await consultCard(),
      reflectionBox(ID, "その3つを選んだ理由と、どうやって続けるかを書こう。", () => cards[2].done()),
    );
    updateCounter();
    drawCard();
    root.append(...cards.map((c) => c.el));
  },
};
