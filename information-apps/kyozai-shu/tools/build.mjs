// 6つの教材の1ファイル版（各フォルダの dist/）を、メニュー付きの1つのHTMLにまとめる。
// 実行: node tools/build.mjs  → dist/情報の技術_体験教材集.html
// 元の教材フォルダは読むだけで、書きかえない。教材を直したら、先にその教材で npm run build してからこれを実行する。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const projects = join(root, "..");
const read = (p) => readFileSync(p, "utf8");
const data = JSON.parse(read(join(root, "data/materials.json")));

// <script> の中に入れても途中で閉じないようにする（JSON として正しいまま）
const jsonForScript = (v) => JSON.stringify(v).replace(/<\//g, "<\\/").replace(/<!--/g, "\\u003c!--");
// アイコンの SVG から大きな埋めこみ情報（metadata）を外して data URI にする
const iconData = (svg) => "data:image/svg+xml;base64," + Buffer.from(svg.replace(/<metadata>[\s\S]*?<\/metadata>/g, "")).toString("base64");

const bridgeSrc = read(join(root, "src/bridge.js"));
const hashLinksScript = `<script>\n${read(join(root, "src/hashlinks.js")).replace(/<\/(script)/gi, "<\\/$1")}</script>\n`;
const guideSrc = read(join(root, "src/guide.js"));
const assistCss = read(join(root, "src/assist.css"));
// ふりがなの言葉と読み: 情報セキュリティ体験ラボの一覧に、ほかの5教材の言葉（src/ruby-words.json）を足す
const rubyWords = { ...JSON.parse(read(join(projects, "security-lab/data/ruby.json"))).words, ...JSON.parse(read(join(root, "src/ruby-words.json"))).words };
for (const [w, r] of Object.entries(rubyWords)) if (w.startsWith("_") || typeof r !== "string" || !r) delete rubyWords[w];
const rubySrc = read(join(root, "src/ruby.js"));
const displaySrc = read(join(root, "src/display.js"));
const payloads = [];
const menuData = { ...data, materials: [], rubyWords };
delete menuData.bridges;
delete menuData.guides;

// 教材の </head> または </body> の直前に足す
// </head> は最初のもの、</body> は最後のもの（教材の中の書き出し用テンプレートにも同じ文字があるため）
const insertBefore = (html, tag, add, source) => {
  const at = tag === "</head>" ? html.indexOf(tag) : html.lastIndexOf(tag);
  if (at < 0) throw new Error(`${source}: ${tag} がありません`);
  return html.slice(0, at) + add + html.slice(at);
};

for (const m of data.materials) {
  let html = read(join(projects, m.source));
  if (!/^<!doctype html>/i.test(html.trimStart())) throw new Error(`${m.source}: HTML ではないようです`);
  // ページ内リンク（#/…）を教材集の中でも動くようにする（src/hashlinks.js）
  {
    const at = html.lastIndexOf("</body>");
    if (at < 0) throw new Error(`${m.source}: </body> がありません`);
    html = html.slice(0, at) + hashLinksScript + html.slice(at);
  }
  // 見やすさの調整（教材集の中だけ）
  html = insertBefore(html, "</head>", `<style>\n${assistCss}</style>\n`, m.source);
  const links = data.bridges?.[m.id];
  if (links) {
    const withTitles = Object.fromEntries(Object.entries(links).map(([k, v]) => [k, { ...v, title: data.materials.find((x) => x.id === v.to).title, fromTitle: m.title }]));
    html = insertBefore(html, "</body>", `<script>\n${bridgeSrc.replace("__LINKS__", () => jsonForScript(withTitles))}</script>\n`, m.source);
  }
  // 上のバーの「ふりがな」「大きな文字」を教材にかける（src/display.js と src/ruby.js）
  const display = { ownRuby: Boolean(m.ownRuby), skip: m.rubySkip || [], words: m.ownRuby ? {} : rubyWords };
  html = insertBefore(html, "</body>", `<script>\n${(rubySrc + "\n" + displaySrc.replace("__DISPLAY__", () => jsonForScript(display))).replace(/<\/(script)/gi, "<\\/$1")}</script>\n`, m.source);
  // 「つぎはこれ」の案内。さいごのページでは、教材集の並びで次の教材をすすめる
  const i = data.materials.indexOf(m);
  const nextM = data.materials[i + 1];
  const guide = { ...(data.guides?.[m.id] || {}), nextMaterial: nextM ? { id: nextM.id, title: nextM.title } : null };
  html = insertBefore(html, "</body>", `<script>\n${guideSrc.replace("__GUIDE__", () => jsonForScript(guide))}</script>\n`, m.source);
  payloads.push(`  <script type="application/json" id="app-${m.id}">${jsonForScript(html)}</script>`);
  const { source, icon, rubySkip, ownRuby, ...rest } = m;
  menuData.materials.push({ ...rest, iconData: iconData(read(join(projects, icon))) });
  console.log(`  ${m.title}: ${Math.round(html.length / 1024)} KB`);
}

const shellIcon = iconData(read(join(root, "icons/icon.svg")));
const out = read(join(root, "src/shell.html"))
  .replace(/\{\{ICON\}\}/g, shellIcon)
  // 4分野共通の枠と、情報の技術の版・更新履歴（各教材の1ファイル版にも、それぞれのビルドで入っている）
  .replace("{{EDUIT_CSS}}", () => read(join(projects, "../shared/eduit-frame.css")))
  .replace("{{EDUIT_INFO}}", () => read(join(projects, "eduit-info.js")).replace(/<\/(script)/gi, "<\\/$1"))
  .replace("{{EDUIT_JS}}", () => read(join(projects, "../shared/eduit-frame.js")).replace(/<\/(script)/gi, "<\\/$1"))
  .replace("{{CSS}}", () => read(join(root, "src/shell.css")))
  .replace("{{DATA}}", () => jsonForScript(menuData))
  .replace("{{PAYLOADS}}", () => payloads.join("\n"))
  .replace("{{JS}}", () => (rubySrc + "\n" + read(join(root, "src/shell.js"))).replace(/<\/(script)/gi, "<\\/$1"));

mkdirSync(join(root, "dist"), { recursive: true });
const name = "情報の技術_体験教材集.html";
writeFileSync(join(root, "dist", name), out);
console.log(`  ふりがなの言葉: ${Object.keys(rubyWords).length}語`);
console.log(`dist/${name} を作りました（${Math.round(Buffer.byteLength(out) / 1024)} KB）`);
