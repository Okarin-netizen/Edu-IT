// 共通UI部品（要素ビルダー、トースト、ファイルの書き出し）

// 小さな要素ビルダー: h("div", { class: "card" }, "text", child)
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// 解説カード。kind: "info" | "warn" | "good" | "bad"
export function explainCard(label, body, kind = "info") {
  const card = h("div", { class: `explain ${kind === "info" ? "" : kind}` });
  card.append(h("span", { class: "explain-label" }, label));
  if (typeof body === "string") card.append(h("p", {}, body));
  else card.append(body);
  return card;
}

// タブ（ボタンの列）。items: [[id, label]]
export function tabs(items, current, onPick, label) {
  const row = h("div", { class: "tabs", role: "tablist", "aria-label": label });
  for (const [id, text] of items) {
    row.append(h("button", { type: "button", role: "tab", "aria-selected": id === current ? "true" : "false", onclick: () => onPick(id) }, text));
  }
  return row;
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
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// 端末内でファイルを作ってダウンロードさせる（送信はしない）
export function downloadFile(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
