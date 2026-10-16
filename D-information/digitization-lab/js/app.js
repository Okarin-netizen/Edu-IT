// アプリ本体: 章ナビ、ルーティング、進捗表示、文字の大きさの切りかえ
import { store } from "./store.js";
import { h, explainCard, flushReflections } from "./ui.js";
import { CATALOG, moduleProgress } from "./catalog.js";
import { renderRecords } from "./records.js";

const view = document.getElementById("view");
const nav = document.getElementById("chapter-nav");
const overall = document.getElementById("overall-progress");
const toggles = document.getElementById("display-toggles");
const PREF_KEY = "digilab.largeText";

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
  ol.append(h("li", { class: "nav-group", "aria-hidden": "true" }, "体験する"));
  for (const c of CATALOG) ol.append(link(`#/${c.id}`, c.num, c.title, c.id, moduleProgress(c).complete));
  ol.append(h("li", { class: "nav-group", "aria-hidden": "true" }, "記録する"));
  ol.append(link("#/records", "✎", "ふりかえり・記録", "records", false));
  nav.replaceChildren(h("nav", { "aria-label": "章ナビゲーション" }, ol));
}

function renderOverall() {
  const all = CATALOG.map(moduleProgress);
  const done = all.reduce((a, p) => a + p.done, 0);
  const total = all.reduce((a, p) => a + p.total, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  overall.replaceChildren(
    h("span", {}, "進み具合"),
    h("div", { class: "bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": pct, "aria-label": "全体の進み具合" }, h("span", { style: `width:${pct}%` })),
    h("span", {}, `${pct}%`),
  );
}

function largeText() {
  try {
    return localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}
function renderToggles() {
  const on = largeText();
  document.documentElement.classList.toggle("large-text", on);
  const b = h("button", { type: "button", class: "toggle ef-btn", "aria-pressed": on ? "true" : "false" }, "大きな文字");
  b.addEventListener("click", () => {
    try {
      localStorage.setItem(PREF_KEY, on ? "0" : "1");
    } catch {}
    renderToggles();
  });
  toggles.replaceChildren(b);
}

// アナログ→デジタルの3つの手順（標本化・量子化・符号化）の図
function pipeline() {
  return h(
    "ol",
    { class: "pipeline", "aria-label": "デジタル化の3つの手順" },
    h("li", {}, h("strong", {}, "標本化"), h("span", {}, "一定の間かくで区切って、値を取り出す"), h("span", { class: "hint" }, "画像なら画素に分ける・音なら時間で区切る")),
    h("li", {}, h("strong", {}, "量子化"), h("span", {}, "取り出した値を、決まった段階の数にあてはめる"), h("span", { class: "hint" }, "画像なら色の段階・音なら波の高さの段階")),
    h("li", {}, h("strong", {}, "符号化"), h("span", {}, "段階の番号を、0と1の並び（2進数）にする"), h("span", { class: "hint" }, "例: 番号5 → 101")),
  );
}

function renderHome() {
  const cards = CATALOG.map((c) => {
    const p = moduleProgress(c);
    return h(
      "a",
      { class: "module-card", href: `#/${c.id}` },
      h("span", { class: "mc-num" }, `${c.label}・目安 ${c.module.minutes}`),
      h("span", { class: "mc-title" }, c.title),
      h("span", { class: "mc-desc" }, c.desc),
      h("div", { class: "bar", "aria-hidden": "true" }, h("span", { style: `width:${(p.done / p.total) * 100}%` })),
      h("span", { class: "hint" }, p.complete ? "✓ 完了" : `${p.done} / ${p.total} ステップ`),
    );
  });
  view.replaceChildren(
    h("div", { class: "module-head" }, h("h1", {}, "デジタル化ラボ"), h("p", { class: "meta" }, "コンピュータは、画像も音も文字も「0と1」にして扱います。どうやって0と1にするのか、そのときデータの量（情報量）がどう変わるのかを、手を動かして確かめよう。"), h("p", { class: "hint author" }, "作成：羽生市立南中学校 技術 岡田")),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "デジタル化の3つの手順"),
      h("p", {}, "連続して変わる量（アナログ）を、とびとびの数（デジタル）にするには、次の3つの手順をふみます。どのモジュールでも、この手順が出てきます。"),
      pipeline(),
      explainCard("安心して体験できます", "このラボはすべてこのブラウザの中だけで動き、インターネットには一切つながりません。自分の写真を読み込んだり、マイクで声を録音したりしても、保存も送信もしません。"),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "すすめ方"),
      h("ol", {}, h("li", {}, "①〜③のモジュールを順に体験し、それぞれのふりかえりを書く"), h("li", {}, "④の計算ドリルで、データ量の計算を練習する"), h("li", {}, "⑤の圧縮のしくみは発展。先生に言われたときや、早く終わったときに取り組む"), h("li", {}, h("a", { href: "#/records" }, "ふりかえり・記録"), "からファイルを書き出して提出する")),
      h(
        "div",
        { class: "lesson-plan" },
        h("h3", {}, "2時間で行うときの例"),
        h(
          "ul",
          {},
          h("li", {}, h("strong", {}, "1時間目"), "「はじめに・① 画像・② 音」"),
          h("li", {}, h("strong", {}, "2時間目"), "「③ 2進数・④ ドリル・ふりかえり・記録」"),
          h("li", {}, h("strong", {}, "⑤ 圧縮（発展）"), "は、早く終わった人や、次の時間に使う"),
        ),
        h("p", { class: "hint" }, "時間の終わりには、ふりかえりを書いてから次へ進もう。"),
      ),
    ),
    h("section", { class: "module-group" }, h("h2", {}, "モジュール"), h("div", { class: "module-grid" }, cards)),
    h("div", { class: "btn-row start-row" }, h("a", { class: "btn", href: `#/${CATALOG[0].id}` }, `${CATALOG[0].label} ${CATALOG[0].title}からはじめよう →`)),
  );
}

async function renderModule(entry, stepId) {
  const m = entry.module;
  const root = h("div");
  view.replaceChildren(h("div", { class: "module-head" }, h("p", { class: "meta" }, `モジュール${entry.label}・目安 ${m.minutes}`), h("h1", {}, entry.title), h("p", {}, m.lead)), root);
  const idx = CATALOG.indexOf(entry);
  const prev = CATALOG[idx - 1];
  const next = CATALOG[idx + 1];
  const navRow = h(
    "div",
    { class: "btn-row" },
    prev ? h("a", { class: "btn secondary", href: `#/${prev.id}` }, "← 前のモジュール") : null,
    next ? h("a", { class: "btn", href: `#/${next.id}` }, `次へ：${next.title} →`) : h("a", { class: "btn", href: "#/records" }, "ふりかえり・記録へ →"),
  );
  await m.render(root);
  view.append(navRow);
  if (stepId) document.getElementById(`step-${entry.id}-${stepId}`)?.scrollIntoView({ block: "start" });
}

let current = null;
async function route() {
  const { id, step } = parseHash();
  const entry = CATALOG.find((c) => c.id === id);
  flushReflections(); // 書きかけのふりかえりを、ページを移る前に保存する
  current?.module?.leave?.(); // 前のモジュールの後片付け（マイクを止めるなど）
  current = entry || null;
  renderNav(id);
  renderOverall();
  window.scrollTo(0, 0);
  if (entry) await renderModule(entry, step);
  else if (id === "records") renderRecords(view, CATALOG);
  else renderHome();
  document.title = `${entry ? entry.title : id === "records" ? "ふりかえり・記録" : "はじめに"} | デジタル化ラボ`;
  if (!step) view.focus({ preventScroll: true });
}

store.subscribe(() => {
  renderNav(parseHash().id);
  renderOverall();
});
window.addEventListener("hashchange", route);
renderToggles();
route();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
