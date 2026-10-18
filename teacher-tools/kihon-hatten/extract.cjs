// 4分野の eduit-info.js から「基本編・発展編」の分け方(levels)と、教材の名前を取り出して JSON で出す(build.py が使う)
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const repo = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");

function info(file) {
  const ctx = { window: {}, document: { querySelector: () => null } };
  vm.runInNewContext(read(file), ctx);
  return ctx.window.EDUIT_INFO;
}
// 教材の id → 名前(各分野のメニューと同じもの)
const names = { A: {}, B: {}, C: {}, D: {} };
{
  const ctx = { self: {} };
  vm.runInNewContext(read("A-materials/common/apps.js"), ctx);
  for (const a of ctx.self.G.APPS) names.A[a.id] = `${a.code} ${a.title}`;
}
{
  const m = read("B-bio/build/menu.html").match(/^var APPS = (\{.*\});$/m);
  for (const [id, a] of Object.entries(JSON.parse(m[1]))) names.B[id] = `${a.code} ${a.plain}`;
}
for (const m of read("C-energy/build/help.py").matchAll(/dict\(id='(C\d)'.*?name='([^']+)'/g)) names.C[m[1]] = `${m[1]} ${m[2]}`;
for (const m of JSON.parse(read("D-information/kyozai-shu/data/materials.json")).materials) names.D[m.id] = `${m.code} ${m.title}`;

const out = [];
for (const [key, dir] of [["A", "A-materials"], ["B", "B-bio"], ["C", "C-energy"], ["D", "D-information"]]) {
  const I = info(`${dir}/eduit-info.js`);
  for (const lv of ["basic", "advanced"])
    for (const it of I.levels[lv].items)
      if (!names[key][it.id]) throw new Error(`${dir}/eduit-info.js: levels の id「${it.id}」がメニューにありません`);
  out.push({ domain: key, domainName: I.domainName, version: I.version, levels: I.levels, textbook: I.textbook || null, names: names[key] });
}
process.stdout.write(JSON.stringify(out));
