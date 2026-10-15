// 1つのHTMLファイルにまとめた版（dist/genai-lab.html と、配布用の ../dist/生成AIのしくみラボ.html）を作る。
// ダブルクリックで開ける・USBメモリで配れる・サーバー不要。実行: node tools/build-standalone.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inlineEduitFrame } from "../../build/eduit-inline.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
// </script> が中に出てこないようにする
const safe = (s) => s.replace(/<\/(script)/gi, "<\\/$1");
const icon = "data:image/svg+xml;base64," + Buffer.from(read("icons/icon.svg")).toString("base64");

let html = read("index.html");
const replaceOnce = (re, to) => {
  if (!re.test(html)) throw new Error(`index.html: ${re} がありません`);
  html = html.replace(re, to);
};
replaceOnce(/<meta http-equiv="Content-Security-Policy"[^>]*>/, `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'">`);
replaceOnce(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon}" type="image/svg+xml">`);
replaceOnce(/src="icons\/icon.svg"/, `src="${icon}"`);
replaceOnce(/<link rel="stylesheet" href="css\/style.css">/, () => `<style>\n${read("css/style.css")}\n</style>`);
for (const f of ["js/lm.js", "js/img.js", "js/data.js", "js/app.js"]) {
  replaceOnce(new RegExp(`<script src="${f.replace(/[./]/g, "\\$&")}"></script>`), () => `<script>\n${safe(read(f))}\n</script>`);
}
// 4分野共通の枠と、版・更新履歴を中に入れる
html = inlineEduitFrame(html);

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/genai-lab.html"), html);
// 配布用の完成ファイル（D-information/dist/）にも同じものを書く
mkdirSync(join(root, "../dist"), { recursive: true });
writeFileSync(join(root, "../dist/生成AIのしくみラボ.html"), html);
console.log(`dist/genai-lab.html と ../dist/生成AIのしくみラボ.html を作りました（${Math.round(html.length / 1024)} KB）`);
