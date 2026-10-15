// 進捗・ふりかえりの保存（この端末のブラウザ内 localStorage のみ。外部には送らない）
// 注意: パスワード入力欄の値はここに絶対に渡さない。

const STORE_KEY = "seclab.v1";

function emptyState() {
  return {
    version: 1,
    student: { cls: "", num: "", name: "" },
    modules: {}, // { [moduleId]: { steps: { [stepId]: isoDate }, score: {...} } }
    reflections: {}, // { [moduleId]: { text, at } }
    updatedAt: null,
  };
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}

function save() {
  state.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // プライベートモード等で保存できない場合も、画面上の体験は続けられる
  }
  listeners.forEach((fn) => fn(state));
}

export const store = {
  get state() {
    return state;
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  completeStep(moduleId, stepId) {
    const m = (state.modules[moduleId] ||= { steps: {}, score: {} });
    if (m.steps[stepId]) return false;
    m.steps[stepId] = new Date().toISOString();
    save();
    return true;
  },
  isStepDone(moduleId, stepId) {
    return Boolean(state.modules[moduleId]?.steps?.[stepId]);
  },
  setScore(moduleId, key, value) {
    const m = (state.modules[moduleId] ||= { steps: {}, score: {} });
    m.score[key] = value;
    save();
  },
  getScore(moduleId, key) {
    return state.modules[moduleId]?.score?.[key];
  },
  // 空の文を保存したとき（全部消したとき）は、記録からも消す
  setReflection(moduleId, text) {
    if (text) state.reflections[moduleId] = { text, at: new Date().toISOString() };
    else delete state.reflections[moduleId];
    save();
  },
  getReflection(moduleId) {
    return state.reflections[moduleId]?.text || "";
  },
  setStudent(info) {
    state.student = { ...state.student, ...info };
    save();
  },
  replaceAll(next) {
    state = { ...emptyState(), ...next };
    save();
  },
  reset() {
    state = emptyState();
    save();
  },
};
