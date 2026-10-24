// 1ファイル版を作るときに、4分野共通の枠（shared/eduit-frame.css・eduit-frame.js）と D の11教材で同じ枠（d-frame.css）と
// 情報の技術の版・更新履歴（eduit-info.js）を、HTML の中に入れる（外部のファイルを読まないように）。
// 各教材の tools/build-standalone.mjs から使う（import "../../build/eduit-inline.mjs"）。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(p, "utf8");
// </script> が中に出てこないようにする
const safe = (s) => s.replace(/<\/(script)/gi, "<\\/$1");

export function inlineEduitFrame(html, source = "index.html") {
  const parts = [
    [/<link rel="stylesheet" href="\.\.\/\.\.\/shared\/eduit-frame\.css">/, () => `<style id="eduit-frame-css">\n${read(join(here, "../../shared/eduit-frame.css"))}\n</style>`],
    [/<script src="\.\.\/eduit-info\.js"><\/script>/, () => `<script id="eduit-info">\n${safe(read(join(here, "../eduit-info.js")))}\n</script>`],
    [/<script src="\.\.\/\.\.\/shared\/eduit-frame\.js"><\/script>/, () => `<script id="eduit-frame">\n${safe(read(join(here, "../../shared/eduit-frame.js")))}\n</script>`],
    // D の11教材で同じ枠（ページの切りかえの帯など。D-information/d-frame.css）。各教材の css/style.css のあと
    [/<link rel="stylesheet" href="\.\.\/d-frame\.css">/, () => `<style id="d-frame-css">\n${read(join(here, "../d-frame.css"))}\n</style>`],
  ];
  // D1 D2 D3 D4 D7 の5教材で同じ中身の部品（D-information/d-common.css）。読んでいる教材だけ
  const common = /<link rel="stylesheet" href="\.\.\/d-common\.css">/;
  if (common.test(html)) html = html.replace(common, () => `<style id="d-common-css">\n${read(join(here, "../d-common.css"))}\n</style>`);
  for (const [re, to] of parts) {
    if (!re.test(html)) throw new Error(`${source}: 共通の枠の読み込み ${re} がありません`);
    html = html.replace(re, to);
  }
  return html;
}
