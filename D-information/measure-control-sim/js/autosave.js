// 書いた文（ふりかえり・改善メモ）を自動で保存する（ほかの教材と同じ決まり）
// ・書いているあいだは、手を止めて約0.4秒たったら保存する
// ・ページ（場面）を移るとき、ページを閉じるときにも、まだ保存していない文を保存する
// 保存の中身は「保存」ボタンを押したときと同じ（同じ場所に入り、書き出しにも入る）。DOM の要素を直接は作らない。

export const AUTOSAVE_HINT = "書いた文は、自動でこの端末に保存されます。";
export const AUTOSAVE_DONE = "保存しました";

const pending = new Set();

// el: textarea など（value と "input" イベントがあるもの） / save(text): 保存する関数
// 返り値: いますぐ保存する関数（保存していない文がなければ何もしない）
export function attachAutosave(el, save, { delay = 400, onSaved } = {}) {
  let timer = null;
  const flush = () => {
    if (timer === null) return false;
    clearTimeout(timer);
    timer = null;
    pending.delete(flush);
    save(el.value);
    onSaved?.();
    return true;
  };
  el.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
    pending.add(flush);
  });
  return flush;
}

// まだ保存していない文を、すべていますぐ保存する（ページを移るとき・閉じるとき）
export function flushAutosaves() {
  for (const f of [...pending]) f();
}
