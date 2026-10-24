// 1つのHTMLファイルにまとめた版（dist/火星探査ロボット.html）を作る。実行: node tools/build-standalone.mjs
// 計測・制御シミュレータ（D7）と共有している部品（言語・インタプリタ・フローチャート・見た目）も中に入れる。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { inlineEduitFrame } from "../../build/eduit-inline.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

// 依存の順番（先に読み込まれるものが前）。../measure-control-sim/ は D7 と共有している部品
const D7 = "../measure-control-sim/js/";
const ORDER = [D7 + "ui.js", D7 + "lang.js", D7 + "interp.js", D7 + "flow.js", D7 + "autosave.js", "js/store.js", "js/world.js", "js/stages.js", "js/rsim.js", "js/rblocks.js", "js/draw.js", "js/radar.js", "js/app.js"];
const varName = (p) => "__m_" + p.replace(/[^a-z0-9]/gi, "_");

const chunks = ORDER.map((file) => {
  let src = read(file);
  const imports = [];
  src = src.replace(/^import\s*\{([^}]+)\}\s*from\s*"([^"]+)";?\s*$/gm, (_, names, spec) => {
    const target = posix.normalize(posix.join(posix.dirname(file), spec));
    if (!ORDER.includes(target)) throw new Error(`${file}: 未知の import ${spec}（${target}）`);
    if (ORDER.indexOf(target) > ORDER.indexOf(file)) throw new Error(`${file}: ${target} より前に並べてください`);
    imports.push(`const {${names.replace(/\bas\b/g, ":")}} = ${varName(target)};`);
    return "";
  });
  if (/^\s*import\s/m.test(src)) throw new Error(`${file}: 対応していない import の書き方があります`);
  const exported = [];
  src = src.replace(/^export\s+(async\s+function|function\*?|const|let|class)\s*([A-Za-z_$][\w$]*)/gm, (_, kind, name) => {
    exported.push(name);
    return `${kind} ${name}`;
  });
  if (/^export\s/m.test(src)) throw new Error(`${file}: 対応していない export の書き方があります`);
  return `// ---- ${file} ----\nconst ${varName(file)} = (() => {\n${imports.join("\n")}\n${src}\nreturn { ${exported.join(", ")} };\n})();`;
});

const icon = "data:image/svg+xml;base64," + Buffer.from(read("icons/icon.svg")).toString("base64");
const safe = (s) => s.replace(/<\/(script)/gi, "<\\/$1");
const style = (p) => `<style>\n${read(p).replace(/<\/style/gi, "<\\/style")}\n</style>`;

let html = read("index.html");
html = html
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'">`)
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon}" type="image/svg+xml">`)
  .replace(/<link rel="stylesheet" href="\.\.\/measure-control-sim\/css\/style\.css">/, () => style("../measure-control-sim/css/style.css"))
  .replace(/<link rel="stylesheet" href="css\/rover\.css">/, () => style("css/rover.css"))
  .replace(/src="icons\/icon.svg"/g, `src="${icon}"`)
  .replace(/<script type="module" src="js\/app.js"><\/script>/, () => `<script>\n"use strict";\n${safe(chunks.join("\n\n"))}\n</script>`);
if (/<link rel="stylesheet" href="(?!\.\.\/\.\.\/shared|\.\.\/d-frame)/.test(html) || /<script type="module"/.test(html)) throw new Error("中に入れられなかったファイルがあります");

// 4分野共通の枠と、版・更新履歴を中に入れる
html = inlineEduitFrame(html);

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/火星探査ロボット.html"), html);
console.log(`dist/火星探査ロボット.html を作りました（${Math.round(html.length / 1024)} KB）`);
