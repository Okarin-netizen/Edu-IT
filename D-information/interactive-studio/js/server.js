// 擬似サーバー: ブラウザの中（localStorage）に「サーバー役」を置き、回答の保存・集計・ランキングと通信ログを残す。
// 本物のネットワークには一切つながない。データはこの端末のこのブラウザの中だけにある。

const KEY = "istudio.server.v1";
const MAX_RECORDS = 2000; // 1つの箱に保存できる件数
const MAX_LOG = 300;
const MAX_BOXES = 50;

let mem = null; // localStorage が使えないときの予備
const listeners = new Set();

// 通信ログと「📡 サーバーと通信中…」で使う、お願いの日本語の名前（IS-15）
export const OP_NAMES = { save: "保存", count: "件数を問い合わせ", list: "一覧を問い合わせ", addScore: "得点を登録", ranking: "ランキングを問い合わせ", clear: "箱を空にする" };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && typeof d === "object" && d.boxes && Array.isArray(d.log)) return d;
    }
  } catch {
    if (mem) return mem;
  }
  return mem || { boxes: {}, log: [] };
}

function persist(d) {
  mem = d;
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* 保存できなくても、この画面を開いている間は使える */
  }
  listeners.forEach((fn) => fn(d));
}

function log(d, work, op, box, detail, result) {
  d.log.push({ at: new Date().toISOString(), work: String(work || "").slice(0, 40), op, box, detail: String(detail ?? "").slice(0, 80), result: String(result ?? "").slice(0, 80) });
  if (d.log.length > MAX_LOG) d.log.splice(0, d.log.length - MAX_LOG);
}

const clip = (v) => (typeof v === "string" ? v.slice(0, 200) : v);

export const server = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  data() {
    return load();
  },
  save(work, box, value) {
    const d = load();
    if (!d.boxes[box] && Object.keys(d.boxes).length >= MAX_BOXES) {
      log(d, work, "save", box, value, "失敗: 箱が多すぎます");
      persist(d);
      return false;
    }
    const b = (d.boxes[box] ||= { type: "values", records: [] });
    b.records.push({ v: clip(value), at: new Date().toISOString(), work: String(work || "").slice(0, 40) });
    if (b.records.length > MAX_RECORDS) b.records.splice(0, b.records.length - MAX_RECORDS);
    log(d, work, "save", box, JSON.stringify(clip(value)), `OK（${b.records.length}件目）`);
    persist(d);
    return true;
  },
  count(work, box, value, eq) {
    const d = load();
    const recs = d.boxes[box]?.records || [];
    const n = value === undefined ? recs.length : recs.filter((r) => eq(r.v ?? r.name, value)).length;
    log(d, work, "count", box, value === undefined ? "（全部）" : JSON.stringify(value), `${n}件`);
    persist(d);
    return n;
  },
  list(work, box) {
    const d = load();
    const recs = d.boxes[box]?.records || [];
    log(d, work, "list", box, "", `${recs.length}件`);
    persist(d);
    return recs.map((r) => (r.v !== undefined ? r.v : r.name));
  },
  addScore(work, box, name, score) {
    const d = load();
    if (!d.boxes[box] && Object.keys(d.boxes).length >= MAX_BOXES) {
      log(d, work, "addScore", box, `${name} ${score}点`, "失敗: 箱が多すぎます");
      persist(d);
      return false;
    }
    const b = (d.boxes[box] ||= { type: "scores", records: [] });
    b.type = "scores";
    b.records.push({ name: String(name).slice(0, 30), score, at: new Date().toISOString(), work: String(work || "").slice(0, 40) });
    if (b.records.length > MAX_RECORDS) b.records.splice(0, b.records.length - MAX_RECORDS);
    log(d, work, "addScore", box, `${name} ${score}点`, "OK");
    persist(d);
    return true;
  },
  ranking(work, box, n) {
    const d = load();
    const recs = (d.boxes[box]?.records || []).filter((r) => typeof r.score === "number");
    const sorted = [...recs].sort((a, b) => b.score - a.score || a.at.localeCompare(b.at)).slice(0, n);
    log(d, work, "ranking", box, `上位${n}人`, `${sorted.length}人`);
    persist(d);
    return sorted;
  },
  clearBox(box) {
    const d = load();
    delete d.boxes[box];
    log(d, "（先生・管理）", "clear", box, "", "箱を空にしました");
    persist(d);
  },
  clearAll() {
    persist({ boxes: {}, log: [] });
  },
  clearLog() {
    const d = load();
    d.log = [];
    persist(d);
  },
};
