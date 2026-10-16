// アプリ本体: 画面の切りかえ（はじめに・場面・書き方ガイド・ふりかえり・記録）
import { h, explainCard, tabs, toast, downloadFile } from "./ui.js";
import { store } from "./store.js";
import { loadData } from "./data.js";
import { MODELS, OUTPUT_KINDS, outputWordWarnings } from "./models.js";
import { compile, programToText, validate, walkProgram, fmt, thresholdsOf } from "./lang.js";
import { Sim, DT, runAllTests } from "./sim.js";
import { createBlockEditor, TOOL_LEGEND } from "./blocks.js";
import { flowchartSvg, labelOf } from "./flow.js";
import { drawChart } from "./chart.js";
import { attachAutosave, flushAutosaves, AUTOSAVE_HINT, AUTOSAVE_DONE } from "./autosave.js";

const view = document.getElementById("view");
const nav = document.getElementById("chapter-nav");
let scenarios = [];
let cleanup = null;
// 「元にもどす」の記録は場面ごとに持つ（ほかのページへ移って戻っても、もどせるように）
const undoHistories = new Map();

const fmtTime = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const sec = (t) => `${(Math.round(t * 10) / 10).toFixed(1)}秒`;

// ---------------- はじめに ----------------
function flowDiagram(parts) {
  const [a, b, c] = parts;
  return h(
    "div",
    { class: "io-flow", role: "img", "aria-label": parts.join(" から ") },
    h("div", { class: "io-box io-in" }, h("span", { class: "io-tag" }, "入力・計測"), a),
    h("span", { class: "io-arrow", "aria-hidden": "true" }, "→"),
    h("div", { class: "io-box io-cpu" }, h("span", { class: "io-tag" }, "処理・判断"), b),
    h("span", { class: "io-arrow", "aria-hidden": "true" }, "→"),
    h("div", { class: "io-box io-out" }, h("span", { class: "io-tag" }, "出力・制御"), c),
  );
}

// はじめにの図: センサ → インタフェース → マイコン → インタフェース → アクチュエータ（教科書の役割分担）
function homeDiagram() {
  const box = (cls, tag, main, sub) => h("div", { class: `io-box ${cls}` }, h("span", { class: "io-tag" }, tag), main, h("small", {}, sub));
  const arrow = () => h("span", { class: "io-arrow", "aria-hidden": "true" }, "→");
  return h(
    "div",
    { class: "io-flow five", role: "img", "aria-label": "センサ から インタフェース（A/D変換） から マイコン から インタフェース から アクチュエータ" },
    box("io-in", "入力・計測", "センサ", "明るさ・距離などを電気信号に変える"),
    arrow(),
    box("io-if", "インタフェース", "A/D変換", "電気信号を、コンピュータが扱える数にする"),
    arrow(),
    box("io-cpu", "処理・判断", "マイコン", "プログラムで判断する"),
    arrow(),
    box("io-if", "インタフェース", "出力の信号にする", "命令を、動かすための電気信号にする（D/A変換など）"),
    arrow(),
    box("io-out", "出力・制御", "アクチュエータ", "LED・モーター など"),
  );
}

function renderHome() {
  const cards = scenarios.map((s) => {
    const best = store.best(s.id);
    const status = !s.tests.length ? "テストなし（自由に試す）" : best ? `テスト ${best.passed}/${best.total} 合格（最高）` : "まだテストしていません";
    return h(
      "a",
      { class: "scn-card", href: `#/s/${s.id}` },
      h("span", { class: "scn-icon", "aria-hidden": "true" }, s.icon),
      h("span", { class: "scn-num" }, `場面${s.label}`),
      h("span", { class: "scn-title" }, s.title),
      h("span", { class: "scn-desc" }, s.summary),
      s.time ? h("span", { class: "scn-time" }, `目安 ${s.time}（${s.period}時間目）`) : null,
      h("span", { class: `scn-status${best && best.passed === best.total ? " done" : ""}` }, status),
    );
  });
  view.replaceChildren(
    h(
      "section",
      { class: "card hero" },
      h("h1", {}, "計測・制御シミュレータ"),
      h("p", { class: "lead" }, "センサで「はかり（計測）」、コンピュータが「判断」し、モーターやLEDを「動かす（制御）」。身のまわりの自動ドアや信号機と同じしくみを、プログラムで作って、画面の中の仮想世界で確かめよう。実機がなくても学習できます。"),
      homeDiagram(),
      h("p", {}, "センサが出す電気信号は、そのままではコンピュータが扱えません。インタフェースがデジタルの数に変えて（A/D変換）、コンピュータに伝えます。このシミュレータの「明るさ 0〜100」は、変換したあとの数です。コンピュータからの命令も、インタフェースでLEDやモーターを動かす信号に変えます。このシミュレータでは、インタフェースのはたらきは見えないところで自動で行っています。"),
      h("p", { class: "author-line" }, "作成：技術 岡田"),
    ),
    h("h2", { class: "section-title" }, "場面をえらぶ"),
    h("div", { class: "scn-grid" }, cards),
    planCard(),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "使い方"),
      h(
        "ol",
        { class: "how-to" },
        h("li", {}, h("strong", {}, "場面を読む"), "：どんな問題を解決したいのか、どのセンサと出力を使うのかを確かめる。"),
        h("li", {}, h("strong", {}, "プログラムを組む"), "：ブロック・フローチャート・テキストのどれでも見られます（ブロックとテキストで編集でき、3つは自動で同じ内容になります）。ブロックは「① 入れたい場所の「＋ ここに入れる」を押す → ② 命令のボタン（「＋もし〜なら」など）を押す」の順で入れます。入れたブロックは「↔」で、「もし」の中など、べつの場所へ動かせます。"),
        h("li", {}, h("strong", {}, "仮想世界で動かす"), "：スライダでセンサの値を変えたり、ケースを再生したりして動きを見る。「1ステップ」で1行ずつ確かめられます。"),
        h("li", {}, h("strong", {}, "テストで確かめる"), "：あらかじめ考えておいたケースで、合格か不合格かを自動で調べます。"),
        h("li", {}, h("strong", {}, "直して記録する"), "：不合格の理由をグラフとログで調べて直し、「改善メモ」に残す。最後に、ページの下の「ふりかえり」を書こう（書いた文は自動で保存されます）。"),
      ),
      explainCard("この教材について", "ブラウザの中だけで動き、インターネットには接続しません。作ったプログラムや記録は、この端末のブラウザの中にだけ保存されます。"),
    ),
  );
}

// 授業の進め方（3時間）。はじめにと先生用ページに出す
function planRows() {
  const byPeriod = [1, 2, 3].map((p) => scenarios.filter((s) => s.period === p));
  const names = (list) => list.map((s) => `${s.label} ${s.title.replace(/（.*?）/g, "")}（${s.time}）`).join("、");
  return [
    ["1時間目", `はじめに（5分）、${names(byPeriod[0])}、ふりかえり（5分）`],
    ["2時間目", `${names(byPeriod[1])}、ふりかえり（10分）`],
    ["3時間目", `${names(byPeriod[2])}、ふりかえり・記録の書き出し（10分）`],
  ];
}

function planCard() {
  return h(
    "section",
    { class: "card plan" },
    h("h2", {}, "授業の進め方（3時間）"),
    h("table", { class: "data plan-table" }, h("tbody", {}, planRows().map(([a, b]) => h("tr", {}, h("th", {}, a), h("td", {}, b))))),
    h("p", { class: "hint" }, "時間は目安です。終わらなかったところは、次の時間に続きから始められます（プログラムはこの端末に自動で保存されます）。"),
  );
}

// 信号機のグラフの線は、ランプの色でかく
const LAMP_COLORS = { 車の青: "#1f9d5c", 車の黄: "#d99a00", 車の赤: "#e0453a", 歩行者の青: "#1f9d5c", 歩行者の赤: "#e0453a" };

// ---------------- 書き方ガイド ----------------
function renderGuide() {
  const rows = [
    ["ずっと … おわり", "ずっとくり返す", "ずっと\n  街灯 = オン\nおわり"],
    ["N 回くり返す … おわり", "決まった回数くり返す", "3 回くり返す\n  LED = オン\n  0.5 秒待つ\n  LED = オフ\n  0.5 秒待つ\nおわり"],
    ["条件 のあいだくり返す … おわり", "条件が成り立つあいだくり返す", "距離 < 100 のあいだくり返す\n  ブザー = オン\nおわり"],
    ["もし 条件 なら … でなければ … おわり", "条件で処理を分ける（でなければ は省略できる）", "もし 明るさ < 30 なら\n  街灯 = オン\nでなければ\n  街灯 = オフ\nおわり"],
    ["N 秒待つ", "時間をあける（0.1秒きざみ）", "2 秒待つ"],
    ["出力 = 値", "出力を動かす", "ドア = 開く\nモーター = 80"],
    ["変数 = 式", "変数に値を入れる（はじめて使う名前は変数になる）", "回数 = 回数 + 1"],
    ["# メモ", "説明を書く（実行されない）", "# 暗くなったらつける"],
  ];
  view.replaceChildren(
    h("h1", {}, "書き方ガイド"),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "ブロックの使い方"),
      h(
        "ol",
        {},
        h("li", {}, "入れたい場所の「＋ ここに入れる」を押します。「▶ ここに入れる」に変わります。何もえらばないときは、「▶」が出ているところに入ります。"),
        h("li", {}, "命令のボタン（「＋もし〜なら」「＋〜秒待つ」など）を押して、入れる命令をえらびます。"),
        h("li", {}, "「もし」や「くり返す」の中に入れたいときは、その中にある「＋ ここに入れる」を先に押します。"),
      ),
      h("ul", {}, TOOL_LEGEND.map(([k, v]) => h("li", {}, h("code", {}, k), "：", v)), h("li", {}, h("code", {}, "▾"), "：式で書いた条件を、えらぶ形にもどす")),
      h("p", {}, "「↔」を押すと、そのブロックを動かせます。動かしたい場所の「▶ ここへ動かす」を押そう。中にブロックが入っている「もし」などは、中身ごと動きます。消したり動かしたりしてまちがえたときは「↶ 元にもどす」でもどせます。"),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "テキストでの書き方"),
      h("p", {}, "ブロックで組んだプログラムは、自動でテキストとフローチャートにもなります。テキストで書くときは、次の形を使います。字下げ（行の先頭の空白）は自由ですが、そろえると読みやすくなります。全角の数字や記号でも読めます。"),
      h(
        "div",
        { class: "table-wrap" },
        h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "書き方"), h("th", {}, "意味"), h("th", {}, "例"))), h("tbody", {}, rows.map(([a, b, c]) => h("tr", {}, h("td", {}, h("code", {}, a)), h("td", {}, b), h("td", {}, h("pre", { class: "code-view small" }, c)))))),
      ),
      h("h3", {}, "条件と式"),
      h("ul", {}, h("li", {}, "くらべる: ", h("code", {}, "< > <= >= == !="), "（条件の中では = も「等しい」と読みます）"), h("li", {}, "組み合わせる: ", h("code", {}, "明るさ < 30 かつ 人感 == オン"), "、", h("code", {}, "ボタン == オン または 距離 < 50")), h("li", {}, "計算: ", h("code", {}, "+ - * / %"), "とかっこ（", h("code", {}, "%"), " は、わり算のあまり。例: ", h("code", {}, "7 % 3"), " は 1）"), h("li", {}, "入れる: ", h("code", {}, "回数 = 回数 + 1"), " の ", h("code", {}, "="), " は「右の値を、左に入れる」という意味です（数学の = とはちがいます）。フローチャートでは ", h("code", {}, "←"), " で表します。"), h("li", {}, "決まった言葉: ", h("code", {}, "オン(1) オフ(0) 開く(1) 閉じる(-1) 止める(0)"))),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "フローチャートの記号"),
      h("ul", {}, h("li", {}, "角が丸い横長の形: はじめ・おわり"), h("li", {}, "長方形: 処理（出力を動かす・変数に入れる・待つ）。「待つ」は色を変えてあります"), h("li", {}, "ひし形: 判断（条件で「はい」「いいえ」に分かれる）"), h("li", {}, "上の角を切った形と下の角を切った形: くり返し（ループ端）。この2つではさまれた部分をくり返す")),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "計測・制御のことば"),
      h("dl", { class: "terms" }, h("dt", {}, "センサ"), h("dd", {}, "明るさ・距離・温度などを測って、電気信号に変える部品。"), h("dt", {}, "アクチュエータ"), h("dd", {}, "モーター・LED・ブザーなど、コンピュータからの命令で動く部品。"), h("dt", {}, "しきい値"), h("dd", {}, "「明るさ < 30 なら」の 30 のように、判断を切りかえる境目の値。"), h("dt", {}, "インタフェース"), h("dd", {}, "センサやアクチュエータとコンピュータの間で、信号を変換する部分。センサの電気信号を、コンピュータが扱えるデジタルの数に変えます（A/D変換）。コンピュータの命令を、アクチュエータを動かす信号に変えます。このシミュレータでは見えないところで自動で行っています。"), h("dt", {}, "A/D変換"), h("dd", {}, "アナログの信号（なめらかに変わる電圧など）を、デジタルの数に変えること。例: 明るさセンサの電圧 → 0〜100 の数。"), h("dt", {}, "D/A変換"), h("dd", {}, "デジタルの数を、アナログの信号に変えること。例: モーターの速さの数 → モーターを回す電気の強さ。")),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "このシミュレータでの時間の進み方"),
      h("p", {}, "仮想世界の時間は 0.1 秒きざみで進みます。1きざみごとに「センサを読む → プログラムを進める → 出力に合わせて世界が動く」をくり返します。「ずっと」「〜のあいだくり返す」の1周に「待つ」がないときは、1周ごとに 0.1 秒進みます（止まらないくり返しで画面が固まらないようにするため）。"),
    ),
  );
}

// ---------------- 先生用ページ（メニューには出さない。#/teacher で開く） ----------------
function renderTeacher() {
  const answers = scenarios.filter((s) => s.model_answer).map((s) => h("details", { class: "answer" }, h("summary", {}, `${s.icon} ${s.label} ${s.title} の模範プログラム`), h("pre", { class: "code-view" }, s.model_answer)));
  view.replaceChildren(
    h("h1", {}, "先生用ページ"),
    explainCard("このページについて", "生徒用のメニューには出ていません。開き方は2つあります。(1) この教材のファイル（計測制御シミュレータ.html）を開き、アドレスの最後に #/teacher をつける。(2) 教材集の中など、アドレスを変えられないときは、教材の画面をクリックしてから（文字を入れる欄の外で）キーボードで teacher と続けて打つ。授業で模範を映して見せるときなどに使ってください。", "warn"),
    h("section", { class: "card" }, h("h2", {}, "授業の時間の割り当て（3時間）"), h("table", { class: "data plan-table" }, h("tbody", {}, planRows().map(([a, b]) => h("tr", {}, h("th", {}, a), h("td", {}, b))))), h("p", { class: "hint" }, "場面4のはじめのプログラムには、車の信号を 青→黄→赤 にするところまで（場面3と同じ手順）が入っています。生徒は、歩行者をわたらせて車を青にもどす手順を足します。")),
    h("section", { class: "card" }, h("h2", {}, "模範プログラム"), h("p", { class: "hint" }, "どの場面の模範プログラムも、その場面の全テストに合格することを自動テストで確かめています。テキストの画面にはりつけると、ブロックとフローチャートでも見られます。"), answers),
  );
}

// ---------------- ふりかえり（ほかの教材と同じ形。場面ごとに1つ） ----------------
// 問いと例は、場面ごとに scenarios.json の reflect / reflect_example に書く（ないときはこれを使う）
const REFLECT_PROMPT = "この場面で、センサの値をどう使って判断させた？ 安全・便利・むだをなくすために工夫したことは？";
const REFLECT_EXAMPLE = "例: 明るさが 30 より小さいときだけつけるようにしたので、昼間は電気がむだにならない";

function reflectionBox(s) {
  const id = `reflect-${s.id}`;
  const ta = h("textarea", { id, maxlength: "400", placeholder: s.reflect_example || REFLECT_EXAMPLE });
  ta.value = store.getReflection(s.id);
  const note = h("div", { class: "saved-note", "aria-live": "polite" });
  // 書いているそばから自動で保存する（「保存」ボタンを押したときと同じ保存のしかた）
  const saveText = () => store.setReflection(s.id, ta.value.trim());
  const flush = attachAutosave(ta, saveText, {
    onSaved: () => {
      note.style.color = "";
      note.textContent = AUTOSAVE_DONE;
    },
  });
  const saveBtn = h("button", { class: "btn", type: "button" }, "ふりかえりを保存");
  saveBtn.addEventListener("click", () => {
    flush();
    saveText();
    if (ta.value.trim().length < 5) {
      note.textContent = "もう少し書いてみよう（5文字以上）";
      note.style.color = "var(--warn)";
      return;
    }
    note.style.color = "";
    note.textContent = "この端末に保存しました";
  });
  return h(
    "section",
    { class: "card reflection" },
    h("h2", {}, "ふりかえり"),
    h("label", { for: id }, s.reflect || REFLECT_PROMPT),
    h("div", { class: "hint" }, "テストごとの「改善メモ」とは別に、この場面で学んだことを自分の言葉でまとめよう。"),
    ta,
    h("div", { class: "hint autosave-hint" }, AUTOSAVE_HINT),
    h("div", { class: "btn-row" }, saveBtn),
    note,
  );
}

// ---------------- ふりかえり・記録 ----------------
function renderRecords() {
  const st = store.state;
  const field = (key, label, w) => {
    const inp = h("input", { type: "text", value: st.student[key] || "", id: `stu-${key}`, style: `max-width:${w}` });
    inp.addEventListener("change", () => store.setStudent({ [key]: inp.value.trim() }));
    return h("div", { class: "field" }, h("label", { for: `stu-${key}` }, label), inp);
  };
  const recs = [...st.records].reverse();
  const summary = scenarios.map((s) => {
    const rs = store.recordsOf(s.id);
    const best = store.best(s.id);
    return h("tr", {}, h("td", {}, `${s.icon} ${s.label} ${s.title}`), h("td", {}, rs.length), h("td", {}, best ? `${best.passed}/${best.total}` : "—"), h("td", {}, rs.length ? `${rs.at(-1).passed}/${rs.at(-1).total}` : "—"), h("td", {}, store.getReflection(s.id) || "—"));
  });
  const list = recs.map((r) =>
    h(
      "li",
      { class: "rec" },
      h("div", { class: "rec-head" }, h("strong", {}, r.title), h("span", { class: `status ${r.passed === r.total ? "good" : "warn"}` }, `${r.passed}/${r.total} 合格`), h("span", { class: "hint" }, fmtTime(r.at))),
      h("ul", { class: "rec-results" }, r.results.map((x) => h("li", {}, x.pass ? "○ " : "× ", x.name, x.pass ? "" : `（${x.reason}）`))),
      r.memo ? h("p", { class: "rec-memo" }, "改善メモ: ", r.memo) : null,
      h("details", {}, h("summary", {}, "このときのプログラム"), h("pre", { class: "code-view small" }, r.program)),
    ),
  );
  // 書き出す前に、組と番号が入っているかを確かめる（だれのファイルか分からなくならないように）
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
    const name = `計測制御_記録_${st.student.cls || ""}${st.student.num || ""}.json`;
    downloadFile(name, JSON.stringify({ app: "計測・制御シミュレータ", exportedAt: new Date().toISOString(), student: st.student, records: st.records, reflections: st.reflections, programs: st.programs }, null, 2));
    exported(name);
  };
  const exportCsv = () => {
    if (!readyToExport()) return;
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["組", "番号", "名前", "日時", "場面", "合格数", "テスト数", "不合格の理由", "改善メモ", "ふりかえり"].map(q).join(",")];
    for (const r of st.records) lines.push([st.student.cls, st.student.num, st.student.name, r.at, r.title, r.passed, r.total, r.results.filter((x) => !x.pass).map((x) => `${x.name}: ${x.reason}`).join(" / "), r.memo, ""].map(q).join(","));
    // テストをしていない場面のふりかえりも残るように、場面ごとのふりかえりを1行ずつ足す
    for (const s of scenarios) if (store.getReflection(s.id)) lines.push([st.student.cls, st.student.num, st.student.name, st.reflections[s.id].at, s.title, "", "", "", "", store.getReflection(s.id)].map(q).join(","));
    const name = `計測制御_記録_${st.student.cls || ""}${st.student.num || ""}.csv`;
    downloadFile(name, "﻿" + lines.join("\r\n"), "text/csv");
    exported(name);
  };
  view.replaceChildren(
    h("h1", {}, "ふりかえり・記録"),
    h("section", { class: "card" }, h("h2", {}, "名前"), h("div", { class: "field-row" }, field("cls", "組", "8em"), field("num", "番号", "6em"), field("name", "名前", "16em")), h("p", { class: "hint" }, "名前はこの端末のブラウザと、書き出したファイルに入ります。ほかの人と端末を使うときは、最後に「この端末の記録をすべて消す」を押そう。")),
    h("section", { class: "card" }, h("h2", {}, "場面ごとのまとめ"), h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "場面"), h("th", {}, "テストした回数"), h("th", {}, "最高"), h("th", {}, "最新"), h("th", {}, "ふりかえり"))), h("tbody", {}, summary))), h("p", { class: "hint" }, h("strong", {}, "先生に出すのは JSON のファイルです。"), "CSV は、表計算ソフトで見るためのものです。"), h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn", onclick: exportJson }, "JSONで書き出す（先生に出す）"), h("button", { type: "button", class: "btn secondary", onclick: exportCsv }, "CSVで書き出す（表計算ソフト用）")), exportNote),
    h("section", { class: "card" }, h("h2", {}, `テストの記録（${recs.length}件、新しい順）`), recs.length ? h("ul", { class: "rec-list" }, list) : h("p", {}, "まだ記録がありません。場面の「テストを実行」を押すと、ここに残ります。"), recs.length ? h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn secondary small", onclick: () => { if (confirm("この端末のテストの記録をすべて消します。よろしいですか？")) { store.clearRecords(); renderRecords(); } } }, "テストの記録だけ消す")) : null),
    h("section", { class: "card" }, h("h2", {}, "記録を消す"), h("p", { class: "hint" }, "次の人に端末をわたすときに使います。名前・場面ごとのプログラム・テストの記録・ふりかえりをすべて消します。"), h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn secondary", onclick: () => { if (confirm("名前・プログラム・テストの記録・ふりかえりをすべて消します。よろしいですか？")) { store.reset(); store.setPref("seenScenes", []); undoHistories.clear(); toast("記録を消しました"); route(); } } }, "この端末の記録をすべて消す"))),
  );
}

// ---------------- 場面（エディタ・仮想世界・デバッグ・テスト） ----------------
function renderScenario(sid) {
  const s = scenarios.find((x) => x.id === sid);
  if (!s) {
    location.hash = "#/";
    return;
  }
  const model = MODELS[s.model];
  const device = model.device;
  const outputNames = new Set(device.outputs.map((o) => o.name));

  // プログラムの状態
  let text = store.getProgram(s.id) ?? s.starter;
  let first = compile(text, device);
  let program = first.errors.length && !first.program.length ? compile(s.starter, device).program : first.program;
  let errors = first.errors;
  // テキストにまちがいがあって、ブロックがまちがえる前のプログラムのままのとき true（ブロックでは直せないようにする）
  let textBroken = first.errors.length > 0;
  if (!undoHistories.has(s.id)) undoHistories.set(s.id, [text]);
  const history = undoHistories.get(s.id);
  if (history.at(-1) !== text) history.push(text);
  let editorTab = store.pref("editorTab") || "blocks";

  // シミュレーションの状態
  const manual = Object.fromEntries(model.env.map((e) => [e.name, e.default]));
  let caseId = "manual";
  let sim = null;
  let running = false;
  let speed = 1;
  let raf = null;
  let lastTs = null;
  let acc = 0;
  let lastChart = 0;
  let chartAll = false;
  let failMarkT = null; // ケース再生で不合格になった時刻（グラフに赤い点線をかく）
  let soundOn = false;
  let audio = null;
  let lastResults = null;
  let resultsStale = false;

  // ---- 見出し ----
  const deviceList = h(
    "div",
    { class: "device-list" },
    device.sensors.length ? h("div", {}, h("h3", {}, "センサ（入力）"), h("ul", {}, device.sensors.map((x) => h("li", {}, h("code", {}, x.name), "：", x.note)))) : h("div", {}, h("h3", {}, "センサ（入力）"), h("p", {}, "なし（時間で切りかえる）")),
    h("div", {}, h("h3", {}, "出力（制御するもの）"), h("ul", {}, device.outputs.map((x) => h("li", {}, h("code", {}, x.name), "：", x.note)))),
  );
  // 場面の説明は、はじめて開いたときだけ開いておく（2回目からはたたんで、プログラムとテストを上に出す）
  const seen = store.pref("seenScenes") || [];
  const firstVisit = !seen.includes(s.id);
  if (firstVisit) store.setPref("seenScenes", [...seen, s.id]);
  const head = h(
    "section",
    { class: "card scn-head" },
    h("div", { class: "scn-title-row" }, h("h1", {}, h("span", { "aria-hidden": "true" }, s.icon, " "), `${s.label} ${s.title}`), s.time ? h("span", { class: "scn-time" }, `目安 ${s.time}（${s.period}時間目）`) : null),
    h("p", { class: "scn-goal" }, h("strong", {}, "めあて："), s.goal),
    h(
      "details",
      { class: "scn-story", open: firstVisit ? "open" : null },
      h("summary", {}, "場面の説明（お話・しくみの図・使えるセンサと出力）"),
      h("p", {}, s.story),
      flowDiagram(s.flow.split("→").map((x) => x.trim())),
      h("div", { class: "dev-details" }, h("h2", { class: "dev-title" }, "使えるセンサと出力"), deviceList),
    ),
    h("details", { class: "hints" }, h("summary", {}, "ヒントを見る"), h("ol", {}, s.hints.map((x) => h("li", {}, x)))),
  );

  // ---- エディタ ----
  const blockEd = createBlockEditor(device, () => programChanged("blocks"), () => {
    // ブロックの数の欄に読めない文字があるときは、まちがいの箱に出して、テストと実行を止める
    errors = [...validate(program, device).errors, ...blockEd.inputErrors()];
    showErrors();
  });
  blockEd.setProgram(program, { memoCursor: true });
  const flowBox = h("div", { class: "flow-box" });
  const ta = h("textarea", { class: "code", spellcheck: "false", wrap: "off", "aria-label": "プログラム（テキスト）", autocapitalize: "off", autocomplete: "off" });
  const gutter = h("div", { class: "gutter", "aria-hidden": "true" });
  const textWrap = h("div", { class: "code-wrap" }, gutter, ta);
  const errBox = h("div", { class: "err-box", "aria-live": "polite" });
  const edBody = h("div", { class: "editor-body" });
  const edTabs = h("div");
  let textTimer = null;

  ta.addEventListener("input", () => {
    updateGutter();
    clearTimeout(textTimer);
    textTimer = setTimeout(() => applyText(ta.value), 400);
  });
  ta.addEventListener("scroll", () => (gutter.scrollTop = ta.scrollTop));
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const { selectionStart: a, selectionEnd: b } = ta;
      ta.setRangeText("  ", a, b, "end");
      ta.dispatchEvent(new Event("input"));
    }
  });
  function updateGutter() {
    const n = ta.value.split("\n").length;
    gutter.replaceChildren(...Array.from({ length: n }, (_, i) => h("div", { "data-line": i + 1 }, i + 1)));
    highlight();
  }

  function applyText(t, fromUndo = false) {
    text = t;
    store.setProgram(s.id, text);
    const c = compile(text, device);
    errors = c.errors;
    textBroken = errors.length > 0;
    if (!fromUndo && history.at(-1) !== text) history.push(text);
    if (history.length > 60) history.shift();
    if (!errors.length) {
      program = c.program;
      blockEd.setProgram(program);
      afterProgramChange();
    } else showErrors();
  }

  function programChanged(from) {
    textBroken = false;
    text = programToText(program);
    store.setProgram(s.id, text);
    if (history.at(-1) !== text) history.push(text);
    errors = [...validate(program, device).errors, ...blockEd.inputErrors()];
    afterProgramChange(from);
  }

  function afterProgramChange(from) {
    showErrors();
    if (lastResults) {
      resultsStale = true;
      renderResults();
    }
    newSim();
    if (editorTab === "flow") renderFlow();
    if (editorTab === "text" && from === "blocks") {
      ta.value = text;
      updateGutter();
    }
  }

  function showErrors() {
    if (!errors.length) {
      // まちがいではないが、出力に合わない言葉（ドア = オフ など）を使っているときの注意
      const warns = outputWordWarnings(program, device);
      errBox.replaceChildren(...(warns.length ? [explainCard("注意", h("ul", {}, warns.slice(0, 4).map((w) => h("li", {}, w.message))), "warn")] : []));
      return;
    }
    errBox.replaceChildren(
      explainCard(
        textBroken ? "テキストにまちがいがあります（直すまで、前のプログラムのまま動きます）" : "まちがいがあります",
        h("ul", {}, errors.slice(0, 6).map((e) => h("li", {}, e.message))),
        "bad",
      ),
    );
  }

  function renderFlow() {
    flowBox.innerHTML = flowchartSvg(program, outputNames);
    highlight();
  }

  function setEditorTab(t) {
    editorTab = t;
    store.setPref("editorTab", t);
    edTabs.replaceChildren(tabs([["blocks", "ブロック"], ["flow", "フローチャート"], ["text", "テキスト"]], t, setEditorTab, "プログラムの見方"));
    if (t === "blocks") {
      blockEd.render();
      showBlocks();
    } else if (t === "flow") {
      renderFlow();
      edBody.replaceChildren(h("p", { class: "hint" }, "フローチャートはプログラムから自動でかかれます。直すときは「ブロック」か「テキスト」で。"), flowBox);
    } else {
      ta.value = text;
      edBody.replaceChildren(textWrap);
      updateGutter();
    }
    showErrors();
    highlight();
  }

  // テキストにまちがいがあるままブロックを見たとき: どちらが今のプログラムかを知らせ、ブロックでは直せないようにする
  // （ブロックを変えると、テキストの書きかけが上書きされて消えてしまうため）
  function showBlocks() {
    blockEd.el.inert = textBroken;
    blockEd.el.classList.toggle("locked", textBroken);
    if (!textBroken) {
      edBody.replaceChildren(blockEd.el);
      return;
    }
    const note = explainCard(
      "テキストにまちがいがあります",
      h(
        "div",
        {},
        h("p", {}, "下のブロックは、まちがえる前のプログラムです（今のテキストとはちがいます）。テキストを直すか、テキストの書きかけをやめてブロックで続けるかをえらぼう。"),
        h("ul", {}, errors.slice(0, 3).map((e) => h("li", {}, e.message))),
        h(
          "div",
          { class: "btn-row" },
          h("button", { type: "button", class: "btn small", onclick: () => setEditorTab("text") }, "テキストにもどって直す"),
          h("button", { type: "button", class: "btn secondary small", onclick: () => {
            if (!confirm("テキストの書きかけを消して、下のブロックのプログラムにします。いいですか？（「元にもどす」で書きかけにもどせます）")) return;
            applyText(programToText(program));
            setEditorTab("blocks");
          } }, "書きかけをやめて、ブロックで続ける"),
        ),
      ),
      "warn",
    );
    edBody.replaceChildren(note, blockEd.el);
  }

  const undoBtn = h("button", { type: "button", class: "btn secondary small", onclick: () => {
    if (history.length < 2) return toast("これ以上もどせません");
    history.pop();
    const prev = history.at(-1);
    applyText(prev, true);
    if (editorTab === "text") {
      ta.value = prev;
      updateGutter();
    }
    if (editorTab === "blocks") setEditorTab("blocks");
  } }, "↶ 元にもどす");
  const resetBtn = h("button", { type: "button", class: "btn secondary small", onclick: () => {
    if (!confirm("はじめのプログラムにもどします。今のプログラムは消えます（「元にもどす」で取り消せます）。")) return;
    applyText(s.starter);
    if (!errors.length) blockEd.setProgram(program, { memoCursor: true });
    if (editorTab === "text") {
      ta.value = s.starter;
      updateGutter();
    }
    if (editorTab === "blocks") setEditorTab("blocks");
  } }, "はじめのプログラムにもどす");

  // プログラムのすぐ上でもテストできるようにする（直すたびに、ページの下までスクロールしなくてよい）
  const testMini = h("div", { class: "test-mini", "aria-live": "polite" });
  const testTopBtn = s.tests.length ? h("button", { type: "button", class: "btn small", onclick: () => runTests() }, "✔ テストを実行") : null;
  const editorCard = h("section", { class: "card editor-card", "aria-label": "プログラム" }, h("div", { class: "card-title-row" }, h("h2", {}, "プログラム"), h("div", { class: "btn-row tight" }, testTopBtn, undoBtn, resetBtn)), testMini, edTabs, edBody, errBox);

  // ---- 仮想世界 ----
  const worldBox = h("div", { class: "world" });
  const timeEl = h("span", { class: "sim-time" });
  const stateEl = h("span", { class: "sim-state" });
  const nextEl = h("div", { class: "next-stmt", "aria-live": "polite" });
  const progress = h("div", { class: "bar case-bar", "aria-hidden": "true" }, h("span", {}));
  const panel = h("div", { class: "mcu-panel" });
  const caseInfo = h("div", { class: "case-info" });
  const manualBox = h("div", { class: "manual-box" });

  const runBtn = h("button", { type: "button", class: "btn", onclick: () => (running ? pause() : run()) }, "▶ 実行");
  const stepBtn = h("button", { type: "button", class: "btn secondary", onclick: () => stepOnce(), title: "次の1つの命令まで進める" }, "⏭ 1ステップ");
  const restartBtn = h("button", { type: "button", class: "btn secondary", onclick: () => newSim(), title: "時間を0にもどす" }, "⟲ 最初から");
  const speedSel = h("select", { class: "speed-sel", "aria-label": "速さ" }, [0.5, 1, 2, 5].map((v) => h("option", { value: v, selected: v === 1 ? "selected" : null }, `×${v}`)));
  speedSel.addEventListener("change", () => (speed = Number(speedSel.value)));
  const caseSel = h("select", { class: "case-sel", "aria-label": "センサの値の動かし方" }, h("option", { value: "manual" }, "手動で動かす（スライダ）"), s.tests.map((t) => h("option", { value: t.id }, `ケース再生：${t.name}`)));
  caseSel.addEventListener("change", () => {
    caseId = caseSel.value;
    newSim();
  });

  function buildManual() {
    const items = model.env.filter((e) => !e.hidden).map((e) => {
      const id = `env-${s.id}-${e.name}`;
      if (e.button) {
        const b = h("button", { type: "button", class: "btn press-btn", "aria-pressed": "false" }, `${e.name}を押す（押している間オン）`);
        const set = (v) => {
          manual[e.name] = v;
          b.setAttribute("aria-pressed", v ? "true" : "false");
          if (!running) refreshWorld();
        };
        // 押したことを仮想マイコンに覚えさせ（すぐ指を離しても、次の0.1秒はオンと読む）、「押した！」と短く出す
        const flash = h("span", { class: "press-flash", "aria-live": "polite" });
        let flashTimer = null;
        const pressed = () => {
          if (running) sim?.press(e.name); // 止まっているときは覚えない（あとで実行したときに急に動かないように）
          flash.textContent = "押した！";
          clearTimeout(flashTimer);
          flashTimer = setTimeout(() => (flash.textContent = ""), 800);
        };
        b.addEventListener("pointerdown", (ev) => {
          b.setPointerCapture?.(ev.pointerId);
          pressed();
          set(1);
        });
        b.addEventListener("pointerup", () => set(0));
        b.addEventListener("pointercancel", () => set(0));
        b.addEventListener("keydown", (ev) => {
          if ((ev.key === " " || ev.key === "Enter") && !ev.repeat) {
            ev.preventDefault();
            pressed();
            set(1);
          }
        });
        b.addEventListener("keyup", (ev) => {
          if (ev.key === " " || ev.key === "Enter") set(0);
        });
        return h("div", { class: "field press-row" }, b, flash);
      }
      if (e.toggle) {
        const cb = h("input", { type: "checkbox", id, checked: manual[e.name] ? "checked" : null });
        cb.addEventListener("change", () => {
          manual[e.name] = cb.checked ? 1 : 0;
          if (!running) refreshWorld();
        });
        return h("label", { class: "check-item", for: id }, cb, `${e.name}（人が動いている）`);
      }
      const out = h("output", { for: id }, `${manual[e.name]}${e.unit}`);
      const r = h("input", { type: "range", id, min: e.min, max: e.max, step: e.step, value: manual[e.name] });
      r.addEventListener("input", () => {
        manual[e.name] = Number(r.value);
        out.textContent = `${r.value}${e.unit}`;
        if (!running) refreshWorld();
      });
      return h("div", { class: "field" }, h("label", { for: id }, `${e.name} `, out), r, e.note ? h("span", { class: "hint" }, e.note) : null);
    });
    if (!items.length) items.push(h("p", { class: "hint" }, "この場面には動かすセンサがありません。▶ 実行して、信号の動きを見よう。"));
    manualBox.replaceChildren(...items);
  }

  const soundBox = device.outputs.some((o) => o.kind === "buzzer")
    ? (() => {
        const cb = h("input", { type: "checkbox", id: `snd-${s.id}` });
        cb.addEventListener("change", () => {
          soundOn = cb.checked;
          updateSound();
        });
        return h("label", { class: "check-item small", for: `snd-${s.id}` }, cb, "ブザーの音を出す");
      })()
    : null;

  const worldCard = h(
    "section",
    { class: "card world-card", "aria-label": "仮想世界" },
    h("div", { class: "card-title-row" }, h("h2", {}, "仮想世界"), h("div", { class: "sim-meta" }, stateEl, timeEl)),
    worldBox,
    progress,
    h("div", { class: "btn-row tight controls" }, runBtn, stepBtn, restartBtn, h("label", { class: "inline-label" }, "速さ ", speedSel)),
    nextEl,
    h("div", { class: "field" }, h("label", {}, "センサの値の動かし方 ", caseSel)),
    caseInfo,
    manualBox,
    soundBox,
    h("h3", { class: "panel-title" }, "仮想マイコンの中の値"),
    device.sensors.length ? h("p", { class: "hint" }, "センサ（入力）の値は、インタフェースで数にした値（A/D変換したあとの値）です。") : null,
    panel,
  );

  // ---- デバッグ（グラフ・ログ） ----
  const canvas = h("canvas", { class: "chart-canvas", role: "img", "aria-label": "センサと出力の値の変化のグラフ" });
  const logBox = h("ol", { class: "log-list", "aria-live": "off" });
  let debugTab = "graph";
  const debugBody = h("div");
  const debugTabs = h("div");
  const allCb = h("input", { type: "checkbox", id: `all-${s.id}` });
  allCb.addEventListener("change", () => {
    chartAll = allCb.checked;
    renderChart(true);
  });
  function setDebugTab(t) {
    debugTab = t;
    debugTabs.replaceChildren(tabs([["graph", "グラフ"], ["log", "ログ（記録）"]], t, setDebugTab, "デバッグの見方"));
    if (t === "graph") {
      debugBody.replaceChildren(canvas, h("label", { class: "check-item small", for: `all-${s.id}` }, allCb, "はじめから全部を表示（チェックなし：最近の30秒）"));
      renderChart(true);
    } else {
      debugBody.replaceChildren(logBox);
      renderLog();
    }
  }
  const debugCard = h("section", { class: "card debug-card", "aria-label": "デバッグ" }, h("h2", {}, "デバッグ"), h("p", { class: "hint" }, "センサの値と出力の動きを、同じ時間の目もりで見くらべよう。不合格のときは、ケース再生のあとに見ると原因が見つけやすくなります。"), debugTabs, debugBody);

  const chartSeries = () => {
    const list = [];
    const th = thresholdsOf(program);
    for (const x of device.sensors) list.push(x.max === 1 ? { name: x.name, min: x.min, max: x.max, step: true, show: (v) => (v ? "オン" : "オフ") } : { name: x.name, label: x.unit ? `${x.name}(${x.unit})` : x.name, min: x.min, max: x.max, scale: true, marks: th[x.name] || [] });
    for (const o of device.outputs) {
      if (o.kind === "display") continue;
      const k = OUTPUT_KINDS[o.kind];
      const [lo, hi] = k.range || (o.kind === "door" ? [-1, 1] : [0, 1]);
      list.push({ name: o.name, min: lo, max: hi, step: true, show: k.show, color: LAMP_COLORS[o.name] });
    }
    if (model.id === "door") list.push({ name: "ドアの開き", label: "ドアの開き(%)", min: 0, max: 100 });
    for (const v of Object.keys(sim?.vars || {})) if (typeof sim.vars[v] === "number") list.push({ name: v, label: `変数 ${v}` });
    return list;
  };

  function renderChart(force = false) {
    if (debugTab !== "graph" || !canvas.isConnected) return;
    const now = performance.now();
    if (!force && now - lastChart < 200) return;
    lastChart = now;
    // 不合格の時刻が「最近の30秒」より前なら、はじめから全部を出す
    const showAll = chartAll || (failMarkT !== null && sim.t - failMarkT > 28);
    drawChart(canvas, chartSeries(), sim.samples, showAll ? null : 30, failMarkT);
  }
  function renderLog() {
    if (debugTab !== "log") return;
    const items = sim.log.slice(-200).map((l) => h("li", { class: `log-${l.kind}` }, h("span", { class: "log-t" }, sec(l.t)), " ", l.text, l.line ? h("span", { class: "log-line" }, `（${l.line}行目）`) : null));
    if (!items.length) items.push(h("li", { class: "hint" }, "出力が変わると、ここに記録されます。"));
    logBox.replaceChildren(...items);
    logBox.scrollTop = logBox.scrollHeight;
  }

  // ---- テスト ----
  const testList = h(
    "ul",
    { class: "test-list" },
    s.tests.map((t) => h("li", {}, h("strong", {}, t.challenge ? "★ " : "", t.name), "：", t.description)),
  );
  const resultsBox = h("div", { "aria-live": "polite" });
  const testBtn = h("button", { type: "button", class: "btn", onclick: () => runTests() }, "✔ テストを実行");
  const memoBox = h("div");
  const historyBox = h("div");
  const testCard = s.tests.length
    ? h("section", { class: "card test-card", "aria-label": "テスト" }, h("h2", {}, "テスト（いろいろなケースで確かめる）"), h("p", {}, "次のケースで、プログラムが正しく動くかを自動で調べます。★はチャレンジ（できたらすごい）。"), testList, h("div", { class: "btn-row" }, testBtn), resultsBox, memoBox, historyBox)
    : h("section", { class: "card" }, h("h2", {}, "テスト"), h("p", {}, "この場面には決まったテストはありません。自分で「こうなったら、こう動くはず」と予想して、スライダで確かめよう。"));

  function runTests() {
    if (errors.length) {
      toast("まちがいを直してからテストしよう");
      return;
    }
    const results = runAllTests(model, program, s.tests);
    const passed = results.filter((r) => r.pass).length;
    const rec = store.addRecord({
      sid: s.id,
      title: s.title,
      passed,
      total: results.length,
      results: results.map((r) => ({ id: r.test.id, name: r.test.name, pass: r.pass, reason: r.failures[0]?.msg || "" })),
      program: text,
    });
    lastResults = { results, rec };
    resultsStale = false;
    renderNav(`s/${s.id}`);
    renderResults();
    renderMemo(rec);
    renderHistory();
  }

  // プログラムの上に出す短いまとめ（○×だけ）
  function renderMini() {
    if (!lastResults) return;
    const { results } = lastResults;
    const passed = results.filter((r) => r.pass).length;
    testMini.replaceChildren(
      h(
        "div",
        { class: `test-mini-box ${resultsStale ? "stale" : passed === results.length ? "good" : "warn"}` },
        h("strong", {}, resultsStale ? "前のプログラムのテスト結果（もう一度テストしよう）" : `テスト ${passed}/${results.length} 合格`),
        h("ul", { class: "test-mini-list" }, results.map((r) => h("li", { class: r.pass ? "pass" : "fail" }, r.pass ? "○ " : "× ", r.test.challenge ? "★ " : "", r.test.name))),
        resultsStale ? null : h("button", { type: "button", class: "linkish", onclick: () => resultsBox.scrollIntoView({ behavior: "smooth", block: "start" }) }, "くわしく見る（理由・再生）↓"),
      ),
    );
  }

  function renderResults() {
    if (!lastResults) return;
    renderMini();
    const { results } = lastResults;
    const passed = results.filter((r) => r.pass).length;
    const basic = results.filter((r) => !r.test.challenge);
    const allBasic = basic.every((r) => r.pass);
    const summary = passed === results.length ? explainCard("全部合格！", "すべてのケースで正しく動きました。どこを工夫したかを「改善メモ」に書いておこう。", "good") : allBasic ? explainCard("基本のテストは全部合格！", "★チャレンジにも挑戦してみよう。", "good") : explainCard(`${results.length}つのテストのうち ${passed}つ合格`, "不合格のケースを「再生」して、どこで思った通りに動かないのかを調べよう。", "warn");
    resultsBox.replaceChildren(
      ...[resultsStale ? explainCard("プログラムが変わりました", "下の結果は前のプログラムのものです。もう一度「テストを実行」しよう。", "warn") : null,
      summary].filter(Boolean),
      h(
        "ul",
        { class: "result-list" },
        results.map((r) =>
          h(
            "li",
            { class: r.pass ? "pass" : "fail" },
            h("div", { class: "result-head" }, h("span", { class: `status ${r.pass ? "good" : "bad"}` }, r.pass ? "○ 合格" : "× 不合格"), h("strong", {}, r.test.challenge ? "★ " : "", r.test.name), h("button", { type: "button", class: "btn secondary small", onclick: () => playCase(r.test.id) }, "▶ このケースを再生")),
            r.pass ? null : h("ul", { class: "fail-list" }, r.failures.slice(0, 3).map((f) => h("li", {}, f.msg))),
          ),
        ),
      ),
    );
  }

  // earlier: ページを開き直したとき、いちばん新しいテストの記録のメモを出す
  function renderMemo(rec, earlier = false) {
    const id = `memo-${s.id}`;
    const tx = h("textarea", { id, maxlength: "400", placeholder: "例: 〇〇を △△ に変えたら、「□□」のテストに合格した。そうしたのは、……だから。" });
    tx.value = rec.memo || "";
    const note = h("span", { class: "saved-note", "aria-live": "polite" });
    // 書いているそばから自動で保存する（「メモを保存」を押したときと同じ保存のしかた）
    const saveMemo = () => {
      store.setMemo(rec.id, tx.value.trim());
      renderHistory();
    };
    const flush = attachAutosave(tx, saveMemo, { onSaved: () => (note.textContent = AUTOSAVE_DONE) });
    memoBox.replaceChildren(
      h(
        "div",
        { class: "memo" },
        h("label", { for: id }, earlier ? `改善メモ（前回のテスト ${rec.passed}/${rec.total} 合格・${fmtTime(rec.at)} の記録）：どこを直したか・なぜそうしたか・気づいたこと` : "改善メモ：どこを直したか・なぜそうしたか・気づいたこと"),
        tx,
        h("div", { class: "hint autosave-hint" }, AUTOSAVE_HINT),
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn small", onclick: () => {
          flush();
          saveMemo();
          note.textContent = "このテストの記録に保存しました";
        } }, "メモを保存"), note),
      ),
    );
  }

  function renderHistory() {
    const rs = store.recordsOf(s.id).slice(-8).reverse();
    if (!rs.length) {
      historyBox.replaceChildren();
      return;
    }
    historyBox.replaceChildren(
      h("h3", {}, "この場面の改善の記録（新しい順）"),
      h("ol", { class: "mini-history" }, rs.map((r) => h("li", {}, h("span", { class: `status ${r.passed === r.total ? "good" : "warn"}` }, `${r.passed}/${r.total}`), " ", h("span", { class: "hint" }, fmtTime(r.at)), r.memo ? ` ${r.memo}` : ""))),
      h("p", {}, h("a", { href: "#/records" }, "すべての記録を見る・書き出す（ふりかえり・記録）")),
    );
  }

  // ---- シミュレーションの操作 ----
  function currentTest() {
    return s.tests.find((t) => t.id === caseId) || null;
  }

  function newSim() {
    pause();
    const test = currentTest();
    sim = new Sim(model, program, { timeline: test ? test.timeline : null, manual });
    failMarkT = null;
    caseInfo.replaceChildren(test ? h("p", { class: "hint" }, `${test.description}（${test.duration}秒）`) : h("span"));
    manualBox.hidden = Boolean(test);
    progress.hidden = !test;
    refreshAll(true);
  }

  function playCase(id) {
    caseId = id;
    caseSel.value = id;
    newSim();
    worldCard.scrollIntoView({ behavior: "smooth", block: "start" });
    run();
  }

  function run() {
    if (errors.length) {
      toast("まちがいを直してから実行しよう");
      return;
    }
    const test = currentTest();
    if (test && sim.t > test.duration) newSim();
    if (!sim.alive && sim.error) newSim();
    running = true;
    lastTs = null;
    acc = 0;
    runBtn.textContent = "⏸ 一時停止";
    raf = requestAnimationFrame(frame);
    refreshState();
  }

  function pause() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    runBtn.textContent = "▶ 実行";
    updateSound();
    if (sim) refreshState();
  }

  function frame(ts) {
    if (!running) return;
    if (lastTs === null) lastTs = ts;
    acc += Math.min(0.25, (ts - lastTs) / 1000) * speed;
    lastTs = ts;
    let n = 0;
    const test = currentTest();
    while (acc >= DT && n < 100) {
      acc -= DT;
      sim.tick();
      n++;
      if (sim.error) break;
      if (test && sim.t > test.duration + 1e-9) break;
    }
    if (n) refreshAll();
    if (sim.error) {
      pause();
      toast("プログラムでエラーが起きました（ログを見よう）");
      setDebugTab("log");
      return;
    }
    if (test && sim.t > test.duration + 1e-9) {
      pause();
      const r = runAllTests(model, program, [test])[0];
      const ts = r.failures.map((f) => f.t).filter((t) => typeof t === "number");
      failMarkT = ts.length ? Math.min(...ts) : null;
      nextEl.replaceChildren(r.pass ? explainCard("ケースの再生が終わりました", "このケースは合格です。", "good") : explainCard("ケースの再生が終わりました（不合格）", h("div", {}, h("ul", {}, r.failures.slice(0, 3).map((f) => h("li", {}, f.msg))), failMarkT !== null ? h("p", { class: "hint" }, "下の「デバッグ」のグラフの赤い点線が、不合格になった時刻です。") : null), "bad"));
      renderChart(true);
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function stepOnce() {
    if (errors.length) {
      toast("まちがいを直してから実行しよう");
      return;
    }
    if (running) pause();
    const test = currentTest();
    if (test && sim.t > test.duration) newSim();
    sim.step();
    refreshAll(true);
    const node = findNode(sim.currentId);
    const wait = sim.waiting();
    nextEl.replaceChildren(
      node
        ? h("p", { class: "next-line" }, h("strong", {}, "次に実行する命令："), `${node.line ? `${node.line}行目 ` : ""}`, h("code", {}, labelOf(node, outputNames)), wait ? `（あと ${fmt(wait)} 秒待つ）` : "")
        : h("p", { class: "next-line" }, sim.error ? "エラーで止まりました" : "プログラムは最後まで終わりました"),
    );
  }

  function findNode(id) {
    let found = null;
    if (id == null) return null;
    walkProgram(program, (n) => {
      if (n.id === id) found = n;
    });
    return found;
  }

  function refreshWorld() {
    // いまの時刻のセンサの値で絵をかく（一時停止中にスライダを動かしたときも、その値で表示しなおす）
    const pp = sim.peek();
    worldBox.innerHTML = model.draw(sim.state, sim.outputs, pp.env, pp.sensors, pp.derived);
    renderPanel(pp);
  }

  function renderPanel(p) {
    const row = (k, v, cls = "") => h("tr", { class: cls }, h("th", {}, k), h("td", {}, v));
    const rows = [];
    for (const x of device.sensors) rows.push(row(x.name, `${p.sensors[x.name]}${x.unit}`, "is-sensor"));
    for (const o of device.outputs) rows.push(row(o.name, OUTPUT_KINDS[o.kind].show(sim.outputs[o.name]), `is-output${sim.outputs[o.name] ? " on" : ""}`));
    for (const [k, v] of Object.entries(sim.vars)) rows.push(row(`変数 ${k}`, fmt(v), "is-var"));
    panel.replaceChildren(h("table", { class: "mcu-table" }, h("tbody", {}, rows)));
  }

  function refreshState() {
    timeEl.textContent = sec(sim.t);
    const w = sim.waiting();
    stateEl.textContent = sim.error ? "エラー" : running ? (w ? "待っている" : "実行中") : sim.tickN === 0 ? "停止中" : "一時停止";
    stateEl.className = `sim-state ${sim.error ? "bad" : running ? "good" : ""}`;
    const test = currentTest();
    if (test) progress.firstChild.style.width = `${Math.min(100, (sim.t / test.duration) * 100)}%`;
  }

  function highlight() {
    if (!sim) return;
    const id = sim.tickN === 0 && !sim.inTick ? null : sim.currentId;
    blockEd.highlight(id);
    flowBox.querySelectorAll(".fc-node.current").forEach((x) => x.classList.remove("current"));
    if (id != null) flowBox.querySelectorAll(`.fc-node[data-id="${id}"]`).forEach((x) => x.classList.add("current"));
    gutter.querySelectorAll(".current").forEach((x) => x.classList.remove("current"));
    const node = findNode(id);
    if (node?.line && editorTab === "text") gutter.querySelector(`[data-line="${node.line}"]`)?.classList.add("current");
  }

  function refreshAll(force = false) {
    refreshWorld();
    refreshState();
    highlight();
    renderChart(force);
    renderLog();
    if (force && !running) nextEl.replaceChildren();
    updateSound();
  }

  function updateSound() {
    const want = soundOn && running && sim && sim.outputs.ブザー;
    if (want && !audio) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.05;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        audio = { ctx, osc };
      } catch {
        audio = null;
      }
    } else if (!want && audio) {
      audio.osc.stop();
      audio.ctx.close();
      audio = null;
    }
  }

  // ---- 組み立て ----
  view.replaceChildren(head, h("div", { class: "workbench" }, editorCard, worldCard), debugCard, testCard);
  buildManual();
  setEditorTab(editorTab);
  newSim();
  setDebugTab("graph");
  renderHistory();
  // 前に書いた改善メモを、ページを開き直しても続きから書けるように出す
  const lastRec = s.tests.length ? store.recordsOf(s.id).at(-1) : null;
  if (lastRec) renderMemo(lastRec, true);
  showErrors();

  const onResize = () => renderChart(true);
  window.addEventListener("resize", onResize);
  cleanup = () => {
    pause();
    soundOn = false;
    updateSound();
    window.removeEventListener("resize", onResize);
  };
}

// 先生用ページへのかくれた入り口: 文字の欄の外で t e a c h e r と打つ
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

// ---------------- 左メニュー（ほかの教材と同じ形） ----------------
// 「信号機（時間で切りかえ）」の（…）は、メニューを細くしたときにかくせるように分けておく
function navTitle(title) {
  const m = /^(.+?)(（.+）)$/.exec(title);
  return m ? [m[1], h("span", { class: "nav-sub" }, m[2])] : [title];
}

function renderNav(current) {
  const link = (href, num, title, id, done) =>
    h(
      "li",
      { class: done ? "done" : "" },
      h("a", { href, "aria-current": current === id ? "page" : null }, h("span", { class: "num", "aria-hidden": "true" }, done ? "✓" : num), h("span", { class: "nav-title" }, ...navTitle(title), done ? h("span", { class: "visually-hidden" }, "（全部合格）") : null)),
    );
  const group = (title) => h("li", { class: "nav-group", "aria-hidden": "true" }, title);
  const ol = h("ol");
  ol.append(link("#/", "⌂", "はじめに", "", false));
  ol.append(group("場面"));
  for (const s of scenarios) {
    const best = store.best(s.id);
    ol.append(link(`#/s/${s.id}`, s.num, s.title, `s/${s.id}`, Boolean(s.tests.length && best && best.passed === best.total)));
  }
  ol.append(group("調べる・記録する"));
  ol.append(link("#/guide", "?", "書き方ガイド", "guide", false));
  ol.append(link("#/records", "✎", "ふりかえり・記録", "records", false));
  nav.replaceChildren(h("nav", { "aria-label": "ページ" }, ol));
}

// ---------------- ルーティング ----------------
function route() {
  flushAutosaves(); // ページを移る前に、まだ保存していない文を保存する
  cleanup?.();
  cleanup = null;
  const [page = "", arg] = location.hash.replace(/^#\/?/, "").split("/");
  renderNav(page === "s" ? `s/${arg}` : page);
  if (page === "s") {
    const sc = scenarios.find((x) => x.id === decodeURIComponent(arg || ""));
    renderScenario(decodeURIComponent(arg || ""));
    if (sc) view.append(reflectionBox(sc));
  }
  else if (page === "guide") renderGuide();
  else if (page === "records") renderRecords();
  else if (page === "teacher") renderTeacher();
  else renderHome();
  // 場面のページだけ、タブレット横では左のメニューを細くして、プログラムと仮想世界を広くする
  document.querySelector(".layout")?.classList.toggle("scn-mode", page === "s");
  window.scrollTo(0, 0);
}

function setupToggles() {
  const box = document.getElementById("display-toggles");
  const apply = () => document.documentElement.classList.toggle("large-text", Boolean(store.pref("largeText")));
  const b = h("button", { type: "button", class: "toggle ef-btn", "aria-pressed": store.pref("largeText") ? "true" : "false" }, "大きな文字");
  b.addEventListener("click", () => {
    store.setPref("largeText", !store.pref("largeText"));
    b.setAttribute("aria-pressed", store.pref("largeText") ? "true" : "false");
    apply();
  });
  box.replaceChildren(b);
  apply();
}

async function start() {
  try {
    scenarios = (await loadData("scenarios")).scenarios;
    // 画面に出す番号は丸数字（①〜④ 基本編、⑤ 発展編）。num は並びの番号
    for (const s of scenarios) s.label = "①②③④⑤⑥⑦⑧⑨"[s.num - 1] || String(s.num);
  } catch (e) {
    view.replaceChildren(h("p", {}, "データを読み込めませんでした。単一ファイル版（dist/計測制御シミュレータ.html）を使うか、Webサーバー経由で開いてください。"));
    return;
  }
  setupToggles();
  setupTeacherKeys();
  // 上の見出し（app-header）の高さ。ブロックの命令ボタンを、スクロールしてもその下に残すために使う
  const header = document.querySelector(".app-header");
  const setHeaderH = () => document.documentElement.style.setProperty("--header-h", `${header?.offsetHeight || 0}px`);
  setHeaderH();
  if (header && "ResizeObserver" in window) new ResizeObserver(setHeaderH).observe(header);
  window.addEventListener("hashchange", route);
  // ページを閉じる・ほかのページへ行く・アプリを切りかえるときにも、書いた文を保存する
  window.addEventListener("pagehide", flushAutosaves);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAutosaves();
  });
  route();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
}

start();
