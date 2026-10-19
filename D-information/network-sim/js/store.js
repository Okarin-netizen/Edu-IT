// 進み具合・ふりかえり・作ったネットワークの保存（この端末のブラウザ内 localStorage のみ。外部には送らない）
import { defaultNetwork, cloneNet, migrateShopNames } from "./netlib.js";

const STORE_KEY = "netsim.v1";

function emptyState() {
  return {
    version: 1,
    student: { cls: "", num: "", name: "" },
    net: defaultNetwork(),
    modules: {}, // { [moduleId]: { steps: { [stepId]: isoDate }, score: {...} } }
    reflections: {}, // { [moduleId]: { text, at } }
    updatedAt: null,
  };
}

let state = load();
const listeners = new Set();

// 保存データを、はじめの形に重ねる。壊れたデータ（オブジェクトのはずの所が別の値など）は、はじめの形にもどす
function mergeSaved(base, saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return base;
  const out = { ...base, ...saved };
  for (const [k, v] of Object.entries(base)) {
    if (v && typeof v === "object" && (!out[k] || typeof out[k] !== "object" || Array.isArray(out[k]))) out[k] = v;
  }
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyState();
    const s = mergeSaved(emptyState(), JSON.parse(raw));
    if (!s.net || !Array.isArray(s.net.nodes) || !Array.isArray(s.net.links)) s.net = defaultNetwork();
    else migrateShopNames(s.net);
    return s;
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
  get net() {
    return state.net;
  },
  saveNet(net) {
    state.net = cloneNet(net);
    save();
  },
  resetNet() {
    state.net = defaultNetwork();
    save();
    return cloneNet(state.net);
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
  // 空の文を保存したとき（全部消したとき）は、記録からも消す（ほかの教材と同じ）
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
  reset() {
    state = emptyState();
    save();
  },
};
