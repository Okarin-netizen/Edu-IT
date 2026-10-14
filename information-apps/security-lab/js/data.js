// data/*.json の読み込み
// 優先順位: ①先生が「設定」で読み込んだ差し替えデータ（この端末の localStorage）②単一HTML版に埋め込まれたデータ ③data フォルダのファイル
const cache = new Map();
const OVERRIDE_PREFIX = "seclab.data.";

export function getOverride(name) {
  try {
    const raw = localStorage.getItem(OVERRIDE_PREFIX + name);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setOverride(name, value) {
  try {
    if (value === null) localStorage.removeItem(OVERRIDE_PREFIX + name);
    else localStorage.setItem(OVERRIDE_PREFIX + name, JSON.stringify(value));
  } catch {
    // 保存できない環境では、その場だけ反映される
  }
  cache.delete(name);
}

export function listOverrides() {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(OVERRIDE_PREFIX)).map((k) => k.slice(OVERRIDE_PREFIX.length));
  } catch {
    return [];
  }
}

export async function loadDefaultData(name) {
  const embedded = globalThis.__SECLAB_DATA?.[name];
  if (embedded) return embedded;
  const r = await fetch(`data/${name}.json`);
  if (!r.ok) throw new Error(`data/${name}.json を読み込めませんでした`);
  return r.json();
}

export async function loadData(name) {
  if (cache.has(name)) return cache.get(name);
  const value = getOverride(name) ?? (await loadDefaultData(name));
  cache.set(name, value);
  return value;
}

// 埋め込み・既定に含まれるデータの名前
export const DATA_NAMES = ["config", "quiz", "phishing", "crypto", "common-passwords", "passphrase-words", "copyright", "roleplay", "ruby", "consult"];
