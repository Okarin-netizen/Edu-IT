// 作品の保存（この端末のブラウザ内 localStorage のみ）。読み込み・書き出しの形式チェックもここで行う。

const KEY = "istudio.works.v1";
export const PART_TYPES = ["label", "input", "button"];
export const MAX_CODE = 60000;
const MAX_PARTS = 30;

// 読みこめなかった保存データの控え（上書きで消さないため）。「この端末の記録をすべて消す」で消す。
export const BACKUP_KEY = "istudio.works.v1.backup";

const listeners = new Set();
// 読みこみの結果。failed: 前のデータを読みこめなかった / kept: 控えを残せた / blocked: 控えを残せないので上書きしない
const loadInfo = { failed: false, kept: false, blocked: false };

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// 読みこみ（load）より前に用意しておく（IS-01: const の前に使うと読みこみ全体が失敗していた）
function str(v, max) {
  return typeof v === "string" ? v.slice(0, max) : "";
}

// 読みこめなかったデータを別のキーに残す（最初の控えと最新の控えの2つまで）
function keepBackup(raw) {
  loadInfo.failed = true;
  let list = readBackups();
  if (!list.some((b) => b.raw === raw)) {
    const item = { at: new Date().toISOString(), raw };
    if (list.length < 2) list.push(item);
    else list[1] = item;
  }
  for (const tryList of [list, list.slice(-1)]) {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(tryList));
      loadInfo.kept = true;
      return;
    } catch {
      /* 入りきらないときは、最新の1つだけで試す */
    }
  }
  loadInfo.blocked = true; // 控えを残せないので、前のデータを上書きしない
}

export function readBackups() {
  try {
    const list = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
    return Array.isArray(list) ? list.filter((b) => b && typeof b.raw === "string") : [];
  } catch {
    return [];
  }
}

export function clearBackups() {
  loadInfo.failed = loadInfo.kept = false;
  try {
    localStorage.removeItem(BACKUP_KEY);
  } catch {
    /* 何もしない */
  }
}

export function storageInfo() {
  return { ...loadInfo, backups: readBackups().length };
}

function load() {
  const empty = { works: [], currentId: null };
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return empty; // この端末では保存が使えない（開いている間だけ使える）
  }
  if (!raw) return empty;
  try {
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.works)) throw new Error("形がちがう");
    const list = [];
    let lost = 0;
    for (const w of d.works) {
      try {
        const c = sanitizeWork(w);
        if (c) list.push(c);
      } catch {
        lost++;
      }
    }
    if (lost) keepBackup(raw);
    return { works: list, currentId: typeof d.currentId === "string" ? d.currentId : null };
  } catch {
    keepBackup(raw);
    return empty;
  }
}

function persist() {
  if (!loadInfo.blocked) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* 保存できない環境でも、開いている間は使える */
    }
  }
  listeners.forEach((fn) => fn(state));
}

export function validPartId(id) {
  return typeof id === "string" && /^[\p{L}_][\p{L}\p{N}_]{0,19}$/u.test(id);
}

// 外から読み込んだデータも、決まった形と長さに切りそろえる
export function sanitizeWork(w) {
  if (!w || typeof w !== "object") return null;
  const ui = [];
  const seen = new Set();
  for (const p of Array.isArray(w.ui) ? w.ui.slice(0, MAX_PARTS) : []) {
    if (!p || !PART_TYPES.includes(p.type) || !validPartId(p.id) || seen.has(p.id)) continue;
    seen.add(p.id);
    ui.push({ type: p.type, id: p.id, text: str(p.text, 200) });
  }
  const plan = w.plan && typeof w.plan === "object" ? w.plan : {};
  return {
    id: typeof w.id === "string" && /^[a-z0-9]{4,30}$/.test(w.id) ? w.id : uid(),
    title: str(w.title, 40).trim() || "名前のない作品",
    code: str(w.code, MAX_CODE),
    ui,
    plan: { who: str(plan.who, 300), problem: str(plan.problem, 300), idea: str(plan.idea, 300), test: str(plan.test, 300), improve: str(plan.improve, 600), reflect: str(plan.reflect, 600) },
    createdAt: str(w.createdAt, 40) || new Date().toISOString(),
    updatedAt: str(w.updatedAt, 40) || new Date().toISOString(),
  };
}

// 保存データの読みこみ（使う関数をすべて用意したあとで行う）
let state = load();

export const works = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  all() {
    return state.works;
  },
  get(id) {
    return state.works.find((w) => w.id === id) || null;
  },
  current() {
    return this.get(state.currentId) || state.works[0] || null;
  },
  setCurrent(id) {
    state.currentId = id;
    persist();
  },
  add(w) {
    const clean = sanitizeWork({ ...w, id: uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    state.works.unshift(clean);
    state.currentId = clean.id;
    persist();
    return clean;
  },
  update(id, patch) {
    const i = state.works.findIndex((w) => w.id === id);
    if (i < 0) return null;
    state.works[i] = sanitizeWork({ ...state.works[i], ...patch, id, updatedAt: new Date().toISOString() });
    persist();
    return state.works[i];
  },
  remove(id) {
    state.works = state.works.filter((w) => w.id !== id);
    if (state.currentId === id) state.currentId = state.works[0]?.id || null;
    persist();
  },
  // 次の人に端末をわたすとき: 作品をすべて消す（読みこめなかったデータの控えも消す）
  reset() {
    state = { works: [], currentId: null };
    loadInfo.failed = loadInfo.kept = loadInfo.blocked = false;
    clearBackups();
    persist();
  },
};

// ---- 書き出し・読み込み ----
export const FORMAT = "interactive-studio-work";

export function workToJson(w) {
  const { id, ...rest } = w;
  return JSON.stringify({ format: FORMAT, version: 1, work: rest }, null, 2);
}

// JSON（このアプリで書き出したもの）か、HTML（作品を書き出したページ）から作品を取り出す
export function workFromFile(text) {
  let data = null;
  const m = /<script type="application\/json" id="studio-work">([\s\S]*?)<\/script>/.exec(text);
  try {
    data = JSON.parse(m ? m[1] : text);
  } catch {
    throw new Error("作品のファイルとして読めませんでした。このスタジオで書き出した .json か .html を選んでください。");
  }
  const w = data && data.format === FORMAT ? data.work : data;
  if (!w || typeof w !== "object" || typeof w.code !== "string") throw new Error("作品のデータが見つかりませんでした。");
  if (w.code.length > MAX_CODE) throw new Error("プログラムが長すぎます。");
  return sanitizeWork(w);
}
