// モジュール②: パスワード強度ラボ
// 入力された文字はこのモジュールの変数（メモリ）の中だけで使い、保存・送信・ログ出力はしない。
import { h, explainCard, stepCard, reflectionBox, threeSteps, choiceQuiz } from "../js/ui.js";
import { loadData } from "../js/data.js";
import { getConfig } from "../js/settings.js";
import { analyze, crackSeconds, formatDuration, rating, bigJaLog10, powNote, universeCompare, durationLog10, rateLabel } from "../js/passwordlib.js";

const ID = "password";
const RATES = [
  { log10: 3, label: "1秒に1,000回", note: "ログイン画面で1つずつ試す場合（ふつうは回数制限もある）" },
  { log10: 10, label: "1秒に100億回", note: "流出したデータを高性能なパソコンで解く場合" },
  { log10: 12, label: "1秒に1兆回", note: "たくさんのコンピュータを使う場合" },
];
const SERIES = [
  { label: "英小文字だけ", size: 26, color: "var(--series-1)", dash: "" },
  { label: "＋英大文字", size: 52, color: "var(--series-2)", dash: "6 3" },
  { label: "＋数字", size: 62, color: "var(--series-3)", dash: "2 3" },
  { label: "＋記号", size: 95, color: "var(--series-4)", dash: "" },
];
const STEPS = [
  { id: "try", title: "文字を入れて、解読時間を見てみよう" },
  { id: "compare", title: "「長さ」と「文字の種類」、どちらが効く？" },
  { id: "passphrase", title: "パスフレーズを作ってみよう" },
  { id: "quiz", title: "いちばん強いのはどれ？" },
  { id: "reflect", title: "ふりかえり" },
];

let rateLog10 = 10;
const rateListeners = new Set();
function setRate(v) {
  rateLog10 = v;
  rateListeners.forEach((fn) => fn());
}

function rateSelect(idSuffix) {
  const sel = h("select", { id: `rate-${idSuffix}` }, RATES.map((r) => h("option", { value: r.log10, selected: r.log10 === rateLog10 ? true : null }, `${r.label}（${r.note}）`)));
  sel.addEventListener("change", () => setRate(Number(sel.value)));
  rateListeners.add(() => (sel.value = String(rateLog10)));
  return h("div", { class: "field" }, h("label", { for: `rate-${idSuffix}` }, "攻撃する側の速さ（仮定）"), sel, h("span", { class: "hint" }, "実際の速さは、パスワードの保存方法や攻撃の方法によって大きく変わります。ここでは仮定を変えて比べてみよう。"));
}

export const passwordModule = {
  id: ID,
  minutes: "15分",
  lead: "パスワードは「長さ」と「文字の種類」で強さが決まります。総当たり（すべての組み合わせを試す）で解読すると、どれくらい時間がかかるかな？ 体験しよう。",
  steps: STEPS,
  async render(root) {
    rateListeners.clear();
    rateLog10 = Number((await getConfig()).defaultAttackRate ?? 10);
    const [commonData, wordData] = await Promise.all([loadData("common-passwords"), loadData("passphrase-words")]);
    const commonSet = new Set(commonData.words);
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));

    root.append(
      explainCard(
        "⚠ 本物のパスワードは入力しないで",
        "ここには、練習用のでたらめな文字を入れてください。入力した文字は、保存も送信もしません。",
        "warn",
      ),
    );

    // ステップ1: 入力して解読時間を見る
    {
      const c = cards[0];
      const input = h("input", { type: "text", id: "pw-input", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-describedby": "pw-result", placeholder: "例: neko123" });
      const result = h("div", { id: "pw-result", class: "result-box", "aria-live": "polite" });
      // 入力欄のすぐ下の1行（タブレットで画面キーボードが出ても、打ちながら結果が見えるように）。読み上げは下の結果だけにする
      const quick = h("div", { class: "hint pw-quick", "aria-hidden": "true", style: "margin-top:4px;font-weight:700;min-height:1.5em" });
      const samples = ["neko", "neko1234", "Neko#1234", "password", "P@ssw0rd", "Sakur@2026!", "tq7vmz2kpw9xrb"];
      const update = () => {
        const pw = input.value;
        if (!pw) {
          quick.textContent = "";
          result.replaceChildren(h("p", { class: "hint" }, "文字を入力するか、下の例をおしてみよう。"));
          return;
        }
        const a = analyze(pw, commonSet);
        const logSec = crackSeconds(a.log10Combos, rateLog10);
        const r = rating(logSec, a.weakness);
        const mark = r.level === "good" ? "◎ " : r.level === "warn" ? "△ " : "× ";
        const time = a.weakness ? "一瞬で見つかるおそれ" : formatDuration(logSec);
        const universe = a.weakness ? "" : universeCompare(logSec);
        const note = powNote(a.log10Combos, a.weakness ? -Infinity : durationLog10(logSec));
        quick.textContent = `結果: ${mark}${r.label}（${a.weakness ? time : `${rateLabel(rateLog10)}試すと ${time}`}）`;
        result.replaceChildren(
          h("div", {}, h("span", { class: `status ${r.level}` }, mark, r.label)),
          h("p", { style: "margin:8px 0 0" }, a.weakness ? "よく使われる言葉やパターンから先に試されるので" : `${rateLabel(rateLog10)}試すと、すべての組み合わせを試し終わるまで`),
          h("div", { class: "big-number" }, time),
          universe ? h("p", { style: "margin:0" }, `（${universe}）`) : "",
          a.weakness ? "" : h("p", { class: "hint", style: "margin:4px 0 0" }, "これは「いちばん長くかかる」場合の時間です。運がよければ、その半分くらいで見つかることもあります。"),
          a.weakness
            ? explainCard(
                "総当たりより先に見つかる理由",
                `${a.weakness.text}。${/^leet/.test(a.weakness.kind) ? "a を @ に、o を 0 にするような置きかえはよく知られていて、辞書の言葉と同じように最初に試されます。" : ""}攻撃する側は、まず「よく使われるパスワードの一覧（辞書）」や決まったパターンから試します。だから、組み合わせの数に関係なく、すぐに見つかってしまいます。`,
                "bad",
              )
            : "",
          h(
            "ul",
            { class: "hint" },
            h("li", {}, `長さ: ${a.length}文字`),
            h("li", {}, `使っている文字の種類: ${a.classes.map((x) => `${x.label}(${x.size})`).join(" ＋ ") || "なし"} ＝ ${a.poolSize}種類`),
            h("li", {}, `組み合わせの数: ${a.poolSize} の ${a.length} 乗 ＝ 約${bigJaLog10(a.log10Combos)}通り`),
          ),
          a.converted ? h("p", { class: "hint" }, "全角の英数字や記号は、半角にそろえて計算しました。") : "",
          a.hasOther ? h("p", { class: "hint" }, "全角の文字やひらがな・漢字は、パスワードに使えないサービスが多いよ。") : "",
          note ? h("p", { class: "hint" }, note) : "",
          h("p", { class: "hint" }, "記号を混ぜる・文字を記号に置きかえるより、長くする・使い回さないほうが効きます。"),
        );
        if (a.length >= 4) c.done();
      };
      input.addEventListener("input", update);
      rateListeners.add(update);
      c.body.append(
        h("p", {}, "文字の種類（英小文字・英大文字・数字・記号）と長さを変えてみよう。解読にかかる時間はどう変わるかな？"),
        h("div", { class: "field" }, h("label", { for: "pw-input" }, "練習用の文字"), input, quick),
        h("div", { class: "btn-row" }, h("span", { class: "hint" }, "例:"), samples.map((s) => h("button", { class: "btn small secondary", type: "button", onclick: () => ((input.value = s), update()) }, s))),
        result,
        rateSelect("1"),
        explainCard("計算のしかた", "組み合わせの数 ＝ 文字の種類の数 を 長さの回数だけかけたもの。それを「1秒あたりに試せる回数」でわると、すべて試し終わるまでの時間が出ます。"),
      );
      update();
    }

    // ステップ2: グラフで比べる
    {
      const c = cards[1];
      const chart = h("div", { class: "chart" });
      const rateNote = h("p", { class: "hint", style: "margin:4px 0" });
      const drawChart = () => {
        chart.replaceChildren(...lengthChart(rateLog10));
        rateNote.textContent = `グラフの時間は、${rateLabel(rateLog10)}試す場合です（速さは下で変えられます）。`;
      };
      rateListeners.add(drawChart);
      drawChart();
      c.body.append(
        h("p", {}, "横じくが「長さ」、たてじくが「すべて試し終わるまでの時間」です。たてじくは、上に行くほど何万倍にものびる目もりです（1秒→1日は約9万倍、1日→1年は365倍）。線が少し上がるだけで、時間はとても長くなります。"),
        h("ul", { class: "legend", "aria-hidden": "true" }, SERIES.map((s) => h("li", {}, h("span", { class: "sw", style: `background:${s.color}` }), s.label))),
        rateNote,
        chart,
        h("p", { class: "hint", style: "margin:4px 0 0" }, "グラフの上を押す（マウスをのせる）と、その長さの時間が出ます。下の「表で見る」でも同じ数字が見られます。"),
        rateSelect("2"),
        tableView(),
        choiceQuiz(
          {
            question: "英小文字だけの8文字のパスワード。強くするのに効果が大きいのはどっち？",
            choices: ["文字の種類を増やす（英大文字も使う）が、長さは8文字のまま", "英小文字だけのまま、長さを12文字にする"],
            answer: 1,
            explain: "英小文字26種類×8文字は約2088億通り。大文字を混ぜて52種類×8文字にすると約53兆通り（256倍）。英小文字だけで12文字にすると約9.5京通り（約46万倍）。長くするほうが効果が大きい。",
          },
          () => c.done(),
        ),
      );
    }

    // ステップ3: パスフレーズ
    {
      const c = cards[2];
      const out = h("div", { class: "result-box", "aria-live": "polite" }, h("p", { class: "hint" }, "ボタンをおすと、単語をランダムに選んでパスフレーズを作ります。"));
      const countSel = h("select", { id: "pp-count" }, [4, 5, 6, 7].map((n) => h("option", { value: n, selected: n === 6 ? true : null }, `${n}個`)));
      const words = wordData.words;
      const gen = () => {
        const n = Number(countSel.value);
        const pick = new Uint32Array(n);
        crypto.getRandomValues(pick);
        const phrase = [...pick].map((x) => words[x % words.length]).join("-");
        const a = analyze(phrase, commonSet);
        const logSecChars = crackSeconds(a.log10Combos, rateLog10);
        const logSecWords = crackSeconds(n * Math.log10(words.length), rateLog10);
        out.replaceChildren(
          h("div", { class: "big-number mono", style: "font-size:1.4rem;overflow-wrap:anywhere" }, phrase),
          h("p", {}, `${a.length}文字。${rateLabel(rateLog10)}試すとして、1文字ずつ総当たりすると ${formatDuration(logSecChars)}。`),
          explainCard(
            "もし攻撃する側が「この単語リストから選んだ」と知っていたら？",
            `このラボの単語リストは${words.length.toLocaleString("ja-JP")}語。組み合わせは ${words.length.toLocaleString("ja-JP")} の ${n} 乗 ＝ 約${bigJaLog10(n * Math.log10(words.length))}通り。${rateLabel(rateLog10)}試すと、すべて試すのに ${formatDuration(logSecWords)}${universeCompare(logSecWords) ? `（${universeCompare(logSecWords)}）` : ""}。${
              logSecWords < Math.log10(86400 * 365 * 100) ? "これでは足りません。単語の数を増やしてみよう。" : "リストを知られていても、ランダムに選んでいれば、とても時間がかかります。"
            }単語をランダムに選ぶことが大切です。弱いものに注意。有名な言葉の組み合わせ、少ない単語の中から選んだもの、辞書にある単語1つだけ、などです。`,
            logSecWords < Math.log10(86400 * 365 * 100) ? "warn" : "good",
          ),
          powNote(a.log10Combos, n * Math.log10(words.length), durationLog10(logSecChars), durationLog10(logSecWords)) ? h("p", { class: "hint" }, powNote(a.log10Combos, n * Math.log10(words.length), durationLog10(logSecChars), durationLog10(logSecWords))) : "",
          h("p", { class: "hint" }, "速さは、ステップ1・2の「攻撃する側の速さ（仮定）」で変えられます。"),
        );
        c.done();
      };
      rateListeners.add(() => out.querySelector(".big-number") && gen());
      c.body.append(
        h("p", {}, "パスフレーズは、いくつかの単語をつなげたパスワードです。長いのに覚えやすいのが利点です。数千語の中から、5〜6個の単語をランダムに選ぶのが目安です。"),
        h("div", { class: "field-row" }, h("div", { class: "field" }, h("label", { for: "pp-count" }, "単語の数"), countSel)),
        h("div", { class: "btn-row" }, h("button", { class: "btn", type: "button", onclick: gen }, "パスフレーズを作る")),
        out,
        explainCard("覚え方のコツ", "単語から情景を思いうかべると、覚えやすくなります。例: neko-sora-hashiru-ringo-yuki-densha → 猫が空を走って、りんごと雪の電車に乗る。有名な歌詞やことわざは避けよう。"),
      );
    }

    // ステップ4: クイズと対策
    {
      const c = cards[3];
      c.body.append(
        choiceQuiz(
          {
            question: "次のうち、いちばん強いパスワードはどれ？（どれも練習用の例）",
            choices: ["P@ssw0rd", "Sakura2026!", "Xy7#", "kumo-ringo-hashiru-ame"],
            answer: 3,
            explain: "いちばん強いのは kumo-ringo-hashiru-ame。長いからです。<br>・P@ssw0rd:記号に置きかえただけ<br>・Sakura2026!:言葉＋年号の定番<br>・Xy7#:4文字しかない<br>本物は、数千語からランダムに5〜6語を選ぼう。",
          },
          () => c.done(),
        ),
        h("h3", {}, "パスワードを守るための対策"),
        h(
          "ul",
          {},
          h("li", {}, h("strong", {}, "長くする: "), "12文字以上。パスフレーズなら、ランダムに選んだ単語を5〜6個に。"),
          h("li", {}, h("strong", {}, "使い回さない: "), "1つのサービスから流出すると、同じパスワードの別のサービスまで乗っ取られます。"),
          h("li", {}, h("strong", {}, "覚えきれないとき: "), "パスワード管理アプリやブラウザの保存機能を、家の人と相談して使おう。紙に書くなら持ち歩かず、家の決まった場所にしまう。"),
          h("li", {}, h("strong", {}, "定期的に変えなくてよい: "), "変えるのは、もれたかもしれないときや、人に見られたとき。そのときはすぐに変えよう。"),
          h("li", {}, h("strong", {}, "2段階認証（多要素認証）を使う: "), "パスワードが知られても、スマホなどの確認がないとログインできません。"),
          h("li", {}, h("strong", {}, "人に教えない: "), "仲のよい友達でも教えない。メッセージで聞かれても答えない。先生や家族を名乗っていても、直接確かめる。"),
        ),
        threeSteps({ stop: "パスワードを聞かれたら手を止める", check: "本当に公式の画面か確かめる", ask: "変だと思ったら大人に相談" }),
      );
    }

    // ステップ5: ふりかえり
    cards[4].body.append(reflectionBox(ID, "長いパスワードやパスフレーズが強いのは、なぜだと思う？ 一言で書こう。", () => cards[4].done()));

    root.append(...cards.map((c) => c.el));
  },
};

// ---- グラフ（長さ × 文字の種類 → 解読時間, たてじくは対数） ----
const YEAR = 86400 * 365;
const REF_LINES = [
  { log10: -3, label: "0.001秒" },
  { log10: 0, label: "1秒" },
  { log10: Math.log10(86400), label: "1日" },
  { log10: Math.log10(YEAR), label: "1年" },
  { log10: Math.log10(YEAR * 1e4), label: "1万年" },
  { log10: Math.log10(YEAR * 1.38e10), label: "宇宙の年齢" },
  // 京より大きい単位は使わず、宇宙の年齢（約138億年）の何倍かで表す
  { log10: Math.log10(YEAR * 1.38e14), label: ["宇宙の年齢", "の1万倍"] },
  { log10: Math.log10(YEAR * 1.38e18), label: ["宇宙の年齢", "の1億倍"] },
  { log10: Math.log10(YEAR * 1.38e22), label: ["宇宙の年齢", "の1兆倍"] },
];
function lengthChart(rateL) {
  const W = 640, H = 340, m = { l: 56, r: 92, t: 12, b: 40 };
  const xs = Array.from({ length: 13 }, (_, i) => i + 4); // 4〜16文字
  const all = SERIES.flatMap((ser) => [4 * Math.log10(ser.size) - rateL, 16 * Math.log10(ser.size) - rateL]);
  const yMin = Math.floor(Math.min(...all)) - 1, yMax = Math.ceil(Math.max(...all)) + 1;
  const x = (len) => m.l + ((len - 4) / 12) * (W - m.l - m.r);
  const y = (lg) => m.t + (1 - (Math.max(yMin, Math.min(yMax, lg)) - yMin) / (yMax - yMin)) * (H - m.t - m.b);
  const NS = "http://www.w3.org/2000/svg";
  const s = (tag, attrs, text) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "パスワードの長さと解読時間のグラフ。長さが1文字増えるごとに、時間は文字の種類の数の倍だけ増える。" });
  const grid = s("g", { class: "grid" });
  const axis = s("g", { class: "axis" });
  for (const r of REF_LINES.filter((r) => r.log10 >= yMin && r.log10 <= yMax)) {
    grid.append(s("line", { x1: m.l, x2: W - m.r, y1: y(r.log10), y2: y(r.log10) }));
    if (Array.isArray(r.label)) {
      const t = s("text", { x: m.l - 6, y: y(r.log10) - 2, "text-anchor": "end" });
      r.label.forEach((line, i) => t.append(s("tspan", { x: m.l - 6, dy: i ? 12 : 0 }, line)));
      axis.append(t);
    } else axis.append(s("text", { x: m.l - 6, y: y(r.log10) + 4, "text-anchor": "end" }, r.label));
  }
  for (const len of xs) {
    if (len % 2 === 0) axis.append(s("text", { x: x(len), y: H - m.b + 18, "text-anchor": "middle" }, `${len}`));
  }
  axis.append(s("text", { x: (m.l + W - m.r) / 2, y: H - 4, "text-anchor": "middle" }, "パスワードの長さ（文字）"));
  svg.append(grid, axis);
  const labelYs = [];
  SERIES.forEach((ser) => {
    const pts = xs.map((len) => [x(len), y(len * Math.log10(ser.size) - rateL)]);
    svg.append(s("path", { d: "M" + pts.map((p) => p.join(",")).join("L"), fill: "none", stroke: ser.color, "stroke-width": 2.5, "stroke-dasharray": ser.dash, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    let ly = pts[pts.length - 1][1];
    for (const prev of labelYs) if (Math.abs(prev - ly) < 14) ly = prev + 14;
    labelYs.push(ly);
    svg.append(s("text", { x: W - m.r + 6, y: Math.max(m.t + 4, ly) + 4, class: "label" }, ser.label));
  });
  // ホバー用の縦線とツールチップ
  const cross = s("line", { y1: m.t, y2: H - m.b, stroke: "var(--text-muted)", "stroke-width": 1, "stroke-dasharray": "3 3", visibility: "hidden" });
  const dots = SERIES.map((ser) => s("circle", { r: 5, fill: ser.color, stroke: "var(--surface-1)", "stroke-width": 2, visibility: "hidden" }));
  svg.append(cross, ...dots);
  const hit = s("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: "transparent" });
  svg.append(hit);
  const tip = h("div", { class: "tooltip", role: "presentation" });
  const show = (evt) => {
    const rect = svg.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * W;
    const len = Math.max(4, Math.min(16, Math.round(4 + ((px - m.l) / (W - m.l - m.r)) * 12)));
    cross.setAttribute("x1", x(len));
    cross.setAttribute("x2", x(len));
    cross.setAttribute("visibility", "visible");
    SERIES.forEach((ser, i) => {
      dots[i].setAttribute("cx", x(len));
      dots[i].setAttribute("cy", y(len * Math.log10(ser.size) - rateL));
      dots[i].setAttribute("visibility", "visible");
    });
    tip.replaceChildren(h("strong", {}, `${len}文字`), ...SERIES.map((ser) => h("div", {}, h("span", { class: "sw", style: `display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;background:${ser.color}` }), `${ser.label}: ${formatDuration(len * Math.log10(ser.size) - rateL)}`)));
    tip.style.display = "block";
    const left = (x(len) / W) * rect.width;
    tip.style.left = `${left > rect.width / 2 ? left - tip.offsetWidth - 12 : left + 12}px`;
    tip.style.top = `${8}px`;
  };
  // マウスはのせている間だけ出す。指やペンで押したときは、指をはなしても消さない（次に押した所に動く）
  hit.addEventListener("pointermove", show);
  hit.addEventListener("pointerdown", show);
  hit.addEventListener("pointerleave", (evt) => {
    if (evt.pointerType && evt.pointerType !== "mouse") return;
    tip.style.display = "none";
    cross.setAttribute("visibility", "hidden");
    dots.forEach((d) => d.setAttribute("visibility", "hidden"));
  });
  return [svg, tip];
}

// グラフと同じ内容の表（色に頼らず読めるように）
function tableView() {
  const tbody = h("tbody");
  const draw = () => {
    tbody.replaceChildren(
      ...[6, 8, 10, 12, 16].map((len) => h("tr", {}, h("th", { scope: "row" }, `${len}文字`), SERIES.map((ser) => h("td", {}, formatDuration(len * Math.log10(ser.size) - rateLog10))))),
    );
  };
  rateListeners.add(draw);
  draw();
  return h(
    "details",
    { open: true },
    h("summary", {}, "表で見る"),
    h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "長さ"), SERIES.map((s) => h("th", { scope: "col" }, `${s.label}（${s.size}種類）`)))), tbody)),
  );
}
