// 保存（この端末のブラウザ内 localStorage のみ。外部には送らない）
// 形は計測・制御シミュレータ（D7）と同じ（教材集の「記録をまとめて書き出す」がそのまま読める）
const KEY = "rover.v1";

function empty() {
  return { version: 1, student: { cls: "", num: "", name: "" }, kadai: "", programs: {}, designs: {}, records: [], prefs: {}, reflections: {}, evaluation: { before: {}, after: {} } };
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
    // こわれた所(形のちがう値)があっても、その所だけ空にして使い続ける(計測・制御シミュレータと同じ)
    const st = { ...empty(), ...d };
    for (const k of ["student", "programs", "designs", "prefs", "reflections", "evaluation"]) if (!isObj(st[k])) st[k] = empty()[k];
    if (typeof st.kadai !== "string") st.kadai = "";
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
    // 保存できない環境でも、その場の操作は続けられる
  }
}

const MAX_RECORDS = 300;

export const store = {
  get state() {
    return state;
  },
  getProgram: (sid) => state.programs[sid],
  setProgram(sid, text) {
    state.programs[sid] = text;
    save();
  },
  getDesign: (sid) => state.designs[sid],
  setDesign(sid, d) {
    state.designs[sid] = d;
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
    return rs.reduce((a, r) => ((r.score ?? r.passed) > (a.score ?? a.passed) ? r : a), rs[0]);
  },
  setReflection(id, text) {
    if (text) state.reflections[id] = { text, at: new Date().toISOString() };
    else delete state.reflections[id];
    save();
  },
  getReflection: (id) => state.reflections[id]?.text || "",
  setKadai(text) {
    state.kadai = text;
    save();
  },
  setEval(which, key, v) {
    state.evaluation[which] = { ...(state.evaluation[which] || {}), [key]: v };
    save();
  },
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
  reset() {
    state = { ...empty(), prefs: state.prefs };
    save();
  },
};
