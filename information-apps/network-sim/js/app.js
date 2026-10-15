// アプリ本体: 章ナビ、ルーティング、進み具合、トップページ、記録ページ
import { store } from "./store.js";
import { h, explainCard, downloadFile, toast, flushDrafts } from "./ui.js";
import { buildModule } from "../modules/build.js";
import { flowModule } from "../modules/flow.js";
import { faultModule } from "../modules/fault.js";
import { spyModule } from "../modules/spy.js";
import { drillModule } from "../modules/drill.js";

export const MODULES = [
  { ...buildModule, num: 1, period: 1, title: "ネットワークを組み立てる", desc: "パソコン・スマホ・ルータ・サーバ・DNSを置いて線でつなぐ。IPアドレスも確かめる。" },
  { ...flowModule, num: 2, period: 1, title: "Webページが届くまで", desc: "DNSへの問い合わせ → IPアドレス → パケットに分ける → 経路 → 組み立てをアニメで見る。" },
  { ...faultModule, num: 3, period: 2, title: "回線が切れたら？", desc: "回線を切る・ルータを止める。別の道で届く？ 届かなくなる？" },
  { ...spyModule, num: 4, period: 2, title: "のぞき見と暗号化", desc: "途中の回線をのぞく人に見えるものを、HTTP と HTTPS で比べる。" },
  { ...drillModule, num: 5, period: 2, title: "IPアドレス・ドリル", desc: "IPアドレスの書き方、同じネットワーク、2進数、機器の役目を練習。" },
];

const view = document.getElementById("view");
const nav = document.getElementById("chapter-nav");
const overall = document.getElementById("overall-progress");
const toggles = document.getElementById("display-toggles");

const progress = (m) => {
  const done = m.steps.filter((s) => store.isStepDone(m.id, s.id)).length;
  return { done, total: m.steps.length, complete: done === m.steps.length };
};

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
  for (const m of MODULES) ol.append(link(`#/${m.id}`, m.num, m.title, m.id, progress(m).complete));
  ol.append(h("li", { class: "nav-group", "aria-hidden": "true" }, "記録する"));
  ol.append(link("#/records", "✎", "ふりかえり・記録", "records", false));
  nav.replaceChildren(h("nav", { "aria-label": "章ナビゲーション" }, ol));
}

function renderOverall() {
  const all = MODULES.map(progress);
  const done = all.reduce((a, p) => a + p.done, 0);
  const total = all.reduce((a, p) => a + p.total, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  overall.replaceChildren(
    h("span", {}, "進み具合"),
    h("div", { class: "bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": pct, "aria-label": "全体の進み具合" }, h("span", { style: `width:${pct}%` })),
    h("span", {}, `${pct}%`),
  );
}

const LARGE_KEY = "netsim.largeText";
function renderToggles() {
  let on = false;
  try {
    on = localStorage.getItem(LARGE_KEY) === "1";
  } catch {}
  document.documentElement.classList.toggle("large-text", on);
  const b = h("button", { type: "button", class: "toggle ef-btn", "aria-pressed": on ? "true" : "false" }, "大きな文字");
  b.addEventListener("click", () => {
    try {
      localStorage.setItem(LARGE_KEY, on ? "0" : "1");
    } catch {}
    renderToggles();
  });
  toggles.replaceChildren(b);
}

const GLOSSARY = [
  ["プロトコル", "", "通信の約束ごと。送る側と受け取る側が同じ約束ごとを守るので、通信できる。HTTP・HTTPS・IP などがある。"],
  ["パケット", "", "データを小さく分けたまとまり。宛先・送信元・番号などの情報（ヘッダ）が付いている。"],
  ["IPアドレス", "", "ネットワークにつながった機器を見分ける番号。例：192.168.1.10"],
  ["宛先・送信元", "あてさき・そうしんもと", "パケットを届ける相手と、送った機器。"],
  ["経路", "けいろ", "パケットが通る道。"],
  ["中継", "ちゅうけい", "受け取ったパケットを、次の機器へ送ること。中継するのはルータだけ。"],
  ["到達", "とうたつ", "相手まで届くこと。"],
  ["冗長化", "じょうちょうか", "1本がこわれても困らないように、道や機器を2つ以上用意しておくこと。"],
  ["暗号化", "あんごうか", "かぎを持っている人にしか読めない形に変えること。"],
  ["DNS", "ディーエヌエス", "サイトの名前（ドメイン名）からIPアドレスを調べるしくみ。"],
];

function renderHome() {
  const grid = h(
    "div",
    { class: "module-grid" },
    MODULES.map((m) => {
      const p = progress(m);
      return h(
        "a",
        { class: "module-card", href: `#/${m.id}` },
        h("span", { class: "mc-num" }, `${m.num}　目安 ${m.minutes}（${m.period}時間目）`),
        h("span", { class: "mc-title" }, m.title),
        h("span", { class: "mc-desc" }, m.desc),
        h("span", { class: "hint" }, p.complete ? "✓ クリア" : `${p.done} / ${p.total} ステップ`),
      );
    }),
  );
  view.replaceChildren(
    h(
      "div",
      { class: "module-head" },
      h("h1", {}, "ネットワーク通信シミュレータ"),
      h("p", { class: "meta" }, "中学校 技術・家庭科（技術分野）D「情報の技術」　情報通信ネットワークの構成と、情報を利用するための基本的なしくみ"),
      h("p", { class: "author" }, "作成：羽生市立南中学校 技術 岡田"),
    ),
    h(
      "div",
      { class: "card" },
      h("p", {}, "パソコンでWebページを見るとき、ネットワークの中では何が起きているのでしょう。このシミュレータでは、ブラウザの中の", h("strong", {}, "模型のネットワーク"), "を組み立てて、パケット・IPアドレス・DNS・ルータ・サーバのはたらきを目で見て確かめます。"),
      explainCard("安心して使えます", "この教材はブラウザの中だけで動き、本物のネットワークや外部のサイトには一切接続しません。出てくるサイト名は架空（<code>.example</code>）です。IPアドレスは、家の中で使う番号（プライベートアドレス）と、説明用に予約された番号を使っています。"),
      h("p", { class: "hint" }, "おすすめの順番：1 → 2 → 3 → 4 → 5。1で作ったネットワークが2〜4で使われます（はじめから用意された形のままでも体験できます）。"),
    ),
    // 授業の区切り（NW-17）。2時間で使う
    h(
      "div",
      { class: "card lesson-plan" },
      h("h2", {}, "授業で使うとき（2時間）"),
      h(
        "table",
        { class: "data" },
        h("thead", {}, h("tr", {}, h("th", {}, "時間"), h("th", {}, "やること"), h("th", {}, "目安"))),
        h(
          "tbody",
          {},
          [1, 2].map((p) => {
            const ms = MODULES.filter((m) => m.period === p);
            return h("tr", {}, h("th", { scope: "row" }, `${p}時間目`), h("td", {}, ms.map((m) => `${m.num} ${m.title}`).join("、")), h("td", {}, ms.map((m) => m.minutes).join(" ＋ ")));
          }),
        ),
      ),
      h("p", { class: "hint" }, "どのページも、終わりに「ふりかえり」を書きます。5のドリルの「チャレンジ問題」は、時間がある人だけでかまいません。"),
    ),
    grid,
    // ことばの一覧（読み方つき）（NW-13）
    h(
      "details",
      { class: "card glossary" },
      h("summary", {}, h("strong", {}, "ことばの一覧（読み方つき）")),
      h(
        "dl",
        {},
        GLOSSARY.map(([w, r, d]) => [h("dt", {}, w, r ? h("span", { class: "ruby-note" }, `（${r}）`) : null), h("dd", {}, d)]),
      ),
    ),
  );
}

function renderRecords() {
  const st = store.state;
  const fields = [
    ["cls", "組"],
    ["num", "番号"],
    ["name", "名前"],
  ].map(([k, label]) => {
    const input = h("input", { type: "text", id: `stu-${k}`, maxlength: "20", value: st.student[k] || "" });
    input.addEventListener("change", () => store.setStudent({ [k]: input.value.trim() }));
    return h("div", { class: "field" }, h("label", { for: `stu-${k}` }, label), input);
  });
  const rows = MODULES.map((m) => {
    const p = progress(m);
    return h("tr", {}, h("td", {}, `${m.num}. ${m.title}`), h("td", {}, `${p.done} / ${p.total}`), h("td", {}, store.getReflection(m.id) || "—"));
  });
  // 書き出す前に、組と番号が入っているかを確かめる。書き出したら、ファイル名と出し方を知らせる（共通のきまり）
  const exportNote = h("p", { class: "export-note", "aria-live": "polite" });
  const readyToExport = () => {
    const vals = Object.fromEntries(fields.map((f) => f.querySelector("input")).map((inp) => [inp.id.replace("stu-", ""), inp.value.trim()]));
    store.setStudent(vals);
    if (!vals.cls || !vals.num) {
      exportNote.className = "export-note warn";
      exportNote.textContent = "組と番号を入れてから書き出そう";
      (vals.cls ? fields[1] : fields[0]).querySelector("input").focus();
      return false;
    }
    return true;
  };
  const exported = (filename) => {
    exportNote.className = "export-note good";
    exportNote.textContent = `ファイルを保存しました（ファイル名: ${filename}）。先生に言われた場所に出そう。`;
  };
  const exportBtn = h("button", { type: "button", class: "btn" }, "記録を書き出す（JSON）");
  exportBtn.addEventListener("click", () => {
    if (!readyToExport()) return;
    const s = store.state;
    const data = {
      app: "network-sim",
      version: 1,
      exportedAt: new Date().toISOString(),
      student: s.student,
      modules: Object.fromEntries(MODULES.map((m) => [m.id, { title: m.title, ...progress(m), steps: s.modules[m.id]?.steps || {}, score: s.modules[m.id]?.score || {} }])),
      reflections: s.reflections,
    };
    const who = [s.student.cls, s.student.num, s.student.name].filter(Boolean).join("-") || "記録";
    const filename = `ネットワーク_${who}.json`;
    downloadFile(filename, JSON.stringify(data, null, 2));
    exported(filename);
  });
  const csvBtn = h("button", { type: "button", class: "btn secondary" }, "CSVで書き出す");
  csvBtn.addEventListener("click", () => {
    if (!readyToExport()) return;
    const s = store.state;
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["組", "番号", "名前", "モジュール", "できたステップ", "全ステップ", "ドリル最高点", "ふりかえり"].map(q).join(",")];
    for (const m of MODULES) {
      const p = progress(m);
      lines.push([s.student.cls, s.student.num, s.student.name, m.title, p.done, p.total, m.id === "drill" ? (store.getScore("drill", "best") ?? "") : "", store.getReflection(m.id)].map(q).join(","));
    }
    const filename = `ネットワーク_${s.student.name || "記録"}.csv`;
    downloadFile(filename, "﻿" + lines.join("\r\n"), "text/csv");
    exported(filename);
  });
  const resetBtn = h("button", { type: "button", class: "btn secondary" }, "この端末の記録をすべて消す");
  resetBtn.addEventListener("click", () => {
    if (!confirm("進み具合・ふりかえり・作ったネットワークをすべて消します。よろしいですか？")) return;
    store.reset();
    toast("記録を消しました");
    route();
  });
  view.replaceChildren(
    h("div", { class: "module-head" }, h("h1", {}, "ふりかえり・記録"), h("p", { class: "meta" }, "記録はこの端末のブラウザの中だけに保存されます。提出するときは書き出したファイルを先生に渡します。")),
    h("div", { class: "card" }, h("h2", {}, "名前"), h("div", { class: "field-row" }, fields)),
    h("div", { class: "card" }, h("h2", {}, "進み具合とふりかえり"), h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "モジュール"), h("th", {}, "ステップ"), h("th", {}, "ふりかえり"))), h("tbody", {}, rows))), h("p", {}, `IPアドレス・ドリルの最高点：${store.getScore("drill", "best") ?? "—"} / 10`), h("p", { class: "hint" }, h("strong", {}, "先生に出すのは JSON のファイルです。"), "CSV は、表計算ソフトで見るためのものです。"), h("div", { class: "btn-row" }, exportBtn, csvBtn), exportNote),
    h("div", { class: "card" }, h("h2", {}, "記録を消す"), h("p", { class: "hint" }, "次の人に端末をわたすときに使います。"), h("div", { class: "btn-row" }, resetBtn)),
  );
}

function renderModule(m) {
  const head = h("div", { class: "module-head" }, h("h1", {}, `${m.num}. ${m.title}`), h("p", { class: "meta" }, `目安 ${m.minutes}（2時間で使うときは ${m.period}時間目）`), h("p", {}, m.lead));
  view.replaceChildren(head);
  m.render(view);
  const idx = MODULES.indexOf(m);
  const next = MODULES[idx + 1];
  view.append(h("div", { class: "btn-row module-next" }, idx > 0 ? h("a", { class: "btn secondary", href: `#/${MODULES[idx - 1].id}` }, `← ${MODULES[idx - 1].title}`) : null, next ? h("a", { class: "btn", href: `#/${next.id}` }, `次へ：${next.title} →`) : h("a", { class: "btn", href: "#/records" }, "ふりかえり・記録へ →")));
}

let lastId = null;
function route() {
  flushDrafts(); // 書きかけのふりかえりを、ページを移る前に保存する
  const id = location.hash.replace(/^#\/?/, "").split("/")[0] || "home";
  const m = MODULES.find((x) => x.id === id);
  if (m) renderModule(m);
  else if (id === "records") renderRecords();
  else renderHome();
  renderNav(m ? m.id : id);
  renderOverall();
  if (lastId !== null && lastId !== id) {
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
  }
  lastId = id;
}

store.subscribe(() => {
  renderOverall();
  const id = location.hash.replace(/^#\/?/, "").split("/")[0] || "home";
  renderNav(id);
});
window.addEventListener("hashchange", route);
renderToggles();
route();

// オフライン用（サーバーから配信したときだけ。1ファイル版では使わない）
if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !window.__NETSIM_STANDALONE) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
