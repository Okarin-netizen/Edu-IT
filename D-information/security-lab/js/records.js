// ふりかえり・記録（エクスポート）と、先生用ページ（集計・設定・問題データの差し替え）
import { store } from "./store.js";
import { h, explainCard, toast, downloadFile, REFLECT_ATTR, recordsTitle } from "./ui.js";
import { CATALOG, moduleProgress } from "./catalog.js";
import { loadData, loadDefaultData, setOverride, listOverrides, DATA_NAMES } from "./data.js";
import { resetConfigCache, clearPrefs } from "./settings.js";
import { scoreRate } from "./check.js";

// ---- 書き出し ----
// 書き出すモジュール: 表示しているモジュールと、表示していなくても記録があるモジュール（SEC-54: 設定で外しても作業が消えない）
export function exportEntries(available) {
  const s = store.state;
  const has = (id) => Boolean(s.reflections[id]) || Object.keys(s.modules[id]?.steps || {}).length > 0 || Object.keys(s.modules[id]?.score || {}).length > 0;
  return [...available, ...CATALOG.filter((c) => !available.some((a) => a.id === c.id) && has(c.id))];
}

export function buildExport(available) {
  const s = store.state;
  const entries = exportEntries(available);
  return {
    app: "seclab",
    version: 2,
    exportedAt: new Date().toISOString(),
    student: s.student,
    progress: entries.map((c) => {
      const p = moduleProgress(c);
      return { module: c.id, title: c.title, doneSteps: p.done, totalSteps: p.total, completed: p.complete, score: s.modules[c.id]?.score || {} };
    }),
    checks: { pre: s.modules.check?.score?.["事前テスト"] || "", post: s.modules.check?.score?.["事後テスト"] || "" },
    reflections: entries.filter((c) => s.reflections[c.id]).map((c) => ({ module: c.id, title: c.title, text: s.reflections[c.id].text, at: s.reflections[c.id].at })),
  };
}

const CSV_HEADER = ["クラス", "番号", "名前", "モジュール", "達成ステップ", "全ステップ", "完了", "スコア", "ふりかえり", "ふりかえり日時"];
function csvCell(v) {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const scoreText = (score) => Object.entries(score || {}).map(([k, v]) => `${k}=${v}`).join(" ");
// 日時は、この端末の時刻（日本の時刻）で「2026-10-13 08:30」の形にする
const pad = (n) => String(n).padStart(2, "0");
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function localDateTime(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return iso || "";
  return `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function exportRows(exp) {
  const st = exp.student || {};
  const rows = exp.progress.map((p) => {
    const r = exp.reflections.find((x) => x.module === p.module);
    return [st.cls, st.num, st.name, p.title, p.doneSteps, p.totalSteps, p.completed ? "はい" : "いいえ", scoreText(p.score), r?.text, r ? localDateTime(r.at) : ""];
  });
  if (exp.checks && (exp.checks.pre || exp.checks.post)) rows.push([st.cls, st.num, st.name, "理解度チェック", "", "", "", `事前=${exp.checks.pre || "-"} 事後=${exp.checks.post || "-"}`, "", ""]);
  return rows;
}
// Excel で文字化けしないよう BOM を付ける
export const toCsv = (rows) => "﻿" + [CSV_HEADER, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
function fileStem(student) {
  const parts = [student?.cls, student?.num].filter(Boolean).join("-");
  return `seclab-${parts || "record"}-${localDate()}`;
}

// 記録ページの文（SEC-60。6つの教材で同じ決まり）
export const MSG_NEED_ID = "組と番号を入れてから書き出そう";
export const MSG_HAND_IN = "先生に出すのは JSON のファイルです";
export const MSG_IMPORT_CONFIRM = "今の記録が、読み込むファイルの記録に置きかわります。よろしいですか？";
export const savedMessage = (filename) => `ファイルを保存しました（ファイル名: ${filename}）。先生に言われた場所に出そう。`;
// 書き出してよいか（組と番号が両方あるか）
export const canExport = (student) => Boolean(String(student?.cls ?? "").trim() && String(student?.num ?? "").trim());
// この端末に、消えると困る記録があるか（読み込む前に確かめるため）
export function hasRecord(state = store.state) {
  const st = state.student || {};
  return Boolean(st.cls || st.num || st.name || Object.keys(state.reflections || {}).length || Object.values(state.modules || {}).some((m) => Object.keys(m?.steps || {}).length || Object.keys(m?.score || {}).length));
}

export function renderRecords(view, available, config, rerender, easy = "") {
  const s = store.state;
  const inputs = {};
  const fields = [
    ["cls", "クラス（組）", "例: 2年1組"],
    ["num", "出席番号", "例: 12"],
    ...(config.askName === false ? [] : [["name", "名前（書かなくてもよい）", "先生の指示にしたがって"]]),
  ].map(([key, label, ph]) => {
    const input = h("input", { type: "text", id: `stu-${key}`, value: s.student[key] || "", placeholder: ph, autocomplete: "off" });
    input.addEventListener("change", () => store.setStudent({ [key]: input.value.trim() }));
    inputs[key] = input;
    return h("div", { class: "field" }, h("label", { for: `stu-${key}` }, label), input);
  });
  // 入力欄の今の値を記録に入れる（「書き出す」を押す前に change が起きていなくても）
  const syncStudent = () => {
    const next = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value.trim()]));
    if (Object.entries(next).some(([k, v]) => (store.state.student[k] || "") !== v)) store.setStudent(next);
  };
  const progressRows = available.map((c) => {
    const p = moduleProgress(c);
    const r = s.reflections[c.id];
    return h("tr", {}, h("td", {}, h("a", { href: `#/${c.id}` }, c.title)), h("td", {}, p.complete ? "✓ 完了" : `${p.done} / ${p.total}`), h("td", REFLECT_ATTR, r ? r.text : h("span", { class: "hint" }, "まだ書いていません")));
  });
  const pre = s.modules.check?.score?.["事前テスト"];
  const post = s.modules.check?.score?.["事後テスト"];
  progressRows.push(h("tr", {}, h("td", {}, h("a", { href: "#/check" }, "理解度チェック")), h("td", {}, `事前 ${pre || "まだ"}・事後 ${post || "まだ"}`), h("td", REFLECT_ATTR, h("span", { class: "hint" }, "テストの点も、書き出すファイルに入ります"))));

  // 書き出し: 組と番号がないときは書き出さず、ボタンの横に知らせる
  const jsonMsg = h("span", { class: "export-msg", role: "status", "aria-live": "polite" });
  const subMsg = h("span", { class: "export-msg", role: "status", "aria-live": "polite" });
  const say = (el, text, kind) => {
    el.className = `export-msg ${kind || ""}`;
    el.textContent = text;
  };
  const doExport = (ext, msgEl) => {
    syncStudent();
    if (!canExport(store.state.student)) {
      say(msgEl, MSG_NEED_ID, "warn");
      (inputs.cls.value.trim() ? inputs.num : inputs.cls).focus();
      return;
    }
    const filename = `${fileStem(store.state.student)}.${ext}`;
    if (ext === "json") downloadFile(filename, JSON.stringify(buildExport(available), null, 2));
    else downloadFile(filename, toCsv(exportRows(buildExport(available))), "text/csv");
    say(msgEl, ext === "json" ? savedMessage(filename) : `ファイルを保存しました（ファイル名: ${filename}）。${MSG_HAND_IN}。`, "good");
  };

  const importInput = h("input", { type: "file", accept: "application/json,.json", class: "visually-hidden", id: "import-file" });
  importInput.addEventListener("change", async () => {
    const f = importInput.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data?.app !== "seclab" || !Array.isArray(data.progress) || !Array.isArray(data.reflections)) throw new Error();
      const modules = {};
      for (const p of data.progress) {
        const stepsDef = CATALOG.find((c) => c.id === p.module)?.module.steps || [];
        modules[p.module] = { steps: Object.fromEntries(stepsDef.slice(0, p.doneSteps).map((st) => [st.id, data.exportedAt])), score: p.score || {} };
      }
      if (data.checks) modules.check = { steps: {}, score: { ...(data.checks.pre ? { 事前テスト: data.checks.pre } : {}), ...(data.checks.post ? { 事後テスト: data.checks.post } : {}) } };
      const reflections = Object.fromEntries(data.reflections.map((r) => [r.module, { text: r.text, at: r.at }]));
      // 今の記録が置きかわるときは、先に確かめる
      if (hasRecord() && !confirm(MSG_IMPORT_CONFIRM)) {
        importInput.value = "";
        return;
      }
      store.replaceAll({ student: data.student, modules, reflections });
      toast("記録を読み込みました");
      rerender();
    } catch {
      toast("このファイルは読み込めませんでした");
    }
    importInput.value = "";
  });

  view.replaceChildren(
    h("div", { class: "module-head" }, h("h1", {}, recordsTitle()), h("p", { class: "meta" }, "記録はこの端末のブラウザの中だけに保存されています。先生に提出するときは、ファイルに書き出してください。"), easy),
    h("section", { class: "card" }, h("h2", {}, "あなたの情報"), h("div", { class: "field-row" }, fields)),
    h("section", { class: "card" }, h("h2", {}, "進み具合", h("span", REFLECT_ATTR, "とふりかえり")), h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "モジュール"), h("th", {}, "進み具合"), h("th", REFLECT_ATTR, "ふりかえり"))), h("tbody", {}, progressRows)))),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "ファイルに書き出す（提出用）"),
      h("p", {}, h("strong", {}, `${MSG_HAND_IN}。`), "クラス（組）と出席番号を入れてから、「JSONで書き出す」を押そう。"),
      h("div", { class: "btn-row" }, h("button", { class: "btn", type: "button", onclick: () => doExport("json", jsonMsg) }, "JSONで書き出す"), jsonMsg),
      explainCard("入っていないもの", "パスワード強度ラボやハッシュ体験で入力した文字は、どこにも保存されません。だから、書き出したファイルにも入りません。", "good"),
      h(
        "div",
        { class: "sub-tools" },
        h("h3", {}, "自分で見る・端末をかえるとき用"),
        h("p", { class: "hint" }, "CSV は、表計算ソフトで自分の記録を見るためのファイルです。「JSONから読み込む」は、前に書き出した自分の JSON を、この端末にもどすボタンです。"),
        h(
          "div",
          { class: "btn-row" },
          h("button", { class: "btn secondary", type: "button", onclick: () => doExport("csv", subMsg) }, "CSVで書き出す"),
          h("label", { for: "import-file", class: "btn secondary", tabindex: "0", role: "button", onkeydown: (e) => (e.key === "Enter" || e.key === " ") && importInput.click() }, "JSONから読み込む"),
          importInput,
          subMsg,
        ),
      ),
      h(
        "div",
        { class: "btn-row" },
        h(
          "button",
          {
            class: "btn small secondary",
            type: "button",
            onclick: () => {
              if (confirm("この端末の進み具合とふりかえりをすべて消します。よろしいですか？")) {
                store.reset();
                toast("記録を消しました");
                rerender();
              }
            },
          },
          "記録をすべて消す",
        ),
      ),
    ),
  );
}

// ---- 先生用 ----
// 「この端末に反映」の前の確認（SEC-54）
export const CONFIRM_APPLY = "この端末のモジュールの表示が変わります。先生の指示がないときは押さないでください。\n反映しますか？";
export function renderTeacher(view, available, config, rerender) {
  // 集計
  const out = h("div", { "aria-live": "polite" });
  const input = h("input", { type: "file", accept: "application/json,.json", multiple: true, id: "teacher-files" });
  input.addEventListener("change", async () => {
    const records = [];
    const errors = [];
    for (const f of input.files) {
      try {
        const d = JSON.parse(await f.text());
        // 形のちがうファイル（progress・reflections が配列でない）は、集計の途中で止まらないよう読み込まない
        if (d?.app !== "seclab" || !Array.isArray(d.progress) || !Array.isArray(d.reflections)) throw new Error();
        records.push(d);
      } catch {
        errors.push(f.name);
      }
    }
    records.sort((a, b) => `${a.student?.cls}`.localeCompare(`${b.student?.cls}`, "ja") || Number(a.student?.num) - Number(b.student?.num));
    const rows = records.flatMap(exportRows);
    const ids = [...new Set(records.flatMap((r) => r.progress.map((p) => p.module)))];
    const summary = ids.map((id) => {
      const title = CATALOG.find((c) => c.id === id)?.title || id;
      const done = records.filter((r) => r.progress.find((p) => p.module === id)?.completed).length;
      const reflected = records.filter((r) => r.reflections.some((x) => x.module === id)).length;
      return h("tr", {}, h("td", {}, title), h("td", {}, `${done} / ${records.length} 人`), h("td", {}, `${reflected} / ${records.length} 人`));
    });
    const pct = (v) => `${Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100)}%`;
    const avg = (key) => {
      const v = records.map((r) => scoreRate(r.checks?.[key])).filter((x) => x !== null);
      return v.length ? `${pct(v)}（${v.length}人）` : "—";
    };
    // 伸びは、事前と事後の両方がある生徒だけでくらべる（SEC-55）
    const both = records.filter((r) => scoreRate(r.checks?.pre) !== null && scoreRate(r.checks?.post) !== null);
    const growth = both.length ? `事前 ${pct(both.map((r) => scoreRate(r.checks.pre)))} → 事後 ${pct(both.map((r) => scoreRate(r.checks.post)))}（${both.length}人）` : "—";
    out.replaceChildren(
      h("p", {}, `${records.length} 人分を読み込みました。`),
      errors.length ? explainCard("読み込めなかったファイル", errors.join("、"), "warn") : "",
      h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "モジュール"), h("th", {}, "完了"), h("th", {}, "ふりかえり記入"))), h("tbody", {}, summary))),
      h("p", {}, `理解度チェックの平均正答率: 事前 ${avg("pre")}・事後 ${avg("post")}`),
      h("p", {}, `事前と事後の両方を受けた生徒の伸び: ${growth}`),
      h("p", { class: "hint" }, "事前テスト・事後テストは、どちらも1回目の点が記録されています。"),
      h("div", { class: "btn-row" }, h("button", { class: "btn", type: "button", onclick: () => downloadFile(`seclab-class-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), "text/csv") }, "まとめてCSVで保存")),
    );
  });

  // 設定
  const modBoxes = CATALOG.map((c) => ({ id: c.id, input: h("input", { type: "checkbox", checked: available.some((a) => a.id === c.id) ? true : null }) }));
  const flag = (key, label) => ({ key, input: h("input", { type: "checkbox", checked: config[key] ? true : null }), label });
  const flags = [flag("ruby", "ふりがなを最初から表示する"), flag("easy", "やさしい日本語のまとめを最初から表示する"), flag("largeText", "文字を大きくして表示する"), flag("askName", "記録ページで名前を入力させる")];
  const rateSel = h("select", { id: "cfg-rate" }, [3, 10, 12].map((r) => h("option", { value: r, selected: Number(config.defaultAttackRate ?? 10) === r ? true : null }, r === 3 ? "1秒に1,000回" : r === 10 ? "1秒に100億回" : "1秒に1兆回")));
  const buildConfig = () => ({
    ...config,
    enabledModules: modBoxes.filter((b) => b.input.checked).map((b) => b.id),
    ...Object.fromEntries(flags.map((f) => [f.key, f.input.checked])),
    defaultAttackRate: Number(rateSel.value),
  });

  // 問題データの差し替え
  const dataName = h("select", { id: "data-name" }, DATA_NAMES.map((n) => h("option", { value: n }, `${n}.json`)));
  const dataFile = h("input", { type: "file", accept: "application/json,.json", id: "data-file" });
  const overrides = h("p", { class: "hint" });
  const showOverrides = () => {
    const list = listOverrides();
    overrides.textContent = list.length ? `この端末で差し替え中: ${list.map((n) => `${n}.json`).join("、")}` : "差し替えているデータはありません（標準の問題を使っています）。";
  };
  showOverrides();

  view.replaceChildren(
    h("div", { class: "module-head" }, h("h1", {}, "先生用ページ"), h("p", { class: "meta" }, "集計・設定・問題データの差し替えができます。ファイルはこの端末の中で読むだけで、どこにも送信しません。"), h("p", { class: "hint" }, "このページは、生徒の章ナビには出ません。開くときは、アドレスの最後に #/teacher を付けます（例: security-lab.html#/teacher）。")),
    h("section", { class: "card" }, h("h2", {}, "クラスの記録を集計する"), h("p", {}, "生徒が「ふりかえり・記録」で書き出した JSON ファイルをまとめて選ぶと、クラス全体の表を作れます。"), h("div", { class: "field" }, h("label", { for: "teacher-files" }, "生徒の JSON ファイル（複数選択できます）"), input), out),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "設定"),
      h("p", {}, "使うモジュールや表示を選びます。「この端末に反映」はこの端末だけに、「設定ファイルを書き出す」でできた config.json を data フォルダに置くと、配布するすべての端末に反映されます。"),
      h("fieldset", { class: "action-group" }, h("legend", {}, "使うモジュール"), h("div", { class: "check-list" }, modBoxes.map((b) => h("label", { class: "check-item" }, b.input, h("span", {}, CATALOG.find((c) => c.id === b.id).title))))),
      h("fieldset", { class: "action-group" }, h("legend", {}, "表示"), h("div", { class: "check-list" }, flags.map((f) => h("label", { class: "check-item" }, f.input, h("span", {}, f.label))))),
      h("div", { class: "field" }, h("label", { for: "cfg-rate" }, "パスワード強度ラボの「攻撃する側の速さ」の初期値"), rateSel),
      h(
        "div",
        { class: "btn-row" },
        h(
          "button",
          {
            class: "btn",
            type: "button",
            onclick: () => {
              if (!confirm(CONFIRM_APPLY)) return;
              setOverride("config", buildConfig());
              resetConfigCache();
              clearPrefs();
              toast("この端末に反映しました");
              rerender();
            },
          },
          "この端末に反映",
        ),
        h("button", { class: "btn secondary", type: "button", onclick: () => downloadFile("config.json", JSON.stringify(buildConfig(), null, 1)) }, "設定ファイルを書き出す"),
        h(
          "button",
          {
            class: "btn small secondary",
            type: "button",
            onclick: () => {
              setOverride("config", null);
              resetConfigCache();
              clearPrefs();
              toast("標準の設定に戻しました");
              rerender();
            },
          },
          "標準に戻す",
        ),
      ),
      h("p", { class: "hint" }, "「標準に戻す」は、この端末で「この端末に反映」した設定を消して、配ったときの設定（ふつうは、すべてのモジュールを表示）にもどします。表示の切りかえ（ふりがな など）も、はじめの状態にもどります。問題データの差し替えは、そのままです。"),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "問題データを差し替える"),
      h("p", {}, "フィッシングの場面、理解度チェックの問題、著作権クイズ、ロールプレイのストーリーなどは JSON ファイルです。標準のデータを書き出して編集し、読み込むと、この端末の問題が差し替わります。"),
      h("div", { class: "field-row" }, h("div", { class: "field" }, h("label", { for: "data-name" }, "データの種類"), dataName), h("div", { class: "field" }, h("label", { for: "data-file" }, "読み込むファイル"), dataFile)),
      h(
        "div",
        { class: "btn-row" },
        h("button", { class: "btn secondary", type: "button", onclick: async () => downloadFile(`${dataName.value}.json`, JSON.stringify(await loadData(dataName.value), null, 1)) }, "今のデータを書き出す"),
        h(
          "button",
          {
            class: "btn",
            type: "button",
            onclick: async () => {
              const f = dataFile.files[0];
              if (!f) return toast("ファイルを選んでください");
              try {
                const value = JSON.parse(await f.text());
                const def = await loadDefaultData(dataName.value);
                const missing = Object.keys(def).filter((k) => !k.startsWith("_") && !(k in value));
                if (missing.length) throw new Error(`必要な項目がありません: ${missing.join(", ")}`);
                setOverride(dataName.value, value);
                if (dataName.value === "config") resetConfigCache();
                showOverrides();
                toast(`${dataName.value}.json を差し替えました`);
              } catch (e) {
                toast(e.message?.startsWith("必要") ? e.message : "JSON として読み込めませんでした");
              }
            },
          },
          "読み込んで差し替える",
        ),
        h(
          "button",
          {
            class: "btn small secondary",
            type: "button",
            onclick: () => {
              listOverrides().forEach((n) => setOverride(n, null));
              resetConfigCache();
              showOverrides();
              toast("標準のデータに戻しました");
              rerender();
            },
          },
          "すべて標準に戻す",
        ),
      ),
      overrides,
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "授業での使い方のヒント"),
      h(
        "ul",
        {},
        h("li", {}, "1モジュールは10〜15分が目安です（暗号ラボは2回に分けても）。導入やまとめの時間にも使えます。"),
        h("li", {}, "はじめに「理解度チェック」の事前テスト、単元の終わりに事後テストを行うと、伸びを確かめられます。"),
        h("li", {}, "ふりかえりの「なぜその対策が有効か」を、ペアやグループで紹介し合うと理解が深まります。"),
        h("li", {}, "まとめ・行動宣言のカードを印刷して、家庭に持ち帰ってもらうのもおすすめです。"),
      ),
    ),
  );
}
