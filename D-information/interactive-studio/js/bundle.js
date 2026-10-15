// モジュールを1つのスクリプトにまとめる（Node の build と、ブラウザの「HTMLで書き出す」の両方で使う）
export const ORDER = ["js/ui.js", "js/lang.js", "js/interp.js", "js/runner.js", "js/blockmodel.js", "js/server.js", "js/store.js", "js/samples.js", "js/bundle.js", "js/stage.js", "js/blocks.js", "js/app.js"];

const varName = (p) => "__m_" + p.replace(/[^a-z0-9]/gi, "_");
const joinPath = (base, spec) => {
  const parts = base.split("/").slice(0, -1);
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
};

// sources: { "js/app.js": "…" }
export function bundleSources(sources) {
  const chunks = ORDER.map((file) => {
    let src = sources[file];
    if (typeof src !== "string") throw new Error(`${file} がありません`);
    const imports = [];
    src = src.replace(/^import\s*\{([^}]+)\}\s*from\s*"([^"]+)";?\s*$/gm, (_, names, spec) => {
      const target = joinPath(file, spec);
      if (!ORDER.includes(target)) throw new Error(`${file}: 未知の import ${spec}`);
      if (ORDER.indexOf(target) > ORDER.indexOf(file)) throw new Error(`${file}: ${target} より前に並べてください`);
      imports.push(`const {${names.replace(/\bas\b/g, ":")}} = ${varName(target)};`);
      return "";
    });
    if (/^\s*import\s/m.test(src)) throw new Error(`${file}: 対応していない import の書き方があります`);
    const exported = [];
    src = src.replace(/^export\s+(async\s+function|function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => {
      exported.push(name);
      return `${kind} ${name}`;
    });
    if (/^export\s/m.test(src)) throw new Error(`${file}: 対応していない export の書き方があります`);
    return `// ---- ${file} ----\nconst ${varName(file)} = (() => {\n${imports.join("\n")}\n${src}\nreturn { ${exported.join(", ")} };\n})();`;
  });
  return safeScript(`"use strict";\n${chunks.join("\n\n")}`);
}

// </script> が中に出てこないようにする
export function safeScript(s) {
  return s.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
}

export const STRICT_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'";
