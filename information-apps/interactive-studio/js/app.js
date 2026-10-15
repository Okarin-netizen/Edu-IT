// 双方向コンテンツ制作スタジオ: 画面とルーティング（作品 / エディタ / 実行 / デバッグ / サーバー / ヘルプ）
import { h, toast, downloadFile, pickFile, safeFileName } from "./ui.js";
import { parse, LangError } from "./lang.js";
import { BUILTINS, toDisplay, typeName } from "./interp.js";
import { Runner, RUN_LIMITS } from "./runner.js";
import { codeToBlocks, blocksToCode, serverCommands } from "./blockmodel.js";
import { server, OP_NAMES } from "./server.js";
import { works, workToJson, workFromFile, validPartId, FORMAT, storageInfo, readBackups, clearBackups } from "./store.js";
import { SAMPLES, BLANK, isUntouchedSample } from "./samples.js";
import { ORDER, bundleSources, STRICT_CSP } from "./bundle.js";
import { createStage } from "./stage.js";
import { BlockEditor, PALETTE, CATS } from "./blocks.js";

const AUTHOR = "作成：技術 岡田";
const APP_NAME = "双方向コンテンツ制作スタジオ";
const view = document.getElementById("view");

// ---- 設定（この端末だけ） ----
const PREF_KEY = "istudio.prefs.v1";
const prefs = (() => {
  try {
    return { editorMode: "both", debugView: "code", speed: "run", delay: 500, largeText: false, ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}") };
  } catch {
    return { editorMode: "both", debugView: "code", speed: "run", delay: 500, largeText: false };
  }
})();
const savePrefs = () => {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    /* 保存できなくても動く */
  }
};

// 「大きな文字」の切りかえ（ほかの教材と同じ。IS-16）。設定は istudio.prefs.v1 に入れる
function renderToggles() {
  document.documentElement.classList.toggle("large-text", Boolean(prefs.largeText));
  const box = document.getElementById("display-toggles");
  if (!box) return;
  const b = h("button", { type: "button", class: "toggle ef-btn", "aria-pressed": prefs.largeText ? "true" : "false" }, "大きな文字");
  b.addEventListener("click", () => {
    prefs.largeText = !prefs.largeText;
    savePrefs();
    renderToggles();
    box.querySelector("button")?.focus();
  });
  box.replaceChildren(b);
}

// ---- 部品（エディタのパレットと、実行タブの「部品の配置」で共用） ----
const PART_NAME = { label: "ラベル", input: "入力ボックス", button: "ボタン" };
const PART_TEXT = { label: "ラベル", input: "ここに入力", button: "ボタン" };
function newPartId(type) {
  const base = { label: "label", input: "input", button: "button" }[type];
  let n = 1;
  while (work.ui.some((p) => p.id === `${base}${n}`)) n++;
  return `${base}${n}`;
}
// 画面に部品を1つ置いて、その名前を返す（wantId が使える名前なら、その名前で置く）
function addPart(type, wantId) {
  if (work.ui.length >= 30) {
    toast("部品は30個までです");
    return null;
  }
  const id = wantId && validPartId(wantId) && !work.ui.some((p) => p.id === wantId) ? wantId : newPartId(type);
  if (["running", "paused", "waiting", "listening"].includes(run.state)) {
    stopRun();
    toast("部品を変えたので、実行を止めました");
  }
  saveWork({ ui: [...work.ui, { type, id, text: PART_TEXT[type] }] });
  stage.setParts(work.ui);
  toast(`実行画面に${PART_NAME[type]}「${id}」を置きました`);
  return id;
}

// ---- いまの作品 ----
let work = null;
let bpWorkId = null;
function currentWork() {
  work = works.current();
  // 作品が変わったら、ブレークポイントは消す（行番号が別のプログラムになるため）
  if (work && work.id !== bpWorkId) {
    run.breakpoints.clear();
    bpWorkId = work.id;
  }
  if (!work) work = works.add({ ...SAMPLES[0] });
  return work;
}
function saveWork(patch) {
  work = works.update(work.id, patch) || work;
}
// 企画・改善メモやふりかえりを、作品 id を決めて保存する（とちゅうで作品が変わっても、書いた作品に入る）
function savePlan(id, patch) {
  const w = works.get(id);
  if (!w) return;
  const next = works.update(id, { plan: { ...w.plan, ...patch } });
  if (work && work.id === id && next) work = next;
}

// ---- ふりかえり・企画メモの自動保存（書いた文が消えないように） ----
const AUTOSAVE_HINT = "書いた文は、自動でこの端末に保存されます。";
const pendingSaves = new Map(); // まだ保存していない書きかけ（ページを移る前に保存する）
function flushSaves() {
  for (const fn of [...pendingSaves.values()]) fn();
}
window.addEventListener("pagehide", flushSaves);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushSaves();
});
// 入力して少したったら（0.4秒）・欄から出たら・ページを移るときに保存する。保存の仕方は保存ボタンと同じ
function autoSave(el, save, status) {
  const key = {};
  let timer = null;
  const run = () => {
    clearTimeout(timer);
    pendingSaves.delete(key);
    save(el.value);
    if (status) {
      status.style.color = "";
      status.textContent = "保存しました";
    }
  };
  el.addEventListener("input", () => {
    pendingSaves.set(key, run);
    clearTimeout(timer);
    timer = setTimeout(run, 400);
  });
  el.addEventListener("change", () => {
    if (pendingSaves.has(key)) run();
  });
}

// ---- 実行（ステージと実行制御は全画面で共有） ----
const run = { state: "idle", line: 0, error: null, vars: new Map(), breakpoints: new Set(), changed: new Set(), code: null, stale: false };
let runner = null;
let onRunEvent = null; // 開いている画面の更新関数

const stage = createStage({
  onButton: (id) => {
    if (!runner || !["running", "paused", "waiting", "listening"].includes(run.state)) {
      toast("先に「▶ 実行」を押してから使おう");
      return;
    }
    if (!runner.click(id)) toast(`ボタン「${id}」が押されたときのブロック（when）がありません`);
  },
});

function startRun(mode = "run") {
  runner?.stop(true);
  stage.setParts(work.ui);
  run.code = work.code;
  run.workId = work.id;
  run.stale = false;
  run.error = null;
  run.vars = new Map();
  run.changed = new Set();
  // まだない箱を数えたり読んだりしたら、0件のまま進めながら注意を出す（IS-08）
  const warnedBoxes = new Set();
  const checkBox = (box) => {
    const names = Object.keys(server.data().boxes);
    if (names.includes(box) || warnedBoxes.has(box)) return;
    warnedBoxes.add(box);
    stage.warn(`箱「${box}」はまだありません` + (names.length ? `（今ある箱: ${names.slice(0, 6).join("、")}）` : "") + "。保存したときの箱の名前と同じか確かめよう。");
  };
  const studioServer = {
    ...server,
    count: (w, box, v, eq) => (checkBox(box), server.count(w, box, v, eq)),
    list: (w, box) => (checkBox(box), server.list(w, box)),
    ranking: (w, box, n) => (checkBox(box), server.ranking(w, box, n)),
  };
  let checkedButtons = false;
  const r = (runner = new Runner({
    code: work.code,
    workTitle: work.title,
    host: {
      output: stage.output,
      clear: stage.clear,
      part: stage.part,
      partIds: stage.partIds,
      resetParts: stage.resetParts,
      request: stage.request,
      cancelRequest: stage.cancelRequest,
      net: stage.net,
      server: studioServer,
    },
    onEvent: (type, data) => {
      if (type === "state") run.state = data;
      // 「ボタンが押されたとき」のボタンが画面にないときは、待ったままにしないで知らせる（IS-07）
      if (type === "state" && data === "listening" && !checkedButtons) {
        checkedButtons = true;
        for (const id of r.interp?.handlers?.keys() || []) {
          const def = work.ui.find((p) => p.id === id);
          if (!stage.part(id)) stage.warn(`ボタン「${id}」が画面にありません。エディタのパレットの「＋ ボタンを置く」か、実行タブの「部品の配置」で置こう。`);
          else if (def && def.type !== "button") stage.warn(`「${id}」は${PART_NAME[def.type]}なので、押せません。「ボタンが押されたとき」には、ボタンの名前を選ぼう。`);
        }
      }
      else if (type === "line") run.line = data;
      else if (type === "error") run.error = data;
      else if (type === "vars") {
        const next = new Map([...data].map(([k, v]) => [k, toDisplay(v)]));
        run.changed = new Set([...next].filter(([k, v]) => run.vars.get(k) !== v).map(([k]) => k));
        run.vars = next;
        run.rawVars = data;
      }
      onRunEvent?.(type, data);
    },
  }));
  runner.breakpoints = run.breakpoints;
  runner.delay = prefs.delay;
  runner.start(mode);
}

function stopRun() {
  runner?.stop();
}

// 実行の途中でコードが変わったら、その実行は終わらせる（止まっている行がずれるため。IS-12）
function stopIfCodeChanged() {
  if (!runner || run.code === null || run.code === work.code) return;
  const active = ["running", "paused", "waiting", "listening"].includes(run.state);
  runner.stop(true);
  run.code = null;
  run.line = 0;
  run.error = null;
  run.vars = new Map();
  run.changed = new Set();
  if (active) {
    run.state = "stopped";
    run.stale = run.workId === work.id; // 別の作品に切りかえたときは、ただ止める
  }
}

const STATE_LABEL = {
  idle: "まだ実行していません",
  running: "実行中…",
  paused: "一時停止中",
  waiting: "入力を待っています",
  listening: "ボタンが押されるのを待っています",
  done: "最後まで実行しました",
  stopped: "止めました",
  error: "エラーで止まりました",
};

function errorBox() {
  const box = h("div", { class: "error-box", role: "alert", hidden: true });
  const update = () => {
    box.hidden = !run.error;
    if (!run.error) return;
    box.replaceChildren(
      h("strong", {}, run.error.line ? `${run.error.line}行目でエラー` : "エラー"),
      h("p", {}, run.error.message),
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn small secondary", onclick: () => gotoLine(run.error.line) }, "エディタで直す")),
    );
  };
  update();
  return { el: box, update };
}

// エディタを開いて、その行を選ぶ
function gotoLine(line) {
  pendingLine = line;
  if (location.hash === "#/editor") route(); // エディタの中の実行画面から押したとき
  else location.hash = "#/editor";
}
let pendingLine = 0;

// ---- 画面のわく ----
const TABS = [
  { id: "works", label: "作品" },
  { id: "editor", label: "エディタ" },
  { id: "run", label: "実行" },
  { id: "debug", label: "デバッグ" },
  { id: "server", label: "サーバー", mark: "▦" },
  { id: "help", label: "ヘルプ", mark: "?" },
  { id: "records", label: "ふりかえり・記録", mark: "✎" },
];

// 左メニュー（ほかの教材と同じ形）
function renderNav(active) {
  const nav = document.getElementById("chapter-nav");
  const item = (t, i) => h("li", {}, h("a", { href: `#/${t.id}`, "aria-current": t.id === active ? "page" : null }, h("span", { class: "num", "aria-hidden": "true" }, i < 4 ? String(i + 1) : t.mark), h("span", {}, t.label)));
  const group = (title) => h("li", { class: "nav-group", "aria-hidden": "true" }, title);
  nav.replaceChildren(
    h("nav", { "aria-label": "画面の切りかえ" }, h("ol", {}, group("作って動かす"), ...TABS.slice(0, 4).map(item), group("データとヘルプ"), item(TABS[4], 4), item(TABS[5], 5), group("記録する"), item(TABS[6], 6))),
  );
  const chip = document.getElementById("work-chip");
  if (chip) chip.textContent = work ? `作品: ${work.title}` : "";
}

function route() {
  const id = (location.hash.match(/^#\/(\w+)/) || [])[1] || "works";
  const tab = TABS.find((t) => t.id === id) ? id : "works";
  flushSaves(); // 書きかけのメモ・ふりかえり・コードを、画面を切りかえる前に保存する
  currentWork();
  stopIfCodeChanged();
  onRunEvent = null;
  renderNav(tab);
  view.replaceChildren();
  ({ works: viewWorks, editor: viewEditor, run: viewRun, debug: viewDebug, server: viewServer, help: viewHelp, records: viewRecords })[tab]();
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

const card = (...children) => h("section", { class: "card" }, ...children);

// ページの下の「つぎはこれ」。作って→使ってもらって→直す、の行き来ができるように、行き先を2つまで並べる（IS-17）
// 教材集の中では、教材集の「つぎはこれ」は同じ行き先のボタンがあると出ないので、こちらだけが出る
function nextHere(text, links) {
  return h(
    "aside",
    { class: "next-here", "aria-label": "つぎにやること" },
    h("span", { class: "next-here-label" }, "つぎはこれ"),
    h("p", {}, text),
    h("div", { class: "btn-row" }, ...links.map(([href, label, sub], i) => h("a", { class: i ? "btn secondary" : "btn", href }, label, sub ? h("span", { class: "next-sub" }, sub) : null))),
  );
}

// ================= 作品 =================
function viewWorks() {
  const all = works.all();
  const title = h("input", { type: "text", id: "work-title", value: work.title, maxlength: "40" });
  const planTitle = h("span", {}, `企画・改善メモ（「${work.title}」のメモ）`);
  title.addEventListener("change", () => {
    saveWork({ title: title.value.trim() || "名前のない作品" });
    renderNav("works");
    planTitle.textContent = `企画・改善メモ（「${work.title}」のメモ）`;
    toast("名前を保存しました");
  });
  const cmds = serverCommands(work.code);

  const planId = work.id;
  const planStatus = h("div", { class: "saved-note", "aria-live": "polite" });
  const planField = (key, label, hint) => {
    const ta = h("textarea", { id: `plan-${key}`, maxlength: key === "improve" ? "600" : "300", placeholder: hint });
    ta.value = work.plan[key] || "";
    autoSave(ta, (v) => savePlan(planId, { [key]: v }), planStatus);
    return h("div", { class: "field" }, h("label", { for: `plan-${key}` }, label), ta);
  };

  // 同じ見本がもうあるときの「前のを開く／もう1つ作る」（IS-09）
  const sampleChoice = h("div", { class: "explain sample-choice", role: "alert", hidden: true });
  view.append(
    ...[loadProblemBanner()].filter(Boolean),
    h(
      "div",
      { class: "module-head" },
      h("h1", {}, APP_NAME),
      h("p", { class: "meta" }, "使う人の入力に応じて反応し、その途中でネットワークを通してほかのコンピュータ（サーバー）とデータをやりとりする「双方向性のあるコンテンツ」を、ブロックとコードで作って、動かして、改善しよう。"),
      h("p", { class: "hint author" }, AUTHOR),
    ),
    h(
      "ol",
      { class: "flow", "aria-label": "制作の流れ" },
      h("li", {}, h("strong", {}, "問題を見つける"), "だれの、どんな困りごとを解決する？"),
      h("li", {}, h("strong", {}, "画面とプログラム"), "部品を置き、ブロックで処理を作る"),
      h("li", {}, h("strong", {}, "動かして直す"), "実行・デバッグで確かめる"),
      h("li", {}, h("strong", {}, "使ってもらう"), "感想や集計から改善する"),
    ),
    card(
      h("h2", {}, "いまの作品"),
      h("div", { class: "field" }, h("label", { for: "work-title" }, "作品の名前"), title),
      h(
        "div",
        { class: "btn-row" },
        h("a", { class: "btn", href: "#/editor" }, "🧩 エディタで作る"),
        h("a", { class: "btn secondary", href: "#/run" }, "▶ 実行する"),
        h("button", { type: "button", class: "btn secondary", onclick: exportJson }, "ファイルに保存（.json）"),
        h("button", { type: "button", class: "btn secondary", onclick: exportHtml }, "HTMLで書き出す"),
        h("button", { type: "button", class: "btn secondary", onclick: () => (resetUndo(), works.add({ ...work, title: work.title + "（コピー）" }), toast("複製しました"), route()) }, "複製"),
      ),
      h("p", { class: "hint" }, "「HTMLで書き出す」と、作品だけが動く1つのファイルができます。友だちの端末で開いて使ってもらえます（サーバーのデータは各端末の中に保存）。回答はそれぞれの端末の中にだけたまり、1つには集まりません。クラスで集計するときは、班の中で1台の端末を回して使ってもらいます。"),
      // 先生の決定: どの作品にも、サーバーとのやりとりを1つ以上入れる
      h(
        "div",
        { class: "explain server-rule" + (cmds.length ? " good" : " warn") },
        h("span", { class: "explain-label" }, "作品には、サーバーとのやりとり（server の命令）を1つ以上入れよう"),
        h(
          "p",
          { class: "server-check" },
          cmds.length
            ? h("span", { class: "status good" }, `✓ この作品はサーバーとやりとりしています（${cmds.join("・")}）`)
            : h("span", { class: "status warn" }, "この作品には、まだ server の命令がありません"),
        ),
        cmds.length ? null : h("p", { class: "hint" }, "例: アンケートの答えをサーバーに保存する（server.save）。クイズの得点をランキングに登録する（server.addScore）。エディタのパレットの「サーバー」から入れられます。"),
      ),
      h(
        "details",
        { class: "plan", open: Object.values(work.plan).some(Boolean) || null },
        h("summary", {}, planTitle),
        h("p", { class: "hint" }, "このメモは、いま開いている作品に入ります。別の作品のメモは、下の「作品の一覧」で作品を開いてから書きます。"),
        h(
          "div",
          { class: "field-row" },
          planField("who", "だれが使う？", "例: クラスの友だち、1年生"),
          planField("problem", "どんな問題・ニーズがある？", "例: 委員会のアンケートを紙で集計するのが大変"),
          planField("idea", "どう解決する？（工夫）", "例: 選ぶだけで答えられ、結果がすぐ見える"),
          planField("test", "どうやって確かめる？", "例: 3人に使ってもらい、まちがいがないか見る"),
        ),
        planField("improve", "使ってもらって、直したこと・これから直したいこと", "例: 選択肢が分かりにくいと言われたので、文を短くした"),
        h("p", { class: "hint autosave-hint" }, AUTOSAVE_HINT),
        planStatus,
      ),
    ),
    card(
      h("h2", {}, "新しく作る"),
      h(
        "div",
        { class: "module-grid" },
        sampleCard({ ...BLANK, key: "blank", desc: "何もないところから作る。", tags: [] }, sampleChoice),
        ...SAMPLES.map((s) => sampleCard(s, sampleChoice)),
      ),
      sampleChoice,
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn secondary", onclick: importWork }, "ファイルから読み込む（.json / .html）")),
    ),
    card(
      h("h2", {}, `作品の一覧（${all.length}）`),
      h("p", { class: "hint" }, "作品はこの端末のブラウザの中に自動で保存されます。別の端末へ移すときは「ファイルに保存（.json）」して、移した先で読み込みます。"),
      h(
        "ul",
        { class: "work-list" },
        all.map((w) =>
          h(
            "li",
            { class: w.id === work.id ? "current" : "" },
            h("span", { class: "wl-title" }, w.title, w.id === work.id ? h("span", { class: "status good" }, "いま開いている") : null, serverCommands(w.code).length ? h("span", { class: "tag" }, "📡 サーバーあり") : null),
            h("span", { class: "wl-date" }, new Date(w.updatedAt).toLocaleString("ja-JP")),
            h(
              "span",
              { class: "btn-row" },
              w.id !== work.id ? h("button", { type: "button", class: "btn small", onclick: () => (stopRun(), resetUndo(), works.setCurrent(w.id), route()) }, "開く") : null,
              h(
                "button",
                {
                  type: "button",
                  class: "btn small secondary",
                  onclick: () => {
                    if (!confirm(`「${w.title}」を削除しますか？（元に戻せません）`)) return;
                    works.remove(w.id);
                    route();
                  },
                },
                "削除",
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

// 前の作品を読みこめなかったときのお知らせ（データは控えとして残してある）
function loadProblemBanner() {
  const info = storageInfo();
  if (!info.failed && !info.backups && !info.blocked) return null;
  const download = () =>
    downloadFile("制作スタジオ_読みこめなかったデータ.json", JSON.stringify({ app: "interactive-studio", note: "この端末で読みこめなかった作品のデータの控え", backups: readBackups() }, null, 2));
  return h(
    "div",
    { class: "explain warn load-problem", role: "alert" },
    h("span", { class: "explain-label" }, "前の作品を読みこめませんでした"),
    h(
      "p",
      {},
      info.blocked
        ? "前のデータを消さないように、いま作ったものはこの端末に保存しません。「ファイルに保存（.json）」でファイルに残してください。先生に知らせてください。"
        : "そのときのデータは消さずに、「控え」としてこの端末に残してあります。先生に知らせてください。",
    ),
    info.backups
      ? h(
          "div",
          { class: "btn-row" },
          h("button", { type: "button", class: "btn small secondary", onclick: download }, "控えをファイルに保存"),
          h(
            "button",
            {
              type: "button",
              class: "btn small secondary",
              onclick: () => {
                if (!confirm("読みこめなかったデータの控えを消しますか？（元に戻せません）")) return;
                clearBackups();
                route();
              },
            },
            "控えを消す",
          ),
        )
      : null,
  );
}

// 見本（または空の作品）から作品を作る
function createFromSample(s) {
  flushSaves();
  stopRun();
  resetUndo();
  // いまの作品が見本のままで、企画・改善メモだけ書いてあれば、新しい作品に移すか聞く（IS-09）
  const memoKeys = ["who", "problem", "idea", "test", "improve"];
  const prev = work;
  const moveMemo =
    prev &&
    isUntouchedSample(prev) &&
    memoKeys.some((k) => prev.plan[k]) &&
    confirm(`いまの「${prev.title}」に書いた企画・改善メモを、新しい作品に移しますか？\n（OK: 移す　キャンセル: 移さない）`);
  const plan = moveMemo ? Object.fromEntries(memoKeys.map((k) => [k, prev.plan[k]])) : {};
  if (moveMemo) works.update(prev.id, { plan: { ...prev.plan, ...Object.fromEntries(memoKeys.map((k) => [k, ""])) } });
  work = works.add({ title: s.title, code: s.code, ui: s.ui, plan });
  toast(moveMemo ? `「${s.title}」を作り、メモを移しました` : `「${s.title}」を作りました`);
  location.hash = "#/editor";
}

function sampleCard(s, choice) {
  const openOld = (old) => {
    stopRun();
    resetUndo();
    works.setCurrent(old.id);
    toast(`前の「${old.title}」を開きました`);
    location.hash = "#/editor";
  };
  return h(
    "button",
    {
      type: "button",
      class: "module-card sample",
      onclick: () => {
        // 同じ見本がもう一覧にあれば、前のを開くか、もう1つ作るかを選ぶ（見本が何個も増えないように。IS-09）
        const old = s.key === "blank" ? null : works.all().find((w) => w.title === s.title);
        if (!old || !choice) return createFromSample(s);
        choice.hidden = false;
        choice.replaceChildren(
          h("p", {}, `「${s.title}」は、作品の一覧にもうあります。`),
          h(
            "div",
            { class: "btn-row" },
            h("button", { type: "button", class: "btn small", onclick: () => openOld(old) }, "前のを開く"),
            h("button", { type: "button", class: "btn small secondary", onclick: () => createFromSample(s) }, "もう1つ作る"),
            h("button", { type: "button", class: "btn small secondary", onclick: () => ((choice.hidden = true), choice.replaceChildren()) }, "やめる"),
          ),
        );
        choice.scrollIntoView({ block: "nearest" });
        choice.querySelector("button")?.focus({ preventScroll: true });
      },
    },
    h("span", { class: "mc-title" }, s.key === "blank" ? "＋ 空の作品" : s.title),
    h("span", { class: "mc-desc" }, s.desc),
    s.tags?.length ? h("span", { class: "tags" }, s.tags.map((t) => h("span", { class: "tag" }, t))) : null,
  );
}

function exportJson() {
  const name = `${safeFileName(work.title)}.json`;
  downloadFile(name, workToJson(work));
  toast(`ファイルを保存しました（ファイル名: ${name}）`);
}

async function appSource() {
  const inline = document.getElementById("studio-app");
  if (inline) return { js: inline.textContent, css: document.getElementById("studio-css")?.textContent || "" };
  const files = {};
  for (const f of ORDER) files[f] = await (await fetch(f)).text();
  return { js: bundleSources(files), css: await (await fetch("css/style.css")).text() };
}

const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function playerHtml(w, { js, css }) {
  const { id, ...rest } = w;
  void id;
  const data = JSON.stringify({ format: FORMAT, version: 1, work: rest }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${STRICT_CSP}">
<title>${escHtml(w.title)}</title>
<style id="studio-css">
${css}
</style>
</head>
<body class="player">
<header class="app-header"><span class="brand" id="player-title">${escHtml(w.title)}</span></header>
<main id="view" tabindex="-1"><noscript><p>この作品を動かすには JavaScript を有効にしてください。</p></noscript></main>
<footer class="app-footer"><p>この作品は「${APP_NAME}」（${AUTHOR}）で作りました。インターネットには接続しません。</p></footer>
<script type="application/json" id="studio-work">${data}</script>
<script id="studio-app">
${js}
</script>
</body>
</html>
`;
}

async function exportHtml() {
  try {
    const src = await appSource();
    downloadFile(`${safeFileName(work.title)}.html`, playerHtml(work, src), "text/html");
    toast("作品のHTMLファイルを保存しました");
  } catch {
    toast("HTMLを作れませんでした。単一HTML版のスタジオで試してください");
  }
}

async function importWork() {
  const f = await pickFile(".json,.html,.htm,application/json,text/html");
  if (!f) return;
  if (f.error) return toast(f.error);
  try {
    const w = workFromFile(f.text);
    stopRun();
    resetUndo();
    work = works.add(w);
    toast(`「${w.title}」を読み込みました`);
    route();
  } catch (e) {
    toast(e.message);
  }
}

// ================= エディタ =================
// 元に戻す・やり直すの記録は、作品ごとに持つ（IS-02: 別の作品のコードに置きかわらないように）。
// 作品を開く・作る・読みこむときと、エディタの外でコードが変わったときは空にする。
const hist = { workId: null, code: null, undo: [], redo: [] };
function resetUndo() {
  hist.workId = null;
  hist.code = null;
  hist.undo.length = 0;
  hist.redo.length = 0;
}
function histFor(w) {
  if (hist.workId !== w.id || (hist.code !== null && hist.code !== w.code)) {
    resetUndo();
    hist.workId = w.id;
  }
  return hist;
}
function pushUndo(w, code) {
  const hh = histFor(w);
  hh.redo.length = 0;
  if (hh.undo[hh.undo.length - 1] !== code) hh.undo.push(code);
  if (hh.undo.length > 60) hh.undo.shift();
}

function varNames(code) {
  const names = new Set();
  for (const m of code.matchAll(/(?:^|[\s;{(])(?:let\s+)?([\p{L}_$][\p{L}\p{N}_$]*)\s*(?:=(?!=)|\+=|-=)/gmu)) names.add(m[1]);
  return [...names].filter((n) => !["if", "while", "repeat", "when", "let"].includes(n)).slice(0, 60);
}

function viewEditor() {
  const datalist = h("datalist", { id: "istudio-vars" });
  const refreshVars = () => datalist.replaceChildren(...varNames(work.code).map((n) => h("option", { value: n })));
  refreshVars();

  const banner = h("div", { class: "explain warn", role: "status", hidden: true });
  const showBanner = (msg) => {
    banner.hidden = !msg;
    banner.replaceChildren(h("span", { class: "explain-label" }, "コードに誤りがあります"), h("p", {}, msg || ""));
  };

  const editor = new BlockEditor({ getParts: () => work.ui, getVars: () => varNames(work.code), varListId: "istudio-vars" });
  editor.onMessage = toast;
  const partsNote = h("div", { class: "pal-note" });
  const syncPartsNote = () => (partsNote.textContent = `いまの部品: ${work.ui.length ? work.ui.map((q) => q.id).join("、") : "なし"}`);
  syncPartsNote();
  editor.onAddPart = (type, id) => {
    const nid = addPart(type, id);
    syncPartsNote();
    return nid;
  };

  // コードにまちがいがある間は、ブロックとパレットを使えないようにする（書いた行が消えないように。IS-13）
  const lockNote = h(
    "div",
    { class: "explain warn lock-note", role: "status", hidden: true },
    h("span", { class: "explain-label" }, "コードのまちがいを直してからブロックを使おう"),
    h("p", {}, prefs.editorMode === "both" ? "右のテキストコードを直すか、「↶ 元に戻す」を押そう。" : "表示を「両方」にしてテキストコードを直すか、「↶ 元に戻す」を押そう。"),
  );
  let locked = false;
  const setLock = (on) => {
    locked = on;
    lockNote.hidden = !on;
    editor.el.inert = on;
    editor.el.classList.toggle("locked", on);
    palette.classList.toggle("locked", on);
    palette.querySelectorAll("button").forEach((b) => (b.disabled = on));
  };

  // コード欄
  const gutter = h("div", { class: "gutter", "aria-hidden": "true" });
  const ta = h("textarea", { class: "code-input", spellcheck: "false", autocapitalize: "off", autocomplete: "off", "aria-label": "テキストコード", wrap: "off" });
  ta.value = work.code;
  const refreshGutter = () => {
    const n = ta.value.split("\n").length;
    gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
    gutter.scrollTop = ta.scrollTop;
  };
  ta.addEventListener("scroll", () => (gutter.scrollTop = ta.scrollTop));

  const loadBlocks = () => {
    try {
      editor.load(codeToBlocks(work.code));
      showBanner("");
      if (locked) setLock(false);
      return true;
    } catch (e) {
      if (!(e instanceof LangError)) throw e;
      showBanner(`${e.line}行目: ${e.message}（ブロックは、コードを直すまで前のままです）`);
      if (!editor.blocks.length) editor.render();
      // まちがいが、文字で書いたコードにあるときだけ止める（ブロックの欄で作ったまちがいは、ブロックで直せる）
      setLock(blocksToCode(editor.blocks) !== work.code);
      return false;
    }
  };

  editor.onChange = (structural) => {
    if (structural) pushUndo(work, work.code);
    else histFor(work).redo.length = 0;
    const code = blocksToCode(editor.blocks);
    saveWork({ code });
    hist.code = work.code;
    syncHist();
    ta.value = code;
    refreshGutter();
    refreshVars();
    if (structural) loadBlocks();
    else {
      try {
        parse(code);
        showBanner("");
      } catch (e) {
        showBanner(`${e.line}行目: ${e.message}`);
      }
    }
  };

  let typing = null;
  let typingStart = null;
  const typingKey = {};
  // 書きかけのコードを保存する（0.35秒たったとき・元に戻す前・画面を移る前）
  const flushTyping = () => {
    clearTimeout(typing);
    pendingSaves.delete(typingKey);
    if (typingStart === null) return;
    const start = typingStart;
    typingStart = null;
    if (start !== ta.value) pushUndo(work, start);
    saveWork({ code: ta.value });
    hist.code = work.code;
    refreshVars();
    loadBlocks();
    syncHist();
  };
  ta.addEventListener("input", () => {
    if (typingStart === null) {
      histFor(work);
      typingStart = work.code;
    }
    refreshGutter();
    undoBtn.disabled = false;
    clearTimeout(typing);
    pendingSaves.set(typingKey, flushTyping);
    typing = setTimeout(flushTyping, 350);
  });
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      ta.setRangeText("  ", ta.selectionStart, ta.selectionEnd, "end");
      ta.dispatchEvent(new Event("input"));
    }
  });

  const applyCode = (code) => {
    saveWork({ code });
    hist.code = work.code;
    ta.value = code;
    refreshGutter();
    refreshVars();
    loadBlocks();
    syncHist();
  };
  const undo = () => {
    flushTyping();
    const hh = histFor(work);
    const prev = hh.undo.pop();
    if (prev === undefined) return toast("これ以上は戻せません");
    hh.redo.push(work.code);
    applyCode(prev);
  };
  const redo = () => {
    flushTyping();
    const hh = histFor(work);
    const next = hh.redo.pop();
    if (next === undefined) return toast("これ以上はやり直せません");
    hh.undo.push(work.code);
    applyCode(next);
  };
  const undoBtn = h("button", { type: "button", class: "btn small secondary", onclick: undo }, "↶ 元に戻す");
  const redoBtn = h("button", { type: "button", class: "btn small secondary", onclick: redo }, "↷ やり直す");
  function syncHist() {
    const hh = histFor(work);
    undoBtn.disabled = !hh.undo.length;
    redoBtn.disabled = !hh.redo.length;
  }

  // パレット
  const placeholder = (code) =>
    code
      .replace("$button", work.ui.find((p) => p.type === "button")?.id || "button1")
      .replace("$input", work.ui.find((p) => p.type === "input")?.id || "input1")
      .replace("$part", work.ui.find((p) => p.type === "label")?.id || work.ui[0]?.id || "label1");
  const palette = h("nav", { class: "palette", "aria-label": "ブロックのパレット" });
  // 「＋ ボタンを置く」など: ブロックではなく、実行画面に部品を置く（IS-07）
  const placePart = (type) => {
    if (!addPart(type)) return;
    syncPartsNote();
    editor.render();
  };
  for (const [cat, label] of Object.entries(CATS)) {
    const items = PALETTE.filter((p) => p.cat === cat);
    palette.append(
      h(
        "div",
        { class: "pal-group" },
        h("div", { class: "pal-title" }, label),
        ...items.map((p) =>
          p.part
            ? h("button", { type: "button", class: `pal-item pal-part cat-${cat}`, onclick: () => placePart(p.part) }, p.label)
            : h("button", { type: "button", class: `pal-item cat-${cat}`, onclick: () => editor.insertCode(placeholder(p.code)) }, p.label),
        ),
        cat === "ui" ? partsNote : null,
      ),
    );
  }

  // 「ブロック＋実行」の表示: 作りながら、すぐ横で動かして確かめる（IS-07）
  const preview = prefs.editorMode === "run" ? editorPreview() : null;

  const modeBtn = (m, label) =>
    h(
      "button",
      {
        type: "button",
        class: "seg",
        "aria-pressed": prefs.editorMode === m ? "true" : "false",
        onclick: () => {
          prefs.editorMode = m;
          savePrefs();
          route();
        },
      },
      label,
    );

  const layout = h(
    "div",
    { class: `editor-grid mode-${prefs.editorMode}` },
    h("div", { class: "pane pane-palette" }, palette),
    h(
      "div",
      { class: "pane pane-blocks" },
      h("div", { class: "pane-title" }, "ブロック", h("span", { class: "hint" }, "ブロックとブロックのすき間を押すと、「▶ ここに追加されます」がそこに動きます。⠿ をドラッグで移動。")),
      lockNote,
      editor.el,
    ),
    h("div", { class: "pane pane-code" }, h("div", { class: "pane-title" }, "テキストコード", h("span", { class: "hint" }, "書きかえるとブロックにも反映")), h("div", { class: "code-wrap" }, gutter, ta)),
    preview ? h("div", { class: "pane pane-preview" }, preview.el) : null,
  );

  view.append(
    datalist,
    h(
      "div",
      { class: "toolbar" },
      h("h1", { class: "tb-title" }, "エディタ", h("span", { class: "hint" }, work.title)),
      h("div", { class: "segmented", role: "group", "aria-label": "表示" }, modeBtn("blocks", "ブロック"), modeBtn("both", "両方"), modeBtn("code", "コード"), modeBtn("run", "ブロック＋実行")),
      undoBtn,
      redoBtn,
      h("a", { class: "btn small", href: "#/run" }, "▶ 実行タブで動かす"),
    ),
    banner,
    layout,
  );
  refreshGutter();
  loadBlocks();
  syncHist();

  if (pendingLine) {
    // route() が最後に画面の先頭へもどすので、そのあとで行を選んで見える所までスクロールする（IS-12）
    const line = pendingLine;
    pendingLine = 0;
    setTimeout(() => {
      if (!ta.isConnected) return;
      editor.highlight(line, "error-line");
      const lines = ta.value.split("\n");
      const start = lines.slice(0, line - 1).reduce((s, l) => s + l.length + 1, 0);
      const block = editor.el.querySelector(".block-head.error-line");
      if (ta.offsetParent) {
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(start, start + (lines[line - 1] || "").length);
        const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
        ta.scrollTop = Math.max(0, (line - 3) * lh);
        refreshGutter();
      }
      (block || ta).scrollIntoView({ block: "center" });
    }, 0);
  }
}

// エディタの中の小さな実行画面（「ブロック＋実行」の表示）
function editorPreview() {
  const ctl = runControls();
  const err = errorBox();
  onRunEvent = (type) => {
    if (type === "state" || type === "error") {
      ctl.update();
      err.update();
    }
  };
  const refresh = () => {
    if (!["running", "paused", "waiting", "listening"].includes(run.state)) stage.setParts(work.ui);
  };
  refresh();
  const el = h(
    "div",
    { class: "preview" },
    h("div", { class: "pane-title" }, "実行画面", h("span", { class: "hint" }, "ブロックを変えたら、もう一度「▶ 実行」")),
    ctl.el,
    h("div", { class: "stage-frame small" }, stage.el),
    err.el,
  );
  return { el, refresh };
}

// ================= 実行 =================
function runControls() {
  const status = h("span", { class: "run-status", "aria-live": "polite" });
  const runBtn = h("button", { type: "button", class: "btn", onclick: () => startRun(prefs.speed === "slow" ? "slow" : "run") }, "▶ 実行");
  const stopBtn = h("button", { type: "button", class: "btn secondary", onclick: stopRun }, "■ 停止");
  const contBtn = h("button", { type: "button", class: "btn secondary", onclick: () => runner?.continue(prefs.speed === "slow" ? "slow" : "run") }, "▶▶ 続ける");
  const update = () => {
    contBtn.hidden = run.state !== "paused";
    status.textContent = run.state === "stopped" && run.stale ? "コードが変わったので、はじめから実行し直そう" : STATE_LABEL[run.state] || "";
    status.className = `run-status st-${run.state}`;
    stopBtn.disabled = !["running", "paused", "waiting", "listening"].includes(run.state);
    runBtn.textContent = ["idle"].includes(run.state) ? "▶ 実行" : "▶ はじめから実行";
  };
  update();
  return { el: h("div", { class: "btn-row run-controls" }, runBtn, contBtn, stopBtn, status), update };
}

function viewRun() {
  if (!["running", "paused", "waiting", "listening"].includes(run.state)) stage.setParts(work.ui);
  const ctl = runControls();
  const err = errorBox();
  const designer = partsDesigner();
  onRunEvent = (type) => {
    if (type === "state" || type === "error") {
      ctl.update();
      err.update();
    }
  };
  view.append(
    h("div", { class: "toolbar" }, h("h1", { class: "tb-title" }, "実行", h("span", { class: "hint" }, work.title))),
    h(
      "div",
      { class: "run-grid" },
      h("div", {}, ctl.el, h("div", { class: "stage-frame" }, stage.el), err.el),
      card(
        h("h2", {}, "部品の配置"),
        h("p", { class: "hint" }, "入力ボックス・ボタン（入力）→ プログラム（処理）→ ラベル・表示（出力）。部品の名前は setText(\"名前\", …) や「ボタンが押されたとき」で使います。"),
        designer,
      ),
    ),
  );
}

function partsDesigner() {
  const wrap = h("div", { class: "designer" });
  const TYPE = { label: "ラベル", input: "入力ボックス", button: "ボタン" };
  const TEXT = { label: "最初に表示する文字", input: "うすく表示する説明", button: "ボタンの文字" };
  const commit = (ui, rename) => {
    if (["running", "paused", "waiting", "listening"].includes(run.state)) {
      stopRun();
      toast("部品を変えたので、実行を止めました");
    }
    let code = work.code;
    if (rename && rename.from !== rename.to) {
      const re = new RegExp(`\\b(setText|getText|when)(\\s*\\(\\s*)"${rename.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g");
      const next = code.replace(re, `$1$2"${rename.to}"`);
      if (next !== code) {
        code = next;
        toast(`プログラムの中の「${rename.from}」も「${rename.to}」に変えました`);
      }
    }
    saveWork({ ui, code });
    stage.setParts(work.ui);
    draw();
  };
  function draw() {
    const rows = work.ui.map((p, i) => {
      const id = h("input", { type: "text", value: p.id, maxlength: "20", "aria-label": `${TYPE[p.type]}の名前`, class: "mono", spellcheck: "false", autocapitalize: "off", autocorrect: "off", autocomplete: "off" });
      id.addEventListener("change", () => {
        const v = id.value.trim();
        if (!validPartId(v)) {
          toast("名前は文字で始め、スペースや記号を入れません（例: start, 答え）");
          id.value = p.id;
          return;
        }
        if (work.ui.some((q, k) => k !== i && q.id === v)) {
          toast("同じ名前の部品がすでにあります");
          id.value = p.id;
          return;
        }
        commit(work.ui.map((q, k) => (k === i ? { ...q, id: v } : q)), { from: p.id, to: v });
      });
      const text = h("input", { type: "text", value: p.text, maxlength: "200", "aria-label": TEXT[p.type], placeholder: TEXT[p.type] });
      text.addEventListener("change", () => commit(work.ui.map((q, k) => (k === i ? { ...q, text: text.value } : q))));
      const mv = (d) => {
        const ui = [...work.ui];
        [ui[i], ui[i + d]] = [ui[i + d], ui[i]];
        commit(ui);
      };
      return h(
        "li",
        { class: `part-row-edit t-${p.type}` },
        h("span", { class: "ptype" }, TYPE[p.type]),
        h("label", { class: "pfield pname" }, h("span", { class: "hint" }, "名前"), id),
        h("label", { class: "pfield ptext" }, h("span", { class: "hint" }, TEXT[p.type]), text),
        h(
          "span",
          { class: "tools" },
          h("button", { type: "button", class: "tool", "aria-label": "上へ", disabled: i === 0 || null, onclick: () => mv(-1) }, "↑"),
          h("button", { type: "button", class: "tool", "aria-label": "下へ", disabled: i === work.ui.length - 1 || null, onclick: () => mv(1) }, "↓"),
          h(
            "button",
            {
              type: "button",
              class: "tool",
              "aria-label": "削除",
              onclick: () => {
                if (!confirm(`${TYPE[p.type]}「${p.id}」を画面から消しますか？`)) return;
                commit(work.ui.filter((_, k) => k !== i));
              },
            },
            "✕",
          ),
        ),
      );
    });
    wrap.replaceChildren(
      rows.length ? h("ol", { class: "part-list" }, rows) : h("p", { class: "hint" }, "部品はまだありません。ask や choose だけでも作品は作れます。エディタのパレットの「＋ ボタンを置く」などでも置けます。"),
      h(
        "div",
        { class: "btn-row" },
        ...["label", "input", "button"].map((t) =>
          h("button", { type: "button", class: "btn small secondary", disabled: work.ui.length >= 30 || null, onclick: () => commit([...work.ui, { type: t, id: newPartId(t), text: PART_TEXT[t] }]) }, `＋ ${TYPE[t]}`),
        ),
      ),
    );
  }
  draw();
  return wrap;
}

// ================= デバッグ =================
function viewDebug() {
  const err = errorBox();
  const status = h("p", { class: "debug-status", "aria-live": "polite" });
  const watchBody = h("tbody");
  const listing = h("ol", { class: "listing", "aria-label": "プログラム" });
  let blockView = null;

  const lines = work.code.split("\n");
  let program = null;
  try {
    program = parse(work.code);
  } catch {
    program = null;
  }
  void program;
  lines.forEach((text, i) => {
    const n = i + 1;
    const bp = h("button", { type: "button", class: "bp", "aria-pressed": run.breakpoints.has(n) ? "true" : "false", "aria-label": `${n}行目で止める`, title: "押すと、この行の前で止まる（ブレークポイント）" }, String(n));
    bp.addEventListener("click", () => {
      if (run.breakpoints.has(n)) run.breakpoints.delete(n);
      else run.breakpoints.add(n);
      bp.setAttribute("aria-pressed", run.breakpoints.has(n) ? "true" : "false");
    });
    listing.append(h("li", { dataset: { line: n } }, bp, h("code", {}, text || " ")));
  });

  if (prefs.debugView === "blocks") {
    blockView = new BlockEditor({ readOnly: true, getParts: () => work.ui });
    try {
      blockView.load(codeToBlocks(work.code));
    } catch (e) {
      blockView.el.replaceChildren(h("p", { class: "hint" }, `コードに誤りがあるのでブロックを表示できません（${e.line}行目: ${e.message}）`));
    }
  }

  const btn = (label, fn, cls = "btn small secondary") => h("button", { type: "button", class: cls, onclick: fn }, label);
  const b = {
    run: btn("▶ 実行", () => startRun(prefs.speed === "slow" ? "slow" : "run"), "btn small"),
    stepStart: btn("⏭ 1つずつ実行", () => startRun("step")),
    step: btn("👣 1つ進む", () => runner?.step()),
    cont: btn("▶▶ 続ける", () => runner?.continue(prefs.speed === "slow" ? "slow" : "run")),
    pause: btn("⏸ 一時停止", () => runner?.pause()),
    stop: btn("■ 停止", stopRun),
  };
  const speed = h("select", { "aria-label": "実行の速さ" }, h("option", { value: "run" }, "速さ: ふつう"), h("option", { value: "slow" }, "速さ: ゆっくり"));
  speed.value = prefs.speed;
  const delay = h("input", { type: "range", min: "100", max: "1500", step: "100", value: String(prefs.delay), "aria-label": "ゆっくりの間隔" });
  const delayLabel = h("span", { class: "hint" });
  const syncSpeed = () => {
    delayLabel.textContent = `1歩 ${(prefs.delay / 1000).toFixed(1)}秒`;
    delay.disabled = prefs.speed !== "slow";
  };
  speed.addEventListener("change", () => {
    prefs.speed = speed.value;
    savePrefs();
    if (runner && run.state === "running") runner.setMode(prefs.speed);
    syncSpeed();
  });
  delay.addEventListener("input", () => {
    prefs.delay = Number(delay.value);
    savePrefs();
    if (runner) runner.delay = prefs.delay;
    syncSpeed();
  });
  syncSpeed();

  const update = (type) => {
    const st = run.state;
    const active = ["running", "paused", "waiting", "listening"].includes(st);
    b.step.disabled = st !== "paused";
    b.cont.disabled = st !== "paused";
    b.pause.disabled = st !== "running";
    b.stop.disabled = !active;
    status.textContent =
      st === "paused" && run.line
        ? `一時停止中: ${run.line}行目を実行する直前です（黄色の行）`
        : st === "error"
          ? `エラーで止まりました（${run.error?.line || "?"}行目）`
          : st === "stopped" && run.stale
            ? "コードが変わったので、はじめから実行し直そう"
            : STATE_LABEL[st];
    if (type !== "vars") {
      listing.querySelectorAll("li.now, li.err").forEach((li) => li.classList.remove("now", "err"));
      const lineNow = st === "error" ? run.error?.line : run.line;
      if (lineNow) {
        const li = listing.querySelector(`li[data-line="${lineNow}"]`);
        li?.classList.add(st === "error" ? "err" : "now");
        li?.scrollIntoView({ block: "nearest" });
      }
      blockView?.highlight(st === "error" ? 0 : run.line, "running");
      blockView?.highlight(st === "error" ? run.error?.line : 0, "error-line");
    }
    if (type === undefined || type === "vars" || type === "state") {
      const rows = [...run.vars].map(([k, v]) =>
        h("tr", { class: run.changed.has(k) ? "changed" : "" }, h("th", { scope: "row" }, k), h("td", { class: "mono" }, v.length > 120 ? v.slice(0, 120) + "…" : v), h("td", {}, typeName(run.rawVars?.get(k)))),
      );
      watchBody.replaceChildren(...(rows.length ? rows : [h("tr", {}, h("td", { colspan: "3", class: "hint" }, "変数はまだありません"))]));
    }
    err.update();
  };
  onRunEvent = update;

  const viewBtn = (m, label) =>
    h(
      "button",
      {
        type: "button",
        class: "seg",
        "aria-pressed": prefs.debugView === m ? "true" : "false",
        onclick: () => {
          prefs.debugView = m;
          savePrefs();
          route();
        },
      },
      label,
    );

  view.append(
    h("div", { class: "toolbar" }, h("h1", { class: "tb-title" }, "デバッグ", h("span", { class: "hint" }, work.title))),
    h("div", { class: "btn-row debug-controls" }, b.run, b.stepStart, b.step, b.cont, b.pause, b.stop, speed, delay, delayLabel),
    status,
    h(
      "div",
      { class: "debug-grid" },
      card(
        h("div", { class: "pane-title" }, "プログラム", h("div", { class: "segmented", role: "group", "aria-label": "表示" }, viewBtn("code", "コード"), viewBtn("blocks", "ブロック"))),
        h("p", { class: "hint" }, prefs.debugView === "code" ? "行番号を押すと、その行の前で止まります（ブレークポイント）。" : "実行中のブロックが黄色になります。"),
        prefs.debugView === "blocks" ? blockView.el : listing,
      ),
      h(
        "div",
        {},
        err.el,
        card(h("h2", {}, "変数ウォッチ"), h("div", { class: "table-wrap" }, h("table", { class: "data watch" }, h("thead", {}, h("tr", {}, h("th", {}, "変数"), h("th", {}, "いまの値"), h("th", {}, "種類"))), watchBody)), h("p", { class: "hint" }, "色がついた行は、さっき値が変わった変数です。")),
        h("div", { class: "stage-frame small" }, stage.el),
      ),
    ),
    nextHere("思いどおりに動いたら、友だちに使ってもらい、集まったデータを見よう。", [
      ["#/server", "サーバーのデータを見る →"],
      ["#/records", "ふりかえり・記録 →", "（サーバーを使わない作品）"],
    ]),
  );
  if (!["running", "paused", "waiting", "listening"].includes(run.state)) stage.setParts(work.ui);
  update();
}

// ================= サーバー =================
function viewServer() {
  const body = h("div");
  const draw = () => {
    const d = server.data();
    const boxes = Object.entries(d.boxes);
    body.replaceChildren(
      card(
        h("h2", {}, `サーバーの箱（${boxes.length}）`),
        boxes.length
          ? h("div", { class: "box-grid" }, boxes.map(([name, box]) => boxCard(name, box)))
          : h("p", { class: "hint" }, "まだデータはありません。アンケート集計や計算チャレンジのひな形を実行してみよう。"),
        h(
          "div",
          { class: "btn-row" },
          h("button", { type: "button", class: "btn small secondary", disabled: !boxes.length || null, onclick: exportServerCsv }, "CSVで書き出す"),
          h(
            "button",
            {
              type: "button",
              class: "btn small secondary",
              onclick: () => {
                if (confirm("サーバーのデータとログを全部消しますか？（元に戻せません）")) server.clearAll();
              },
            },
            "全部消す",
          ),
        ),
      ),
      card(
        h("h2", {}, "通信ログ（新しい順）"),
        h("p", { class: "hint" }, "作品（クライアント）からサーバーへの「お願い（リクエスト）」と、サーバーの「返事（レスポンス）」の記録です。"),
        d.log.length
          ? h(
              "div",
              { class: "table-wrap log-wrap" },
              h(
                "table",
                { class: "data" },
                h("thead", {}, h("tr", {}, h("th", {}, "時刻"), h("th", {}, "作品"), h("th", {}, "お願い"), h("th", {}, "箱"), h("th", {}, "内容"), h("th", {}, "返事"))),
                h(
                  "tbody",
                  {},
                  [...d.log].reverse().slice(0, 150).map((l) =>
                    h("tr", {}, h("td", { class: "mono" }, new Date(l.at).toLocaleTimeString("ja-JP")), h("td", {}, l.work), h("td", {}, OP_NAMES[l.op] || l.op), h("td", {}, l.box), h("td", {}, l.detail), h("td", {}, l.result)),
                  ),
                ),
              ),
            )
          : h("p", { class: "hint" }, "ログはまだありません。"),
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn small secondary", disabled: !d.log.length || null, onclick: () => server.clearLog() }, "ログを消す")),
      ),
    );
  };
  const unsub = server.subscribe(() => {
    if (!body.isConnected) return unsub();
    draw();
  });
  draw();
  view.append(
    h("div", { class: "toolbar" }, h("h1", { class: "tb-title" }, "サーバー")),
    card(
      h(
        "div",
        { class: "cs-diagram", "aria-label": "クライアントとサーバーの関係" },
        h("div", { class: "cs-node" }, h("span", { class: "emoji", "aria-hidden": "true" }, "💻"), h("strong", {}, "作品（クライアント）"), h("span", { class: "hint" }, "入力を受け取り、表示する")),
        h("div", { class: "cs-arrows" }, h("span", {}, "お願い →"), h("span", { class: "mono" }, "server.save など"), h("span", {}, "← 返事")),
        h("div", { class: "cs-node" }, h("span", { class: "emoji", "aria-hidden": "true" }, "🗄"), h("strong", {}, "サーバー"), h("span", { class: "hint" }, "データを保存・集計する")),
      ),
      h(
        "div",
        { class: "real-vs-model" },
        h(
          "div",
          { class: "explain" },
          h("span", { class: "explain-label" }, "本物では"),
          h("p", {}, "作品（クライアント）は、ネットワーク（学校のLANやインターネット）を通って、別の場所にあるサーバーにお願いを送り、返事を受け取ります。みんなの端末が同じサーバーにつながるので、クラス全員の回答を集計できます。"),
        ),
        h(
          "div",
          { class: "explain warn" },
          h("span", { class: "explain-label" }, "この教材では"),
          h("p", {}, "サーバー役もこの端末のブラウザの中にある模型です。お願い→返事の流れは本物と同じですが、ほかの端末の回答は集まりません。本物のインターネットにはつながらず、データはこの端末のこのブラウザの中だけに保存されます。"),
        ),
      ),
      // 先生の決定: クラスのアンケートの集め方
      h(
        "div",
        { class: "explain good class-survey-tip" },
        h("span", { class: "explain-label" }, "クラスでアンケートをとるとき"),
        h("p", {}, "クラスのアンケートは、班の中で1台の端末を回して答えてもらおう（この教材のサーバーは、端末ごとの模型です）。"),
      ),
    ),
    body,
    nextHere("改善点が見つかったら、エディタで直そう。直したら、もう一度動かして確かめよう。", [
      ["#/editor", "エディタへ →"],
      ["#/records", "ふりかえり・記録 →"],
    ]),
  );
}

function boxCard(name, box) {
  const recs = box.records || [];
  let content;
  if (box.type === "scores") {
    const top = [...recs].sort((a, b) => b.score - a.score || a.at.localeCompare(b.at)).slice(0, 10);
    content = h(
      "div",
      {},
      h("p", { class: "hint" }, "ランキングにはニックネームを使おう。授業の終わりに「全部消す」で消そう。"),
      h(
        "table",
        { class: "data" },
        h("thead", {}, h("tr", {}, h("th", {}, "順位"), h("th", {}, "名前"), h("th", {}, "得点"))),
        h("tbody", {}, top.map((r, i) => h("tr", {}, h("td", {}, `${i + 1}位`), h("td", {}, r.name), h("td", {}, String(r.score))))),
      ),
    );
  } else {
    const counts = new Map();
    for (const r of recs) counts.set(String(r.v), (counts.get(String(r.v)) || 0) + 1);
    const rows = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 12);
    const max = Math.max(1, ...rows.map((r) => r[1]));
    content = h(
      "ul",
      { class: "tally" },
      rows.map(([v, n]) => h("li", {}, h("span", { class: "tv" }, v), h("span", { class: "tbar" }, h("span", { style: `width:${(n / max) * 100}%` })), h("span", { class: "tn" }, `${n}件`))),
    );
  }
  return h(
    "div",
    { class: "box-card" },
    h("div", { class: "box-head" }, h("strong", {}, `🗃 ${name}`), h("span", { class: "hint" }, `${recs.length}件・${box.type === "scores" ? "ランキング" : "値"}`)),
    content,
    h(
      "button",
      {
        type: "button",
        class: "btn small secondary",
        onclick: () => {
          if (confirm(`箱「${name}」を空にしますか？`)) server.clearBox(name);
        },
      },
      "この箱を空にする",
    ),
  );
}

function exportServerCsv() {
  const d = server.data();
  const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const rows = [["箱", "値または名前", "得点", "時刻", "作品"].map(q).join(",")];
  for (const [name, box] of Object.entries(d.boxes)) for (const r of box.records) rows.push([name, r.v ?? r.name, r.score ?? "", r.at, r.work].map(q).join(","));
  downloadFile("サーバーのデータ.csv", "﻿" + rows.join("\r\n"), "text/csv");
}

// ================= ふりかえり・記録（ほかの教材と同じ形） =================
const STUDENT_KEY = "istudio.student.v1";
function loadStudent() {
  try {
    return { cls: "", num: "", name: "", ...JSON.parse(localStorage.getItem(STUDENT_KEY) || "{}") };
  } catch {
    return { cls: "", num: "", name: "" };
  }
}
function saveStudent(st) {
  try {
    localStorage.setItem(STUDENT_KEY, JSON.stringify(st));
  } catch {
    /* 保存できない環境でも、書き出しには使える */
  }
}

function viewRecords() {
  const st = loadStudent();
  const inputs = {};
  const fields = [
    ["cls", "組"],
    ["num", "番号"],
    ["name", "名前"],
  ].map(([k, label]) => {
    const input = (inputs[k] = h("input", { type: "text", id: `stu-${k}`, maxlength: "20", value: st[k] || "" }));
    input.addEventListener("change", () => {
      st[k] = input.value.trim();
      saveStudent(st);
    });
    return h("div", { class: "field" }, h("label", { for: `stu-${k}` }, label), input);
  });

  const ta = h("textarea", { id: "reflect-work", maxlength: "600", placeholder: "例: 選ぶだけで答えられるようにしたら、友だちがすぐ使えた。結果がすぐ出るので、自分の答えとくらべられるのがよかった" });
  ta.value = work.plan.reflect || "";
  const note = h("div", { class: "saved-note", "aria-live": "polite" });
  const saveBtn = h("button", { class: "btn", type: "button" }, "ふりかえりを保存");
  const reflectId = work.id;
  saveBtn.addEventListener("click", () => {
    const text = ta.value.trim();
    if (text.length < 5) {
      note.textContent = "もう少し書いてみよう（5文字以上）";
      note.style.color = "var(--warn)";
      return;
    }
    savePlan(reflectId, { reflect: text });
    note.style.color = "";
    note.textContent = "この端末に保存しました";
    drawTable();
  });
  // 保存ボタンを押さなくても、書いたところまで自動で保存する（保存ボタンと同じ場所に入る）
  autoSave(
    ta,
    (v) => {
      savePlan(reflectId, { reflect: v.trim() });
      drawTable();
    },
    note,
  );

  // 記録に出すのは、メモかふりかえりを書いた作品と、自分で作りかえた作品だけ（さわっただけの見本は出さない。IS-09）
  const recordWorks = () => works.all().filter((w) => Object.values(w.plan).some(Boolean) || !isUntouchedSample(w));
  const serverText = (cmds) => (cmds.length ? `あり（${cmds.join("・")}）` : "なし");
  const tbody = h("tbody");
  const drawTable = () => {
    const list = recordWorks();
    tbody.replaceChildren(
      ...(list.length
        ? list.map((w) =>
            h(
              "tr",
              {},
              h("td", {}, w.title),
              h("td", {}, [w.plan.who, w.plan.problem].filter(Boolean).join("／") || "—"),
              h("td", {}, w.plan.improve || "—"),
              h("td", {}, w.plan.reflect || "—"),
              h("td", { class: "nowrap" }, serverCommands(w.code).length ? "あり" : "なし"),
            ),
          )
        : [h("tr", {}, h("td", { colspan: "5", class: "hint" }, "まだありません。作品タブの「企画・改善メモ」か、上のふりかえりを書こう。"))]),
    );
  };
  drawTable();

  const who = () => [st.cls, st.num, st.name].filter(Boolean).join("-") || "記録";
  const rows = () =>
    recordWorks().map((w) => {
      const cmds = serverCommands(w.code);
      return { title: w.title, usesServer: cmds.length > 0, serverCommands: cmds, who: w.plan.who, problem: w.plan.problem, idea: w.plan.idea, test: w.plan.test, improve: w.plan.improve, reflect: w.plan.reflect, updatedAt: w.updatedAt };
    });
  // 書き出す前に、組と番号が入っているか確かめる（ほかの教材と同じ）
  const exportNote = h("span", { class: "export-note", role: "status", "aria-live": "polite" });
  const say = (text, kind) => {
    exportNote.textContent = text;
    exportNote.className = `export-note ${kind}`;
  };
  const ready = () => {
    for (const k of Object.keys(inputs)) st[k] = inputs[k].value.trim();
    saveStudent(st);
    if (!st.cls || !st.num) {
      say("組と番号を入れてから書き出そう", "warn");
      return false;
    }
    if (!rows().length) {
      say("まだ書き出す作品がありません。企画・改善メモか、ふりかえりを書こう", "warn");
      return false;
    }
    return true;
  };
  const saved = (name) => say(`ファイルを保存しました（ファイル名: ${name}）。先生に言われた場所に出そう。`, "good");
  const exportJson = () => {
    if (!ready()) return;
    const name = `制作スタジオ_${who()}.json`;
    downloadFile(name, JSON.stringify({ app: "interactive-studio", version: 1, exportedAt: new Date().toISOString(), student: st, works: rows() }, null, 2));
    saved(name);
  };
  const exportCsv = () => {
    if (!ready()) return;
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["組", "番号", "名前", "作品", "サーバーとのやりとり", "だれが使う", "問題・ニーズ", "解決の工夫", "確かめ方", "直したこと", "ふりかえり", "更新日時"].map(q).join(",")];
    for (const r of rows()) lines.push([st.cls, st.num, st.name, r.title, serverText(r.serverCommands), r.who, r.problem, r.idea, r.test, r.improve, r.reflect, r.updatedAt].map(q).join(","));
    const name = `制作スタジオ_${who()}.csv`;
    downloadFile(name, "\ufeff" + lines.join("\r\n"), "text/csv");
    saved(name);
  };

  view.append(
    h("div", { class: "module-head" }, h("h1", {}, "ふりかえり・記録"), h("p", { class: "meta" }, "記録はこの端末のブラウザの中だけに保存されます。提出するときは書き出したファイルを先生に渡します。")),
    card(h("h2", {}, "名前"), h("div", { class: "field-row" }, fields), h("p", { class: "hint" }, "名前は書き出したファイルに入ります。この端末にも残るので、みんなで使う端末では、最後に「この端末の記録をすべて消す」を押します。")),
    h(
      "section",
      { class: "card reflection" },
      h("h2", {}, `ふりかえり：${work.title}`),
      h("label", { for: "reflect-work" }, "この作品で、使う人とのやりとり（双方向性）をどう工夫した？ サーバーとのやりとり（通信）を、どこでどう使った？ 使ってもらって分かったことは？"),
      h("div", { class: "hint" }, "作品タブの「企画・改善メモ」とあわせて、学んだことを自分の言葉でまとめよう。別の作品のふりかえりは、作品タブで作品を切りかえてから書きます。"),
      ta,
      h("p", { class: "hint autosave-hint" }, AUTOSAVE_HINT),
      h("div", { class: "btn-row" }, saveBtn),
      note,
    ),
    card(
      h("h2", {}, "作品ごとの記録"),
      h("p", { class: "hint" }, "表と書き出すファイルに入るのは、企画・改善メモかふりかえりを書いた作品と、自分で作りかえた作品です（さわっただけの見本は入りません）。「サーバー」は、server の命令が入っているかどうかです。"),
      h(
        "div",
        { class: "table-wrap" },
        h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "作品"), h("th", {}, "だれの・どんな問題"), h("th", {}, "直したこと"), h("th", {}, "ふりかえり"), h("th", {}, "サーバー"))), tbody),
      ),
      h("p", { class: "hint hand-in" }, "先生に出すのは JSON のファイルです（CSV は、表計算ソフトで見るときに使います）。"),
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn", onclick: exportJson }, "記録を書き出す（JSON）"), h("button", { type: "button", class: "btn secondary", onclick: exportCsv }, "CSVで書き出す"), exportNote),
    ),
    card(
      h("h2", {}, "記録を消す"),
      h("p", { class: "hint" }, "次の人に端末をわたすときに使います。名前・作った作品（企画・改善メモ・ふりかえりをふくむ）・サーバーのデータとログをすべて消し、はじめの状態にもどします。"),
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn secondary", onclick: resetAll }, "この端末の記録をすべて消す")),
    ),
  );
}

function resetAll() {
  if (!confirm("名前・作った作品・サーバーのデータをすべて消します。よろしいですか？（元に戻せません）")) return;
  stopRun();
  pendingSaves.clear();
  resetUndo();
  works.reset();
  server.clearAll();
  try {
    localStorage.removeItem(STUDENT_KEY);
  } catch {
    /* 何もしない */
  }
  work = null;
  toast("記録を消しました");
  route();
}

// ================= ヘルプ =================
function viewHelp() {
  // ブロックの名前は、パレットの名前とそろえる（IS-15）
  const syntax = [
    ["io", "表示する", 'show("こんにちは");'],
    ["io", "文字と変数をつなげて表示", 'show("得点は" + score + "点");'],
    ["io", "たずねる（入力）", 'let name = ask("名前は？");'],
    ["io", "選ばせる（ボタン）", 'let a = choose("どれ？", "A", "B");'],
    ["var", "変数に入れる", "let score = 0;"],
    ["var", "変数を増やす", "score += 1;"],
    ["var", "リストを作る（と、取り出す）", 'let names = ["A", "B"];\nshow(names[0]);'],
    ["ctrl", "もし〜でなければ", 'if (a == "A") {\n  show("正解");\n} else {\n  show("ざんねん");\n}'],
    ["ctrl", "回数くり返す", "repeat (3) {\n  show(\"!\");\n}"],
    ["ctrl", "条件でくり返す", "while (i < 10) {\n  i += 1;\n}"],
    ["event", "ボタンが押されたとき", 'when ("start") {\n  show("押された");\n}'],
    ["ui", "部品の文字を変える", 'setText("result", "合計 " + score);'],
    ["server", "サーバーに保存", 'server.save("アンケート", answer);'],
    ["other", "メモ（実行されない）", "// ここに説明を書く"],
  ];
  const cats = {};
  for (const [name, b] of Object.entries(BUILTINS)) (cats[b.cat] ||= []).push([name, b]);
  view.append(
    h("div", { class: "toolbar" }, h("h1", { class: "tb-title" }, "ヘルプ")),
    // 教科書の言葉（順次・分岐・反復）と、この教材のブロックの対応（IS-15）
    card(
      h("h2", {}, "プログラムの3つの基本と、イベント"),
      h(
        "ul",
        { class: "basics" },
        h("li", {}, h("strong", {}, "順次"), "：プログラムは、上から順に1つずつ実行されます。"),
        h("li", {}, h("strong", {}, "分岐"), "：「もし」で、条件によって実行することが分かれます（パレットの「分岐と反復（くり返し）」）。"),
        h("li", {}, h("strong", {}, "反復"), "：「回数くり返す」「条件でくり返す」で、同じことを何度も実行します。"),
        h("li", {}, h("strong", {}, "イベント"), "：「ボタンが押されたとき」の中は、ボタンが押される（イベント）たびに実行されます。"),
      ),
    ),
    card(
      h("h2", {}, "ブロックとコードの対応"),
      h("p", { class: "hint" }, "ブロックの名前は、エディタのパレットの名前と同じです。"),
      h(
        "div",
        { class: "table-wrap" },
        h(
          "table",
          { class: "data" },
          h("thead", {}, h("tr", {}, h("th", {}, "パレットの分類"), h("th", {}, "ブロック"), h("th", {}, "テキストコード"))),
          h("tbody", {}, syntax.map(([cat, a, c]) => h("tr", {}, h("td", { class: "hint" }, CATS[cat]), h("td", {}, a), h("td", {}, h("pre", { class: "code-sample" }, c))))),
        ),
      ),
    ),
    card(
      h("h2", {}, "命令の一覧"),
      Object.entries(cats).map(([cat, list]) =>
        h("div", {}, h("h3", {}, cat), h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("tbody", {}, list.map(([, b]) => h("tr", {}, h("td", { class: "mono nowrap" }, b.sig), h("td", {}, b.help))))))),
      ),
    ),
    card(
      h("h2", {}, "書き方のきまり"),
      h(
        "ul",
        {},
        h("li", {}, "文字は \" \" でかこみます（ブロックの「文字」モードでは自動で付きます）。記号やかっこは半角で書きます。"),
        h("li", {}, "「=」は変数に入れる、「==」は同じかどうか比べる、です。ちがうときは「!=」。"),
        h("li", {}, "条件は and（かつ）、or（または）、not（〜でない）でつなげられます。"),
        h("li", {}, "ask の答えが数字だけなら、数として受け取ります（全角の数字もOK）。"),
        h("li", {}, "リストの番号は 0 から数えます。names[0] が1つ目です。"),
        h("li", {}, "文字と数を + でつなぐと、文字としてつながります（例: \"合計\" + 3 → 合計3）。"),
      ),
    ),
    card(
      h("h2", {}, "安全のしくみ"),
      h(
        "ul",
        {},
        h("li", {}, "作ったプログラムは、このスタジオの中の小さな「通訳（インタプリタ）」が1つずつ実行します。使えるのは上の命令だけで、ほかのページや本物のネットワークには触れられません。"),
        h("li", {}, `終わらないくり返し（無限ループ）は、${RUN_LIMITS.maxActiveMs / 1000}秒たつか、命令を ${RUN_LIMITS.maxSteps.toLocaleString()} 回実行すると自動で止まります。いつでも「■ 停止」で止められます。`),
        h("li", {}, "表示は最新の300行まで、文字は2万文字まで、リストは1万個までです。"),
        h("li", {}, "作品とサーバーのデータは、この端末のブラウザの中だけに保存されます。"),
      ),
    ),
  );
}

// ================= 書き出したHTML（プレイヤー） =================
function bootPlayer(data) {
  const w = data && data.work;
  work = { ...w, id: "player", ui: Array.isArray(w?.ui) ? w.ui : [], code: String(w?.code || ""), title: String(w?.title || "作品") };
  const ctl = runControls();
  const err = errorBox();
  err.el.querySelector?.(".btn-row")?.remove();
  onRunEvent = (type) => {
    if (type === "state" || type === "error") {
      ctl.update();
      err.update();
      err.el.querySelector(".btn-row")?.remove();
    }
  };
  stage.setParts(work.ui);
  view.append(h("div", { class: "player-wrap" }, ctl.el, h("div", { class: "stage-frame" }, stage.el), err.el));
  startRun("run");
}

function boot() {
  const embedded = document.getElementById("studio-work");
  if (embedded) {
    try {
      bootPlayer(JSON.parse(embedded.textContent));
    } catch {
      view.append(h("p", {}, "作品のデータを読めませんでした。"));
    }
    return;
  }
  renderToggles();
  window.addEventListener("hashchange", route);
  route();
  if (storageInfo().failed) toast("前の作品を読みこめませんでした");
  if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !document.getElementById("studio-app")) navigator.serviceWorker.register("sw.js").catch(() => {});
}

boot();
