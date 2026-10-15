// 教材集の外わく: メニューを出し、選ばれた教材を iframe の中で開く。
// 一度開いた教材は閉じずに隠すだけなので、メニューに戻っても途中の作業は消えない。
"use strict";
(() => {
  const DATA = JSON.parse(document.getElementById("kyozai-data").textContent);
  const byId = new Map(DATA.materials.map((m) => [m.id, m]));
  const menu = document.getElementById("menu");
  const stage = document.getElementById("stage");
  const nowTitle = document.getElementById("now-title");
  const switcher = document.getElementById("switcher");
  const switchWrap = document.getElementById("switch-wrap");
  const switchBtn = document.getElementById("switch-btn");
  const frames = new Map();

  // 上のバーの「ふりがな」「大きな文字」（KS-01）: 6つの教材とこのメニューにかかる。
  // 表示の設定なので「はじめからやり直す」でも消さない（resetKeys に入れない）
  const PREFS_KEY = "kyozai.prefs.v1";
  let prefs = { ruby: false, largeText: false };
  try {
    const v = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    if (v && typeof v === "object") prefs = { ruby: Boolean(v.ruby), largeText: Boolean(v.largeText) };
  } catch {}
  const tgRuby = document.getElementById("tg-ruby");
  const tgLarge = document.getElementById("tg-large");
  const shellRuby = kyozaiRuby(document, DATA.rubyWords || {}, [".shell-header", "#stage"]);
  function applyPrefs() {
    tgRuby.setAttribute("aria-pressed", String(prefs.ruby));
    tgLarge.setAttribute("aria-pressed", String(prefs.largeText));
    document.documentElement.classList.toggle("large-text", prefs.largeText && document.body.classList.contains("home-mode"));
    shellRuby.set(prefs.ruby, document.body);
    for (const f of frames.values()) applyPrefsTo(f);
  }
  function applyPrefsTo(f) {
    try {
      f.contentWindow?.kyozaiDisplay?.set(prefs);
    } catch {}
  }
  function togglePref(key) {
    prefs = { ...prefs, [key]: !prefs[key] };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
    applyPrefs();
  }
  tgRuby.addEventListener("click", () => togglePref("ruby"));
  tgLarge.addEventListener("click", () => togglePref("largeText"));

  // 開いたことのある教材と、さいごに開いた教材（このパソコンのブラウザの中だけに保存）
  const SEEN_KEY = "kyozai.seen.v1";
  let seen = { opened: [], last: null };
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) || "null");
    if (v && Array.isArray(v.opened)) seen = { opened: v.opened.filter((id) => byId.has(id)), last: byId.has(v.last) ? v.last : null };
  } catch {}
  function markSeen(id) {
    if (!seen.opened.includes(id)) seen.opened.push(id);
    seen.last = id;
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {}
  }

  // SEC-23: 教材ごとに、さいごに開いていた教材の中のページ（#/crypto など）を覚えておき、
  // 再読みこみのあとに教材を開き直したときは、そこへもどる。
  // NW-18: ほかの教材の案内から移ってきたときの「もどる先」も、ここに覚える。
  // sessionStorage（このタブの中だけ）なので、ブラウザを閉じれば消える。全リセットでも消す。
  const PLACE_KEY = "kyozai.place.v1";
  const INNER_RE = /^#\/[\w/-]*$/;
  let place = { inner: {}, back: {} };
  try {
    const v = JSON.parse(sessionStorage.getItem(PLACE_KEY) || "null");
    if (v && typeof v === "object") {
      for (const [id, hs] of Object.entries(v.inner || {})) if (byId.has(id) && INNER_RE.test(hs)) place.inner[id] = hs;
      for (const [id, b] of Object.entries(v.back || {})) if (byId.has(id) && b && byId.has(b.id) && INNER_RE.test(b.hash || "#/")) place.back[id] = { id: b.id, hash: b.hash || "#/" };
    }
  } catch {}
  function savePlace() {
    try {
      sessionStorage.setItem(PLACE_KEY, JSON.stringify(place));
    } catch {}
  }
  function rememberInner(id, hash) {
    if (!INNER_RE.test(hash) || hash === "#/") delete place.inner[id];
    else place.inner[id] = hash;
    savePlace();
  }
  function applyBackTo(f) {
    const b = place.back[f.dataset.id];
    try {
      f.contentWindow?.kyozaiBack?.set(b ? { id: b.id, hash: b.hash, title: byId.get(b.id).title } : null);
    } catch {}
  }

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null) el.append(k);
    return el;
  }

  function renderMenu() {
    const order = DATA.materials.map((m) => m.id);
    const card = (m) =>
      h(
        "a",
        { class: "mcard ef-card" + (seen.opened.includes(m.id) ? " seen" : ""), href: `#/${m.id}` },
        h("img", { src: m.iconData, alt: "" }),
        h("span", { class: "tag ef-card-tag" }, h("span", { class: "order" }, `おすすめ ${order.indexOf(m.id) + 1}番`)),
        h("span", { class: "t ef-card-title" }, m.title),
        h("span", { class: "d" }, m.desc),
        h("span", { class: "go ef-btn-primary", "aria-hidden": "true" }, "開く ▶"),
        seen.opened.includes(m.id) ? h("span", { class: "seen-mark" }, "✓ 開いたことがある") : null,
      );
    menu.replaceChildren(
      h("div", { class: "hero" }, h("h1", {}, DATA.title), h("p", { class: "lead" }, DATA.lead), h("p", { class: "author" }, DATA.author)),
      renderNext(order),
      ...DATA.groups.map((g) =>
        h("section", { class: "group", "aria-labelledby": `g-${g.id}` }, h("h2", { id: `g-${g.id}` }, g.title), h("div", { class: "grid" }, g.items.map((id) => card(byId.get(id))))),
      ),
      renderExport(),
      h(
        "section",
        { class: "note", "aria-labelledby": "g-teacher" },
        h("h2", { id: "g-teacher" }, "先生へ"),
        h(
          "ul",
          {},
          h("li", {}, "インターネットにつながっていなくても使えます。入力した内容や記録は、このパソコンのブラウザの中にだけ保存されます。"),
          h("li", {}, "記録の提出は、上の「記録をまとめて書き出す」で、6つの教材の記録を1つの JSON ファイルにして出せます。教材ごとの「ふりかえり・記録」からも書き出せます。"),
          h("li", {}, "教材を開いているときは、上のバーの教材の名前（はばがせまい画面では「教材をかえる ▾」）で教材を切りかえられます。切りかえても、開いていた教材の作業は消えません。"),
          h("li", {}, "上のバーの「ふりがな」「大きな文字」は、6つの教材とこのメニューにまとめてかかります。プログラムを書く欄や入力欄には、ふりがなは付きません。"),
          h("li", {}, "「情報セキュリティ体験ラボ」の「デジタル化と情報量」「ネットワーク通信の模擬」は短い体験版です。くわしく扱うときは、その単元のさいご（ふりかえりのあと）の案内から「デジタル化ラボ」「ネットワーク通信シミュレータ」に移れます。移った先のページの上と下に「← 情報セキュリティ体験ラボにもどる」が出ます。"),
          renderCurriculum(),
        ),
      ),
      h(
        "section",
        { class: "note reset", "aria-labelledby": "g-reset" },
        h("h2", { id: "g-reset" }, "はじめからやり直す"),
        h("p", {}, "次の人にパソコンをわたすときに使います。6つの教材の名前・進み具合・ふりかえり・作ったプログラムや作品と、このメニューの「開いたことがある」の印・「記録をまとめて書き出す」の組・番号・名前を、すべて消します。ふりがな・文字の大きさなどの表示の設定と、先生用ページで差し替えた問題データは残ります。"),
        h("button", { type: "button", class: "reset-btn ef-btn", id: "reset-all" }, "この端末の記録をすべて消す"),
        h("p", { class: "reset-msg", id: "reset-msg", role: "status" }, resetMsg),
      ),
    );
    document.getElementById("reset-all").addEventListener("click", resetAll);
  }

  // KS-09: 学習指導要領との対応は、生徒向けのカードには出さず、「先生へ」にまとめる
  function renderCurriculum() {
    const C = DATA.curriculum;
    if (!C) return null;
    return h(
      "li",
      { class: "curriculum" },
      `${C.note}: `,
      DATA.materials.map((m) => `${m.title} ${m.tag}`).join("、"),
      "。",
      h("span", { class: "curr-key" }, Object.entries(C.items).map(([k, v]) => `${k} ${v}`).join("／")),
    );
  }

  // ================= 記録をまとめて書き出す（KS-05） =================
  // 6つの教材の記録（resetKeys にあるキー）を読むだけで、教材の保存場所には書きこまない。
  const STUDENT_KEY = "kyozai.student.v1";
  function loadStudent() {
    try {
      const v = JSON.parse(localStorage.getItem(STUDENT_KEY) || "null");
      if (v && typeof v === "object") return { cls: String(v.cls || ""), num: String(v.num || ""), name: String(v.name || "") };
    } catch {}
    return { cls: "", num: "", name: "" };
  }
  function saveStudent(st) {
    try {
      localStorage.setItem(STUDENT_KEY, JSON.stringify(st));
    } catch {}
  }
  function readKey(k) {
    let raw = null;
    try {
      raw = localStorage.getItem(k);
    } catch {}
    if (raw == null) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  // 日本の時刻（2026-10-13 14:05）
  function japanTime(d, withTime = true) {
    const t = new Date(d.getTime() + 9 * 3600 * 1000).toISOString();
    return withTime ? `${t.slice(0, 10)} ${t.slice(11, 16)}` : t.slice(0, 10);
  }
  function fmtAt(v) {
    const d = typeof v === "string" || typeof v === "number" ? new Date(v) : null;
    return d && !isNaN(d) ? japanTime(d) : "";
  }
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const SCORE_NAMES = { best: "最高", last: "前回" };
  function fmtScore(score) {
    if (!isObj(score)) return "";
    return Object.entries(score)
      .map(([k, v]) => {
        const name = SCORE_NAMES[k] || k;
        if (isObj(v) && "correct" in v && "total" in v) return `${name} ${v.correct}/${v.total}`;
        if (v == null || typeof v === "object") return `${name} ${JSON.stringify(v).slice(0, 80)}`;
        return `${name} ${v}`;
      })
      .join("、");
  }
  // 1つの教材の記録を、先生が読みやすい形にする（もとのデータは raw にそのまま入れる）
  function summarize(m) {
    const name = (id) => (m.recordNames && m.recordNames[id]) || id;
    const keys = (DATA.resetKeys || []).filter((k) => m.storagePrefix && k.startsWith(m.storagePrefix) && !/\.backup$/.test(k));
    const raw = {};
    for (const k of keys) {
      const v = readKey(k);
      if (v !== undefined) raw[k] = v;
    }
    const progress = [];
    const reflections = [];
    let student = null;
    const takeStudent = (st) => {
      if (isObj(st) && (st.cls || st.num || st.name)) student = { cls: String(st.cls || ""), num: String(st.num || ""), name: String(st.name || "") };
    };
    for (const [k, s] of Object.entries(raw)) {
      if (!isObj(s)) continue;
      if (/\.student\./.test(k)) {
        takeStudent(s);
        continue;
      }
      takeStudent(s.student);
      if (isObj(s.reflections))
        for (const [id, r] of Object.entries(s.reflections)) {
          const text = typeof r === "string" ? r : isObj(r) ? String(r.text || "") : "";
          if (text.trim()) reflections.push({ page: name(id), text, at: isObj(r) ? fmtAt(r.at) : "" });
        }
      if (isObj(s.modules))
        for (const [id, mod] of Object.entries(s.modules)) {
          if (!isObj(mod)) continue;
          const steps = isObj(mod.steps) ? Object.keys(mod.steps).length : 0;
          const sc = fmtScore(mod.score);
          if (steps || sc) progress.push({ page: name(id), detail: [steps ? `できたステップ ${steps}` : "", sc].filter(Boolean).join("／") });
        }
      if (isObj(s.visited) && Object.keys(s.visited).length) progress.push({ page: "見たページ", detail: Object.keys(s.visited).map(name).join("、") });
      if (isObj(s.cleared) && Object.keys(s.cleared).length) progress.push({ page: "クリアした課題", detail: `${Object.keys(s.cleared).length}つ: ${Object.keys(s.cleared).map(name).join("、")}` });
      if (isObj(s.manual) && typeof s.manual.seconds === "number") progress.push({ page: name("auto"), detail: `手計算 ${s.manual.seconds.toFixed(1)}秒` });
      if (isObj(s.drafts) && Object.keys(s.drafts).length) progress.push({ page: "書いたプログラム", detail: `${Object.keys(s.drafts).length}つ（中身は raw に入っています）` });
      if (Array.isArray(s.records)) {
        const bySid = new Map();
        for (const r of s.records) if (isObj(r)) bySid.set(r.sid, [...(bySid.get(r.sid) || []), r]);
        for (const [sid, rs] of bySid) {
          const best = rs.reduce((a, r) => ((r.passed || 0) > (a.passed || 0) ? r : a), rs[0]);
          const memos = rs.map((r) => (typeof r.memo === "string" ? r.memo.trim() : "")).filter(Boolean);
          progress.push({ page: name(sid), detail: [`テスト ${rs.length}回`, `いちばんよい結果 ${best.passed ?? "?"}/${best.total ?? "?"}`, memos.length ? `改善メモ: ${memos.join(" / ")}` : ""].filter(Boolean).join("／") });
        }
      }
      if (Array.isArray(s.works))
        for (const w of s.works) {
          if (!isObj(w)) continue;
          const plan = isObj(w.plan) ? w.plan : {};
          const parts = [["だれの", plan.who], ["困りごと", plan.problem], ["くふう", plan.idea], ["確かめ方", plan.test], ["改善", plan.improve]].filter(([, v]) => typeof v === "string" && v.trim()).map(([l, v]) => `${l}: ${v.trim()}`);
          const page = `作品「${w.title || "名前のない作品"}」`;
          progress.push({ page, detail: parts.join("／") || "作品を作った", at: fmtAt(w.updatedAt) });
          if (typeof plan.reflect === "string" && plan.reflect.trim()) reflections.push({ page, text: plan.reflect, at: fmtAt(w.updatedAt) });
        }
      if (isObj(s.boxes)) {
        const list = Object.entries(s.boxes).filter(([, b]) => isObj(b) && Array.isArray(b.records));
        if (list.length) progress.push({ page: "サーバーのデータ", detail: list.map(([n, b]) => `${n}: ${b.records.length}件`).join("、") });
      }
    }
    return { id: m.id, title: m.title, hasRecord: Boolean(student || progress.length || reflections.length), studentInMaterial: student, progress, reflections, raw };
  }

  function exportFileName(st, ext) {
    const clean = (v, tail) => v.normalize("NFKC").trim().replace(new RegExp(tail + "$"), "").replace(/[\\/:*?"<>|\s]+/g, "-");
    return `情報の技術_記録まとめ_${clean(st.cls, "組")}組${clean(st.num, "番")}番_${japanTime(new Date(), false)}.${ext}`;
  }
  function downloadFile(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h("a", { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function buildExport(st) {
    const list = DATA.materials.map(summarize);
    const now = new Date();
    return {
      app: DATA.title,
      kind: "記録まとめ",
      version: 1,
      exportedAt: now.toISOString(),
      exportedAtJapan: japanTime(now),
      student: st,
      noRecordYet: list.filter((x) => !x.hasRecord).map((x) => x.title),
      materials: list,
    };
  }
  const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  function toCsv(data) {
    const st = data.student;
    const rows = [["組", "番号", "名前", "教材", "種類", "ページ", "内容", "日時"]];
    for (const m of data.materials) {
      if (!m.hasRecord) rows.push([st.cls, st.num, st.name, m.title, "記録なし", "", "", ""]);
      for (const p of m.progress) rows.push([st.cls, st.num, st.name, m.title, "進み具合", p.page, p.detail, p.at || ""]);
      for (const r of m.reflections) rows.push([st.cls, st.num, st.name, m.title, "ふりかえり", r.page, r.text, r.at]);
    }
    return "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  }

  function renderExport() {
    const st = loadStudent();
    const msg = h("p", { class: "export-msg", id: "export-msg", role: "status", "aria-live": "polite" });
    const inputs = {};
    const field = (key, label, cls, size) => {
      const input = h("input", { type: "text", id: `ex-${key}`, value: st[key], maxlength: "40", autocomplete: "off", size });
      input.addEventListener("input", () => {
        st[key] = input.value.normalize("NFKC").trim();
        input.removeAttribute("aria-invalid");
        saveStudent(st);
      });
      inputs[key] = input;
      return h("div", { class: "field " + cls }, h("label", { for: `ex-${key}` }, label), input);
    };
    const status = DATA.materials.map((m) => {
      const s = summarize(m);
      const bits = [s.reflections.length ? `ふりかえり ${s.reflections.length}` : "", s.progress.length ? `進み具合 ${s.progress.length}こ` : ""].filter(Boolean).join("・");
      return h("li", { class: s.hasRecord ? "has" : "none" }, h("span", { class: "mark", "aria-hidden": "true" }, s.hasRecord ? "✓" : "—"), h("span", {}, `${m.title}: `, s.hasRecord ? `記録あり（${bits || "名前だけ"}）` : "まだ記録なし"));
    });
    const run = (ext) => {
      const missing = ["cls", "num"].filter((k) => !st[k]);
      for (const k of ["cls", "num"]) inputs[k].toggleAttribute("aria-invalid", missing.includes(k));
      if (missing.length) {
        msg.className = "export-msg warn";
        msg.textContent = "組と番号を入れてから書き出そう";
        inputs[missing[0]].setAttribute("aria-invalid", "true");
        inputs[missing[0]].focus();
        return;
      }
      const data = buildExport({ ...st });
      const name = exportFileName(st, ext);
      if (ext === "json") downloadFile(name, JSON.stringify(data, null, 2), "application/json");
      else downloadFile(name, toCsv(data), "text/csv");
      msg.className = "export-msg";
      msg.textContent = `ファイルを保存しました（ファイル名: ${name}）。${ext === "json" ? "先生に言われた場所に出そう。" : "先生に出すのは JSON のファイルです。"}`;
    };
    return h(
      "section",
      { class: "note export", "aria-labelledby": "g-export" },
      h("h2", { id: "g-export" }, "記録をまとめて書き出す"),
      h("p", {}, "6つの教材の記録（進み具合・ふりかえりなど）を、1つのファイルにまとめて書き出します。組・番号・名前は、ここで1回入れればよいです。"),
      h("div", { class: "field-row" }, field("cls", "組", "cls", "6"), field("num", "番号", "num", "6"), field("name", "名前", "name", "16")),
      h("p", { class: "export-status-label", id: "ex-status-label" }, "教材ごとの記録（「まだ記録なし」の教材は、まだ使っていないか、何も保存されていません）"),
      h("ul", { class: "export-status", "aria-labelledby": "ex-status-label" }, status),
      h("p", { class: "export-which" }, "先生に出すのは JSON のファイルです。CSV は、表計算ソフトで見るためのものです。"),
      h(
        "div",
        { class: "btn-row" },
        h("button", { type: "button", class: "main-btn ef-btn-primary", id: "export-json", onclick: () => run("json") }, "JSONで書き出す（先生に出す）"),
        h("button", { type: "button", class: "main-btn secondary ef-btn", id: "export-csv", onclick: () => run("csv") }, "CSVで書き出す（表計算ソフト用）"),
      ),
      msg,
    );
  }

  // 全リセット: 開いている教材を閉じてから（閉じるときの保存で記録が戻らないように）、各教材の記録を消す
  let resetMsg = "";
  function resetAll() {
    if (!confirm("6つの教材の記録（名前・進み具合・ふりかえり・プログラムや作品）と、まとめて書き出す欄の組・番号・名前をすべて消して、はじめからやり直します。よろしいですか？（元に戻せません）")) return;
    for (const f of frames.values()) f.remove();
    frames.clear();
    place = { inner: {}, back: {} };
    try {
      sessionStorage.removeItem(PLACE_KEY);
    } catch {}
    try {
      for (const k of DATA.resetKeys || []) localStorage.removeItem(k);
    } catch {}
    seen = { opened: [], last: null };
    resetMsg = "記録をすべて消しました。はじめから使えます。";
    renderMenu();
    resetMsg = "";
    document.getElementById("reset-all").focus();
  }

  // 「つぎはこれ」: まだ開いていない教材のうち、おすすめの順番でいちばん前のもの
  function renderNext(order) {
    const nextId = order.find((id) => !seen.opened.includes(id));
    const last = seen.last && byId.get(seen.last);
    const big = (m, label) => h("a", { class: "next-go", href: `#/${m.id}` }, h("img", { src: m.iconData, alt: "" }), h("span", {}, h("span", { class: "k" }, label), h("span", { class: "t" }, m.title)), h("span", { class: "arrow", "aria-hidden": "true" }, "→"));
    const steps = h(
      "ol",
      { class: "route", "aria-label": "おすすめの順番" },
      order.map((id) => {
        const m = byId.get(id);
        const state = seen.opened.includes(id) ? "seen" : id === nextId ? "next" : "";
        return h("li", { class: state }, h("a", { href: `#/${id}` }, m.title), state === "seen" ? h("span", { class: "visually-hidden" }, "（開いたことがある）") : state === "next" ? h("span", { class: "visually-hidden" }, "（つぎはこれ）") : null);
      }),
    );
    return h(
      "section",
      { class: "next-panel", "aria-labelledby": "g-next" },
      h("h2", { id: "g-next" }, seen.opened.length ? "つぎはこれ" : "はじめての人は、ここから"),
      h("div", { class: "next-row" }, nextId ? big(byId.get(nextId), seen.opened.length ? "まだ開いていない教材" : "おすすめ 1番") : null, last && last.id !== nextId ? big(last, "前回のつづき") : null),
      h("p", { class: "route-label" }, "おすすめの順番（授業の進め方に合わせて、どこから始めてもかまいません）"),
      steps,
    );
  }

  // 教材の切りかえ（KS-04）: アイコンに短い名前。はばがせまいときは「教材をかえる ▾」で、名前の一覧を出す
  function renderSwitcher(currentId) {
    switcher.replaceChildren(
      ...DATA.materials.map((m) =>
        h(
          "a",
          { href: `#/${m.id}`, title: m.title, "aria-current": m.id === currentId ? "page" : null },
          h("img", { src: m.iconData, alt: "" }),
          h("span", { class: "short", "aria-hidden": "true" }, m.short || m.title),
          h("span", { class: m.short ? "full" : "full visually-hidden" }, m.title),
        ),
      ),
    );
  }
  function setSwitchOpen(open) {
    switchWrap.classList.toggle("open", open);
    switchBtn.setAttribute("aria-expanded", String(open));
  }
  switchBtn.addEventListener("click", () => {
    const open = !switchWrap.classList.contains("open");
    setSwitchOpen(open);
    if (open) (switcher.querySelector('[aria-current="page"]') || switcher.querySelector("a"))?.focus();
  });
  switcher.addEventListener("click", () => setSwitchOpen(false));
  document.addEventListener("click", (e) => !switchWrap.contains(e.target) && setSwitchOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && switchWrap.classList.contains("open")) {
      setSwitchOpen(false);
      switchBtn.focus();
    }
  });
  // 教材の中（iframe）を押したときも閉じる
  window.addEventListener("blur", () => setSwitchOpen(false));

  function frameFor(m) {
    let f = frames.get(m.id);
    if (f) return f;
    f = document.createElement("iframe");
    f.title = m.title;
    f.dataset.id = m.id;
    f.setAttribute("allow", "microphone *; clipboard-write *; fullscreen *");
    f.srcdoc = JSON.parse(document.getElementById(`app-${m.id}`).textContent);
    stage.append(f);
    frames.set(m.id, f);
    return f;
  }

  // 教材の中の場所（#/spy など）へ移る。読みこみ前なら読みこみ後に移る
  function goInside(f, hash) {
    if (!hash) return;
    const doc = f.contentDocument;
    if (doc && doc.readyState === "complete" && f.dataset.loaded) f.contentWindow.location.hash = hash;
    else f.addEventListener("load", () => (f.contentWindow.location.hash = hash), { once: true });
  }

  let pendingInner = null;
  let pendingBack = null;
  let firstRoute = true;
  function route() {
    let id = location.hash.replace(/^#\/?/, "");
    // #/security-lab/teacher のように、教材の名前のあとに教材の中の場所を付けて開ける（先生用ページなど）
    const slash = id.indexOf("/");
    if (slash > 0 && byId.has(id.slice(0, slash)) && /^[\w/-]+$/.test(id.slice(slash + 1))) {
      pendingInner = `#/${id.slice(slash + 1)}`;
      id = id.slice(0, slash);
      history.replaceState(null, "", `#/${id}`);
    }
    const m = byId.get(id);
    document.body.classList.toggle("home-mode", !m);
    document.body.classList.toggle("app-mode", Boolean(m));
    document.documentElement.classList.toggle("large-text", prefs.largeText && !m);
    setSwitchOpen(false);
    if (!m) {
      stage.hidden = true;
      renderMenu();
      menu.hidden = false;
      nowTitle.textContent = "";
      document.title = DATA.title;
      menu.focus({ preventScroll: true });
      return;
    }
    menu.hidden = true;
    stage.hidden = false;
    for (const f of frames.values()) f.hidden = true;
    const isNew = !frames.has(m.id);
    const f = frameFor(m);
    f.hidden = false;
    // 再読みこみのあとなどで教材を開き直すときは、さいごに開いていたページへ（SEC-23）
    goInside(f, pendingInner || (isNew ? place.inner[m.id] : null));
    pendingInner = null;
    // ほかの教材の案内から来たときは「もどる」を出す。メニューや上のバーから開いたときは消す（NW-18）
    if (pendingBack) place.back[m.id] = pendingBack;
    else if (!firstRoute) delete place.back[m.id];
    pendingBack = null;
    savePlace();
    applyBackTo(f);
    markSeen(m.id);
    nowTitle.textContent = m.title;
    document.title = `${m.title} | ${DATA.title}`;
    renderSwitcher(m.id);
    window.scrollTo(0, 0);
    f.focus();
  }

  // 教材の中からほかの教材を開く（情報セキュリティ体験ラボ → デジタル化ラボ など）
  window.addEventListener("message", (e) => {
    const from = [...frames.values()].find((f) => f.contentWindow === e.source);
    const d = e.data;
    if (!from || !d) return;
    if (d.type === "kyozai-home") {
      location.hash = "#/";
      return;
    }
    if (d.type !== "kyozai-open" || !byId.has(d.id)) return;
    pendingInner = typeof d.hash === "string" && INNER_RE.test(d.hash) ? d.hash : null;
    pendingBack = typeof d.back === "string" && INNER_RE.test(d.back) && d.id !== from.dataset.id ? { id: from.dataset.id, hash: d.back } : null;
    // 「← もとの教材にもどる」を押したら、その教材の「もどる」は消す
    if (d.returning) delete place.back[from.dataset.id];
    if (location.hash === `#/${d.id}`) route();
    else location.hash = `#/${d.id}`;
  });

  stage.addEventListener(
    "load",
    (e) => {
      if (e.target.tagName !== "IFRAME") return;
      const f = e.target;
      f.dataset.loaded = "1";
      applyPrefsTo(f);
      applyBackTo(f);
      // 教材の中でページが変わるたびに、その場所を覚える（SEC-23）
      try {
        const w = f.contentWindow;
        w.addEventListener("hashchange", () => frames.get(f.dataset.id) === f && rememberInner(f.dataset.id, w.location.hash));
      } catch {}
    },
    true,
  );
  window.addEventListener("hashchange", route);
  renderMenu();
  route();
  firstRoute = false;
  applyPrefs();
})();
