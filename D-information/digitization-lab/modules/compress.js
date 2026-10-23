// モジュール⑤（発展）: 圧縮のしくみ（ランレングス圧縮を手作業→自動、可逆と非可逆）
import { h, explainCard, stepCard, reflectionBox, choiceQuiz } from "../js/ui.js";
import { rleCounts, unrleCounts, rleImageBits, rleText, unrleText, parseCountList } from "../js/digilib.js";

const ID = "compress";
const STEPS = [
  { id: "hand", title: "手作業で圧縮してみよう" },
  { id: "auto", title: "自動で圧縮して、圧縮率をくらべよう" },
  { id: "text", title: "文字の圧縮と、可逆・非可逆" },
  { id: "reflect", title: "ふりかえり" },
];
const COUNT_BITS = 5; // 個数1つを5ビット（0〜31）で表す
const N = 16;

// 16×16 の白黒の絵（1＝黒）
const PICTURES = {
  heart: { label: "ハート", rows: ["0000000000000000", "0001110000111000", "0011111001111100", "0111111111111110", "0111111111111110", "0111111111111110", "0011111111111100", "0001111111111000", "0000111111110000", "0000011111100000", "0000001111000000", "0000000110000000", "0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000"] },
  hstripe: { label: "横じま", rows: Array.from({ length: N }, (_, r) => (Math.floor(r / 2) % 2 ? "1" : "0").repeat(N)) },
  vstripe: { label: "たてじま", rows: Array.from({ length: N }, () => "0011".repeat(4)) },
  check: { label: "チェック（市松）", rows: Array.from({ length: N }, (_, r) => (r % 2 ? "01" : "10").repeat(8)) },
  noise: { label: "でたらめな点", rows: null },
  paint: { label: "自分で描く", rows: null },
};
const noiseRows = () => Array.from({ length: N }, () => Array.from({ length: N }, () => (Math.random() < 0.5 ? "1" : "0")).join(""));

// 手作業の課題に使う絵（矢印）
const ARROW = ["0000000000000000", "0000000011000000", "0000000011100000", "1111111111110000", "1111111111111000", "1111111111110000", "0000000011100000", "0000000011000000"];
const HAND_ROWS = [1, 4, 0]; // 白から始まる行・黒から始まる行・全部白の行

function gridView(rows, label) {
  return h("div", { class: "rle-grid", role: "img", "aria-label": label, style: `grid-template-columns:repeat(${rows[0].length},1fr)` }, rows.flatMap((r) => [...r].map((ch) => h("span", { class: ch === "1" ? "on" : "" }))));
}

export const compressModule = {
  id: ID,
  minutes: "20分",
  lead: "内容をなるべく保ったまま、データの量を小さくすることを「圧縮」といいます。同じものが続くところを「何が・何個」とまとめるのが「ランレングス圧縮」です。手作業と自動でやってみよう。",
  steps: STEPS,
  async render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));

    // ---------- ステップ1: 手作業 ----------
    {
      const c = cards[0];
      const ok = new Set();
      const items = HAND_ROWS.map((r, k) => {
        const row = ARROW[r];
        const input = h("input", { type: "text", id: `hand-${k}`, inputmode: "numeric", autocomplete: "off", class: "mono", placeholder: "例: 3,4,9" });
        const fb = h("div", { class: "hint", "aria-live": "polite" });
        const judge = () => {
          // 全角の「８，２，６」や「8個 2個 6個」も、半角の数の並びにそろえてから判定する
          const parsed = parseCountList(input.value, "個");
          if (!parsed.ok) {
            fb.textContent = parsed.message;
            return;
          }
          const nums = parsed.values;
          const want = rleCounts(row);
          if (nums.length === want.length && nums.every((n, i) => n === want[i])) {
            fb.replaceChildren(h("span", { class: "status good" }, `○ 正解！ 16個の0と1 → ${want.length}個の数`));
            ok.add(k);
            if (ok.size === HAND_ROWS.length) c.done();
          } else if (nums.reduce((a, b) => a + b, 0) !== N) {
            fb.textContent = `合計が16になっていません（今は${nums.reduce((a, b) => a + b, 0)}）。`;
          } else if (row[0] === "1" && nums[0] !== 0) {
            fb.textContent = "この行は黒から始まっています。決まりでは白から数えるので、はじめは「白が0個」です。";
          } else fb.textContent = "おしい！ 左から、白→黒→白…の順に、続く個数を数えよう。";
        };
        input.addEventListener("keydown", (e) => e.key === "Enter" && !e.isComposing && judge());
        return h(
          "div",
          { class: "hand-item" },
          h("div", { class: "hint" }, `${r + 1}行目`),
          gridView([row], `${r + 1}行目の16画素`),
          h("div", { class: "field" }, h("label", { for: `hand-${k}` }, "白・黒・白…の順に続く個数"), h("div", { class: "inline-field" }, input, h("button", { class: "btn small", type: "button", onclick: judge }, "答え合わせ"))),
          fb,
        );
      });
      c.body.append(
        h("p", {}, "下の矢印の絵は、横16画素 × 縦8画素です。1行ずつ「白が何個、黒が何個…」と数えて、数の並びにしてみよう。"),
        gridView(ARROW, "矢印の絵（16×8画素）"),
        explainCard("決まり", "左から、<strong>白 → 黒 → 白 → 黒…</strong>の順に、同じ色が続く個数を書きます。黒から始まる行は、はじめに「白が0個」と書きます。<br>例: □□□■■■■□□□□□□□□□ → 3, 4, 9"),
        ...items,
      );
    }

    // ---------- ステップ2: 自動 ----------
    {
      const c = cards[1];
      const compared = new Set();
      let key = "heart";
      let paintRows = Array.from({ length: N }, () => "0".repeat(N));
      const view = h("div");
      const codes = h("ol", { class: "rle-codes mono" });
      const info = h("div", { "aria-live": "polite" });
      const tbody = h("tbody");
      const tabs = h("div", { class: "scenario-tabs", role: "group", "aria-label": "絵を選ぶ" });
      const rowsOf = (k) => (k === "paint" ? paintRows : k === "noise" ? (PICTURES.noise.rows ||= noiseRows()) : PICTURES[k].rows);

      const paintGrid = () => {
        const grid = h("div", { class: "paint-grid p16", role: "grid", "aria-label": "16×16の画素。押すと白と黒が切りかわる" });
        paintRows.forEach((row, r) => {
          grid.append(
            h(
              "div",
              { role: "row", class: "px-row" },
              [...row].map((ch, x) =>
                h("button", {
                  type: "button",
                  class: `px${ch === "1" ? " on" : ""}`,
                  "aria-label": `${r + 1}行${x + 1}列`,
                  "aria-pressed": ch === "1" ? "true" : "false",
                  onclick: () => {
                    const a = [...paintRows[r]];
                    a[x] = a[x] === "1" ? "0" : "1";
                    paintRows[r] = a.join("");
                    show(false);
                    view.querySelectorAll("button.px")[r * N + x]?.focus(); // 描き直しても、押した画素にフォーカスを残す
                  },
                }),
              ),
            ),
          );
        });
        return grid;
      };
      function show(record = true) {
        const rows = rowsOf(key);
        view.replaceChildren(key === "paint" ? paintGrid() : gridView(rows, `${PICTURES[key].label}の絵（16×16画素）`));
        codes.replaceChildren(...rows.map((r) => h("li", {}, rleCounts(r).join(", "))));
        const original = N * N;
        const comp = rleImageBits(rows, COUNT_BITS);
        const ratio = Math.round((comp / original) * 100);
        const restored = rows.map((r) => unrleCounts(rleCounts(r)));
        const same = restored.every((r, i) => r === rows[i]);
        info.replaceChildren(
          h("div", { class: "result-box" }, h("div", {}, `もとのデータ: ${original}ビット（1画素1ビット × 256画素）`), h("div", {}, `圧縮後: 数が${comp / COUNT_BITS}個 × ${COUNT_BITS}ビット ＝ ${comp}ビット`), h("div", {}, "圧縮率: ", h("strong", { class: "big-number" }, `${ratio}%`), h("span", { class: "hint" }, "（もとの大きさを100%としたとき）")), h("div", { class: "hint" }, "圧縮率 ＝ 圧縮後の大きさ ÷ もとの大きさ × 100（%）"), h("div", { class: "hint" }, `この絵: ${comp} ÷ ${original} × 100 → ${ratio}%`), h("div", { class: "hint" }, "100%より小さいほど、よく縮んだことになります。100%より大きいときは、かえって大きくなっています。")),
          ratio < 100 ? explainCard("小さくなった", "同じ色が長く続く絵ほど、少ない数で表せるので、よく圧縮できます。", "good") : explainCard("小さくならなかった", "色がこまかく入れかわる絵は、まとめられません。圧縮すると、かえって大きくなります。", "warn"),
          h("p", { class: "hint" }, same ? "✓ 数の並びから元の絵に戻すと、1画素もちがわずに元どおりになります（可逆圧縮）。" : ""),
        );
        if (record && key !== "paint") addRow(ratio, comp);
      }
      const addRow = (ratio, comp) => {
        if (compared.has(key)) return;
        compared.add(key);
        tbody.append(h("tr", {}, h("td", {}, PICTURES[key].label), h("td", { class: "num" }, `${comp}ビット`), h("td", { class: "num" }, `${ratio}%`)));
        if (compared.size >= 3) c.done();
      };
      const setKey = (k) => {
        key = k;
        if (k === "noise") PICTURES.noise.rows = noiseRows();
        for (const b of tabs.querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.key === k ? "true" : "false");
        // 「表に入れる」ボタンは「自分で描く」を選んだときだけ出す。描くときはマスを大きくする
        addPaintRow.hidden = k !== "paint";
        viewRow.classList.toggle("painting", k === "paint");
        show();
      };
      for (const [k, p] of Object.entries(PICTURES)) tabs.append(h("button", { type: "button", dataset: { key: k }, onclick: () => setKey(k) }, p.label));
      const addPaint = () => {
        compared.delete("paint");
        const comp = rleImageBits(paintRows, COUNT_BITS);
        tbody.append(h("tr", {}, h("td", {}, "自分の絵"), h("td", { class: "num" }, `${comp}ビット`), h("td", { class: "num" }, `${Math.round((comp / 256) * 100)}%`)));
        compared.add("paint");
        if (compared.size >= 3) c.done();
      };
      const viewRow = h("div", { class: "field-row digital-row" }, view, h("details", { open: true }, h("summary", {}, "各行の数の並び"), codes));
      const addPaintRow = h("div", { class: "btn-row" }, h("button", { class: "btn small secondary", type: "button", onclick: () => key === "paint" && addPaint() }, "＋ 自分で描いた絵を表に入れる"));
      c.body.append(
        h("p", {}, "ステップ1と同じやり方を、コンピュータに自動でやらせます。絵を選んで、圧縮率をくらべよう（3つ以上でクリア）。数1つは5ビット（0〜31）で表すことにします。"),
        tabs,
        viewRow,
        info,
        addPaintRow,
        h("div", { class: "table-wrap" }, h("table", { class: "data compare" }, h("thead", {}, h("tr", {}, h("th", {}, "絵"), h("th", {}, "圧縮後"), h("th", {}, "圧縮率"))), tbody)),
      );
      setKey("heart");
    }

    // ---------- ステップ3: 文字列と可逆・非可逆 ----------
    {
      const c = cards[2];
      const input = h("input", { type: "text", id: "rle-text", value: "AAAAAAABBBBCCCCCCCCD", maxlength: "60", class: "mono" });
      const out = h("div", { class: "result-box", "aria-live": "polite" });
      const show = () => {
        const t = input.value;
        if (!t) return out.replaceChildren("文字を入れてね");
        const code = rleText(t);
        const ok = unrleText(code) === t;
        out.replaceChildren(
          h("div", {}, "圧縮後: ", h("strong", { class: "mono" }, code)),
          h("div", {}, `${[...t].length}文字 → ${[...code].length}文字（圧縮率 ${Math.round(([...code].length / [...t].length) * 100)}%）`),
          /\d/.test(t) ? h("div", { class: "hint" }, "※数字が入っていると、元に戻すときに個数とまちがえてしまいます。圧縮のやり方には、データにあわせた工夫が必要です。") : h("div", { class: "hint" }, ok ? "✓ 元に戻せます" : ""),
        );
      };
      input.addEventListener("input", show);
      const answered = new Set();
      const mark = (k) => {
        answered.add(k);
        if (answered.size >= 2) c.done();
      };
      c.body.append(
        h("p", {}, "文字も同じように圧縮できます。「A7」は「Aが7個」という意味です。いろいろな文字を入れて、小さくなるとき・ならないときを見つけよう。"),
        h("div", { class: "field" }, h("label", { for: "rle-text" }, "圧縮する文字（英字がおすすめ）"), input),
        h("div", { class: "btn-row" }, ...["AAAAAAABBBBCCCCCCCCD", "ABCDEFG", "WWWWWWWWWWWWBWWWWWWWWWWWW"].map((ex) => h("button", { class: "btn small secondary", type: "button", onclick: () => { input.value = ex; show(); } }, ex))),
        out,
        explainCard(
          "可逆圧縮と非可逆圧縮",
          "<strong>可逆圧縮</strong>:完全に元に戻せる（ZIP・PNG など）。文書やプログラムに使う。<br><strong>非可逆圧縮</strong>:細かい部分を捨てて小さくする。元には戻らない（JPEG・MP3 など）。",
        ),
        choiceQuiz({ question: "学校に出すレポートの文書ファイルをメールで送るために圧縮します。どちらを使うべき？", choices: ["可逆圧縮", "非可逆圧縮"], answer: 0, explain: "文書は1文字でも変わると困ります。だから、完全に元に戻せる可逆圧縮（ZIPなど）を使います。" }, () => mark(1)),
        choiceQuiz({ question: "スマートフォンで撮った写真のデータ量を、見た目をあまり変えずに大きく減らしたい。向いているのは？", choices: ["非可逆圧縮（JPEGなど）", "可逆圧縮（ZIPなど）", "どちらも同じ"], answer: 0, explain: "写真は、気づきにくい細かい部分を捨てても、見た目はほとんど変わりません。だから、非可逆圧縮でデータ量を大きく減らせます。" }, () => mark(2)),
      );
      show();
    }

    cards[3].body.append(reflectionBox(ID, "圧縮しやすいデータと、しにくいデータのちがいは何だろう？ 可逆圧縮と非可逆圧縮の使い分けも書こう。", () => cards[3].done()));
    root.append(...cards.map((c) => c.el));
  },
};
