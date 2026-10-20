// 処理の自動化: 手計算とプログラムをくらべる（クロックと実行時間の目安も）
import { h, explain } from "./ui.js";
import { store } from "./store.js";
import { assemble, createMachine, runToEnd } from "./vm.js";

// 手計算の N は、スタートを押すたびに 15〜25 から選ぶ（答えを覚えて入力するだけにならないように）
export const N_MIN = 15;
export const N_MAX = 25;
export function randomManualN(rand = Math.random, prev = null) {
  let n;
  do n = N_MIN + Math.floor(rand() * (N_MAX - N_MIN + 1));
  while (n === prev);
  return n;
}
export const sumTo = (n) => (n * (n + 1)) / 2;
// 手計算の記録（壊れた記録・秒のない記録は、記録なしとして扱う）
const validManual = (rec) => (rec && Number.isFinite(rec.seconds) ? rec : null);
// 前の版の記録には n がない（そのころは 20 で固定だった）
export const recordN = (rec) => (rec && Number.isInteger(rec.n) ? rec.n : 20);
// hz: 1秒の合図（クロック）の回数、cpi: 1命令にかかる合図の回数（目安）
export const CLOCKS = [
  { label: "人がボタンで1命令ずつ進める", hz: 1, cpi: 1, note: "1秒に1命令" },
  { label: "昔のパソコン（1980年ごろ）", hz: 4e6, cpi: 4, note: "合図（クロック）が1秒に約400万回（4 MHz）。1命令に合図が4回以上かかる" },
  { label: "いまのパソコンのCPU", hz: 3e9, cpi: 1, note: "合図（クロック）が1秒に約30億回（3 GHz）" },
];
// 命令の数 → かかる時間（秒）
export const runSeconds = (steps, c) => (steps * c.cpi) / c.hz;
// これより大きい N は計算に時間がかかるので、先に「計算中…」を出す
const SLOW_N = 100000;

// 2けたに丸めて、指数（2.0e+2 など）を使わずに書く（例: 200、270、4.5、0.0012）
const num2 = (x) => Number(x.toPrecision(2)).toLocaleString("ja-JP", { maximumFractionDigits: 20 });

export function formatSeconds(sec) {
  if (sec >= 365 * 86400) return `約${(sec / (365 * 86400)).toFixed(1)}年`;
  if (sec >= 86400) return `約${(sec / 86400).toFixed(1)}日`;
  if (sec >= 3600) return `約${Math.floor(sec / 3600)}時間${Math.round((sec % 3600) / 60)}分`;
  if (sec >= 60) return `約${Math.floor(sec / 60)}分${Math.round(sec % 60)}秒`;
  if (sec >= 1) return `約${sec.toFixed(sec < 10 ? 1 : 0)}秒`;
  if (sec >= 1e-3) return `約${num2(sec * 1e3)}ミリ秒（1000分の1秒が1ミリ秒）`;
  if (sec >= 1e-6) return `約${num2(sec * 1e6)}マイクロ秒（100万分の1秒が1マイクロ秒）`;
  return `約${num2(sec * 1e9)}ナノ秒（10億分の1秒が1ナノ秒）`;
}

export function renderAuto(view, { tasks, isa }) {
  store.markVisited("auto");
  // ✓ は「手で計算して正解」と「N を 100 以上にしてくらべる」の両方をしたときにつける（開いただけではつけない）
  const BIG_N = 100;
  const doneRule = h("p", { class: "done-rule", "aria-live": "polite" });
  const updateDone = () => {
    const manualOk = Boolean(validManual(store.state.manual));
    const bigOk = store.isDone("autoBigN");
    if (manualOk && bigOk && !store.isDone("auto")) {
      store.markDone("auto");
      document.dispatchEvent(new CustomEvent("vcpu:progress"));
    }
    doneRule.textContent = store.isDone("auto")
      ? "✓ このページはやり終えました。"
      : `このページに ✓ がつく条件: ${manualOk ? "✓" : "□"} 1. 手で計算して正解する　${bigOk ? "✓" : "□"} 2. 「どこまでたす？」を ${BIG_N} 以上にしてくらべる`;
  };
  const program = tasks.find((t) => t.id === "sumN").answer;
  const prog = assemble(program, isa);
  let timer = null;
  let startAt = 0;

  // ---- 1. 手で計算 ----
  const clock = h("div", { class: "big-number timer", "aria-live": "off" }, "0.0 秒");
  const answer = h("input", { type: "text", inputmode: "numeric", "aria-label": "答え", placeholder: "答え", disabled: true });
  const startBtn = h("button", { class: "btn", type: "button" }, "スタート");
  const doneBtn = h("button", { class: "btn", type: "button", disabled: true }, "できた");
  const manualMsg = h("div", { "aria-live": "polite" });
  const prevRec = validManual(store.state.manual);
  if (prevRec) manualMsg.append(explain("前回の記録", `1 から ${recordN(prevRec)} までの合計を ${prevRec.seconds.toFixed(1)}秒で正解しました。`, "good"));
  // N はスタートを押したときに決まる（先に計算しておけないように）
  let nManual = null;
  const manualTitle = h("h3", {}, "1. 手で計算: 1 + 2 + 3 + … + N は？");

  startBtn.addEventListener("click", () => {
    nManual = randomManualN(Math.random, nManual);
    manualTitle.textContent = `1. 手で計算: 1 + 2 + 3 + … + ${nManual} は？`;
    startAt = performance.now();
    clearInterval(timer);
    timer = setInterval(() => (clock.textContent = `${((performance.now() - startAt) / 1000).toFixed(1)} 秒`), 100);
    answer.disabled = false;
    doneBtn.disabled = false;
    answer.value = "";
    answer.focus();
    startBtn.textContent = "やり直す";
    manualMsg.replaceChildren();
  });
  const finish = () => {
    if (!timer) return;
    const v = Number(answer.value.normalize("NFKC").trim());
    const sec = (performance.now() - startAt) / 1000;
    if (v === sumTo(nManual)) {
      clearInterval(timer);
      timer = null;
      clock.textContent = `${sec.toFixed(1)} 秒`;
      answer.disabled = true;
      doneBtn.disabled = true;
      store.setManual({ seconds: sec, n: nManual, at: new Date().toISOString() });
      manualMsg.replaceChildren(explain("正解！", `${sec.toFixed(1)}秒かかりました。下で、同じ計算をプログラムにさせるとどうなるか見てみよう。`, "good"));
      setManualOption(nManual);
      nSelect.value = String(nManual);
      renderCompare();
      updateDone();
    } else {
      manualMsg.replaceChildren(explain("おしい", "答えがちがうようです。計算を見直してもう一度入力しよう（時間は進んでいます）。", "warn"));
    }
  };
  doneBtn.addEventListener("click", finish);
  answer.addEventListener("keydown", (e) => e.key === "Enter" && !e.isComposing && finish());

  // ---- 2. プログラムなら ----
  // いちばん上の選択肢は、手計算で正解したときの N（記録がなければ 20）
  const manualOpt = h("option", {});
  const setManualOption = (n) => {
    manualOpt.value = String(n);
    manualOpt.textContent = `1 から ${n} まで`;
  };
  setManualOption(recordN(validManual(store.state.manual)));
  const nSelect = h("select", { "aria-label": "N の大きさ" }, manualOpt, [100, 1000, 10000, 100000, 1000000].map((n) => h("option", { value: n }, `1 から ${n.toLocaleString("ja-JP")} まで`)));
  const compareBox = h("div", { "aria-live": "polite" });

  function renderCompare() {
    const n = Number(nSelect.value);
    const m = runToEnd(createMachine(prog, { inputs: [n], maxSteps: 1e9 }));
    const steps = m.steps;
    const manual = validManual(store.state.manual);
    compareBox.replaceChildren(
      h(
        "div",
        { class: "result-box" },
        h("p", {}, "プログラムが出した答え: ", h("strong", { class: "big-number" }, m.outputs[0]?.toLocaleString("ja-JP"))),
        h("p", {}, `実行した命令の数: `, h("strong", {}, `${steps.toLocaleString("ja-JP")} 回`), h("span", { class: "hint" }, `（くり返し1回で8命令 × ${n.toLocaleString("ja-JP")}回 ＋ 最初と最後の数命令）`)),
      ),
      h(
        "div",
        { class: "table-wrap" },
        h(
          "table",
          { class: "data" },
          h("thead", {}, h("tr", {}, h("th", {}, "だれが実行する？"), h("th", {}, "速さの目安"), h("th", {}, "かかる時間"))),
          h(
            "tbody",
            {},
            manual && n === recordN(manual) ? h("tr", { class: "you" }, h("td", {}, "あなた（手計算）"), h("td", {}, "—"), h("td", {}, `${manual.seconds.toFixed(1)}秒`)) : null,
            CLOCKS.map((c) => h("tr", {}, h("td", {}, c.label), h("td", {}, c.note), h("td", {}, formatSeconds(runSeconds(steps, c))))),
          ),
        ),
      ),
      h("p", { class: "hint" }, "※ おおよその目安です。昔のパソコンは、1命令に合図を4回（命令によっては20回ほど）使いました。ここでは4回として計算しました。いまのパソコンは、1命令を1回の合図で進めるとしました。実際には、1回の合図で何命令も同時に進めることもあります。"),
    );
  }
  let slowTimer = null;
  nSelect.addEventListener("change", () => {
    const after = () => {
      renderCompare();
      if (Number(nSelect.value) >= BIG_N) store.markDone("autoBigN");
      updateDone();
    };
    clearTimeout(slowTimer);
    if (Number(nSelect.value) >= SLOW_N) {
      // 画面が止まって見えないように、先に「計算中…」を出してから実行する
      compareBox.replaceChildren(h("p", { class: "status calc-busy" }, "計算中…（数がとても多いので、少し待ってね）"));
      nSelect.disabled = true;
      slowTimer = setTimeout(() => {
        after();
        nSelect.disabled = false;
      }, 60);
    } else after();
  });

  view.replaceChildren(
    h("div", { class: "page-head" }, h("h2", {}, "処理の自動化: 手計算 vs プログラム"), h("p", { class: "muted" }, "同じ計算を、人とコンピュータでくらべてみよう。"), doneRule),
    h(
      "div",
      { class: "card" },
      manualTitle,
      h("p", {}, `電卓を使わずに、頭の中か紙で計算します。「スタート」を押すと N（${N_MIN}〜${N_MAX} のどれか）が決まり、時間をはかりはじめます。`),
      h("div", { class: "manual-row" }, clock, h("div", { class: "btn-row" }, startBtn, answer, doneBtn)),
      manualMsg,
    ),
    h(
      "div",
      { class: "card" },
      h("h3", {}, "2. プログラムなら"),
      h("p", {}, "1からNまでをたすプログラムを実行します。使うのは、この教材の小さなコンピュータ（仮想CPU）です。プログラムは用意してあるので、自分で作らなくてもくらべられます。N を大きくしても、プログラムは1文字も変えずにそのまま使えます。"),
      h("details", {}, h("summary", {}, "使うプログラムを見る（発展の ④課題「1からNまでの合計」の答えの例です）"), h("pre", { class: "code-block small" }, program)),
      h("div", { class: "field" }, h("label", {}, "どこまでたす？", nSelect)),
      compareBox,
    ),
    h(
      "div",
      { class: "card" },
      h("h3", {}, "3. まとめ"),
      explain(
        "処理の自動化",
        h(
          "ul",
          {},
          h("li", {}, "コンピュータは、決められた手順（プログラム）をくり返せます。とても速く・正確に・何度でもできます。人のようにつかれたり、計算をまちがえたりしません。"),
          h("li", {}, "そのかわり、手順を考えてプログラムにするのは人の仕事です。手順がまちがっていれば、コンピュータはまちがった答えを速く出してしまいます。"),
          h("li", {}, "CPU は「合図（クロック）」に合わせて命令を進めます。1秒間の合図の回数をクロック周波数といい、3 GHz なら1秒に約30億回です。"),
        ),
      ),
      h("p", {}, "考えよう: コンピュータが「くり返し」を自動でしている例は、身のまわりにあるかな？（例: 自動ドア、信号機、エアコンの温度調節）"),
    ),
    h("div", { class: "btn-row next-link" }, h("a", { class: "btn secondary", href: "#/sim" }, "発展: ③仮想CPUで命令を動かしてみよう →")),
  );
  renderCompare();
  updateDone();
  return () => {
    clearInterval(timer);
    clearTimeout(slowTimer);
  };
}
