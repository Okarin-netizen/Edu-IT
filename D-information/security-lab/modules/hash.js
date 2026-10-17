// モジュール⑪（発展）: ハッシュ体験
import { h, explainCard, stepCard, reflectionBox, choiceQuiz } from "../js/ui.js";
import { sha256Hex, hexBitDiff } from "../js/cryptolib.js";

const ID = "hash";
const STEPS = [
  { id: "avalanche", title: "1文字変えると、どうなる？" },
  { id: "fixed", title: "どんなに長くても同じ長さ" },
  { id: "tamper", title: "書きかえ（改ざん）を見つけよう" },
  { id: "storage", title: "パスワードはハッシュで保存されている" },
  { id: "reflect", title: "ふりかえり" },
];

const PRINT_ORIGINAL = "【2年 技術科】作品の提出期限は10月20日（火）です。提出先は技術室の棚です。";
// 書きかえ版の日付も曜日が合うようにする（2026年10月27日は火曜日）。曜日のずれで見分けられないように。
const PRINT_FAKE = "【2年 技術科】作品の提出期限は10月27日（火）です。提出先は技術室の棚です。";

// ハッシュ値を、もう一方と違う文字に色を付けて表示する
function hashView(hex, other) {
  return h(
    "div",
    { class: "cipher-text hash-view" },
    [...hex].map((ch, i) => (other && other[i] !== ch ? h("mark", {}, ch) : ch)),
  );
}

export const hashModule = {
  id: ID,
  minutes: "10〜15分",
  lead: "ハッシュは、データから「指紋」のような短い値を作るしくみです。少しでも書きかわると指紋がまったく変わるので、改ざんを見つけたり、パスワードを安全に保存したりするのに使われます。",
  steps: STEPS,
  async render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));

    // ステップ1: なだれ効果
    {
      const c = cards[0];
      const a = h("input", { type: "text", id: "hash-a", value: "こんにちは", autocomplete: "off" });
      const b = h("input", { type: "text", id: "hash-b", value: "こんにちわ", autocomplete: "off" });
      const out = h("div", { "aria-live": "polite" });
      let touched = false;
      const update = async () => {
        const [ha, hb] = await Promise.all([sha256Hex(a.value), sha256Hex(b.value)]);
        const bits = hexBitDiff(ha, hb);
        out.replaceChildren(
          h("p", { class: "hint" }, "A のハッシュ値（SHA-256）"),
          hashView(ha, hb),
          h("p", { class: "hint", style: "margin-top:8px" }, "B のハッシュ値（A と違う文字に色）"),
          hashView(hb, ha),
          h("div", { class: "result-box" }, a.value === b.value ? "A と B が同じなので、ハッシュ値もまったく同じです。" : h("span", {}, "256ビットのうち ", h("strong", { class: "big-number" }, `${bits}`), " ビットが変わりました（約半分が変わるのがふつう）。")),
        );
        if (touched && a.value !== b.value) c.done();
      };
      a.addEventListener("input", () => ((touched = true), update()));
      b.addEventListener("input", () => ((touched = true), update()));
      c.body.append(
        h("p", {}, "A と B に、1文字だけ違う言葉を入れてみよう。ハッシュ値はどれくらい変わるかな？"),
        h("div", { class: "field-row" }, h("div", { class: "field" }, h("label", { for: "hash-a" }, "A"), a), h("div", { class: "field" }, h("label", { for: "hash-b" }, "B"), b)),
        out,
        explainCard("なだれ効果", "入力がほんの少し変わるだけで、ハッシュ値は予想できないほど大きく変わります。だから、ハッシュ値を見ても「どこが変わったか」「元は何か」は分かりません。"),
      );
      update();
    }

    // ステップ2: 固定長・一方向
    {
      const c = cards[1];
      const ta = h("textarea", { id: "hash-long", placeholder: "ここに文章を入れてみよう" });
      const out = h("div", { "aria-live": "polite" });
      const update = async () => {
        const hex = await sha256Hex(ta.value);
        out.replaceChildren(h("p", { class: "hint" }, `入力: ${[...ta.value].length}文字 → ハッシュ値: ${hex.length}文字（いつも同じ）`), hashView(hex));
        if ([...ta.value].length >= 50) c.done();
      };
      ta.addEventListener("input", update);
      c.body.append(
        h("p", {}, "1文字でも、本1冊分でも、SHA-256 のハッシュ値はいつも64文字（256ビット）です。"),
        h("p", { class: "hint" }, "ハッシュ値は 0〜9 と a〜f の16種類の文字で書かれています（16進数）。1文字で4ビット分なので、64文字 × 4 ＝ 256ビットになります。"),
        h("div", { class: "field" }, h("label", { for: "hash-long" }, "文章"), ta),
        h("div", { class: "btn-row" }, h("button", { class: "btn small secondary", type: "button", onclick: () => ((ta.value = "吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。".repeat(3)), update()) }, "長い文章を入れてみる")),
        out,
        explainCard("元に戻せない（一方向）", "暗号は鍵があれば元に戻せますが、ハッシュは元に戻すことができません。64文字に「まとめて」しまうので、元の情報はなくなっています。"),
      );
      update();
    }

    // ステップ3: 改ざん検出
    {
      const c = cards[2];
      const official = await sha256Hex(PRINT_ORIGINAL);
      const files = Math.random() < 0.5 ? [PRINT_ORIGINAL, PRINT_FAKE] : [PRINT_FAKE, PRINT_ORIGINAL];
      const fb = h("div", { "aria-live": "polite" });
      const fileBox = (text, label) => {
        const hashOut = h("div");
        const pick = h("button", { class: "btn small", type: "button" }, `${label} が本物`);
        pick.addEventListener("click", () => {
          if (text === PRINT_ORIGINAL) {
            fb.replaceChildren(explainCard("正解！", "ハッシュ値が先生の公開した値と一致するのは、書きかえられていないファイルだけです。もう一方は「20日」が「27日」に書きかえられていました（曜日はどちらも火曜日なので、見た目だけでは気づきにくい）。ソフトの配布やダウンロードでも、同じ方法で改ざんを確かめます。", "good"));
            c.done();
          } else fb.replaceChildren(explainCard("もう一度", "ハッシュ値を計算して、先生が公開した値と1文字ずつ比べてみよう。", "warn"));
        });
        return h(
          "div",
          { class: "card", style: "margin:8px 0" },
          h("strong", {}, label),
          h("p", {}, text),
          h("div", { class: "btn-row" }, h("button", { class: "btn small secondary", type: "button", onclick: async () => hashOut.replaceChildren(hashView(await sha256Hex(text), official)) }, "ハッシュ値を計算"), pick),
          hashOut,
        );
      };
      c.body.append(
        h("p", {}, "先生がプリントのデータを配り、そのハッシュ値を黒板に書きました。ところが、出回っているファイルが2つあります。どちらかは途中で書きかえられています。"),
        h("p", { class: "hint" }, "先生が公開したハッシュ値"),
        hashView(official),
        fileBox(files[0], "ファイル1"),
        fileBox(files[1], "ファイル2"),
        fb,
      );
    }

    // ステップ4: パスワードの保存（入力は変数の中だけで使い、保存しない）
    {
      const c = cards[3];
      let storedHash = null;
      const reg = h("input", { type: "text", id: "hash-reg", autocomplete: "off", spellcheck: "false", placeholder: "練習用の文字（本物は入れない）" });
      const login = h("input", { type: "text", id: "hash-login", autocomplete: "off", spellcheck: "false", placeholder: "もう一度入れてみよう" });
      const db = h("div", { "aria-live": "polite" });
      const res = h("div", { "aria-live": "polite" });
      c.body.append(
        h("p", {}, "きちんとしたサービスは、パスワードそのものではなく、ハッシュ値を保存しています。ログインのときは、入力された文字のハッシュ値を計算して、保存されたハッシュ値と比べます。"),
        h("div", { class: "field" }, h("label", { for: "hash-reg" }, "① 登録（練習用の文字）"), reg),
        h(
          "div",
          { class: "btn-row" },
          h(
            "button",
            {
              class: "btn small",
              type: "button",
              onclick: async () => {
                if (!reg.value) return;
                storedHash = await sha256Hex(reg.value);
                reg.value = "";
                db.replaceChildren(h("p", { class: "hint" }, "サーバーに保存されたもの（パスワードそのものはない）"), h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("tbody", {}, h("tr", {}, h("th", {}, "ユーザー"), h("td", {}, "taro")), h("tr", {}, h("th", {}, "ハッシュ値"), h("td", { class: "mono", style: "word-break:break-all" }, storedHash))))));
              },
            },
            "登録する",
          ),
        ),
        db,
        h("div", { class: "field" }, h("label", { for: "hash-login" }, "② ログイン"), login),
        h(
          "div",
          { class: "btn-row" },
          h(
            "button",
            {
              class: "btn small",
              type: "button",
              onclick: async () => {
                if (!storedHash) return res.replaceChildren(explainCard("先に登録しよう", "①で練習用の文字を登録してください。", "warn"));
                const ok = (await sha256Hex(login.value)) === storedHash;
                res.replaceChildren(explainCard(ok ? "ログイン成功" : "ログイン失敗", ok ? "ハッシュ値が一致しました。サーバーはパスワードを知らなくても、本人かどうかを確かめられます。" : "ハッシュ値が一致しません。1文字違うだけでも、まったく別のハッシュ値になります。", ok ? "good" : "bad"));
              },
            },
            "ログインする",
          ),
        ),
        res,
        choiceQuiz(
          {
            question: "パスワードのハッシュ値が流出しました。それでも「password」のようなパスワードが危ないのはなぜ？",
            choices: ["ハッシュ値は、専用の計算をすれば簡単に元のパスワードに戻せるから", "よく使われるパスワードのハッシュ値を計算して、同じ値を探せるから", "短いパスワードのハッシュ値には、元の文字がそのまま残っているから"],
            answer: 1,
            explain: "ハッシュは元に戻せませんが、同じ入力からは必ず同じハッシュ値ができます。だから「よく使われるパスワードの一覧」のハッシュ値を作って比べれば、すぐに見つかってしまいます（パスワード強度ラボの辞書攻撃と同じ）。実際のサービスは、ソルトという工夫や、わざと計算を遅くする方法も組み合わせています。",
          },
          () => c.done(),
        ),
      );
    }

    cards[4].body.append(reflectionBox(ID, "ハッシュ値を比べると改ざんが分かるのは、なぜだと思う？", () => cards[4].done()));
    root.append(...cards.map((c) => c.el));
  },
};
