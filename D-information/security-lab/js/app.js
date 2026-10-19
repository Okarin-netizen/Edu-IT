// アプリ本体: 章ナビ、ルーティング、進捗表示、表示の切りかえ（ふりがな・やさしい日本語・文字の大きさ）
import { store } from "./store.js";
import { h, explainCard, threeSteps, flushReflections, furikaeriOn, recordsTitle } from "./ui.js";
import { availableModules, moduleProgress, GROUPS, EASY_STEPS, EASY_PAGES } from "./catalog.js";
import { getConfig, pref, setPref, setRubyEnabled } from "./settings.js";
import { renderRecords, renderTeacher } from "./records.js";
import { renderCheck } from "./check.js";

const view = document.getElementById("view");
const nav = document.getElementById("chapter-nav");
const overall = document.getElementById("overall-progress");
const toggles = document.getElementById("display-toggles");

let config = {};
let available = [];

function parseHash() {
  const [id = "home", step = null] = location.hash.replace(/^#\/?/, "").split("/");
  return { id: id || "home", step };
}

function renderNav(currentId) {
  const ol = h("ol");
  const link = (href, num, title, id, done) =>
    h(
      "li",
      { class: done ? "done" : "" },
      h("a", { href, "aria-current": currentId === id ? "page" : null }, h("span", { class: "num", "aria-hidden": "true" }, done ? "✓" : num), h("span", {}, title, done ? h("span", { class: "visually-hidden" }, "（完了）") : null)),
    );
  ol.append(link("#/", "⌂", "はじめに", "home", false));
  for (const g of GROUPS) {
    const mods = available.filter((c) => c.group === g.id);
    if (!mods.length) continue;
    ol.append(h("li", { class: "nav-group", "aria-hidden": "true" }, g.title));
    for (const c of mods) ol.append(link(`#/${c.id}`, c.num, c.title, c.id, moduleProgress(c).complete));
  }
  ol.append(h("li", { class: "nav-group", "aria-hidden": "true" }, "確かめる・記録する"));
  ol.append(link("#/check", "?", "理解度チェック", "check", false));
  ol.append(link("#/records", "✎", recordsTitle(), "records", false));
  // 先生用ページは章ナビに出さない（SEC-54）。先生はアドレスの最後に #/teacher を付けて開く
  const next = h("nav", { "aria-label": "章ナビゲーション" }, ol);
  // 中身が同じなら書きかえない（ふりかえりの自動保存のたびに、押そうとしたリンクやフォーカスが消えないように）
  if (nav.firstElementChild?.outerHTML === next.outerHTML) return;
  nav.replaceChildren(next);
  showCurrentInNav();
}

// 章ナビが画面より長いときは、章ナビの中だけをスクロールして、今のページを見えるところに出す（SEC-22）
function showCurrentInNav() {
  if (nav.scrollHeight <= nav.clientHeight + 1) return;
  const a = nav.querySelector('[aria-current="page"]');
  if (!a) return;
  const nr = nav.getBoundingClientRect();
  const ar = a.getBoundingClientRect();
  if (ar.top < nr.top || ar.bottom > nr.bottom) nav.scrollTop += ar.top - nr.top - (nr.height - ar.height) / 2;
}

// 上の固定バーの高さ（見出しがバーの下にかくれないように: SEC-61、章ナビの高さ: SEC-22）
const header = document.querySelector(".app-header");
const setHeaderHeight = () => document.documentElement.style.setProperty("--header-h", `${Math.ceil(header.getBoundingClientRect().height)}px`);
setHeaderHeight();
if ("ResizeObserver" in window) new ResizeObserver(setHeaderHeight).observe(header);
else window.addEventListener("resize", setHeaderHeight);

function renderOverall() {
  const all = available.map(moduleProgress);
  const done = all.reduce((a, p) => a + p.done, 0);
  const total = all.reduce((a, p) => a + p.total, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  overall.replaceChildren(
    h("span", {}, "進み具合"),
    h("div", { class: "bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": pct, "aria-label": "全体の進み具合" }, h("span", { style: `width:${pct}%` })),
    h("span", {}, `${pct}%`),
  );
}

// 表示の切りかえ。押しても画面は作り直さない（やりかけの入力・選んだもの・場所はそのまま: SEC-11）。
// ボタン: #display-toggles button[data-pref="ruby" | "easy" | "largeText"]、今の状態は aria-pressed(文字の大きさは「文字 中/大」の .ef-size)。
// 教材集などの外側からは、このボタンを click() すれば切りかわる（状態は localStorage "seclab.prefs" に残る）。
async function renderToggles() {
  const items = [
    ["ruby", "ふりがな"],
    ["largeText", "大きな文字"],
    ["easy", "やさしい日本語のまとめ"],
  ];
  const buttons = await Promise.all(
    items.map(async ([key, label]) => {
      const on = Boolean(await pref(key));
      // ふりがな・やさしい日本語は ✓ の付く切りかえ(.ef-toggle)、文字の大きさは4分野共通の「文字 中/大」ボタン(.ef-size)
      const b =
        key === "largeText"
          ? h("button", { type: "button", class: "ef-btn ef-size", "data-pref": key, "data-kz-label": "大きな文字", "aria-label": "文字の大きさ(大きな文字)", "aria-pressed": on ? "true" : "false" }, "文字 ", h("span", { class: "ef-size-v" }))
          : h("button", { type: "button", class: "toggle ef-btn ef-toggle", "data-pref": key, "aria-pressed": on ? "true" : "false" }, label);
      b.addEventListener("click", () => setDisplay(key, b.getAttribute("aria-pressed") !== "true"));
      return b;
    }),
  );
  toggles.replaceChildren(...buttons);
}

async function setDisplay(key, on) {
  setPref(key, on);
  toggles.querySelector(`[data-pref="${key}"]`)?.setAttribute("aria-pressed", on ? "true" : "false");
  await applyDisplay();
  if (key === "ruby") await setRubyEnabled(view, on);
  showCurrentInNav();
}

async function applyDisplay() {
  document.documentElement.classList.toggle("large-text", Boolean(await pref("largeText")));
  document.documentElement.classList.toggle("easy-mode", Boolean(await pref("easy")));
}

// やさしい日本語のまとめ（「やさしい日本語のまとめ」をオンにすると表示）
function easyBox(text) {
  return text ? h("div", { class: "easy-summary" }, explainCard("やさしい日本語のまとめ", text)) : "";
}

function renderHome() {
  const cards = available.map((c) => {
    const p = moduleProgress(c);
    return h(
      "a",
      { class: "module-card", href: `#/${c.id}` },
      h("span", { class: "mc-num" }, `モジュール${c.label}・${c.module.minutes}`),
      h("span", { class: "mc-title" }, c.title),
      h("span", { class: "mc-desc" }, c.desc),
      h("div", { class: "bar", "aria-hidden": "true" }, h("span", { style: `width:${p.total ? (p.done / p.total) * 100 : 0}%` })),
      h("span", { class: "hint" }, p.complete ? "✓ 完了" : `${p.done} / ${p.total} ステップ`),
    );
  });
  view.replaceChildren(
    h("div", { class: "module-head" }, h("h1", {}, "情報セキュリティ体験ラボ"), h("p", { class: "meta" }, "「脅威 → しくみ → 対策」を手を動かして体験し、なぜその対策が必要かを自分の言葉で説明できるようになろう。"), h("p", { class: "hint author" }, "作成：技術 岡田"), easyBox(EASY_PAGES.home)),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "このラボで大切にすること"),
      h("p", {}, "インターネットの危険は、こわがるだけでは防げません。どのモジュールでも、次の3つの手順で判断する練習をします。"),
      threeSteps(),
      explainCard("安心して体験できます", "このラボはすべてこのブラウザの中だけで動きます。インターネット上のサイトには一切つながらず、入力した内容が外に送られることもありません。登場する会社名やアドレスはすべて架空のものです。", "good"),
    ),
    h("section", { class: "card" }, h("h2", {}, "すすめ方"), h("ol", {}, h("li", {}, h("a", { href: "#/check" }, "理解度チェック"), "の「事前テスト」で、今の力を確かめる"), h("li", {}, furikaeriOn() ? "モジュールを①から順に体験して、最後にふりかえりを書く" : "モジュールを①から順に体験する", "（⑪ ハッシュ体験は発展。先生に言われたときに取り組む）"), h("li", {}, "「事後テスト」で伸びを確かめ、まちがえた問題を復習する"), h("li", {}, h("a", { href: "#/records" }, recordsTitle()), "からファイルを書き出して提出する"))),
    ...GROUPS.map((g) => {
      const list = available.map((c, i) => [c, cards[i]]).filter(([c]) => c.group === g.id);
      return list.length ? h("section", { class: "module-group" }, h("h2", {}, g.title), h("div", { class: "module-grid" }, list.map(([, card]) => card))) : "";
    }),
  );
}

async function renderModule(entry, stepId) {
  const m = entry.module;
  const root = h("div");
  view.replaceChildren(
    h("div", { class: "module-head" }, h("p", { class: "meta" }, `モジュール${entry.label}・目安 ${m.minutes}`), h("h1", {}, entry.title), h("p", {}, m.lead), easyBox(entry.easy)),
    root,
  );
  const idx = available.indexOf(entry);
  const prev = available[idx - 1];
  const next = available[idx + 1];
  const navRow = h(
    "div",
    { class: "btn-row" },
    prev ? h("a", { class: "btn secondary", href: `#/${prev.id}` }, "← 前のモジュール") : null,
    next ? h("a", { class: "btn", href: `#/${next.id}` }, `次へ：${next.title} →`) : h("a", { class: "btn", href: "#/check" }, "理解度チェックへ →"),
  );
  await m.render(root);
  // やさしい日本語: ステップごとに「やること」を1文で出す（SEC-14）
  for (const [stepId, text] of Object.entries(EASY_STEPS[entry.id] || {})) {
    const head = document.getElementById(`step-${entry.id}-${stepId}`);
    if (head) head.after(h("p", { class: "easy-summary easy-step" }, h("span", { class: "easy-tag" }, "やること"), text));
  }
  view.append(navRow);
  if (stepId) document.getElementById(`step-${entry.id}-${stepId}`)?.scrollIntoView({ block: "start" });
}

let routeToken = 0;
async function route() {
  const token = ++routeToken;
  // ページを移る前に、書きかけのふりかえりを保存する（前の画面がまだ残っているうちに）
  flushReflections();
  const { id, step } = parseHash();
  const entry = available.find((c) => c.id === id);
  renderNav(id);
  renderOverall();
  window.scrollTo(0, 0);
  if (entry) await renderModule(entry, step);
  else if (id === "records") renderRecords(view, available, config, route, easyBox(EASY_PAGES.records));
  else if (id === "teacher") renderTeacher(view, available, config, reloadConfig);
  else if (id === "check") await renderCheck(view, available, easyBox(EASY_PAGES.check));
  else renderHome();
  if (token !== routeToken) return;
  const title = entry ? entry.title : { records: recordsTitle(), teacher: "先生用ページ", check: "理解度チェック" }[id] || "はじめに";
  document.title = `${title} | 情報セキュリティ体験ラボ`;
  if (!step) view.focus({ preventScroll: true });
}

async function reloadConfig() {
  config = await getConfig();
  available = availableModules(config);
  await applyDisplay();
  await renderToggles();
  await setRubyEnabled(view, Boolean(await pref("ruby")));
  await route();
}

// 記録が変わったら章ナビと進み具合を書きかえる。
// ただし、マウスや指で押している途中に書きかえると、そのクリックが消えてしまう
// （ふりかえりの自動保存は、章ナビを押した瞬間にも起きる）ので、はなしてから書きかえる。
let pointerIsDown = false;
let navPending = false;
function refreshNav() {
  navPending = false;
  renderNav(parseHash().id);
  renderOverall();
}
document.addEventListener("pointerdown", () => (pointerIsDown = true), true);
const pointerReleased = () => {
  pointerIsDown = false;
  if (navPending) setTimeout(refreshNav, 0);
};
document.addEventListener("pointerup", pointerReleased, true);
document.addEventListener("pointercancel", pointerReleased, true);
store.subscribe(() => {
  if (pointerIsDown) navPending = true;
  else refreshNav();
});
window.addEventListener("hashchange", route);
// 画面を閉じる・別のアプリに切りかえる・再読み込みするときも、書きかけのふりかえりを保存する
window.addEventListener("pagehide", flushReflections);
window.addEventListener("beforeunload", flushReflections);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushReflections();
});

reloadConfig().catch((e) => {
  // 設定や問題のデータを読めなかったとき（ファイルを直接開いた など）は、白い画面のままにせず知らせる
  view.replaceChildren(h("div", { class: "card" }, h("h1", {}, "読み込めませんでした"), h("p", {}, `${e?.message || e}。単一HTML版（dist/security-lab.html）を使うか、Webサーバー経由で開いてください。`)));
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
