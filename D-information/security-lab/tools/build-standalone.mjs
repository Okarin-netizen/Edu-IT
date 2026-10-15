// 1つのHTMLファイルにまとめた版（dist/security-lab.html）を作る。
// ダブルクリックで開ける・USBメモリで配れる・サーバー不要。実行: node tools/build-standalone.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { inlineEduitFrame } from "../../build/eduit-inline.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

// 依存の順番（先に読み込まれるものが前）
const ORDER = ["js/store.js", "js/ui.js", "js/data.js", "js/settings.js", "js/cryptolib.js", "js/passwordlib.js", "js/digitallib.js", "js/branch.js", "js/consult.js", "modules/password.js", "modules/crypto.js", "modules/hash.js", "modules/phishing.js", "modules/network.js", "modules/sns.js", "modules/tattoo.js", "modules/copyright.js", "modules/roleplay.js", "modules/declare.js", "modules/digital.js", "js/catalog.js", "js/check.js", "js/records.js", "js/app.js"];
const varName = (p) => "__m_" + p.replace(/[^a-z0-9]/gi, "_");

const chunks = ORDER.map((file) => {
  let src = read(file);
  const imports = [];
  src = src.replace(/^import\s*\{([^}]+)\}\s*from\s*"([^"]+)";?\s*$/gm, (_, names, spec) => {
    const target = posix.normalize(posix.join(posix.dirname(file), spec));
    if (!ORDER.includes(target)) throw new Error(`${file}: 未知の import ${spec}`);
    if (ORDER.indexOf(target) > ORDER.indexOf(file)) throw new Error(`${file}: ${target} より前に並べてください`);
    imports.push(`const {${names.replace(/\bas\b/g, ":")}} = ${varName(target)};`);
    return "";
  });
  if (/^\s*import\s/m.test(src)) throw new Error(`${file}: 対応していない import の書き方があります`);
  const exported = [];
  src = src.replace(/^export\s+(async\s+function|function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => {
    exported.push(name);
    return `${kind} ${name}`;
  });
  if (/^export\s/m.test(src)) throw new Error(`${file}: 対応していない export の書き方があります`);
  return `// ---- ${file} ----\nconst ${varName(file)} = (() => {\n${imports.join("\n")}\n${src}\nreturn { ${exported.join(", ")} };\n})();`;
});

const data = Object.fromEntries(readdirSync(join(root, "data")).filter((f) => f.endsWith(".json")).map((f) => [f.replace(/\.json$/, ""), JSON.parse(read(`data/${f}`))]));
const icon = "data:image/svg+xml;base64," + Buffer.from(read("icons/icon.svg")).toString("base64");
// </script> が中に出てこないようにする
const safe = (s) => s.replace(/<\/(script)/gi, "<\\/$1");

let html = read("index.html");
html = html
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'">`)
  .replace(/\s*<link rel="manifest"[^>]*>/, "")
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon}" type="image/svg+xml">`)
  .replace(/<link rel="stylesheet" href="css\/style.css">/, () => `<style>\n${read("css/style.css")}\n</style>`)
  .replace(/src="icons\/icon.svg"/g, `src="${icon}"`)
  .replace(
    /<script type="module" src="js\/app.js"><\/script>/,
    () => `<script>\nwindow.__SECLAB_DATA = ${safe(JSON.stringify(data))};\n</script>\n<script>\n"use strict";\n${safe(chunks.join("\n\n"))}\n</script>`,
  );

// 4分野共通の枠と、版・更新履歴を中に入れる
html = inlineEduitFrame(html);

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/security-lab.html"), html);
console.log(`dist/security-lab.html を作りました（${Math.round(html.length / 1024)} KB）`);
