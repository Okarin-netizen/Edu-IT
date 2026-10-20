// ガイダンス(G)・4分野・教科書順コースの M・F・Z の eduit-info.js から自習ガイドの中身(jishu)と、教材の名前を取り出して JSON で出す(build.py が使う)
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const repo = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");

function info(file) {
  const ctx = { window: {}, document: { querySelector: () => null } };
  vm.runInNewContext(read(file), ctx);
  return ctx.window.EDUIT_INFO;
}
// 教材の記号 → 名前(各分野のメニューと同じもの)
const names = { G: { G: "技術分野のガイダンス" }, A: {}, B: {}, C: {}, D: {},
  M: { M: "身の回りの技術さがし", MA: "身の回りの技術さがし ① 材料と加工", MB: "身の回りの技術さがし ② 生物育成",
    MC: "身の回りの技術さがし ③ エネルギー変換", MD: "身の回りの技術さがし ④ 情報" },
  F: { F: "これからの技術ラボ", FA: "これからの技術ラボ ① 材料と加工", FB: "これからの技術ラボ ② 生物育成",
    FC: "これからの技術ラボ ③ エネルギー変換", FE: "これからの技術ラボ ④ 未来を提案" },
  Z: { Z: "学習を終えて" } };
// MA〜MD・FA〜FE は、教科書順コースから分野だけで開いたときの自習ガイド(画面には label の M① などを出す)
{
  const ctx = { self: {} };
  vm.runInNewContext(read("A-materials/common/apps.js"), ctx);
  for (const a of ctx.self.G.APPS) names.A[a.code] = a.title;
}
{
  const m = read("B-bio/build/menu.html").match(/^var APPS = (\{.*\});$/m);
  if (!m) throw new Error("B-bio/build/menu.html: var APPS = {…}; の行が見つかりません");
  for (const a of Object.values(JSON.parse(m[1]))) names.B[a.code] = a.plain;
}
for (const m of read("C-energy/build/help.py").matchAll(/dict\(id='(C\d)'.*?name='([^']+)'/g)) names.C[m[1]] = m[2];
for (const m of JSON.parse(read("D-information/kyozai-shu/data/materials.json")).materials) names.D[m.code] = m.title;

const out = [];
for (const [key, dir] of [["G", "G-guidance"], ["A", "A-materials"], ["B", "B-bio"], ["C", "C-energy"], ["D", "D-information"],
  ["M", "T-textbook/M-mimawari"], ["F", "T-textbook/F-korekara"], ["Z", "T-textbook/Z-owari"]]) {
  const I = info(`${dir}/eduit-info.js`);
  const J = I.jishu;
  if (!J || !J.apps) throw new Error(`${dir}/eduit-info.js: 自習ガイド(jishu)がありません`);
  const apps = [];
  for (const [code, a] of Object.entries(J.apps)) {
    if (!names[key][code]) throw new Error(`${dir}/eduit-info.js: jishu の記号「${code}」がメニューにありません`);
    apps.push(Object.assign({ code, name: names[key][code] }, a));
  }
  apps.sort((a, b) => (parseInt(a.code.slice(1), 10) || 0) - (parseInt(b.code.slice(1), 10) || 0));  // A2 < A10(G・M・F・Z は番号なし)
  out.push({ domain: key, domainName: I.domainName, version: I.version, lead: J.lead || "", ruby: J.ruby || {}, apps });
}
process.stdout.write(JSON.stringify(out));
