// 表示の設定（ふりがな・やさしい日本語・文字の大きさ）と、先生用の設定ファイル
import { loadData } from "./data.js";

const PREF_KEY = "seclab.prefs";
let config = null;
let rubyRegex = null;
let rubyWords = null;

export async function getConfig() {
  if (!config) config = await loadData("config");
  return config;
}
export function resetConfigCache() {
  config = null;
}

// 生徒が画面で切りかえた設定（先生の設定ファイルの値が初期値）
export function getPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
  } catch {
    return {};
  }
}
export function setPref(key, value) {
  const p = getPrefs();
  p[key] = value;
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    // 保存できなくても、その場では切りかわる
  }
}
export async function pref(key) {
  const p = getPrefs();
  if (key in p) return p[key];
  return (await getConfig())[key] ?? false;
}

// ---- ふりがな ----
async function ensureRuby() {
  if (rubyRegex) return;
  const { words } = await loadData("ruby");
  rubyWords = words;
  const keys = Object.keys(words).sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  rubyRegex = keys.length ? new RegExp(keys.join("|"), "g") : null;
}

const SKIP = new Set(["RUBY", "RT", "RP", "SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "PRE", "svg", "SVG", "text", "title"]);
function shouldSkip(node) {
  for (let el = node.parentNode; el && el.nodeType === 1; el = el.parentNode) {
    if (SKIP.has(el.tagName) || el.classList?.contains("mono") || el.classList?.contains("cipher-text") || el.classList?.contains("no-ruby") || el.classList?.contains("rb-run") || el.namespaceURI === "http://www.w3.org/2000/svg") return true;
  }
  return false;
}

// ふりがなを付けた文は、1つの <span class="rb-run"> にまとめる。
// （チェックボックスの横の文などが、ふりがなの前後で切れて横に並ばないように: SEC-59）
// 元の文は覚えておき、ふりがなをオフにするときに、そのまま元にもどす（画面を作り直さない: SEC-11）
const originalText = new WeakMap();
function rubyfyNode(textNode) {
  const text = textNode.nodeValue;
  rubyRegex.lastIndex = 0;
  if (!rubyRegex.test(text)) return;
  rubyRegex.lastIndex = 0;
  const run = document.createElement("span");
  run.className = "rb-run";
  originalText.set(run, text);
  let last = 0;
  for (const m of text.matchAll(rubyRegex)) {
    if (m.index > last) run.append(text.slice(last, m.index));
    const r = document.createElement("ruby");
    r.append(m[0]);
    const rt = document.createElement("rt");
    rt.textContent = rubyWords[m[0]];
    r.append(rt);
    run.append(r);
    last = m.index + m[0].length;
  }
  if (last < text.length) run.append(text.slice(last));
  textNode.replaceWith(run);
}

export function rubyfy(root) {
  if (!rubyRegex) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets = [];
  while (walker.nextNode()) if (!shouldSkip(walker.currentNode)) targets.push(walker.currentNode);
  targets.forEach(rubyfyNode);
}

// ふりがなを外す（付けたところだけを元の文にもどす。入力中の内容や選んだものはそのまま）
function baseText(run) {
  let t = "";
  for (const n of run.childNodes) {
    if (n.nodeType === 3) t += n.nodeValue;
    else if (n.tagName === "RUBY") for (const c of n.childNodes) if (c.nodeType === 3) t += c.nodeValue;
  }
  return t;
}
export function unrubyfy(root) {
  for (const run of root.querySelectorAll("span.rb-run")) run.replaceWith(document.createTextNode(originalText.get(run) ?? baseText(run)));
}

let observer = null;
// ふりがなのオン・オフ。画面は作り直さない（作業中の入力・選んだもの・スクロール位置はそのまま）。
// オンのあいだは、画面が書きかわるたびに、新しく出た文字にもふりがなを付ける
export async function setRubyEnabled(root, on) {
  observer?.disconnect();
  observer = null;
  if (!on) {
    unrubyfy(root);
    return;
  }
  await ensureRuby();
  rubyfy(root);
  observer = new MutationObserver((muts) => {
    observer.disconnect();
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (!n.isConnected) continue;
        if (n.nodeType === 3 && !shouldSkip(n)) rubyfyNode(n);
        else if (n.nodeType === 1 && n.tagName !== "RUBY" && !n.classList.contains("rb-run")) rubyfy(n);
      }
    }
    observer.observe(root, { childList: true, subtree: true });
  });
  observer.observe(root, { childList: true, subtree: true });
}
