// data/*.json の読み込み（単一HTML版では埋め込みデータを使う）
const cache = new Map();

export async function loadData(name) {
  if (cache.has(name)) return cache.get(name);
  const embedded = globalThis.__MCSIM_DATA?.[name];
  let value = embedded;
  if (!value) {
    const r = await fetch(`data/${name}.json`);
    if (!r.ok) throw new Error(`data/${name}.json を読み込めませんでした`);
    value = await r.json();
  }
  cache.set(name, value);
  return value;
}
