// 保存（この端末のブラウザ内 localStorage のみ。外部には送らない）
const KEY = "mcsim.v1";

function empty() {
  return { version: 1, student: { cls: "", num: "", name: "" }, programs: {}, records: [], prefs: {}, reflections: {} };
}

// load() の中で使うので、読みこみより前に用意しておく
const isObj = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw);
    if (!isObj(d)) return empty();
    // こわれた所(形のちがう値)があっても、その所だけ空にして使い続ける
    const st = { ...empty(), ...d };
    for (const k of ["student", "programs", "prefs", "reflections"]) if (!isObj(st[k])) st[k] = empty()[k];
    if (!Array.isArray(st.records)) st.records = [];
    st.records = st.records.filter(isObj);
    return st;
  } catch {
    return empty();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 保存できない環境（プライベートモード等）でも、その場の操作は続けられる
  }
}

const MAX_RECORDS = 500;

export const store = {
  get state() {
    return state;
  },
  getProgram: (sid) => state.programs[sid],
  setProgram(sid, text) {
    state.programs[sid] = text;
    save();
  },
  clearProgram(sid) {
    delete state.programs[sid];
    save();
  },
  addRecord(rec) {
    state.records.push({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), at: new Date().toISOString(), memo: "", ...rec });
    if (state.records.length > MAX_RECORDS) state.records.splice(0, state.records.length - MAX_RECORDS);
    save();
    return state.records[state.records.length - 1];
  },
  setMemo(id, memo) {
    const r = state.records.find((x) => x.id === id);
    if (r) {
      r.memo = memo;
      save();
    }
  },
  recordsOf: (sid) => state.records.filter((r) => r.sid === sid),
  best(sid) {
    const rs = state.records.filter((r) => r.sid === sid);
    if (!rs.length) return null;
    return rs.reduce((a, r) => (r.passed > a.passed ? r : a), rs[0]);
  },
  // 書いた文が空になったら、記録からも外す（書き出しに空の行を出さない）
  setReflection(sid, text) {
    if (text) state.reflections[sid] = { text, at: new Date().toISOString() };
    else delete state.reflections[sid];
    save();
  },
  getReflection: (sid) => state.reflections[sid]?.text || "",
  setStudent(info) {
    state.student = { ...state.student, ...info };
    save();
  },
  pref: (k) => state.prefs[k],
  setPref(k, v) {
    state.prefs[k] = v;
    save();
  },
  clearRecords() {
    state.records = [];
    save();
  },
  // 次の人に端末をわたすとき: 名前・プログラム・テストの記録・ふりかえりをすべて消す（表示の設定は残す）
  reset() {
    state = { ...empty(), prefs: state.prefs };
    save();
  },
};
