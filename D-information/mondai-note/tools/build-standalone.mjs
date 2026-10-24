// 1つのHTMLファイルにまとめた版（dist/問題解決ノート.html）を作る。実行: node tools/build-standalone.mjs
// 問題解決ノートの本体（4分野共通の shared/mondai-note/）も中に入れる。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inlineEduitFrame } from "../../build/eduit-inline.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
// </script> が中に出てこないようにする
const safe = (s) => s.replace(/<\/(script)/gi, "<\\/$1");
const style = (p) => `<style>\n${read(p).replace(/<\/style/gi, "<\\/style")}\n</style>`;
const icon = "data:image/svg+xml;base64," + Buffer.from(read("icons/icon.svg")).toString("base64");

let html = read("index.html");
const replaceOnce = (re, to) => {
  if (!re.test(html)) throw new Error(`index.html: ${re} がありません`);
  html = html.replace(re, to);
};
replaceOnce(/<meta http-equiv="Content-Security-Policy"[^>]*>/, `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'">`);
replaceOnce(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon}" type="image/svg+xml">`);
replaceOnce(/src="icons\/icon.svg"/, `src="${icon}"`);
replaceOnce(/<link rel="stylesheet" href="\.\.\/\.\.\/shared\/mondai-note\/mondai-note\.css">/, () => style("../../shared/mondai-note/mondai-note.css"));
replaceOnce(/<link rel="stylesheet" href="css\/style\.css">/, () => style("css/style.css"));
for (const f of ["../../shared/mondai-note/mondai-note-data.js", "../../shared/mondai-note/mondai-note.js", "js/app.js"]) {
  replaceOnce(new RegExp(`<script src="${f.replace(/[./]/g, "\\$&")}"></script>`), () => `<script>\n${safe(read(f))}\n</script>`);
}
if (/<link rel="stylesheet" href="(?!\.\.\/\.\.\/shared\/eduit-frame|\.\.\/d-frame)|<script src="(?!\.\.\/(\.\.\/shared\/)?eduit-)/.test(html)) throw new Error("中に入れられなかったファイルがあります");
// 4分野共通の枠と、版・更新履歴を中に入れる
html = inlineEduitFrame(html);

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/問題解決ノート.html"), html);
console.log(`dist/問題解決ノート.html を作りました（${Math.round(html.length / 1024)} KB）`);
