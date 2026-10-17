// 画面の切りかえ（#/ … トップ、#/diagram ①図解、#/auto ②手計算くらべ、#/sim ③仮想CPU、#/tasks ④課題、#/task/ID、#/records ふりかえり・記録）
import { h, explain, REFLECT_ATTR, recordsTitle } from "./ui.js";
import { loadData } from "./data.js";
import { store } from "./store.js";
import { renderDiagram } from "./diagram.js";
import { createSimulator, isaTable, readingCard } from "./sim.js";
import { renderTaskList, renderTask, tierCount } from "./tasks.js";
import { renderAuto } from "./auto.js";
import { reflectionBox, flushReflection, renderRecords } from "./records.js";

const SAMPLES = [
  { name: "3 + 5 を表示する", inputs: [], source: "LOAD a     ; a の数（3）を ACC に読み込む\nADD b      ; b の数（5）をたす\nSTORE c    ; 答えを c にもしまっておく（OUT が出すのは ACC の値）\nOUT        ; 答えを出力\nHALT       ; 終わり\na: DATA 3\nb: DATA 5\nc: DATA 0" },
  { name: "入力された数をそのまま表示（0で終わり）", inputs: [4, 7, 1, 0], source: "loop: IN        ; 入力\n      JZ end    ; 0 なら終わり\n      OUT       ; 出力\n      JUMP loop ; くり返す\nend:  HALT" },
  { name: "終わらないプログラム（速さ「最速」で、自動で止まるか確認）", fastest: true, inputs: [], source: "      LOAD #0\nloop: ADD #1\n      OUT\n      JUMP loop   ; ずっとくり返す（HALT にたどりつかない）" },
  { name: "まっさら", inputs: [], source: "" },
];

let cleanup = null;
let data = null;

// 左メニュー（ほかの教材と同じ形）
function renderNav() {
  const route = location.hash.replace(/^#/, "") || "/";
  const current = route === "/" ? "/" : route.startsWith("/task/") ? "/tasks" : route;
  const tasks = data?.tasks || [];
  const link = (path, num, title, done) =>
    h(
      "li",
      { class: done ? "done" : "" },
      h("a", { href: `#${path}`, "aria-current": current === path ? "page" : null }, h("span", { class: "num", "aria-hidden": "true" }, done ? "✓" : num), h("span", {}, title, done ? h("span", { class: "visually-hidden" }, "（完了）") : null)),
    );
  const ol = h(
    "ol",
    {},
    link("/", "⌂", "はじめに", false),
    h("li", { class: "nav-group", "aria-hidden": "true" }, "体験する"),
    // ✓ は「やり終えた」ときだけ（開いただけではつけない）。課題は必修（課題1〜4）を全部クリアしたとき
    // 基本編（① 図解・② 手計算くらべ）→ 発展編（③ 仮想CPUを動かす・④ 課題）の順
    link("/diagram", "1", "図解: 5つの装置", store.isDone("diagram")),
    link("/auto", "2", "手計算くらべ", store.isDone("auto")),
    link("/sim", "3", "仮想CPUを動かす", false),
    link("/tasks", "4", "課題", (() => { const c = tierCount(tasks, "must"); return c.total > 0 && c.done === c.total; })()),
    h("li", { class: "nav-group", "aria-hidden": "true" }, "記録する"),
    link("/records", "✎", recordsTitle(), false),
  );
  document.getElementById("chapter-nav").replaceChildren(h("nav", { "aria-label": "ページ" }, ol));
}

function renderHome(view) {
  const { tasks } = data;
  const done = tasks.filter((t) => store.isCleared(t.id)).length;
  const must = tierCount(tasks, "must");
  const card = (num, href, title, desc, extra) => h("a", { class: "module-card", href }, h("span", { class: "mc-num" }, num), h("span", { class: "mc-title" }, title), h("span", { class: "mc-desc" }, desc), extra);
  view.replaceChildren(
    h(
      "section",
      { class: "hero" },
      h("h1", {}, "仮想CPUラボ"),
      h("p", { class: "lead" }, "プログラムがコンピュータの中でどのように処理されるのかを、小さな仮想コンピュータを動かしながら確かめる教材です。"),
      h("p", { class: "author" }, "作成：技術 岡田"),
    ),
    h(
      "div",
      { class: "module-grid" },
      card("①", "#/diagram", "図解: 5つの装置", "入力・記憶・演算・制御・出力。データがどう流れるかをアニメで見る。", store.isDone("diagram") ? h("span", { class: "status good small-status" }, "✓ やった") : null),
      card("②", "#/auto", "手計算 vs プログラム", "同じ計算を人とコンピュータでくらべ、処理の自動化を考える。", store.isDone("auto") ? h("span", { class: "status good small-status" }, "✓ やった") : null),
      card("③", "#/sim", "仮想CPUを動かす", "10個の命令で動く小さなCPU。1段階ずつ進めて、レジスタ（CPUの中の小さな記憶の箱）と記憶装置の変化を見る。", null),
      card("④", "#/tasks", "課題", "必修は課題1〜4。たし算、ひき算、くり返しをプログラムする。発展・チャレンジもある。", h("span", { class: `status ${must.done === must.total ? "good" : ""} small-status` }, `必修 ${must.done} / ${must.total}（全体 ${done} / ${tasks.length}）`)),
    ),
    h(
      "details",
      { class: "card teacher" },
      h("summary", {}, "先生へ（授業での使い方）"),
      h("p", {}, "技術・家庭科（技術分野）D「情報の技術」の「コンピュータの仕組み」（入力・記憶・演算・制御・出力）に対応しています。インターネットに接続せず、このファイルだけで動きます。"),
      h(
        "ol",
        {},
        h("li", {}, "1時間目（前半 約25分）: ①図解で5つの装置とデータ・制御の流れを確認し、機器の仲間分けをする。"),
        h("li", {}, "1時間目（後半 約25分）: ②手計算くらべで、同じ計算を人とプログラムでくらべ、処理の自動化をまとめる。", h("span", REFLECT_ATTR, "ふりかえりを書き、"), "記録（JSON）を書き出す。（ここまでが基本編）"),
        h("li", {}, "発展（2時間目）: ③仮想CPUで「3 + 5 を表示する」を「1段階すすむ」で動かし、取り出し→解読→実行をたしかめる。④課題1〜4（必修。順次とくり返し）。終わった生徒は課題5〜7（発展）、課題8（チャレンジ）へ進む。"),
      ),
      h("p", {}, "課題の区分: 課題1〜4 が必修、5〜7 が発展、8 がチャレンジです。時間の目安は、必修1問 5〜8分、発展1問 8〜12分です（クラスに合わせて調整してください）。"),
      h("p", {}, "ヒントは「考え方 → 一部の答え」の順に出ます。最後のヒントも答えそのものではありません。ヒントを全部見ると「答えの例」を開けます。答えの例をプログラム欄に入れるボタンはなく、生徒が自分で打ちこみます。答えの例を開いたことは記録に残り、書き出した JSON に入ります（各課題のプログラムも入ります）。"),
      h("p", {}, "✓ は、①は仲間分けの答え合わせ、②は手計算と N を大きくしたくらべ、④は必修（課題1〜4）のクリアをしたときにつきます。開いただけではつきません。"),
      h("p", {}, "進み具合と書いたプログラムは、この端末のブラウザの中だけに保存されます（外部には送りません）。"),
      h("button", { class: "btn small secondary", type: "button", onclick: () => confirm("この端末に保存された進み具合とプログラムをすべて消しますか？") && (store.reset(), route()) }, "この端末の記録を消す"),
    ),
  );
}

function renderSim(view) {
  store.markVisited("sim");
  const sel = h("select", { "aria-label": "サンプルプログラム" }, SAMPLES.map((p, i) => h("option", { value: i }, p.name)));
  // 前に選んだサンプルと入力の数をもどす（書いたプログラムは下書きとしてもどる）
  const draft = store.getDraft("_free");
  const meta = store.state.sim || {};
  const sampleIndex = Number.isInteger(meta.sample) && SAMPLES[meta.sample] ? meta.sample : 0;
  sel.value = String(sampleIndex);
  const sim = createSimulator({
    isa: data.isa,
    source: draft ?? SAMPLES[sampleIndex].source,
    inputs: Array.isArray(meta.inputs) ? meta.inputs : draft ? [] : SAMPLES[sampleIndex].inputs,
    onSourceChange: (t) => store.setDraft("_free", t),
    onInputsChange: (list) => store.setSimMeta({ inputs: list }),
  });
  let shownIndex = sampleIndex;
  // 終わらないサンプルは、1万命令で自動で止まるのを見るために速さを「最速」にする
  if (SAMPLES[sampleIndex].fastest) sim.setSpeed(sim.FASTEST);
  sel.addEventListener("change", () => {
    const p = SAMPLES[Number(sel.value)];
    // 自分で書きかえたプログラムがあるときは、消してよいか先にたずねる
    const cur = sim.source;
    const edited = cur.trim() !== "" && !SAMPLES.some((x) => x.source === cur);
    if (edited && !confirm("いまのプログラムは消えて、サンプルに書きかわります。よろしいですか？")) {
      sel.value = String(shownIndex);
      return;
    }
    shownIndex = Number(sel.value);
    sim.setSource(p.source);
    sim.setInputs(p.inputs);
    if (p.fastest) sim.setSpeed(sim.FASTEST);
    store.setSimMeta({ sample: shownIndex, inputs: p.inputs });
  });
  view.replaceChildren(
    h("div", { class: "page-head" }, h("h2", {}, "仮想CPUを動かす"), h("p", { class: "muted" }, "プログラムは記憶装置に読み込まれ、制御装置が命令を1つずつ「取り出し → 解読 → 実行」します。まずは「1段階すすむ」を何回か押してみよう。"), h("div", { class: "sample-row" }, h("label", {}, "サンプルプログラム", sel))),
    h("div", { class: "card sim-card" }, sim.el),
    readingCard(true),
    isaTable(data.isa, true),
    explain("見るところ", h("ul", {}, h("li", {}, "記憶装置の青い枠が「次に取り出す番地（PC）」、色がついたマスが「いま実行している命令」です。マスを押すと、中身の意味が出ます。"), h("li", {}, "STORE で書きこまれたマスはオレンジ色に光ります。"), h("li", {}, "命令もデータも同じ記憶装置に入っていることに注目しよう。命令を記憶装置に入れておき、1つずつ取り出して実行するしくみを「プログラム内蔵方式」といいます。"), h("li", {}, "①図解とのちがい: この仮想CPUでは、IN で入った数はまず ACC に入ります。記憶装置にしまうには STORE を使います。OUT は ACC の値を表示します（記憶装置の数を出すときは、LOAD してから OUT）。"))),
  );
  return () => sim.stop();
}

function route() {
  flushReflection(); // 前のページのふりかえりの書きかけを保存してから移る
  cleanup?.();
  cleanup = null;
  const view = document.getElementById("view");
  const path = location.hash.replace(/^#/, "") || "/";
  if (path === "/diagram") cleanup = renderDiagram(view);
  else if (path === "/sim") cleanup = renderSim(view);
  else if (path === "/tasks") renderTaskList(view, data);
  else if (path.startsWith("/task/")) cleanup = renderTask(view, data, decodeURIComponent(path.slice(6)));
  else if (path === "/auto") cleanup = renderAuto(view, data);
  else if (path === "/records") renderRecords(view, data, route);
  else renderHome(view);
  const box = reflectionBox(path.slice(1));
  if (box) {
    // 「次:」ボタン（.next-link）があるページでは、ふりかえり欄をその上に置く
    const nextLink = view.querySelector(":scope > .next-link");
    if (nextLink) nextLink.before(box);
    else view.append(box);
  }
  renderNav();
  window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
}

async function main() {
  try {
    const [isa, t] = await Promise.all([loadData("isa"), loadData("tasks")]);
    data = { isa, tasks: t.tasks };
  } catch (e) {
    document.getElementById("view").replaceChildren(explain("読み込めませんでした", `${e.message}。単一HTML版（dist/virtual-cpu.html）を使うか、Webサーバー経由で開いてください。`, "bad"));
    return;
  }
  window.addEventListener("hashchange", route);
  document.addEventListener("vcpu:progress", renderNav); // ✓ がついたときに左メニューを書きなおす
  window.addEventListener("pagehide", () => {
    flushReflection();
    cleanup?.();
  });
  route();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !globalThis.__VCPU_DATA) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

main();
