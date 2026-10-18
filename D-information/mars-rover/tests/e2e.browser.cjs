// ブラウザでの確認（file:// で1ファイル版を開く）
// 実行: npm run build のあと、NODE_PATH=（playwright のある場所） node tests/e2e.browser.cjs
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("/opt/node-tools/node_modules/playwright"));
}
const path = require("path");
const URL = "file://" + path.join(__dirname, "../dist/火星探査ロボット.html");
const ok = (c, m) => {
  console.log((c ? "PASS " : "FAIL ") + m);
  if (!c) process.exitCode = 1;
};

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const reqs = [];
  for (const [w, hgt, touch] of [[1366, 768, true], [1280, 800, false], [390, 844, true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, hasTouch: touch, acceptDownloads: true });
    ctx.on("request", (r) => { if (!/^(file|data|blob|about):/.test(r.url())) reqs.push(r.url()); });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${w}: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`${w}: ${m.text()}`));
    await page.goto(URL);
    const go = async (hash) => {
      await page.evaluate((h) => (location.hash = h), hash);
      await page.waitForTimeout(150);
    };
    const tag = `${w}px`;
    for (const hash of ["#/", "#/s/straight", "#/s/rock", "#/s/maze", "#/s/line", "#/s/free", "#/eval", "#/records", "#/teacher"]) {
      await go(hash);
      ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `${tag} ${hash}: 横にはみ出さない`);
    }
    if (w !== 1280) continue;

    // 上のバー・メニュー
    await go("#/");
    ok((await page.textContent(".ef-title")).includes("D10火星探査ロボット・シミュレータ"), "上のバーに記号と名前");
    const navText = (await page.textContent("#chapter-nav")).replace(/\s+/g, "");
    ok(/はじめに.*基本編.*まっすぐ走って止まる.*岩の前で止まる・よける.*迷路のような谷を探査する.*発展編.*色センサで線をたどる.*自由なコースで記録に挑戦.*評価・振り返り.*記録/.test(navText), "メニューの順: はじめに → ①②③ → ④⑤ → 評価・振り返り → 記録");
    ok(await page.$("#chapter-nav[data-ef-autohide]"), "タブの帯に data-ef-autohide");

    // ① 時間を変えて合格する
    await go("#/s/straight");
    const secs = page.locator('.blk-editor input[aria-label="秒数"]');
    await secs.fill("10");
    await secs.press("Enter");
    await secs.dispatchEvent("change");
    await page.waitForTimeout(100);
    await page.click('.test-card button:has-text("テストを実行")');
    ok((await page.textContent(".test-card")).includes("全部合格"), "① 前進 10 秒で全部合格");
    // 実行すると、ロボットが動く（×10）
    await page.selectOption(".speed-sel", "10");
    await page.click('button:has-text("▶ 実行")');
    await page.waitForTimeout(2000);
    ok((await page.textContent(".outcome")).includes("ミッション達成"), "① 実行するとミッション達成");

    // ② ブロックを足す: 1ステップで光る、まちがいの箱
    await go("#/s/rock");
    await page.click('button:has-text("⏭ 1ステップ")');
    ok((await page.$$(".blk.current")).length === 1, "1ステップで、次の命令のブロックが光る");
    ok((await page.textContent(".next-stmt")).includes("次に実行する命令"), "1ステップで次の命令が出る");
    await page.click('.blk-add[data-kind="drive:右に回る"]');
    ok((await page.$$(".blk-drive")).length >= 3, "動きのブロックを入れられる");
    await page.click(".design-card [data-slot=frontLeft]");
    ok((await page.textContent(".design-card")).includes("左前の距離"), "設計でセンサを付けると、使える名前が増える");
    await page.click('.tabs button:has-text("フローチャート")');
    ok((await page.$$("svg.flowchart .fc-node")).length > 4 && (await page.textContent("svg.flowchart")).includes("右に回る"), "フローチャートに「右に回る」");
    await page.click('.tabs button:has-text("ブロック")');
    // 付けていないセンサ
    await go("#/s/maze");
    await page.click('.blk-add[data-kind="if"]');
    await page.waitForTimeout(100);
    const sel = page.locator('.blk-editor select[aria-label="くらべるもの"]').last();
    ok((await sel.locator("option").allTextContents()).includes("前の距離"), "条件でセンサをえらべる");
    // テストの結果と再生
    await page.click('.test-card button:has-text("テストを実行")');
    ok((await page.$$(".result-list li.fail")).length === 2, "③ はじめのプログラムは不合格（2ケース）");
    await page.click('.result-list button:has-text("このケースを再生")');
    await page.waitForTimeout(300);
    ok((await page.textContent(".sim-state")).includes("実行中"), "ケースを再生できる");

    // ⑤ 記録に挑戦とランキング
    await go("#/s/free");
    await page.selectOption(".case-sel", "1");
    await page.click('.test-card button:has-text("記録に挑戦")');
    ok(/\d+点/.test(await page.textContent(".test-card")) && (await page.$$(".ranking tbody tr")).length === 1, "⑤ 記録に挑戦すると点数とランキング");

    // 評価
    await go("#/eval");
    await page.fill("#ev-before-機能", "3").catch(() => {});
    await page.evaluate(() => { const r = document.getElementById("ev-before-機能"); r.value = "4"; r.dispatchEvent(new Event("input")); });
    ok((await page.$$("svg.radar polygon[fill]")).length === 1, "評価のレーダーチャートがかける");
    await page.fill("#refl-debug", "止まる距離を30にした");
    await page.waitForTimeout(600);
    ok(await page.$(".reflection[data-ef-reflect]"), "振り返りに data-ef-reflect");

    // 記録の書き出し
    await go("#/records");
    await page.fill("#stu-cls", "2");
    await page.fill("#stu-num", "7");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click('button:has-text("JSONで書き出す")')]);
    const json = JSON.parse(require("fs").readFileSync(await dl.path(), "utf8"));
    ok(json.app === "火星探査ロボット・シミュレータ" && json.records.length >= 3 && json.evaluation.before.機能 === 4 && json.reflections.debug.text.includes("30"), "JSON に記録・評価・振り返りが入る");

    // 振り返りを隠す設定
    const p2 = await ctx.newPage();
    await p2.goto(URL + "?furikaeri=off#/eval");
    await p2.waitForTimeout(300);
    ok(!(await p2.isVisible(".reflection")) && (await p2.textContent("#chapter-nav")).includes("評価") && !(await p2.textContent("#chapter-nav")).includes("振り返り"), "振り返りを隠すと、振り返りの欄が出ない（評価は出る）");
    await p2.goto(URL + "?furikaeri=on#/");
    await p2.close();
  }
  ok(errors.length === 0, `コンソールのエラーなし${errors.length ? ": " + errors.join(" / ") : ""}`);
  ok(reqs.length === 0, `外部への通信なし${reqs.length ? ": " + reqs.join(" ") : ""}`);
  await browser.close();
})();
