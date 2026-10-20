// ふりかえり・記録: 各ページのふりかえり欄と、名前・進み具合・ふりかえりの一覧、JSON/CSV の書き出し（端末内でファイルを作るだけ。送信はしない）
import { h, toast, takeReflectionFocus, REFLECT_ATTR, recordsTitle } from "./ui.js";
import { store } from "./store.js";
import { tierSummary, tierLabel } from "./tasks.js";

// ふりかえりを書く場所（ページごと）
export const REFLECT = [
  { id: "diagram", title: "① 図解: 5つの装置", prompt: "コンピュータの5つの装置は、それぞれどんな役割をしていた？ データはどの順に流れた？" },
  { id: "auto", title: "② 手計算くらべ", prompt: "同じ計算を人とコンピュータでくらべたね。処理を自動化するよさと、注意することは何だと思う？" },
  { id: "sim", title: "③ 仮想CPUを動かす", prompt: "CPUが命令を「取り出し → 解読 → 実行」するようすを見て、気づいたことは？" },
  { id: "tasks", title: "④ 課題", prompt: "プログラムが思ったとおりに動かなかったとき、どこを見て、どう直した？" },
];

export function downloadFile(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// いま画面にあるふりかえり欄の書きかけを保存する（ページを移るとき・pagehide のとき app.js がよぶ）
let flushCurrent = null;
export function flushReflection() {
  flushCurrent?.();
}

// ふりかえり（「なぜそうなるのか」を自分の言葉で書く）
// 書いた文は、打って 400 ミリ秒後・ページを移るとき・pagehide のときに自動で保存する（保存ボタンと同じ保存場所）
export function reflectionBox(id) {
  flushCurrent = null;
  const r = REFLECT.find((x) => x.id === id);
  if (!r) return null;
  const tid = `reflect-${id}`;
  const ta = h("textarea", { id: tid, maxlength: "400", placeholder: "例: 〇〇だから、△△になる" });
  ta.value = store.getReflection(id);
  const note = h("div", { class: "saved-note", "aria-live": "polite" });
  let lastSaved = ta.value.trim();
  let timer = null;
  const autosave = () => {
    clearTimeout(timer);
    timer = null;
    const text = ta.value.trim();
    if (text === lastSaved) return;
    store.setReflection(id, text);
    lastSaved = text;
    note.style.color = "";
    note.textContent = "保存しました";
  };
  ta.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(autosave, 400);
  });
  flushCurrent = autosave;
  const saveBtn = h("button", { class: "btn", type: "button" }, "ふりかえりを保存");
  saveBtn.addEventListener("click", () => {
    autosave();
    const text = ta.value.trim();
    if (text.length < 5) {
      note.textContent = text ? "保存しました。もう少し書いてみよう（5文字以上）" : "もう少し書いてみよう（5文字以上）";
      note.style.color = "var(--warn)";
      return;
    }
    store.setReflection(id, text);
    lastSaved = text;
    note.style.color = "";
    note.textContent = "この端末に保存しました";
  });
  const box = h(
    "section",
    { class: "card reflection", ...REFLECT_ATTR },
    h("h2", {}, "ふりかえり"),
    h("label", { for: tid }, r.prompt),
    h("div", { class: "hint" }, "用語を覚えるだけでなく、「なぜそうなるのか」を自分の言葉で書こう。"),
    ta,
    h("p", { class: "hint" }, "書いた文は、自動でこの端末に保存されます。"),
    h("div", { class: "btn-row" }, saveBtn),
    note,
  );
  if (takeReflectionFocus()) {
    // ページの表示（いちばん上へもどす）が終わってから、ふりかえり欄まで動かす
    setTimeout(() => box.isConnected && box.scrollIntoView?.({ block: "center" }), 60);
  }
  return box;
}

// 進み具合: ✓ はやり終えたときだけ。開いただけのときは「開いた（とちゅう）」
export function progressText(id, tasks) {
  const st = store.state;
  if (id === "tasks") {
    const seen = tasks.filter((t) => store.answerViewed(t.id)).length;
    return `${tierSummary(tasks)}${seen ? `（答えの例を見た: ${seen}問）` : ""}`;
  }
  if (id === "diagram" || id === "auto") return store.isDone(id) ? "✓ やった" : st.visited[id] ? "開いた（とちゅう）" : "—";
  return st.visited[id] ? "開いた" : "—";
}

// 書き出す JSON（先生に出すファイル）。各課題のクリア・答えの例を見たか・最後のプログラムを入れる
export function exportData(tasks) {
  const st = store.state;
  return {
    app: "virtual-cpu",
    version: 1,
    exportedAt: new Date().toISOString(),
    student: st.student,
    visited: st.visited,
    done: st.done,
    cleared: st.cleared,
    answerViewed: st.answerViewed,
    tasks: tasks.map((t, i) => {
      const draft = store.getDraft(t.id);
      return {
        no: i + 1,
        id: t.id,
        title: t.title,
        tier: tierLabel(t.tier || "must"),
        cleared: st.cleared[t.id] || null,
        answerViewed: store.answerViewed(t.id),
        edited: draft !== undefined && draft !== null,
        program: draft ?? t.starter,
      };
    }),
    simProgram: store.getDraft("_free") ?? null,
    manual: st.manual,
    reflections: st.reflections,
  };
}

// 組と番号が入っていないと書き出さない（ほかの教材と同じ）
export function missingStudent(student) {
  return !String(student?.cls ?? "").trim() || !String(student?.num ?? "").trim();
}

export function renderRecords(view, { tasks }, rerender) {
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
  const rows = REFLECT.map((r) => h("tr", {}, h("td", {}, r.title), h("td", {}, progressText(r.id, tasks)), h("td", REFLECT_ATTR, store.getReflection(r.id) || "—")));
  const who = () => [st.student.cls, st.student.num, st.student.name].filter(Boolean).join("-") || "記録";
  const exportMsg = h("p", { class: "export-msg", role: "status", "aria-live": "polite" });
  // 書き出す前に、入力中の組・番号・名前も保存する（change を待たない）
  const readStudent = () => {
    const info = {};
    for (const k of ["cls", "num", "name"]) {
      const el = view.querySelector(`#stu-${k}`);
      if (el) info[k] = el.value.trim();
    }
    store.setStudent(info);
    return store.state.student;
  };
  const tryExport = (make) => {
    if (missingStudent(readStudent())) {
      exportMsg.className = "export-msg warn";
      exportMsg.textContent = "組と番号を入れてから書き出そう";
      return;
    }
    const filename = make();
    exportMsg.className = "export-msg good";
    exportMsg.textContent = `ファイルを保存しました（ファイル名: ${filename}）。先生に言われた場所に出そう。`;
  };
  const exportBtn = h("button", { type: "button", class: "btn" }, "記録を書き出す（JSON）");
  exportBtn.addEventListener("click", () =>
    tryExport(() => {
      const filename = `仮想CPU_${who()}.json`;
      downloadFile(filename, JSON.stringify(exportData(tasks), null, 2));
      return filename;
    }),
  );
  const csvBtn = h("button", { type: "button", class: "btn secondary" }, "CSVで書き出す");
  csvBtn.addEventListener("click", () =>
    tryExport(() => {
      const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [["組", "番号", "名前", "ページ", "進み具合", "ふりかえり"].map(q).join(",")];
      for (const r of REFLECT) lines.push([st.student.cls, st.student.num, st.student.name, r.title, progressText(r.id, tasks), store.getReflection(r.id)].map(q).join(","));
      const filename = `仮想CPU_${who()}.csv`;
      downloadFile(filename, "\ufeff" + lines.join("\r\n"), "text/csv");
      return filename;
    }),
  );
  const resetBtn = h("button", { type: "button", class: "btn secondary" }, "この端末の記録をすべて消す");
  resetBtn.addEventListener("click", () => {
    if (!confirm("進み具合・書いたプログラム・ふりかえりをすべて消します。よろしいですか？")) return;
    store.reset();
    toast("記録を消しました");
    rerender();
  });
  view.replaceChildren(
    h("div", { class: "page-head" }, h("h2", {}, recordsTitle()), h("p", { class: "muted" }, "記録はこの端末のブラウザの中だけに保存されます。提出するときは書き出したファイルを先生に渡します。")),
    h("section", { class: "card" }, h("h2", {}, "名前"), h("div", { class: "field-row" }, fields)),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "進み具合", h("span", REFLECT_ATTR, "とふりかえり")),
      h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "ページ"), h("th", {}, "進み具合"), h("th", REFLECT_ATTR, "ふりかえり"))), h("tbody", {}, rows))),
      h("p", { class: "hint", ...REFLECT_ATTR }, "ふりかえりは、それぞれのページのいちばん下で書けます。"),
      h("p", { class: "hint" }, h("strong", {}, "先生に出すのは JSON のファイルです。"), "JSON には、課題ごとに書いたプログラムと、答えの例を見たかも入ります。CSV は表で見たいときに使います。"),
      h("div", { class: "btn-row" }, exportBtn, csvBtn, exportMsg),
    ),
    h("section", { class: "card" }, h("h2", {}, "記録を消す"), h("p", { class: "hint" }, "次の人に端末をわたすときに使います。"), h("div", { class: "btn-row" }, resetBtn)),
  );
}
