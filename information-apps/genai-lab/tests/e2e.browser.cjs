// ブラウザでの自動テスト（npm run build のあと node tests/e2e.browser.cjs）
// ダブルクリックで開いたときと同じ file:// で開き、中学生目線レビュー(2026-10-15)で直した所が
// もどっていないこと・外部に通信しないことを確かめる。
const { chromium } = require("playwright");
const path = require("path");

const file = path.join(__dirname, "..", "dist", "genai-lab.html");
const url = "file://" + file.split(path.sep).map(encodeURIComponent).join("/");

let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "✓" : "✗"} ${label}`);
};

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 650 } });
  const p = await ctx.newPage();
  const errors = [];
  const external = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  p.on("request", (r) => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  const go = async (id) => { await p.goto(url + "#" + id); await p.waitForTimeout(100); };
  const scrollY = () => p.evaluate(() => window.scrollY);

  // 全ページが開ける
  for (const id of ["intro", "guess", "token", "textgen", "halluc", "noise", "imggen", "privacy", "quiz"]) {
    await go(id);
    check((await p.locator(".sec-title").count()) === 1, `${id} が開ける`);
  }

  // GL-01: ボタンを押しても画面がとばない
  await go("quiz");
  const q6 = p.locator(".quiz-opts").nth(5).locator(".choice").first();
  await q6.scrollIntoViewIfNeeded();
  const y0 = await scrollY();
  await q6.click();
  await p.waitForTimeout(100);
  check(y0 > 300 && Math.abs((await scrollY()) - y0) < 5, `クイズQ6を押してもスクロール位置が変わらない (${y0} → ${await scrollY()})`);
  // GL-04: キーボードの位置も残る
  check(await p.evaluate(() => !!document.activeElement && document.activeElement !== document.body && document.getElementById("view").contains(document.activeElement)), "押したあともフォーカスが教材の中に残る");

  // GL-02: 正解の位置がばらばら
  const pos = await p.evaluate(() => GenaiData.quiz.map((q) => q.c));
  check(new Set(pos).size >= 3, `クイズの正解の位置がばらばら (${pos.join(",")})`);

  // GL-03・GL-10: 判定する前に答えのまとめが出ない。新しい文は3本だけ判定
  await go("halluc");
  await p.click("text=AIに文を5本つくらせる");
  check((await p.locator(".gen-row").count()) === 5, "文を5本つくる");
  check((await p.locator(".result.warn").count()) === 0, "判定する前は答えのまとめが出ない");
  const judges = p.locator(".gen-row .judge");
  const n = await judges.count();
  check(n === 3, `判定するのは新しい文の3本 (${n})`);
  for (let i = 0; i < n; i++) await p.locator(".gen-row .judge").first().locator("text=まちがい").click();
  check((await p.locator(".result.warn").count()) === 1, "3本判定すると答えのまとめが出る");
  check((await p.locator("text=前の言葉をいくつ見る").count()) === 0, "このページには1語/2語の切りかえがない");
  // GL-05: AIの答えの文に印がつく
  const line = p.locator(".line").first();
  await line.click();
  check((await p.locator(".line.marked").count()) === 1, "AIの答えの文をおすと印がつく");

  // GL-06: 送ったら②へ移る
  await go("privacy");
  await p.click("text=AIに送る");
  await p.waitForTimeout(800);
  const top2 = await p.evaluate(() => document.getElementById("privacy-step2").getBoundingClientRect().top);
  check(top2 >= -5 && top2 < 300, `送ったあと②が画面に見える (top ${Math.round(top2)})`);
  await p.click("text=わたしの電話番号は…");
  check((await p.locator(".result.ng").count()) === 1, "Aさんの電話番号がBさんへの答えに出る");
  check((await p.locator("text=入れる情報を変える").count()) === 1, "①に「入れる情報を変える」がある");

  // GL-07・GL-27: 絵をつくる
  await go("imggen");
  check((await p.locator("text=AIの予想: まだありません").count()) === 1, "はじめの「AIの予想」に説明が出る");
  await p.click("text=最後まで自動");
  await p.waitForTimeout(4500);
  check(await p.locator("text=1ステップ進める").isDisabled(), "できあがったら「1ステップ進める」が止まる");

  // GL-12・GL-19: ミニ文章AI
  await go("textgen");
  check((await p.locator("table.prob").count()) === 0, "文のはじめは候補の表を出さない(はじめの言葉だけ)");
  await p.locator(".start-row .ef-btn").first().click();
  await p.click("text=文のおわりまで自動");
  await p.waitForTimeout(500);
  const mid = await p.locator(".sentence .chip").count();
  await p.waitForTimeout(9000);
  const end = await p.locator(".sentence .chip").count();
  check(end > mid, `自動は1語ずつふえる (${mid} → ${end})`);

  // GL-09: ふりがな
  await go("privacy");
  await p.click("text=ふりがな");
  check((await p.locator("#view ruby").count()) > 10, "ふりがなをおすと、むずかしい言葉にふりがながつく");
  await p.click("text=ふりがな");
  check((await p.locator("#view ruby").count()) === 0, "もう一度おすとふりがなが消える");

  // GL-08: 記録を書き出す
  await go("quiz");
  await p.click("text=記録を書き出す");
  check((await p.locator("text=組と番号を入れてから").count()) === 1, "組と番号がないと書き出さない");
  await p.fill("#rec-cls", "2");
  await p.fill("#rec-num", "5");
  // (file:// の自動テストのブラウザでは保存名が「download」になるので、ファイル名は知らせの文で確かめる)
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 5000 }).catch(() => null), p.click("text=記録を書き出す")]);
  check(Boolean(dl), "記録のファイルができる");
  check((await p.locator("text=生成AIのしくみラボ_2_5.json").count()) === 1, "知らせにファイル名が出る");

  // GL-23・GL-24: 読みこみ直しても残る
  await p.reload();
  await p.waitForTimeout(200);
  check((await p.locator(".nav-link.is-visited").count()) >= 5, "メニューに「やった」印がつく");
  await go("quiz");
  check((await p.locator(".quiz-opts .choice.right").count()) >= 1, "読みこみ直してもクイズの答えが残る");

  // GL-22: タブレット縦で、メニューの8ステップが全部見える
  await p.setViewportSize({ width: 810, height: 1080 });
  await go("intro");
  const hidden = await p.evaluate(() => [...document.querySelectorAll(".nav-link")].filter((a) => a.getBoundingClientRect().right > window.innerWidth).length);
  check(hidden === 0, "タブレット縦でメニューが画面の外に出ない");
  await p.setViewportSize({ width: 390, height: 800 });
  for (const id of ["textgen", "imggen", "privacy", "quiz"]) {
    await go(id);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    check(sw <= 390, `スマホ幅で ${id} が横にはみ出さない (${sw})`);
  }

  check(errors.length === 0, "エラーが出ない" + (errors.length ? ": " + errors.join(" / ") : ""));
  check(external.length === 0, "外部への通信が0件" + (external.length ? ": " + external.join(" ") : ""));

  await browser.close();
  console.log(`\n${pass} 件 OK / ${fail} 件 NG`);
  process.exit(fail ? 1 : 0);
})();
