// 1つのHTMLファイルにまとめた版（dist/interactive-studio.html）を作る。
// ダブルクリックで開ける・USBメモリで配れる・サーバー不要。実行: node tools/build-standalone.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ORDER, bundleSources, STRICT_CSP } from "../js/bundle.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const js = bundleSources(Object.fromEntries(ORDER.map((f) => [f, read(f)])));
const icon = "data:image/svg+xml;base64," + Buffer.from(read("icons/icon.svg")).toString("base64");

let html = read("index.html");
html = html
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, `<meta http-equiv="Content-Security-Policy" content="${STRICT_CSP}">`)
  .replace(/\s*<link rel="manifest"[^>]*>/, "")
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon}" type="image/svg+xml">`)
  .replace(/<link rel="stylesheet" href="css\/style.css">/, () => `<style id="studio-css">\n${read("css/style.css")}\n</style>`)
  .replace(/src="icons\/icon.svg"/g, `src="${icon}"`)
  .replace(/<script type="module" src="js\/app.js"><\/script>/, () => `<script id="studio-app">\n${js}\n</script>`);

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/interactive-studio.html"), html);
console.log(`dist/interactive-studio.html を作りました（${Math.round(html.length / 1024)} KB）`);
