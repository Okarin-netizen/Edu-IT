// 共通UI部品（要素ビルダー、トースト、ファイルの書き出し・読み込み）

// 小さな要素ビルダー: h("div", { class: "card" }, "text", child)
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k === "value") el.value = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

let toastTimer;
export function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = h("div", { class: "toast", role: "status" });
    document.body.append(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

// 端末内でファイルを作ってダウンロードさせる（送信はしない）
export function downloadFile(filename, text, type = "application/json") {
  const blob = new Blob([text], { type: type + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ファイルを選ばせて、文字として読む
export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept, class: "visually-hidden" });
    input.addEventListener("change", async () => {
      const f = input.files[0];
      input.remove();
      if (!f) return resolve(null);
      if (f.size > 3 * 1024 * 1024) return resolve({ error: "ファイルが大きすぎます（3MBまで）。" });
      try {
        resolve({ name: f.name, text: await f.text() });
      } catch {
        resolve({ error: "ファイルを読めませんでした。" });
      }
    });
    document.body.append(input);
    input.click();
  });
}

export function safeFileName(s) {
  return String(s).replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40) || "作品";
}
