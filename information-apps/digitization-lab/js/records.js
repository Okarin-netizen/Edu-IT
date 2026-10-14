// ふりかえり・記録: 名前の入力、進み具合とふりかえりの一覧、JSON/CSV の書き出し（端末内でファイルを作るだけ。送信はしない）
import { store } from "./store.js";
import { h, explainCard, downloadFile, toast } from "./ui.js";
import { moduleProgress } from "./catalog.js";
import { drillBestText } from "./digilib.js";

export function renderRecords(view, catalog) {
  const s = store.state;
  const field = (id, label, key, width) => {
    const input = h("input", { type: "text", id, value: s.student[key] || "", maxlength: "40", style: width ? `max-width:${width}` : null });
    input.addEventListener("change", () => store.setStudent({ [key]: input.value.trim() }));
    return h("div", { class: "field" }, h("label", { for: id }, label), input);
  };
  const rows = catalog.map((c) => {
    const p = moduleProgress(c);
    const best = c.id === "drill" ? drillBestText(s.modules.drill?.score) : "";
    return h(
      "tr",
      {},
      h("td", {}, `${c.num}. ${c.title}`),
      h("td", {}, p.complete ? "✓ 完了" : `${p.done} / ${p.total}`),
      h("td", {}, best ? `ドリル最高 ${best}` : ""),
      h("td", {}, store.getReflection(c.id) || h("span", { class: "hint" }, "（まだ書いていません）")),
    );
  });

  // 書き出す前に、組と番号が入っているかを確かめる（だれの記録か分からないファイルにしないため）
  const note = h("p", { class: "export-note", role: "status", "aria-live": "polite" });
  const setNote = (msg, kind) => {
    note.className = `export-note ${kind}`;
    note.textContent = msg;
  };
  const readFields = () => {
    // 入力したばかりの文字も使う（change が起きる前に押されたとき）
    const info = {};
    for (const [id, key] of [["rec-cls", "cls"], ["rec-num", "num"], ["rec-name", "name"]]) {
      const el = document.getElementById(id);
      if (el) info[key] = el.value.trim();
    }
    store.setStudent(info);
  };
  const doExport = (ext) => {
    readFields();
    const missing = missingFields(store.state.student);
    if (missing.length) {
      setNote(EXPORT_MESSAGES.missing, "warn");
      document.getElementById(missing[0] === "cls" ? "rec-cls" : "rec-num")?.focus();
      return;
    }
    const name = fileName(ext);
    if (ext === "json") downloadFile(name, JSON.stringify(buildExport(catalog), null, 2));
    else downloadFile(name, "\ufeff" + toCsv(buildExport(catalog)), "text/csv");
    setNote(EXPORT_MESSAGES.saved(name), "good");
  };
  const reset = () => {
    if (!confirm("この端末に保存した進み具合とふりかえりを、すべて消します。よろしいですか？")) return;
    store.reset();
    renderRecords(view, catalog);
    toast("記録を消しました");
  };

  view.replaceChildren(
    h("div", { class: "module-head" }, h("h1", {}, "ふりかえり・記録"), h("p", { class: "meta" }, "進み具合とふりかえりは、この端末のブラウザの中にだけ保存されています。提出するときは、ファイルに書き出してください。")),
    h("section", { class: "card" }, h("h2", {}, "名前"), h("div", { class: "field-row" }, field("rec-cls", "組", "cls", "8em"), field("rec-num", "番号", "num", "6em"), field("rec-name", "名前", "name"))),
    h("section", { class: "card" }, h("h2", {}, "進み具合とふりかえり"), h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "モジュール"), h("th", {}, "ステップ"), h("th", {}, "記録"), h("th", {}, "ふりかえり"))), h("tbody", {}, rows)))),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "書き出す"),
      h("p", {}, h("strong", {}, "先生に出すのは JSON のファイルです。"), "CSV は、表計算ソフトで見るときに使います。"),
      h("div", { class: "btn-row" }, h("button", { class: "btn", type: "button", onclick: () => doExport("json") }, "JSONで書き出す（提出用）"), h("button", { class: "btn secondary", type: "button", onclick: () => doExport("csv") }, "CSVで書き出す（表計算ソフト用）")),
      note,
      explainCard("書き出す中身", "名前、各モジュールの進み具合、ドリルの最高点（種類ごと）、ふりかえりの文章だけです。読み込んだ写真や録音した声は含まれません。"),
    ),
    h("section", { class: "card" }, h("h2", {}, "記録を消す"), h("p", { class: "hint" }, "次の人に端末をわたすときに使います。"), h("div", { class: "btn-row" }, h("button", { class: "btn secondary", type: "button", onclick: reset }, "この端末の記録をすべて消す"))),
  );
}

// 書き出しのときの文（どの教材でも同じ言い方）
export const EXPORT_MESSAGES = {
  missing: "組と番号を入れてから書き出そう",
  saved: (name) => `ファイルを保存しました（ファイル名: ${name}）。先生に言われた場所に出そう。`,
};
// 書き出しに足りない欄（組・番号）。空なら ["cls", "num"] のように返す
export function missingFields(student = {}) {
  return ["cls", "num"].filter((k) => !String(student[k] ?? "").trim());
}

export function fileName(ext) {
  const st = store.state.student;
  const who = [st.cls, st.num, st.name].filter(Boolean).join("_") || "記録";
  return `デジタル化ラボ_${who}.${ext}`.replace(/[\\/:*?"<>|]/g, "_");
}

export function buildExport(catalog) {
  const s = store.state;
  return {
    app: "デジタル化ラボ",
    exportedAt: new Date().toISOString(),
    student: s.student,
    modules: catalog.map((c) => {
      const p = moduleProgress(c);
      return { id: c.id, title: c.title, stepsDone: p.done, stepsTotal: p.total, complete: p.complete, score: s.modules[c.id]?.score || {}, reflection: store.getReflection(c.id) };
    }),
  };
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
function toCsv(data) {
  const head = ["組", "番号", "名前", "モジュール", "できたステップ", "全ステップ", "完了", "ドリル最高点", "ふりかえり"];
  const lines = data.modules.map((m) => {
    const best = drillBestText(m.score, true);
    return [data.student.cls, data.student.num, data.student.name, m.title, m.stepsDone, m.stepsTotal, m.complete ? "○" : "", best, m.reflection].map(csvCell).join(",");
  });
  return [head.map(csvCell).join(","), ...lines].join("\r\n");
}
