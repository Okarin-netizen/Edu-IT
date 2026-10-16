// 第3段（中学生目線レビュー MC-11・17・18）のブラウザでの確認
// 実行: npm run build のあと、NODE_PATH=（playwright のある場所） node tests/stage3.browser.cjs
const { chromium } = require("playwright");
const path = require("path");
const URL = "file://" + path.join(__dirname, "../dist/計測制御シミュレータ.html");
const ok = (c, m) => {
  console.log((c ? "PASS " : "FAIL ") + m);
  if (!c) process.exitCode = 1;
};

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const reqs = [];
  const watch = (ctx, page, tag) => {
    ctx.on("request", (r) => { if (!/^(file|data|blob|about):/.test(r.url())) reqs.push(r.url()); });
    page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`${tag}: ${m.text()}`));
  };

  // ---- 画面の大きさごと: はみ出さない ----
  for (const [w, hgt, touch] of [[1366, 650, false], [810, 1080, true], [1366, 655, true], [1280, 690, true], [1366, 560, false]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, hasTouch: touch });
    const page = await ctx.newPage();
    watch(ctx, page, `${w}×${hgt}`);
    await page.goto(URL);
    for (const hash of ["#/s/door", "#/s/traffic-button", "#/s/sandbox", "#/guide"]) {
      await page.evaluate((h) => (location.hash = h), hash);
      await page.waitForTimeout(150);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      ok(ov <= 0, `${w}×${hgt} ${hash}: 横にはみ出さない`);
    }
    await ctx.close();
  }

  const ctx = await browser.newContext({ viewport: { width: 1366, height: 650 } });
  const page = await ctx.newPage();
  watch(ctx, page, "操作");
  await page.goto(URL);
  const go = async (hash) => {
    await page.evaluate((h) => (location.hash = h), hash);
    await page.waitForTimeout(150);
  };

  ok((await page.textContent(".ef-footer")).includes("第1.7版") && (await page.textContent(".ef-footer")).includes("羽生市立南中学校"), "フッターに作成者と版（第1.7版）が出る（共通の枠）");

  // ---- MC-17: 速さ×0.5で短く押しても気づく ----
  await go("#/s/traffic-button");
  await page.selectOption(".speed-sel", "0.5");
  await page.click('button:has-text("▶ 実行")');
  await page.waitForTimeout(400);
  let hits = 0;
  for (let i = 0; i < 4; i++) {
    await page.click('button:has-text("■ 最初から"), button:has-text("⟲ 最初から")');
    await page.click('button:has-text("▶ 実行")');
    await page.waitForTimeout(350);
    const b = await page.$(".press-btn");
    const box = await b.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.waitForTimeout(25);
    await page.mouse.up();
    const flash = await page.textContent(".press-flash");
    await page.waitForTimeout(500);
    const log = await page.evaluate(() => {
      document.querySelector('.debug-card .tabs button:nth-child(2)').click();
      return document.querySelector(".log-list").textContent;
    });
    if (flash.includes("押した！") && log.includes("ボタン オン → 車の青 を「オフ」にした")) hits++;
    await page.evaluate(() => document.querySelector('.debug-card .tabs button:nth-child(1)').click());
  }
  ok(hits === 4, `×0.5で約25msの短いタップ: 4回中 ${hits}回 気づき、「押した！」とログ（ボタン オン → …）が出る`);
  await page.click('button:has-text("⏸ 一時停止")').catch(() => {});

  // ---- MC-18: 足した「もし」の条件は「ボタン ＝ オン」 ----
  await page.click(".blk-add-if");
  const cond = await page.evaluate(() => {
    const ifs = [...document.querySelectorAll(".blk-if .blk-cond")];
    const c = ifs.at(-1);
    const sels = c.querySelectorAll("select");
    return [...sels].map((s) => s.options[s.selectedIndex].textContent).join(" ");
  });
  ok(/^ボタン ＝（等しい） オン/.test(cond), "場面4: 足した「もし」は「ボタン ＝ オン」: " + cond);
  await page.click('button:has-text("元にもどす")');

  await go("#/s/door");
  await page.click(".blk-add-if");
  const cond2 = await page.evaluate(() => {
    const c = [...document.querySelectorAll(".blk-if .blk-cond")].at(-1);
    return c.textContent + " " + [...c.querySelectorAll("input")].map((i) => i.value).join(" ");
  });
  ok(cond2.includes("50"), "場面2: 足した「もし」の数は、プログラムのしきい値（50）: " + cond2.replace(/\s+/g, " ").slice(0, 60));
  await page.click('button:has-text("元にもどす")');

  // フローチャートの記号
  await page.click('.editor-card .tabs button:has-text("フローチャート")');
  const fc = await page.textContent(".flow-box");
  ok(fc.includes("距離 ＜ 50 ？") && !fc.includes("<"), "フローチャートは「＜」で表示: " + fc.slice(0, 40));

  // テキストで「ドア = オフ」→ 注意
  await page.click('.editor-card .tabs button:has-text("テキスト")');
  await page.fill("textarea.code", "ずっと\n  もし 距離 < 50 なら\n    ドア = 開く\n  でなければ\n    ドア = オフ\n  おわり\nおわり");
  await page.waitForTimeout(700);
  const warn = await page.textContent(".err-box");
  ok(warn.includes("注意") && warn.includes("5行目: 「ドア」には「開く」「閉じる」「止める」を使おう"), "ドア = オフ に注意が出る");
  await page.fill("textarea.code", "ずっと\n  もし 距離 < 50 なら\n    ドア = 開く\n  でなければ\n    ドア = 閉じる\n  おわり\nおわり");
  await page.waitForTimeout(700);
  ok((await page.textContent(".err-box")).trim() === "", "直すと注意が消える");

  // ---- MC-11: テストの理由の順・ケース再生の不合格の印・ログのセンサの値 ----
  await page.click('.editor-card button:has-text("テストを実行")');
  const lists = await page.$$eval(".result-list .fail-list", (ls) => ls.map((l) => [...l.querySelectorAll("li")].map((x) => parseFloat(x.textContent)).filter((n) => !Number.isNaN(n))));
  ok(lists.length > 0 && lists.every((ts) => ts.every((t, i) => i === 0 || ts[i - 1] <= t)), "テストの理由が時刻の順: " + JSON.stringify(lists));
  await page.click('.result-list li.fail button:has-text("このケースを再生")');
  await page.selectOption(".speed-sel", "5");
  await page.waitForFunction(() => document.querySelector(".next-stmt")?.textContent.includes("ケースの再生が終わりました"), null, { timeout: 30000 });
  const after = await page.textContent(".next-stmt");
  ok(after.includes("赤い点線が、不合格になった時刻"), "再生のあと、グラフの赤い点線の説明が出る");
  await page.$eval(".debug-card", (e) => e.scrollIntoView());
  const red = await page.$eval(".chart-canvas", (c) => {
    const g = c.getContext("2d");
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] < 80 && d[i + 2] < 80) n++;
    return n;
  });
  ok(red > 20, `グラフに不合格の時刻の赤い線（赤い点 ${red}）`);
  await page.screenshot({ path: path.join(process.env.SHOT_DIR || "/tmp", "mc-door-graph.png"), fullPage: false, clip: await page.$eval(".debug-card", (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: Math.max(0, r.y), width: r.width, height: Math.min(r.height, 600) }; }) }).catch(() => {});
  await page.click('.debug-card .tabs button:has-text("ログ")');
  const log = await page.textContent(".log-list");
  ok(/距離 \d+cm → ドア を「開く」にした/.test(log), "ログに「距離 ○cm → ドア を「開く」にした」");
  ok(log.includes("人がドアにぶつかった！"), "ログに「ぶつかった」");

  // 書き方ガイド
  await go("#/guide");
  const guide = await page.textContent("#view");
  ok(guide.includes("わり算のあまり") && guide.includes("数学の = とはちがいます"), "ガイドに「%」と「=（入れる）」の説明");

  // エラーのログの行番号は1回
  await go("#/s/sandbox");
  await page.click('.editor-card .tabs button:has-text("テキスト")');
  await page.fill("textarea.code", "1000000 回くり返す\n  LED = オン\nおわり");
  await page.waitForTimeout(700);
  await page.click('button:has-text("▶ 実行")');
  await page.waitForTimeout(500);
  const elog = await page.textContent(".log-list");
  ok(elog.includes("エラー: くり返す回数が多すぎます（10万回まで）（1行目）") && !elog.includes("1行目: "), "エラーのログの行番号は1回: " + elog.slice(0, 60));

  await ctx.close();
  ok(errors.length === 0, "コンソールのエラーなし " + errors.join(" / "));
  ok(reqs.length === 0, "外部へのリクエストなし " + reqs.join(" "));
  await browser.close();
})();
