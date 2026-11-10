// 学習コースのデータ(course-data.js)と、各分野の自習ガイド(eduit-info.js の jishu)の sec が合っているかを確かめる。
// 実行: node T-textbook/check-course.cjs   (T-textbook/build.py も実行する。1つでもまちがいがあれば止める)
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const repo = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");
const ctx = { window: {} };
vm.runInNewContext(read("T-textbook/course-data.js"), ctx);
const { COURSE, COURSE_APPS } = ctx.window;
const secs = {};
for (const H of COURSE) for (const C of H.chapters) for (const s of C.secs) {
  if (secs[s.id]) throw new Error(`course-data.js: 節の id「${s.id}」が2つあります`);
  secs[s.id] = { s, H, used: 0 };
}
const errors = [];
const used = {};  // 記号 → その記号の手順に付いた sec
for (const dir of ["G-guidance", "A-materials", "B-bio", "C-energy", "D-information", "T-textbook/M-mimawari", "T-textbook/F-korekara", "T-textbook/Z-owari"]) {
  const c = { window: {}, document: { querySelector: () => null } };
  vm.runInNewContext(read(`${dir}/eduit-info.js`), c);
  const apps = c.window.EDUIT_INFO.jishu.apps;
  for (const [code, a] of Object.entries(apps)) {
    const list = (a.steps || []).map((x) => ["手順", x]).concat((a.check || []).map((x) => ["たしかめ問題", x]));
    for (const [kind, x] of list) {
      if (x.sec == null) continue;
      for (const id of [].concat(x.sec)) {
        if (!secs[id]) { errors.push(`${dir}: ${code} の${kind}の sec「${id}」が course-data.js にありません`); continue; }
        if (kind === "手順") { secs[id].used++; (used[code] = used[code] || new Set()).add(id); }
      }
    }
  }
}
// 節で開く教材(go)の記号に、その節の手順があるか(M・F は分野の記号 MA など。学習のまとめは手順なし)
for (const { s, H } of Object.values(secs)) {
  if (!s.p) errors.push(`course-data.js: ${s.id} にページ(p)がありません`);
  for (const g of s.go) {
    const A = COURSE_APPS[g[0]];
    if (!A) { errors.push(`course-data.js: ${s.id} の教材の記号「${g[0]}」が COURSE_APPS にありません`); continue; }
    if (A.q === "matome=1") continue;
    const code = (g[0] === "M" || g[0] === "F") && g[2] ? g[0] + g[2].toUpperCase() : g[0];
    if (!used[code] || !used[code].has(s.id)) errors.push(`${s.id}(${s.ref} ${s.name}): ${code} の自習ガイドに sec: '${s.id}' の手順がありません`);
  }
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`学習コースのデータ: ${Object.keys(secs).length} 節、まちがいなし`);
