// アプリ本体: はじめに・ステージ（設計 → プログラム → 動作確認・デバッグ → テスト）・評価と振り返り・記録
import { h, explainCard, tabs, toast, downloadFile } from "../../measure-control-sim/js/ui.js";
import { programToText, parseProgram, fmt } from "../../measure-control-sim/js/lang.js";
import { flowchartSvg } from "../../measure-control-sim/js/flow.js";
import { attachAutosave, flushAutosaves, AUTOSAVE_HINT, AUTOSAVE_DONE } from "../../measure-control-sim/js/autosave.js";
import { store } from "./store.js";
import { STAGES, stageById } from "./stages.js";
import { SPEEDS, DIST_SLOTS, COLOR_SETS, MAX_DIST_SENSORS, designCost, sensorsOf, BATTERY, PART_COST } from "./world.js";
import { RoverSim, DT, validate, runTests, judge, freeScore, OUTPUTS } from "./rsim.js";
import { createBlockEditor, flowLabel, blockLabel } from "./rblocks.js";
import { createView } from "./draw.js";
import { radarSvg, AXES, AXIS_NOTE } from "./radar.js";

// 振り返りを隠す設定（先生用。shared/eduit-frame.js）
const FK_OFF = Boolean(globalThis.EduitFrame && globalThis.EduitFrame.furikaeri === false);
const T_EVAL = FK_OFF ? "評価" : "評価・振り返り";
const APP_NAME = "火星探査ロボット・シミュレータ";

const view = document.getElementById("view");
const nav = document.getElementById("chapter-nav");
let cleanup = null;
const undoHistories = new Map();

const fmtTime = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const yen = (n) => `${n.toLocaleString("ja-JP")}円`;

function designOf(s) {
  const d = store.getDesign(s.id);
  const base = s.design;
  if (!d) return { ...base, dist: [...base.dist] };
  return { dist: (Array.isArray(d.dist) ? d.dist : []).filter((x) => s.allow.dist.includes(x)), color: s.allow.color.includes(Number(d.color)) ? Number(d.color) : base.color, speed: SPEEDS[d.speed] ? d.speed : base.speed };
}

function designText(d) {
  const dist = d.dist.length ? d.dist.map((id) => DIST_SLOTS.find((x) => x.id === id)?.short).join("・") : "なし";
  const col = Number(d.color) ? `${d.color}こ` : "なし";
  return `距離センサ: ${dist}／色センサ: ${col}／速さ: ${SPEEDS[d.speed].label}`;
}

// ---------------- はじめに ----------------
const FLOW_STEPS = [
  ["1", "問題の発見・課題の設定", "人が行けない火星を調べたい。どんなロボットが必要？", "このページ"],
  ["2", "解決策の構想", "どんなセンサ・走行部（モーター）にするか。プログラムの流れ（フローチャート）を考える。", "各ステージの「ロボットの設計」"],
  ["3", "プログラムの制作", "ずっと・もし〜なら・でなければ と、センサの値でロボットを動かす。", "各ステージの「プログラム」"],
  ["✓", "動作確認・デバッグ", "フィールドで走らせ、1ステップで確かめて直す。いろいろなケースでテストする。", "「火星のフィールド」と「テスト」"],
  ["4", "評価、改善・修正", "機能・利便性・費用・安全性・環境への配慮をレーダーチャートで評価する。", `「${T_EVAL}」`],
];

function renderHome() {
  const cards = STAGES.map((s) => {
    const best = store.best(s.id);
    const status = s.free ? (best ? `いちばんよい点数 ${best.score}点` : "まだ挑戦していません") : best ? `テスト ${best.passed}/${best.total} 合格（最高）` : "まだテストしていません";
    return h(
      "a",
      { class: "scn-card", href: `#/s/${s.id}` },
      h("span", { class: "scn-icon", "aria-hidden": "true" }, s.icon),
      h("span", { class: "scn-num" }, `ステージ${s.label}・${s.level === "basic" ? "基本編" : "発展編"}`),
      h("span", { class: "scn-title" }, s.title),
      h("span", { class: "scn-desc" }, s.goal),
      h("span", { class: `scn-status${best && (s.free || best.passed === best.total) ? " done" : ""}` }, status),
    );
  });
  const kadaiId = "kadai-text";
  const kadai = h("textarea", { id: kadaiId, maxlength: "300", rows: "3", placeholder: "例: 人が行けない火星の地面を調査するロボットを開発する。障害物は自動でよけて走る。" });
  kadai.value = store.state.kadai || "";
  const kadaiNote = h("div", { class: "saved-note", "aria-live": "polite" });
  attachAutosave(kadai, (t) => store.setKadai(t.trim()), { onSaved: () => (kadaiNote.textContent = AUTOSAVE_DONE) });
  view.replaceChildren(
    h(
      "section",
      { class: "card hero" },
      h("h1", {}, "火星探査ロボット・シミュレータ"),
      h("p", { class: "lead" }, "火星の調査ロボットを設計し、プログラムで走らせよう。センサで岩をよけ、線をたどり、サンプルを集めて基地をめざします。"),
      h(
        "div",
        { class: "io-flow", role: "img", "aria-label": "センサ から コンピュータ から モーター" },
        h("div", { class: "io-box io-in" }, h("span", { class: "io-tag" }, "入力・計測"), "センサ", h("small", {}, "超音波の距離センサ（岩までの距離）・色センサ（線）")),
        h("span", { class: "io-arrow", "aria-hidden": "true" }, "→"),
        h("div", { class: "io-box io-cpu" }, h("span", { class: "io-tag" }, "処理・判断"), "コンピュータ", h("small", {}, "プログラムで判断する")),
        h("span", { class: "io-arrow", "aria-hidden": "true" }, "→"),
        h("div", { class: "io-box io-out" }, h("span", { class: "io-tag" }, "出力・制御（仕事を行う部分）"), "左右のモーター", h("small", {}, "前進・後退・右に回る・左に回る・止まる")),
      ),
      h("p", { class: "author-line" }, "作成：技術 岡田"),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "問題解決の流れ（教科書の統合的な問題解決と同じ）"),
      h("ol", { class: "ps-flow" }, FLOW_STEPS.map(([n, t, d, where]) => h("li", {}, h("span", { class: "ps-num", "aria-hidden": "true" }, n), h("div", {}, h("strong", {}, t), h("span", { class: "ps-desc" }, d), h("span", { class: "ps-where" }, "この教材では: ", where))))),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "1 問題の発見・課題の設定"),
      h("p", {}, "火星は地球から遠く、人が直接行って調べることはできません。地面には岩やクレーターがあり、どこに何があるかもわかりません。通信にも時間がかかるので、地球から1つずつ操作するのはたいへんです。"),
      explainCard("例: 問題の発見 → 課題の設定", h("div", {}, h("p", {}, "問題: 人が直接行くことのできない、未知の場所などを調査したい。"), h("p", {}, "課題: 未知の場所を、自動で障害物を回避しながら調査するロボットを開発する。"))),
      h("label", { for: kadaiId, class: "block-label" }, "自分の言葉で、課題を書いてみよう（社会・安全・環境・経済の面からも考えよう）"),
      kadai,
      h("div", { class: "hint autosave-hint" }, AUTOSAVE_HINT),
      kadaiNote,
    ),
    h("h2", { class: "section-title" }, "ステージをえらぶ"),
    h("div", { class: "scn-grid" }, cards),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "使い方"),
      h(
        "ol",
        { class: "how-to" },
        h("li", {}, h("strong", {}, "ロボットを設計する"), "：距離センサを付ける場所、色センサを付けるか、モーターの速さをえらぶ。部品の費用も出ます。"),
        h("li", {}, h("strong", {}, "プログラムを作る"), "：入れたい場所の「＋ ここに入れる」を押し、命令のボタンを押します（D7 と同じ使い方）。フローチャートでも見られます。"),
        h("li", {}, h("strong", {}, "走らせて確かめる"), "：▶ 実行・⏸ 一時停止・⏭ 1ステップで動かします。ロボットの動きとセンサの値を見ながら、デバッグします。"),
        h("li", {}, h("strong", {}, "テストする"), "：岩の場所や谷の形がちがういくつかのケースで、合格か不合格かを自動で調べます。"),
        h("li", {}, h("strong", {}, "評価する"), `：「${T_EVAL}」で、レーダーチャートを使って自分のロボットを評価します。そして、改善を考えます。`),
      ),
      explainCard("この教材について", "ブラウザの中だけで動き、インターネットには接続しません。作ったプログラムや記録は、この端末のブラウザの中にだけ保存されます。実際のロボット（マイコンボードとモーター・センサ）での学習と組み合わせて使ってください。"),
    ),
  );
}

// ---------------- 先生用（#/teacher） ----------------
function renderTeacher() {
  view.replaceChildren(
    h("h1", {}, "先生用ページ"),
    explainCard("このページについて", "生徒用のメニューには出ていません。開き方は2つあります。(1) この教材のファイルを開き、アドレスの最後に #/teacher をつける。(2) 教材集の中など、アドレスを変えられないときは、教材の画面をクリックしてから（文字を入れる欄の外で）キーボードで teacher と続けて打つ。", "warn"),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "授業の進め方の例（3〜4時間）"),
      h(
        "table",
        { class: "data plan-table" },
        h(
          "tbody",
          {},
          [
            ["1時間目", "はじめに（問題の発見・課題の設定 10分）、① まっすぐ走って止まる（15分）、② 岩の前で止まる・よける（前半）"],
            ["2時間目", "② 岩の前で止まる・よける（後半）、③ 迷路のような谷を探査する（センサの付け方を考える）"],
            ["3時間目", "③ のテストと改善、評価・振り返り（レーダーチャート）、記録の書き出し"],
            ["発展", "④ 色センサで線をたどる、⑤ 自由なコースで記録に挑戦（班で点数を競う）"],
          ].map(([a, b]) => h("tr", {}, h("th", {}, a), h("td", {}, b))),
        ),
      ),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "模範（設計とプログラム）"),
      h("p", { class: "hint" }, "①〜④の模範は、そのステージのすべてのケースに合格することを自動テストで確かめています。⑤は一例です。"),
      STAGES.map((s) => h("details", { class: "answer" }, h("summary", {}, `${s.icon} ${s.label} ${s.title}`), h("p", {}, designText(s.model.design)), h("pre", { class: "code-view" }, s.model.program))),
    ),
  );
}

// ---------------- ステージ ----------------
function renderStage(sid) {
  const s = stageById(sid);
  if (!s) {
    location.hash = "#/";
    return;
  }
  let design = designOf(s);
  let text = store.getProgram(s.id) ?? s.starter;
  let parsed = parseProgram(text);
  if (parsed.errors.length) {
    text = s.starter;
    parsed = parseProgram(text);
  }
  let program = parsed.program;
  let errors = [];
  if (!undoHistories.has(s.id)) undoHistories.set(s.id, [text]);
  const history = undoHistories.get(s.id);
  if (history.at(-1) !== text) history.push(text);
  let editorTab = store.pref("editorTab") === "flow" ? "flow" : "blocks";
  let caseIdx = Math.max(0, Math.min(Math.floor(Number(store.pref(`case.${s.id}`))) || 0, s.cases.length - 1));
  let sim = null;
  let running = false;
  let speed = Number(store.pref("simSpeed")) || 1;
  let raf = null;
  let lastTs = null;
  let acc = 0;
  let lastResults = null;
  let resultsStale = false;
  let announced = null;

  // ---- 見出し ----
  const seen = store.pref("seenStages") || [];
  const firstVisit = !seen.includes(s.id);
  if (firstVisit) store.setPref("seenStages", [...seen, s.id]);
  const head = h(
    "section",
    { class: "card scn-head" },
    h("div", { class: "scn-title-row" }, h("h1", {}, h("span", { "aria-hidden": "true" }, s.icon, " "), `${s.label} ${s.title}`), h("span", { class: "scn-time" }, s.level === "basic" ? "基本編" : "発展編")),
    h("p", { class: "scn-goal" }, h("strong", {}, "めあて："), s.goal),
    h(
      "details",
      { class: "scn-story", open: firstVisit ? "open" : null },
      h("summary", {}, "ステージの説明（お話・できたら合格になること）"),
      h("p", {}, s.story),
      h("p", { class: "hint" }, h("strong", {}, "学ぶこと: "), s.learn),
      h("h3", { class: "dev-title" }, s.free ? "点数のつけ方" : "テストで調べること（ケースごと）"),
      h("ul", {}, s.checks.map((c) => h("li", {}, c))),
    ),
    h("details", { class: "hints" }, h("summary", {}, "ヒントを見る"), h("ol", {}, s.hints.map((x) => h("li", {}, x)))),
  );

  // ---- 2 解決策の構想: ロボットの設計 ----
  const designBox = h("div", { class: "design-body" });
  const designCard = h("section", { class: "card design-card", "aria-label": "ロボットの設計" }, h("h2", {}, h("span", { class: "ps-tag" }, "2 解決策の構想"), "ロボットの設計"), designBox);

  function renderDesign() {
    const distAllowed = DIST_SLOTS.filter((x) => s.allow.dist.includes(x.id));
    const full = design.dist.length >= MAX_DIST_SENSORS;
    const distBtns = distAllowed.map((slot) => {
      const on = design.dist.includes(slot.id);
      return h(
        "button",
        {
          type: "button",
          class: `ef-btn chip${on ? " is-on" : ""}`,
          "aria-pressed": on ? "true" : "false",
          disabled: !on && full ? "disabled" : null,
          "data-slot": slot.id,
          onclick: () => {
            const next = on ? design.dist.filter((x) => x !== slot.id) : [...design.dist, slot.id];
            setDesign({ ...design, dist: DIST_SLOTS.map((x) => x.id).filter((id) => next.includes(id)) });
          },
        },
        on ? "✓ " : "＋ ",
        slot.short,
      );
    });
    const radio = (name, value, label, checked, onPick) => {
      const id = `${name}-${s.id}-${value}`;
      const inp = h("input", { type: "radio", name: `${name}-${s.id}`, id, value, checked: checked ? "checked" : null });
      inp.addEventListener("change", () => onPick(value));
      return h("label", { class: "radio-chip", for: id }, inp, label);
    };
    const colorRow = s.allow.color.length > 1 ? h("div", { class: "design-row" }, h("span", { class: "design-label" }, "色センサ（下向き）"), h("div", { class: "chip-row" }, s.allow.color.map((n) => radio("color", n, n === 0 ? "なし" : n === 1 ? "1こ（まん中）" : "2こ（左右）", Number(design.color) === n, (v) => setDesign({ ...design, color: Number(v) }))))) : null;
    const sp = SPEEDS[design.speed];
    const turn = Math.round((sp.v / 20) * 90);
    const sensorsN = sensorsOf(design).length;
    const usePerMin = Math.round((BATTERY.base + BATTERY.sensor * sensorsN + 2 * BATTERY.wheel(sp.v)) * 60 * 10) / 10;
    designBox.replaceChildren(
      h(
        "div",
        { class: "design-grid" },
        h(
          "div",
          {},
          h("div", { class: "design-row" }, h("span", { class: "design-label" }, `距離センサ（超音波）… 付ける場所（${MAX_DIST_SENSORS}こまで）`), h("div", { class: "chip-row", role: "group", "aria-label": "距離センサを付ける場所" }, distBtns)),
          colorRow,
          h("div", { class: "design-row" }, h("span", { class: "design-label" }, "モーター（走行部）の速さ"), h("div", { class: "chip-row" }, Object.entries(SPEEDS).map(([k, v]) => radio("speed", k, `${v.label}（${v.v}cm/秒）`, design.speed === k, (val) => setDesign({ ...design, speed: val }))))),
          h(
            "ul",
            { class: "design-facts" },
            h("li", {}, h("strong", {}, "進む速さ: "), `1秒に ${sp.v}cm`),
            h("li", {}, h("strong", {}, "その場で回る速さ: "), `1秒に 約${turn}°（90°回るには 約${fmt(90 / turn)}秒）`),
            h("li", {}, h("strong", {}, "部品の費用: "), yen(designCost(design)), h("span", { class: "hint" }, `（本体 ${yen(PART_COST.body)}・距離センサ 1こ ${yen(PART_COST.dist)}・色センサ 1こ ${yen(PART_COST.color)}・モーター ${yen(sp.cost)}）`)),
            h("li", {}, h("strong", {}, "電池の使い方: "), `走っているとき 1分に 約${usePerMin}%`),
            h("li", {}, h("strong", {}, "プログラムで使える名前: "), sensorsOf(design).map((x) => x.name).join("・") || "（センサなし）"),
          ),
        ),
        robotSvg(design),
      ),
    );
  }

  function setDesign(d) {
    design = d;
    store.setDesign(s.id, d);
    renderDesign();
    blockEd.setSensors(sensorsOf(design));
    errors = [...validate(program, design).errors, ...blockEd.inputErrors()];
    afterProgramChange();
  }

  // ---- 3 プログラムの制作 ----
  const blockEd = createBlockEditor(() => programChanged(), () => {
    errors = [...validate(program, design).errors, ...blockEd.inputErrors()];
    showErrors();
  });
  blockEd.sensors = sensorsOf(design);
  blockEd.setProgram(program, { memoCursor: true });
  errors = validate(program, design).errors;
  const flowBox = h("div", { class: "flow-box" });
  const errBox = h("div", { class: "err-box", "aria-live": "polite" });
  const edBody = h("div", { class: "editor-body" });
  const edTabs = h("div");

  function applyText(t) {
    text = t;
    store.setProgram(s.id, text);
    const c = parseProgram(text);
    program = c.program;
    blockEd.setProgram(program);
    errors = [...c.errors, ...validate(program, design).errors];
    afterProgramChange();
  }

  function programChanged() {
    text = programToText(program);
    store.setProgram(s.id, text);
    if (history.at(-1) !== text) history.push(text);
    if (history.length > 60) history.shift();
    errors = [...validate(program, design).errors, ...blockEd.inputErrors()];
    afterProgramChange();
  }

  function afterProgramChange() {
    showErrors();
    if (lastResults) {
      resultsStale = true;
      renderResults();
    }
    newSim();
    if (editorTab === "flow") renderFlow();
  }

  function showErrors() {
    errBox.replaceChildren(...(errors.length ? [explainCard("まちがいがあります（直すまで、実行とテストはできません）", h("ul", {}, errors.slice(0, 6).map((e) => h("li", {}, e.message))), "bad")] : []));
  }

  function renderFlow() {
    flowBox.innerHTML = flowchartSvg(program, new Set(OUTPUTS), flowLabel);
    highlight();
  }

  function setEditorTab(t) {
    editorTab = t;
    store.setPref("editorTab", t);
    edTabs.replaceChildren(tabs([["blocks", "ブロック"], ["flow", "フローチャート"]], t, setEditorTab, "プログラムの見方"));
    if (t === "blocks") {
      blockEd.render();
      edBody.replaceChildren(blockEd.el);
    } else {
      renderFlow();
      edBody.replaceChildren(h("p", { class: "hint" }, "フローチャートは、プログラムから自動でかかれます。解決策の構想で考えた流れと同じになっているか、くらべよう。直すときは「ブロック」で。"), flowBox);
    }
    highlight();
  }

  const undoBtn = h("button", { type: "button", class: "btn secondary small", onclick: () => {
    if (history.length < 2) return toast("これ以上もどせません");
    history.pop();
    applyText(history.at(-1));
    if (editorTab === "blocks") setEditorTab("blocks");
  } }, "↶ 元にもどす");
  const resetBtn = h("button", { type: "button", class: "btn secondary small", onclick: () => {
    if (!confirm("はじめのプログラムにもどします。今のプログラムは消えます（「元にもどす」で取り消せます）。")) return;
    applyText(s.starter);
    if (history.at(-1) !== text) history.push(text);
    blockEd.setProgram(program, { memoCursor: true });
    if (editorTab === "blocks") setEditorTab("blocks");
  } }, "はじめのプログラムにもどす");
  const testMini = h("div", { class: "test-mini", "aria-live": "polite" });
  const testTopBtn = h("button", { type: "button", class: "btn small", onclick: () => (s.free ? runChallenge() : doTests()) }, s.free ? "🏆 記録に挑戦" : "✔ テストを実行");
  const editorCard = h(
    "section",
    { class: "card editor-card", "aria-label": "プログラム" },
    h("div", { class: "card-title-row" }, h("h2", {}, h("span", { class: "ps-tag" }, "3 プログラムの制作"), "プログラム"), h("div", { class: "btn-row tight" }, testTopBtn, undoBtn, resetBtn)),
    testMini,
    edTabs,
    edBody,
    errBox,
  );

  // ---- 動作確認・デバッグ: 火星のフィールド ----
  const canvas = h("canvas", { class: "field-canvas", role: "img", "aria-label": "上から見た火星のフィールドとロボット" });
  const viewer = createView(canvas);
  const timeEl = h("span", { class: "sim-time" });
  const stateEl = h("span", { class: "sim-state" });
  const meters = h("div", { class: "meters" });
  const outcomeEl = h("div", { class: "outcome", "aria-live": "polite" });
  const nextEl = h("div", { class: "next-stmt", "aria-live": "polite" });
  const panel = h("div", { class: "mcu-panel" });
  const logBox = h("ol", { class: "log-list", "aria-live": "off" });
  const runBtn = h("button", { type: "button", class: "btn", onclick: () => (running ? pause() : run()) }, "▶ 実行");
  const stepBtn = h("button", { type: "button", class: "btn secondary", onclick: () => stepOnce(), title: "次の1つの命令まで進める" }, "⏭ 1ステップ");
  const restartBtn = h("button", { type: "button", class: "btn secondary", onclick: () => newSim(), title: "ロボットをスタートの場所にもどす" }, "⟲ 最初から");
  const speedSel = h("select", { class: "speed-sel", "aria-label": "速さ" }, [0.5, 1, 2, 5, 10].map((v) => h("option", { value: v, selected: v === speed ? "selected" : null }, `×${v}`)));
  speedSel.addEventListener("change", () => {
    speed = Number(speedSel.value);
    store.setPref("simSpeed", speed);
  });
  const caseSel = h("select", { class: "case-sel", "aria-label": s.free ? "コース" : "ケース" }, s.cases.map((c, i) => h("option", { value: i, selected: i === caseIdx ? "selected" : null }, c.name)));
  caseSel.addEventListener("change", () => {
    caseIdx = Number(caseSel.value);
    store.setPref(`case.${s.id}`, caseIdx);
    newSim();
    if (s.free) renderRanking();
  });
  const worldCard = h(
    "section",
    { class: "card world-card", "aria-label": "火星のフィールド" },
    h("div", { class: "card-title-row" }, h("h2", {}, h("span", { class: "ps-tag" }, "動作確認・デバッグ"), "火星のフィールド"), h("div", { class: "sim-meta" }, stateEl, timeEl)),
    h("div", { class: "field" }, h("label", {}, s.free ? "コース " : "ケース ", caseSel)),
    h("div", { class: "world" }, canvas),
    meters,
    outcomeEl,
    h("div", { class: "btn-row tight controls" }, runBtn, stepBtn, restartBtn, h("label", { class: "inline-label" }, "速さ ", speedSel)),
    nextEl,
    h("h3", { class: "panel-title" }, "コンピュータの中の値"),
    h("p", { class: "hint" }, "距離センサの値は、ロボットの前のはしから岩や岩壁までの距離（cm）です。何もないときは 300。"),
    panel,
    h("details", { class: "log-details", open: "open" }, h("summary", {}, "ログ（記録）"), logBox),
  );

  // ---- テスト ----
  const resultsBox = h("div", { "aria-live": "polite" });
  const memoBox = h("div");
  const historyBox = h("div");
  const rankingBox = h("div");
  const testCard = s.free
    ? h(
        "section",
        { class: "card test-card", "aria-label": "記録に挑戦" },
        h("h2", {}, "記録に挑戦"),
        h("p", {}, "えらんだコースで、ロボットを最後まで走らせて点数を出します。時間・電池の残り・ぶつかったかも記録されます。"),
        h("p", { class: "hint" }, s.hints[0]),
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn", onclick: () => runChallenge() }, "🏆 記録に挑戦")),
        resultsBox,
        memoBox,
        rankingBox,
      )
    : h(
        "section",
        { class: "card test-card", "aria-label": "テスト" },
        h("h2", {}, "テスト（いろいろなケースで確かめる）"),
        h("p", {}, "次のケースで、ロボットが最後まで正しく動くかを自動で調べます。ケースごとに、", s.cases.length > 1 ? "岩の場所や地形がちがいます。" : "同じ道を走ります。"),
        h("ul", { class: "test-list" }, s.cases.map((c) => h("li", {}, h("strong", {}, c.name)))),
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn", onclick: () => doTests() }, "✔ テストを実行")),
        resultsBox,
        memoBox,
        historyBox,
      );

  function doTests() {
    if (errors.length) return toast("まちがいを直してからテストしよう");
    const results = runTests(s, program, design);
    const passed = results.filter((r) => r.pass).length;
    const rec = store.addRecord({ sid: s.id, title: s.title, passed, total: results.length, results: results.map((r) => ({ id: r.id, name: r.name, pass: r.pass, reason: r.reason })), program: text, design: { ...design }, cost: designCost(design) });
    lastResults = { results, rec };
    resultsStale = false;
    renderNav(`s/${s.id}`);
    renderResults();
    renderMemo(rec);
    renderHistory();
  }

  function runChallenge() {
    if (errors.length) return toast("まちがいを直してから挑戦しよう");
    const c = s.cases[caseIdx];
    const sm = new RoverSim(c.field, program, design);
    const sum = sm.runToEnd();
    const score = freeScore(c.field, sum);
    const rec = store.addRecord({ sid: s.id, title: `${s.title}（${c.name}）`, course: c.id, courseName: c.name, score, passed: sum.collected, total: sum.targets, time: sum.time, battery: sum.battery, goal: sum.goal, crash: Boolean(sum.crash), outcome: sum.outcome, results: [], program: text, design: { ...design }, cost: designCost(design) });
    const best = store.recordsOf(s.id).filter((r) => r.course === c.id).reduce((a, r) => (r.score > a ? r.score : a), 0);
    const j = judge(s, c.field, sum);
    resultsBox.replaceChildren(
      explainCard(
        `${score}点${score >= best && score > 0 ? "（自己ベスト！）" : ""}`,
        h(
          "ul",
          {},
          h("li", {}, `サンプル ${sum.collected}/${sum.targets}${c.field.goal ? `・基地 ${sum.goal ? "○ 帰った" : "× まだ"}` : ""}`),
          h("li", {}, `時間 ${fmt(sum.time)}秒・電池の残り ${fmt(sum.battery)}%・走った距離 ${sum.distance}cm・費用 ${yen(designCost(design))}`),
          sum.outcome === "clear" ? h("li", {}, "ミッション達成！ 電池の残りと残り時間も点数に入りました。") : h("li", {}, j.reasons[0] || ""),
        ),
        sum.outcome === "clear" ? "good" : sum.crash ? "bad" : "warn",
      ),
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn secondary small", onclick: () => { newSim(); run(); } }, "▶ フィールドで見る")),
    );
    lastResults = null;
    renderMemo(rec);
    renderRanking();
    renderNav(`s/${s.id}`);
  }

  function renderRanking() {
    if (!s.free) return;
    const c = s.cases[caseIdx];
    const rs = store.recordsOf(s.id).filter((r) => r.course === c.id).sort((a, b) => b.score - a.score || a.time - b.time).slice(0, 10);
    rankingBox.replaceChildren(
      h("h3", {}, `自分の記録ランキング（${c.name}）`),
      rs.length
        ? h(
            "div",
            { class: "table-wrap" },
            h(
              "table",
              { class: "data ranking" },
              h("thead", {}, h("tr", {}, ["順位", "点数", "サンプル", "時間", "電池", "費用", "設計", "日時"].map((x) => h("th", {}, x)))),
              h("tbody", {}, rs.map((r, i) => h("tr", {}, h("td", {}, `${i + 1}位`), h("td", {}, h("strong", {}, `${r.score}点`)), h("td", {}, `${r.passed}/${r.total}${r.crash ? " 💥" : ""}`), h("td", {}, `${fmt(r.time)}秒`), h("td", {}, `${fmt(r.battery)}%`), h("td", {}, yen(r.cost || 0)), h("td", { class: "small-cell" }, designText(r.design)), h("td", {}, fmtTime(r.at))))),
            ),
          )
        : h("p", { class: "hint" }, "まだ記録がありません。"),
      h("p", { class: "hint" }, "班やクラスで、同じコースの点数・時間・電池の残りをくらべてみよう。点数が同じなら、時間が短いほうが上です。"),
    );
  }

  function renderMini() {
    if (!lastResults) return testMini.replaceChildren();
    const { results } = lastResults;
    const passed = results.filter((r) => r.pass).length;
    testMini.replaceChildren(
      h(
        "div",
        { class: `test-mini-box ${resultsStale ? "stale" : passed === results.length ? "good" : "warn"}` },
        h("strong", {}, resultsStale ? "前のプログラムのテスト結果（もう一度テストしよう）" : `テスト ${passed}/${results.length} 合格`),
        h("ul", { class: "test-mini-list" }, results.map((r) => h("li", { class: r.pass ? "pass" : "fail" }, r.pass ? "○ " : "× ", r.name))),
        resultsStale ? null : h("button", { type: "button", class: "linkish", onclick: () => resultsBox.scrollIntoView({ behavior: "smooth", block: "start" }) }, "くわしく見る（理由・再生）↓"),
      ),
    );
  }

  function renderResults() {
    if (!lastResults) return;
    renderMini();
    const { results } = lastResults;
    const passed = results.filter((r) => r.pass).length;
    const summary = passed === results.length ? explainCard("全部合格！", "すべてのケースでミッションを達成しました。どこを工夫したかを「改善メモ」に書いておこう。次は、電池や時間をもっとへらせないか考えてみよう。", "good") : explainCard(`${results.length}つのケースのうち ${passed}つ合格`, "不合格のケースを「再生」しよう。どこで思った通りに動かないのかを、1ステップやセンサの値で調べよう。", "warn");
    resultsBox.replaceChildren(
      ...[resultsStale ? explainCard("プログラムが変わりました", "下の結果は前のプログラムのものです。もう一度「テストを実行」しよう。", "warn") : null, summary].filter(Boolean),
      h(
        "ul",
        { class: "result-list" },
        results.map((r) =>
          h(
            "li",
            { class: r.pass ? "pass" : "fail" },
            h("div", { class: "result-head" }, h("span", { class: `status ${r.pass ? "good" : "bad"}` }, r.pass ? "○ 合格" : "× 不合格"), h("strong", {}, r.name), h("span", { class: "hint" }, `${fmt(r.summary.time)}秒・電池の残り ${fmt(r.summary.battery)}%`), h("button", { type: "button", class: "btn secondary small", onclick: () => playCase(r.id) }, "▶ このケースを再生")),
            r.pass ? null : h("ul", { class: "fail-list" }, r.reasons.slice(0, 3).map((x) => h("li", {}, x))),
          ),
        ),
      ),
    );
  }

  function renderMemo(rec, earlier = false) {
    const id = `memo-${s.id}`;
    const tx = h("textarea", { id, maxlength: "400", placeholder: "例: 岩の手前で止まる距離を 10 から 30 に変えたら、速く走ってもぶつからなくなった。" });
    tx.value = rec.memo || "";
    const note = h("span", { class: "saved-note", "aria-live": "polite" });
    const saveMemo = () => {
      store.setMemo(rec.id, tx.value.trim());
      renderHistory();
    };
    const flush = attachAutosave(tx, saveMemo, { onSaved: () => (note.textContent = AUTOSAVE_DONE) });
    memoBox.replaceChildren(
      h(
        "div",
        { class: "memo" },
        h("label", { for: id }, earlier ? `改善メモ（前回の記録・${fmtTime(rec.at)}）：どこを直したか・なぜそうしたか・気づいたこと` : "改善メモ：どこを直したか・なぜそうしたか・気づいたこと"),
        tx,
        h("div", { class: "hint autosave-hint" }, AUTOSAVE_HINT),
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn small", onclick: () => { flush(); saveMemo(); note.textContent = "この記録に保存しました"; } }, "メモを保存"), note),
      ),
    );
  }

  function renderHistory() {
    if (s.free) return;
    const rs = store.recordsOf(s.id).slice(-8).reverse();
    if (!rs.length) return historyBox.replaceChildren();
    historyBox.replaceChildren(
      h("h3", {}, "このステージの改善の記録（新しい順）"),
      h("ol", { class: "mini-history" }, rs.map((r) => h("li", {}, h("span", { class: `status ${r.passed === r.total ? "good" : "warn"}` }, `${r.passed}/${r.total}`), " ", h("span", { class: "hint" }, `${fmtTime(r.at)}・${yen(r.cost || 0)}`), r.memo ? ` ${r.memo}` : ""))),
      h("p", {}, h("a", { href: "#/records" }, "すべての記録を見る・書き出す（記録）")),
    );
  }

  // ---- シミュレーションの操作 ----
  function newSim() {
    pause();
    sim = new RoverSim(s.cases[caseIdx].field, program, design);
    announced = null;
    outcomeEl.replaceChildren();
    nextEl.replaceChildren();
    refresh(true);
  }

  function playCase(id) {
    caseIdx = s.cases.findIndex((c) => c.id === id);
    caseSel.value = String(caseIdx);
    newSim();
    worldCard.scrollIntoView({ behavior: "smooth", block: "start" });
    run();
  }

  function run() {
    if (errors.length) return toast("まちがいを直してから実行しよう");
    if (!sim || sim.outcome) newSim();
    running = true;
    runBtn.textContent = "⏸ 一時停止";
    nextEl.replaceChildren();
    lastTs = null;
    acc = 0;
    raf = requestAnimationFrame(loop);
    refreshState();
  }

  function pause() {
    running = false;
    runBtn.textContent = "▶ 実行";
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    refreshState();
  }

  function loop(ts) {
    if (!running) return;
    if (lastTs == null) lastTs = ts;
    const dt = Math.min(0.25, (ts - lastTs) / 1000);
    lastTs = ts;
    acc += dt * speed;
    let n = 0;
    while (acc >= DT && n < 200 && !sim.outcome) {
      sim.tick();
      acc -= DT;
      n++;
    }
    refresh();
    if (sim.outcome) {
      pause();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function stepOnce() {
    if (errors.length) return toast("まちがいを直してから実行しよう");
    if (!sim || sim.outcome) newSim();
    pause();
    sim.step();
    refresh();
    const node = findNode(sim.currentId);
    nextEl.replaceChildren(sim.outcome ? "" : h("p", { class: "next-line" }, node ? ["次に実行する命令: ", h("strong", {}, blockLabel(node)), "（ブロックとフローチャートで光っています）"] : sim.programAlive ? "待っています（時間が進みます）" : "プログラムは終わりました"));
  }

  function findNode(id) {
    let found = null;
    const walk = (list) => list.forEach((n) => {
      if (n.id === id) found = n;
      for (const k of ["body", "then", "else"]) if (Array.isArray(n[k])) walk(n[k]);
    });
    if (id != null) walk(program);
    return found;
  }

  function highlight() {
    if (!sim) return;
    const id = sim.tickN === 0 && !sim.inTick ? null : sim.currentId;
    blockEd.highlight(running ? null : id);
    flowBox.querySelectorAll(".fc-node.current").forEach((x) => x.classList.remove("current"));
    if (id != null && !running) flowBox.querySelectorAll(`.fc-node[data-id="${id}"]`).forEach((x) => x.classList.add("current"));
  }

  function refreshState() {
    if (!sim) return;
    const st = sim.outcome === "clear" ? "ミッション達成" : sim.outcome === "crash" ? "ぶつかった" : sim.outcome === "battery" ? "電池切れ" : sim.outcome ? "おわり" : running ? "実行中" : sim.tickN ? "一時停止" : "停止中";
    stateEl.textContent = st;
    stateEl.className = `sim-state${sim.outcome === "clear" ? " good" : sim.outcome === "crash" || sim.outcome === "battery" ? " bad" : running ? " run" : ""}`;
  }

  function refresh(force = false) {
    if (!sim) return;
    viewer.draw(sim);
    timeEl.textContent = `${sim.t.toFixed(1)}秒 / ${sim.limit}秒`;
    const bat = sim.battery;
    meters.replaceChildren(
      h("div", { class: "meter" }, h("span", { class: "meter-label" }, "🔋 電池"), h("span", { class: `bar battery-bar${bat < 20 ? " low" : ""}`, role: "img", "aria-label": `電池の残り ${Math.round(bat)}%` }, h("span", { style: `width:${bat.toFixed(1)}%` })), h("span", { class: "meter-val" }, `${bat.toFixed(1)}%`)),
      h("div", { class: "meter" }, h("span", { class: "meter-label" }, "💎 調査"), h("span", { class: "meter-val" }, `${sim.collected}/${sim.targets.length}`), sim.field.goal ? h("span", { class: "meter-val" }, `🚩 ${sim.goalReached ? "着いた" : "まだ"}`) : null, h("span", { class: "meter-val muted" }, `走った距離 ${Math.round(sim.robot.dist)}cm`)),
    );
    refreshState();
    // コンピュータの中の値
    const rows = [];
    for (const x of sim.sensorList) rows.push(h("tr", { class: "is-sensor" }, h("th", {}, x.name), h("td", {}, x.kind === "dist" ? `${sim.sensors[x.name]} cm` : sim.sensors[x.name] ? "線（1）" : "地面（0）")));
    rows.push(h("tr", { class: `is-output${sim.wheels[0] || sim.wheels[1] ? " on" : ""}` }, h("th", {}, "走行"), h("td", {}, sim.drive)));
    rows.push(h("tr", { class: "is-output" }, h("th", {}, "左右のモーター"), h("td", {}, `左 ${wheelWord(sim.wheels[0])}・右 ${wheelWord(sim.wheels[1])}`)));
    for (const [k, v] of Object.entries(sim.vars)) rows.push(h("tr", { class: "is-var" }, h("th", {}, `変数 ${k}`), h("td", {}, fmt(v))));
    panel.replaceChildren(h("table", { class: "mcu-table" }, h("tbody", {}, rows)));
    // ログ
    const items = sim.log.slice(-40).reverse().map((l) => h("li", { class: `log-${l.kind}` }, h("span", { class: "log-t" }, `${l.t.toFixed(1)}秒`), l.text));
    logBox.replaceChildren(...(items.length ? items : [h("li", { class: "hint" }, "▶ 実行すると、ここに動きの記録が出ます。")]));
    highlight();
    if (sim.outcome && announced !== sim) {
      announced = sim;
      const sum = sim.summary();
      const j = judge(s, sim.field, sum);
      outcomeEl.replaceChildren(
        sim.outcome === "clear"
          ? explainCard("ミッション達成！", `${fmt(sum.time)}秒・電池の残り ${fmt(sum.battery)}%。${s.free ? "" : "ほかのケースでもうまくいくか、テストで確かめよう。"}`, "good")
          : explainCard(sim.outcome === "crash" ? "ぶつかった！" : sim.outcome === "battery" ? "電池が切れた" : sim.outcome === "time" ? "時間切れ" : "止まりました", j.reasons.join("。") || "プログラムが終わりました。", sim.outcome === "stopped" ? "warn" : "bad"),
      );
    }
    if (force) nextEl.replaceChildren();
  }

  const wheelWord = (w) => (w > 0 ? "前へ" : w < 0 ? "後ろへ" : "止まる");

  const onResize = () => sim && viewer.draw(sim);
  window.addEventListener("resize", onResize);
  cleanup = () => {
    pause();
    window.removeEventListener("resize", onResize);
  };

  view.replaceChildren(head, designCard, h("div", { class: "workbench" }, editorCard, worldCard), testCard);
  renderDesign();
  setEditorTab(editorTab);
  showErrors();
  newSim();
  if (s.free) renderRanking();
  // 前のテストの記録があれば、その改善メモを出す
  const last = store.recordsOf(s.id).at(-1);
  if (last) renderMemo(last, true);
  renderHistory();
}

// ロボットを上から見た図（センサの位置）
function robotSvg(design) {
  const sz = 150;
  const c = sz / 2;
  const k = 2.1;
  let s = `<rect x="${c - 16 * k}" y="${c - 13 * k}" width="${32 * k}" height="${26 * k}" rx="8" class="rb-body"/>`;
  s += `<rect x="${c - 16 * k}" y="${c - 13 * k - 2}" width="${32 * k}" height="9" rx="3" class="rb-wheel"/><rect x="${c - 16 * k}" y="${c + 13 * k - 7}" width="${32 * k}" height="9" rx="3" class="rb-wheel"/>`;
  s += `<polygon points="${c + 12 * k},${c} ${c + 6 * k},${c - 4 * k} ${c + 6 * k},${c + 4 * k}" class="rb-front"/>`;
  for (const id of design.dist) {
    const sl = DIST_SLOTS.find((x) => x.id === id);
    const x = c + sl.fwd * k;
    const y = c + sl.side * k;
    const a = (sl.dir * Math.PI) / 180;
    s += `<line x1="${x}" y1="${y}" x2="${x + Math.cos(a) * 26}" y2="${y + Math.sin(a) * 26}" class="rb-beam"/>`;
    s += `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" rx="2" class="rb-dist" transform="rotate(${sl.dir} ${x} ${y})"/>`;
  }
  for (const cs of COLOR_SETS[Number(design.color) || 0]) s += `<circle cx="${c + cs.fwd * k}" cy="${c + cs.side * k}" r="5" class="rb-color"/>`;
  return h("figure", { class: "robot-fig" }, h("div", { html: `<svg viewBox="0 0 ${sz} ${sz}" width="${sz}" height="${sz}" role="img" aria-label="ロボットを上から見た図（右が前）">${s}</svg>` }), h("figcaption", { class: "hint" }, "上から見た図（右が前）。青い四角: 距離センサ、緑の丸: 色センサ"));
}

// ---------------- 評価・振り返り ----------------
const REFLECT_Q = [
  ["design", "解決策の構想: どのセンサを、どこに付けた？ モーターの速さは？ そうした理由は？", "例: 谷では左右の開いている方を知りたかったので、前・左・右に距離センサを付けた。"],
  ["debug", "動作確認・デバッグ: 思ったとおりに動かなかったところと、どう直したか", "例: 速く走るとぶつかったので、止まる距離を 10cm から 30cm にした。"],
  ["improve", "評価して、もっとよくするために改善・修正したいこと", "例: 電池を多く使っていたので、速さをふつうにして、回る回数をへらしたい。"],
  ["society", "この問題解決の考え方を、社会や生活のどんな問題の解決に生かせそうか", "例: 災害で人が入れない建物の中を調べるロボットに使えそう。"],
];

function renderEval() {
  const ev = store.state.evaluation || { before: {}, after: {} };
  const chartBox = h("div", { class: "radar-box" });
  const COLORS = { before: "#2a78d6", after: "#eb6834" };
  const draw = () => {
    const e = store.state.evaluation;
    chartBox.innerHTML = radarSvg([
      { values: e.before, color: COLORS.before, label: "改善の前" },
      { values: e.after, color: COLORS.after, label: "改善のあと" },
    ]);
  };
  const sliders = (which, title) =>
    h(
      "fieldset",
      { class: `eval-set eval-${which}` },
      h("legend", {}, h("span", { class: "swatch", style: `background:${COLORS[which]}` }), title),
      AXES.map((a) => {
        const id = `ev-${which}-${a}`;
        const v = Number(ev[which]?.[a]) || 0;
        const out = h("output", { for: id }, v ? `${v}` : "—");
        const r = h("input", { type: "range", id, min: "0", max: "5", step: "1", value: v, "aria-label": `${title} ${a}` });
        r.addEventListener("input", () => {
          store.setEval(which, a, Number(r.value));
          out.textContent = Number(r.value) ? r.value : "—";
          draw();
        });
        return h("div", { class: "field eval-row" }, h("label", { for: id }, a, " ", out), r);
      }),
    );
  // 参考になる記録
  const facts = STAGES.map((s) => {
    const rs = store.recordsOf(s.id);
    const best = store.best(s.id);
    const last = rs.at(-1);
    return h("tr", {}, h("td", {}, `${s.label} ${s.title}`), h("td", {}, best ? (s.free ? `${best.score}点` : `${best.passed}/${best.total}`) : "—"), h("td", {}, last ? yen(last.cost || 0) : "—"), h("td", {}, last ? designText(last.design || designOf(s)) : "—"));
  });
  const reflect = REFLECT_Q.map(([id, q, ex]) => {
    const tid = `refl-${id}`;
    const ta = h("textarea", { id: tid, maxlength: "400", placeholder: ex });
    ta.value = store.getReflection(id);
    const note = h("div", { class: "saved-note", "aria-live": "polite" });
    attachAutosave(ta, (t) => store.setReflection(id, t.trim()), { onSaved: () => (note.textContent = AUTOSAVE_DONE) });
    return h("div", { class: "field" }, h("label", { for: tid, class: "block-label" }, q), ta, note);
  });
  view.replaceChildren(
    h("div", { "data-ef-lets": "d35" }),
    h("h1", {}, T_EVAL),
    h(
      "section",
      { class: "card" },
      h("h2", {}, h("span", { class: "ps-tag" }, "4 評価、改善・修正"), "レーダーチャートで評価しよう"),
      h("p", {}, "自分のロボットを、5つの観点で1〜5 の5段階で評価しよう。「改善の前」と、直したあとの「改善のあと」をつけると、よくなった所が見えます。"),
      h("div", { class: "eval-grid" }, chartBox, h("div", { class: "eval-sliders" }, sliders("before", "改善の前"), sliders("after", "改善のあと"))),
      h("dl", { class: "axis-notes" }, AXES.map((a) => [h("dt", {}, a), h("dd", {}, AXIS_NOTE[a])])),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "評価の参考になる自分の記録"),
      h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "ステージ"), h("th", {}, "いちばんよい結果"), h("th", {}, "費用（最新）"), h("th", {}, "設計（最新）"))), h("tbody", {}, facts))),
      h("p", { class: "hint" }, "テストの「電池の残り」や「ぶつかった」も、評価の手がかりになります。環境への配慮や安全性を評価するときに使おう。"),
    ),
    h("section", { class: "card reflection", "data-ef-reflect": "" }, h("h2", {}, "振り返り"), h("p", { class: "hint" }, AUTOSAVE_HINT), reflect),
  );
  draw();
}

// ---------------- 記録 ----------------
function renderRecords() {
  const st = store.state;
  const field = (key, label, w) => {
    const inp = h("input", { type: "text", value: st.student[key] || "", id: `stu-${key}`, style: `max-width:${w}` });
    inp.addEventListener("change", () => store.setStudent({ [key]: inp.value.trim() }));
    return h("div", { class: "field" }, h("label", { for: `stu-${key}` }, label), inp);
  };
  const recs = [...st.records].reverse();
  const summary = STAGES.map((s) => {
    const rs = store.recordsOf(s.id);
    const best = store.best(s.id);
    return h("tr", {}, h("td", {}, `${s.icon} ${s.label} ${s.title}`), h("td", {}, rs.length), h("td", {}, best ? (s.free ? `${best.score}点` : `${best.passed}/${best.total}`) : "—"));
  });
  const list = recs.map((r) =>
    h(
      "li",
      { class: "rec" },
      h("div", { class: "rec-head" }, h("strong", {}, r.title), r.score != null ? h("span", { class: "status good" }, `${r.score}点`) : h("span", { class: `status ${r.passed === r.total ? "good" : "warn"}` }, `${r.passed}/${r.total} 合格`), h("span", { class: "hint" }, fmtTime(r.at))),
      r.results?.length ? h("ul", { class: "rec-results" }, r.results.map((x) => h("li", {}, x.pass ? "○ " : "× ", x.name, x.pass ? "" : `（${x.reason}）`))) : h("p", { class: "hint" }, `サンプル ${r.passed}/${r.total}・${fmt(r.time)}秒・電池の残り ${fmt(r.battery)}%`),
      r.design ? h("p", { class: "hint" }, designText(r.design), `・費用 ${yen(r.cost || 0)}`) : null,
      r.memo ? h("p", { class: "rec-memo" }, "改善メモ: ", r.memo) : null,
      h("details", {}, h("summary", {}, "このときのプログラム"), h("pre", { class: "code-view small" }, r.program)),
    ),
  );
  const exportNote = h("p", { class: "export-note", "aria-live": "polite" });
  const readyToExport = () => {
    const vals = Object.fromEntries(["cls", "num", "name"].map((k) => [k, (document.getElementById(`stu-${k}`)?.value || "").trim()]));
    store.setStudent(vals);
    const empty = ["cls", "num"].find((k) => !vals[k]);
    if (empty) {
      exportNote.className = "export-note warn";
      exportNote.textContent = "組と番号を入れてから書き出そう";
      document.getElementById(`stu-${empty}`)?.focus({ preventScroll: true });
      return false;
    }
    return true;
  };
  const exported = (name) => {
    exportNote.className = "export-note good";
    exportNote.textContent = `ファイルを保存しました（ファイル名: ${name}）。先生に言われた場所に出そう。`;
  };
  const exportJson = () => {
    if (!readyToExport()) return;
    const name = `火星探査ロボット_記録_${st.student.cls || ""}${st.student.num || ""}.json`;
    const data = { app: APP_NAME, exportedAt: new Date().toISOString(), student: st.student, kadai: st.kadai, records: st.records, evaluation: st.evaluation, reflections: FK_OFF ? {} : st.reflections, programs: st.programs, designs: st.designs };
    downloadFile(name, JSON.stringify(data, null, 2));
    exported(name);
  };
  const exportCsv = () => {
    if (!readyToExport()) return;
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["組", "番号", "名前", "日時", "ステージ", "合格数・サンプル", "ケース数・サンプル数", "点数", "不合格の理由", "設計", "費用", "改善メモ"].map(q).join(",")];
    for (const r of st.records) lines.push([st.student.cls, st.student.num, st.student.name, r.at, r.title, r.passed, r.total, r.score ?? "", (r.results || []).filter((x) => !x.pass).map((x) => `${x.name}: ${x.reason}`).join(" / "), r.design ? designText(r.design) : "", r.cost ?? "", r.memo].map(q).join(","));
    for (const w of ["before", "after"]) for (const a of AXES) if (st.evaluation?.[w]?.[a]) lines.push([st.student.cls, st.student.num, st.student.name, "", `評価（${w === "before" ? "改善の前" : "改善のあと"}）`, "", "", "", a, st.evaluation[w][a], "", ""].map(q).join(","));
    if (!FK_OFF) for (const [id, qq] of REFLECT_Q) if (store.getReflection(id)) lines.push([st.student.cls, st.student.num, st.student.name, st.reflections[id].at, `振り返り: ${qq.split(":")[0]}`, "", "", "", "", "", "", store.getReflection(id)].map(q).join(","));
    const name = `火星探査ロボット_記録_${st.student.cls || ""}${st.student.num || ""}.csv`;
    downloadFile(name, "﻿" + lines.join("\r\n"), "text/csv");
    exported(name);
  };
  view.replaceChildren(
    h("h1", {}, "記録"),
    h("section", { class: "card" }, h("h2", {}, "名前"), h("div", { class: "field-row" }, field("cls", "組", "8em"), field("num", "番号", "6em"), field("name", "名前", "16em")), h("p", { class: "hint" }, "名前はこの端末のブラウザと、書き出したファイルに入ります。ほかの人と端末を使うときは、最後に「この端末の記録をすべて消す」を押そう。")),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "ステージごとのまとめ"),
      h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "ステージ"), h("th", {}, "テスト・挑戦の回数"), h("th", {}, "いちばんよい結果"))), h("tbody", {}, summary))),
      h("p", { class: "hint" }, h("strong", {}, "先生に出すのは JSON のファイルです。"), "課題・テストの記録・評価", FK_OFF ? "" : "・振り返り", " が入ります。CSV は、表計算ソフトで見るためのものです。"),
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn", onclick: exportJson }, "JSONで書き出す（先生に出す）"), h("button", { type: "button", class: "btn secondary", onclick: exportCsv }, "CSVで書き出す（表計算ソフト用）")),
      exportNote,
    ),
    h("section", { class: "card" }, h("h2", {}, `テスト・挑戦の記録（${recs.length}件、新しい順）`), recs.length ? h("ul", { class: "rec-list" }, list) : h("p", {}, "まだ記録がありません。ステージの「テストを実行」「記録に挑戦」を押すと、ここに残ります。"), recs.length ? h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn secondary small", onclick: () => { if (confirm("この端末のテストの記録をすべて消します。よろしいですか？")) { store.clearRecords(); renderRecords(); } } }, "テストの記録だけ消す")) : null),
    h("section", { class: "card" }, h("h2", {}, "記録を消す"), h("p", { class: "hint" }, "次の人に端末をわたすときに使います。名前・課題・設計・プログラム・テストの記録・評価・振り返りをすべて消します。"), h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn secondary", onclick: () => { if (confirm("名前・課題・設計・プログラム・テストの記録・評価・振り返りをすべて消します。よろしいですか？")) { store.reset(); store.setPref("seenStages", []); undoHistories.clear(); toast("記録を消しました"); route(); } } }, "この端末の記録をすべて消す"))),
  );
}

// ---------------- 左メニュー ----------------
function renderNav(current) {
  const link = (href, num, title, id, done, attrs = {}) =>
    h("li", { class: done ? "done" : "", ...attrs }, h("a", { href, "aria-current": current === id ? "page" : null }, h("span", { class: "num", "aria-hidden": "true" }, done ? "✓" : num), h("span", { class: "nav-title" }, title, done ? h("span", { class: "visually-hidden" }, "（全部合格）") : null)));
  const group = (title) => h("li", { class: "nav-group", "aria-hidden": "true" }, title);
  const ol = h("ol");
  ol.append(link("#/", "⌂", "はじめに", "", false));
  for (const [lv, title] of [["basic", "基本編"], ["advanced", "発展編"]]) {
    ol.append(group(title));
    for (const s of STAGES.filter((x) => x.level === lv)) {
      const best = store.best(s.id);
      ol.append(link(`#/s/${s.id}`, s.num, s.title, `s/${s.id}`, Boolean(!s.free && best && best.passed === best.total)));
    }
  }
  ol.append(group("まとめ"));
  ol.append(link("#/eval", "★", T_EVAL, "eval", false));
  ol.append(link("#/records", "✎", "記録", "records", false));
  nav.replaceChildren(h("nav", { "aria-label": "ページ" }, ol));
}

// ---------------- ルーティング ----------------
function route() {
  flushAutosaves();
  cleanup?.();
  cleanup = null;
  const [page = "", arg] = location.hash.replace(/^#\/?/, "").split("/");
  renderNav(page === "s" ? `s/${arg}` : page);
  if (page === "s") renderStage(decodeURIComponent(arg || ""));
  else if (page === "eval") renderEval();
  else if (page === "records") renderRecords();
  else if (page === "teacher") renderTeacher();
  else renderHome();
  document.querySelector(".layout")?.classList.toggle("scn-mode", page === "s");
  window.scrollTo(0, 0);
}

function setupToggles() {
  const box = document.getElementById("display-toggles");
  const apply = () => document.documentElement.classList.toggle("large-text", Boolean(store.pref("largeText")));
  const b = h("button", { type: "button", class: "ef-btn ef-size", "data-kz-label": "大きな文字", "aria-label": "文字の大きさ(大きな文字)", "aria-pressed": store.pref("largeText") ? "true" : "false" }, "文字 ", h("span", { class: "ef-size-v" }));
  b.addEventListener("click", () => {
    store.setPref("largeText", !store.pref("largeText"));
    b.setAttribute("aria-pressed", store.pref("largeText") ? "true" : "false");
    apply();
    window.dispatchEvent(new Event("resize"));
  });
  box.replaceChildren(b);
  apply();
}

function setupTeacherKeys() {
  const word = "teacher";
  let typed = "";
  window.addEventListener("keydown", (e) => {
    const t = e.target;
    if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-word.length);
    if (typed === word) {
      typed = "";
      location.hash = "#/teacher";
    }
  });
}

function start() {
  setupToggles();
  setupTeacherKeys();
  const header = document.querySelector(".app-header");
  const setHeaderH = () => document.documentElement.style.setProperty("--header-h", `${header?.offsetHeight || 0}px`);
  setHeaderH();
  if (header && "ResizeObserver" in window) new ResizeObserver(setHeaderH).observe(header);
  window.addEventListener("hashchange", route);
  window.addEventListener("pagehide", flushAutosaves);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAutosaves();
  });
  route();
}

start();
