// 進み具合・プログラム・ふりかえりの保存（この端末のブラウザ内 localStorage のみ。外部には送らない）
const KEY = "vcpu.v1";

function empty() {
  // visited: 開いたページ（記録用） / done: やり終えたページ（✓ をつける。図解は仲間分けの答え合わせ、手計算くらべは手計算と N のくらべ）
  // answerViewed: 課題の「答えの例」を開いた時刻 / sim: 仮想CPUページで選んだサンプルの番号と入力の数
  return { cleared: {}, drafts: {}, visited: {}, done: {}, answerViewed: {}, sim: null, manual: null, reflections: {}, student: { cls: "", num: "", name: "" } };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 保存できない環境（プライベートモードなど）でも、その場の体験は続けられる
  }
}

export const store = {
  get state() {
    return state;
  },
  markVisited(page) {
    if (state.visited[page]) return;
    state.visited[page] = new Date().toISOString();
    save();
  },
  // ページをやり終えた印（info は記録に残す中身。例: 仲間分けの正解数）
  markDone(page, info = {}) {
    state.done[page] = { ...(state.done[page] || {}), ...info, at: state.done[page]?.at || new Date().toISOString() };
    save();
  },
  isDone: (page) => Boolean(state.done?.[page]?.at),
  // 課題の「答えの例」を開いたことを記録する（はじめて開いた時刻）
  markAnswerViewed(id) {
    if (state.answerViewed[id]) return;
    state.answerViewed[id] = new Date().toISOString();
    save();
  },
  answerViewed: (id) => state.answerViewed?.[id] || null,
  setSimMeta(info) {
    state.sim = { ...(state.sim || {}), ...info };
    save();
  },
  isCleared: (id) => Boolean(state.cleared[id]),
  clear(id) {
    if (!state.cleared[id]) state.cleared[id] = new Date().toISOString();
    save();
  },
  getDraft: (id) => state.drafts[id],
  setDraft(id, text) {
    if (text === null) delete state.drafts[id];
    else state.drafts[id] = text;
    save();
  },
  setManual(rec) {
    state.manual = rec;
    save();
  },
  setReflection(id, text) {
    if (text) state.reflections[id] = { text, at: new Date().toISOString() };
    else delete state.reflections[id]; // 全部消したときは「書いていない」にもどす
    save();
  },
  getReflection: (id) => state.reflections[id]?.text || "",
  setStudent(info) {
    state.student = { ...state.student, ...info };
    save();
  },
  reset() {
    state = empty();
    save();
  },
};
