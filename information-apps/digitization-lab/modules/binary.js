// モジュール3: 2進数と文字コード（ビットカード、変換パズル、文字コード）
import { h, explainCard, stepCard, reflectionBox } from "../js/ui.js";
import { toBinary, fromBinary, binaryExplain, utf8Bytes, charCodeRow, parseNumberAnswer, parseBinaryAnswer, parseWordAnswer, pickCardTargets, cardDots } from "../js/digilib.js";

const ID = "binary";
const STEPS = [
  { id: "cards", title: "ビットカードで数を作ろう" },
  { id: "puzzle", title: "10進数 ⇔ 2進数 パズル" },
  { id: "chars", title: "文字も0と1で表す（文字コード）" },
  { id: "reflect", title: "ふりかえり" },
];
const fmt = (n) => n.toLocaleString("ja-JP");
const SECRETS = ["CAT", "DOG", "SUN", "BIT", "PC", "KEY", "CODE", "BYTE"];

export const binaryModule = {
  id: ID,
  minutes: "20〜25分",
  lead: "コンピュータの中では、電気が流れる・流れない（オン・オフ）の2つの状態で情報を表します。これを0と1に置きかえた数の表し方が「2進数」です。0と1の1けたを1ビット、8ビットをまとめて1バイトといいます。",
  steps: STEPS,
  async render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));

    // ---------- ステップ1: ビットカード ----------
    {
      const c = cards[0];
      const values = [128, 64, 32, 16, 8, 4, 2, 1];
      const on = values.map(() => false);
      const targets = pickCardTargets(); // 小さい数から順に
      let ti = 0;
      const made = new Set();
      const row = h("div", { class: "bit-cards" });
      const out = h("div", { class: "result-box", "aria-live": "polite" });
      const goal = h("div", { class: "goal", "aria-live": "polite" });
      const btns = values.map((v, i) => {
        const b = h("button", { type: "button", class: "bit-card", "aria-pressed": "false" });
        b.addEventListener("click", () => {
          on[i] = !on[i];
          update();
        });
        return b;
      });
      row.append(...btns);
      function update() {
        btns.forEach((b, i) => {
          b.setAttribute("aria-pressed", on[i] ? "true" : "false");
          b.setAttribute("aria-label", `${values[i]}のカード（${on[i] ? "表・1" : "裏・0"}）`);
          b.replaceChildren(h("span", { class: "bc-value" }, String(values[i])), h("span", { class: "bc-dots", "aria-hidden": "true" }, on[i] ? cardDots(values[i]) : ""), h("span", { class: "bc-bit" }, on[i] ? "1" : "0"));
        });
        const n = values.reduce((a, v, i) => a + (on[i] ? v : 0), 0);
        out.replaceChildren(h("div", {}, "2進数: ", h("strong", { class: "mono big-number" }, on.map((x) => (x ? 1 : 0)).join(""))), h("div", {}, "10進数: ", h("strong", { class: "big-number" }, String(n))));
        const t = targets[ti];
        if (t !== undefined && n === t && !made.has(t)) {
          made.add(t);
          ti++;
          if (made.size >= 3) c.done();
        }
        const next = targets[ti];
        goal.replaceChildren(
          made.size ? h("div", { class: "status good" }, `✓ できた: ${[...made].join("、")}`) : "",
          next !== undefined ? h("p", {}, "お題：カードを表にして ", h("strong", { class: "big-number" }, String(next)), " を作ろう") : h("p", {}, h("strong", {}, "全部できました！ 自由に数を作ってみよう。")),
        );
      }
      c.body.append(
        h("p", {}, "カードを押すと表（1）と裏（0）が切りかわります。裏のカードにも、うすく数が書いてあります。表になっているカードの数を合計すると、10進数になります。"),
        goal,
        row,
        out,
        explainCard("気づいたかな？", "カードの数は、右から 1, 2, 4, 8, 16… と2倍ずつになっています。8枚（8ビット）で 0〜255 の 256通りの数を表せます。ビットが1つ増えるごとに、表せる数は2倍になります。"),
      );
      update();
    }

    // ---------- ステップ2: 変換パズル ----------
    {
      const c = cards[1];
      let correct = 0;
      let q = null;
      const area = h("div");
      const score = h("div", { class: "hint", "aria-live": "polite" });
      const fb = h("div", { "aria-live": "polite" });
      const newQ = () => {
        const toBin = Math.random() < 0.5;
        const n = Math.floor(Math.random() * (correct < 2 ? 32 : 256));
        q = { toBin, n };
        const input = h("input", { type: "text", inputmode: "numeric", id: "bin-answer", autocomplete: "off", class: "mono", style: "max-width:12em" });
        const check = h("button", { class: "btn", type: "button" }, "答え合わせ");
        const judge = () => {
          // 全角で入れた答えも半角にそろえてから判定する。空欄や数字でないときは、計算のヒントではなく入れ方を伝える
          const parsed = toBin ? parseBinaryAnswer(input.value) : parseNumberAnswer(input.value);
          if (!parsed.ok) {
            fb.replaceChildren(explainCard("入れ方", parsed.message, "warn"));
            return;
          }
          const ok = toBin ? fromBinary(parsed.value) === n : parsed.value === n;
          if (ok) {
            correct++;
            fb.replaceChildren(explainCard("正解！", toBin ? `${n} ＝ ${toBinary(n)}（${binaryExplain(toBinary(n))}）` : binaryExplain(toBinary(n, 8)), "good"));
            if (correct >= 4) c.done();
            area.replaceChildren(h("div", { class: "btn-row" }, h("button", { class: "btn", type: "button", onclick: newQ }, "次の問題")));
          } else {
            fb.replaceChildren(explainCard("もう一度", toBin ? "大きいカード（128, 64, 32…）から順に、使えるかどうか考えよう。" : "1になっているけたの重み（右から1, 2, 4, 8…）を足そう。", "warn"));
          }
          score.textContent = `正解 ${correct}問（4問でクリア）`;
        };
        input.addEventListener("keydown", (e) => e.key === "Enter" && judge());
        check.addEventListener("click", judge);
        fb.replaceChildren();
        area.replaceChildren(
          h("p", {}, h("strong", {}, toBin ? `10進数の ${n} を2進数にすると？` : `2進数の ${toBinary(n, 8)} を10進数にすると？`)),
          h("div", { class: "field" }, h("label", { for: "bin-answer" }, toBin ? "2進数（0と1）で答える" : "10進数で答える"), input),
          h("div", { class: "btn-row" }, check),
        );
        input.focus();
      };
      c.body.append(h("p", {}, "ステップ1のカードを思い出しながら解こう。4問正解でクリアです。"), area, fb, score);
      newQ();
    }

    // ---------- ステップ3: 文字コード ----------
    {
      const c = cards[2];
      const input = h("input", { type: "text", id: "char-in", value: "Hi! あ", maxlength: "20" });
      const table = h("tbody");
      const total = h("div", { class: "result-box", "aria-live": "polite" });
      const show = () => {
        const chars = [...input.value];
        table.replaceChildren(
          ...chars.map((ch) => {
            // 番号（10進数）は UTF-8 の1バイトずつの値。番号を2進数にしたものが、となりの「0と1」になる
            const row = charCodeRow(ch);
            return h("tr", {}, h("td", { class: "big-char" }, ch === " " ? "（空白）" : ch), h("td", { class: "mono" }, row.numbers.join(", ")), h("td", { class: "mono" }, row.bits.join(" ")), h("td", {}, `${row.bytes}バイト`));
          }),
        );
        const n = utf8Bytes(input.value).length;
        total.replaceChildren(h("div", {}, `${chars.length}文字 → `, h("strong", {}, `${n}バイト（${n * 8}ビット）`)));
      };
      input.addEventListener("input", show);

      // 暗号文を解読する
      const word = SECRETS[Math.floor(Math.random() * SECRETS.length)];
      const ans = h("input", { type: "text", id: "secret-ans", maxlength: "10", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", placeholder: "半角の英字で（例: ABC）", style: "max-width:16em;text-transform:uppercase" });
      const fb = h("div", { "aria-live": "polite" });
      const judge = () => {
        // 全角の「ＰＣ」や小文字の「pc」も、半角の大文字にそろえてから判定する
        const parsed = parseWordAnswer(ans.value);
        if (!parsed.ok) return fb.replaceChildren(explainCard("入れ方", parsed.message, "warn"));
        if (parsed.value === word) {
          fb.replaceChildren(explainCard("解読成功！", `答えは「${word}」。${[...word].map((ch) => `${toBinary(ch.charCodeAt(0), 8)} → ${ch.charCodeAt(0)} → ${ch}`).join("、")}`, "good"));
          c.done();
        } else fb.replaceChildren(explainCard("もう少し", "1文字ずつ、2進数を10進数にしてから表で文字を探そう。", "warn"));
      };
      ans.addEventListener("keydown", (e) => e.key === "Enter" && judge());
      const abc = h(
        "div",
        { class: "ascii-table mono", role: "table", "aria-label": "英大文字の文字コード表" },
        ...Array.from({ length: 26 }, (_, i) => h("span", { role: "cell" }, `${String.fromCharCode(65 + i)}=${65 + i}`)),
      );

      c.body.append(
        h("p", {}, "文字にも、1つ1つ番号（文字コード）が決められています。コンピュータはその番号を2進数にして記録しています。文字を入力して、表の「番号（10進数）」を2進数にすると、となりの「0と1（2進数）」になることを確かめよう。"),
        h("div", { class: "field" }, h("label", { for: "char-in" }, "文字を入力"), input),
        h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "文字"), h("th", {}, "番号（10進数）"), h("th", {}, "0と1（2進数）"), h("th", {}, "大きさ"))), table)),
        total,
        explainCard("英数字と日本語", "英字・数字・記号は、1文字を1つの番号（1バイト＝8ビット）で表します。ひらがなや漢字は数がとても多いので、UTF-8 という決まりでは、1文字を3つの番号の組（3バイト＝24ビット）で表します。日本語入力のまま打った全角の英数字（ＡＢＣ）も3バイトになります。<br>文字コードには、日本語1文字を2バイトで表すシフトJISなど、ほかの決まりもあります。決まりがちがうと、同じ文字でも番号やバイト数が変わります。"),
        h("h3", {}, "やってみよう：0と1の暗号を解読しよう"),
        h("p", {}, "次の0と1は、英大文字の文字コードです。表を見て、元の言葉を当てよう。"),
        h("div", { class: "cipher-text mono" }, [...word].map((ch) => toBinary(ch.charCodeAt(0), 8)).join("  ")),
        abc,
        h("div", { class: "field" }, h("label", { for: "secret-ans" }, "答え（英字）"), ans),
        h("div", { class: "btn-row" }, h("button", { class: "btn", type: "button", onclick: judge }, "答え合わせ")),
        fb,
      );
      show();
    }

    cards[3].body.append(reflectionBox(ID, "コンピュータが、数や文字を0と1だけで表せるのはなぜ？ ビットの数と表せる数の関係も入れて書こう。", () => cards[3].done()));
    root.append(...cards.map((c) => c.el));
  },
};
