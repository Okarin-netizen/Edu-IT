// 第2段（中学生目線レビュー MC-02・06・09・10・14・15・記録の書き出し）のブラウザでの確認
// 実行: npm run build のあと、NODE_PATH=（playwright のある場所） node tests/stage2.browser.cjs
const { chromium } = require("playwright");
const path = require("path");
const URL = "file://" + path.join(__dirname, "../dist/計測制御シミュレータ.html");
const ok = (c, m) => {
  console.log((c ? "PASS " : "FAIL ") + m);
  if (!c) process.exitCode = 1;
};
const prog = (page, sid) => page.evaluate((id) => JSON.parse(localStorage.getItem("mcsim.v1") || "{}").programs?.[id] || "", sid);

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const reqs = [];
  for (const [w, hgt, touch] of [[1366, 560, false], [1366, 650, false], [1080, 810, true], [810, 1080, true]]) {
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
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const tag = `${w}×${hgt}`;
    for (const hash of ["#/", "#/s/streetlight", "#/s/traffic-button", "#/guide", "#/records", "#/teacher"]) {
      await go(hash);
      ok((await overflow()) <= 0, `${tag} ${hash}: 横にはみ出さない`);
    }
    // 2回目に開いた場面: 説明はたたまれ、「テストを実行」が最初の画面に入る（MC-10）
    await go("#/s/streetlight");
    await go("#/");
    await go("#/s/streetlight");
    const top = await page.evaluate(() => {
      const b = document.querySelector(".editor-card .btn-row .btn").getBoundingClientRect();
      return { bottom: b.bottom, text: document.querySelector(".editor-card .btn-row .btn").textContent, open: document.querySelector(".scn-story").open };
    });
    ok(!top.open && top.text.includes("テストを実行") && top.bottom <= hgt, `${tag} 2回目の場面: 説明がたたまれ、テストのボタンが画面に入る（下端 ${Math.round(top.bottom)}px）`);
    if (w >= 1001) {
      const cols = await page.evaluate(() => [".editor-card", ".world-card"].map((s) => document.querySelector(s).getBoundingClientRect()));
      ok(Math.abs(cols[0].top - cols[1].top) < 2 && cols[1].width >= 440, `${tag} プログラムと仮想世界が2列（仮想世界の幅 ${Math.round(cols[1].width)}px）`);
    }
    await ctx.close();
  }

  // ---- 操作の確認（ノートPC） ----
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 650 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const dialogs = [];
  let answer = true;
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    answer ? d.accept() : d.dismiss();
  });
  await page.goto(URL);
  const go = async (hash) => {
    await page.evaluate((h) => (location.hash = h), hash);
    await page.waitForTimeout(150);
  };

  // MC-09: はじめに授業の進め方と目安
  await go("#/");
  const home = await page.textContent("#view");
  ok(home.includes("授業の進め方（3時間）") && home.includes("1時間目") && home.includes("3時間目") && home.includes("目安 40分（2時間目）"), "はじめに: 3時間の進め方と場面ごとの目安");
  ok(home.includes("＋ ここに入れる"), "はじめにの使い方に、ブロックの入れ方");

  // MC-06: 模範プログラムはガイドにない。先生用ページはメニューにない
  await go("#/guide");
  const guide = await page.textContent("#view");
  ok(!guide.includes("模範"), "書き方ガイドに模範プログラムがない");
  ok(guide.includes("ブロックの使い方"), "書き方ガイドにブロックの使い方");
  ok((await page.$$('#chapter-nav a[href="#/teacher"]')).length === 0, "メニューに先生用ページがない");
  await page.click("body");
  await page.keyboard.type("teacher");
  await page.waitForTimeout(150);
  ok((await page.evaluate(() => location.hash)) === "#/teacher", "t e a c h e r と打つと先生用ページ");
  const teacher = await page.textContent("#view");
  ok(teacher.includes("模範プログラム") && (await page.$$("details.answer")).length === 4 && teacher.includes("#/teacher"), "先生用ページに4場面の模範と開き方");

  // MC-09・MC-02: 場面4ははじめから「もし」の中のメモの下が選ばれている
  await go("#/s/traffic-button");
  ok(/目安 25分（3時間目）/.test(await page.textContent(".scn-head")), "場面4に目安");
  const active = await page.evaluate(() => {
    const a = document.querySelector(".blk-slot.active");
    return a && a.closest(".blk-if") && a.previousElementSibling?.classList.contains("blk-comment");
  });
  ok(active, "場面4: 「もし」の中の「# ここに…」の下の「＋」が選ばれている");
  await page.click(".blk-add-wait");
  ok((await prog(page, "traffic-button")).includes("# ここに、歩行者をわたらせて、車を青にもどす手順を書こう\n    1 秒待つ\n  おわり"), "場面4: 命令が「もし」の中に入る");

  // MC-02: ↔ で「もし」の外のブロックを中へ動かす
  await go("#/s/streetlight");
  await page.click(".blk-add-wait"); // 何も選ばないと「ずっと」の最後（「▶」が出ている所）に入る
  ok((await prog(page, "streetlight")).includes("  おわり\n  1 秒待つ\nおわり"), "場面1: 何も選ばないと、▶ の所（「ずっと」の最後）に入る");
  await page.click('.blk-wait button[title="べつの場所へ動かす"]');
  ok((await page.textContent(".blk-howto")).includes("を動かします"), "↔ を押すと、動かし方の説明が出る");
  await page.click('button:has-text("やめる")');
  await page.click('.blk-if > .blk-head button[title="べつの場所へ動かす"]');
  ok(await page.$eval(".blk-if", (e) => e.querySelectorAll(".blk-slot.move-target[disabled]").length > 0 && e.querySelector(".blk-slot.move-target:not([disabled])") === null), "動かしている「もし」の中へは動かせない");
  await page.click('button:has-text("やめる")');
  await page.click('.blk-wait button[title="べつの場所へ動かす"]');
  // 「もし」の中の最初の「ここへ動かす」
  await page.click(".blk-if .blk-inner .blk-slot.move-target >> nth=0");
  ok((await prog(page, "streetlight")).includes("  もし 明るさ < 30 なら\n    1 秒待つ\n    街灯 = オン"), "↔ → ここへ動かす で「もし」の中へ移る");

  // MC-14: 中身のあるブロックを消すときは確かめる。ページを移っても元にもどせる
  dialogs.length = 0;
  answer = false;
  await page.click('.blk-forever > .blk-head button[title="消す"]');
  ok(dialogs.length === 1 && /中のブロック（\d+こ）も、いっしょに消えます/.test(dialogs[0]), "「ずっと」を消す前に確かめる");
  ok((await prog(page, "streetlight")).includes("ずっと"), "「いいえ」なら消えない");
  answer = true;
  await page.click('.blk-forever > .blk-head button[title="消す"]');
  ok(!(await prog(page, "streetlight")).includes("ずっと"), "「はい」なら消える");
  ok((await page.textContent(".blk-legend")).includes("コピー"), "ボタンの意味の凡例がある");
  await go("#/");
  await go("#/s/streetlight");
  await page.click('button:has-text("元にもどす")');
  await page.waitForTimeout(100);
  ok((await prog(page, "streetlight")).includes("ずっと"), "ページを移って戻っても、元にもどせる");

  // MC-15: テキストにまちがいがあるままブロックへ
  await page.click('.tabs button:has-text("テキスト")');
  await page.fill("textarea.code", "ずっと\n  もし 明るさ < 30 なら\n    街灯 = オン\n  でなければ\n    街灯 = オフ\nおわり");
  await page.waitForTimeout(600);
  await page.click('.tabs button:has-text("ブロック")');
  const lock = await page.evaluate(() => ({ note: document.querySelector(".editor-card .explain.warn")?.textContent || "", inert: document.querySelector(".blk-editor").inert }));
  ok(lock.note.includes("まちがえる前のプログラム") && lock.inert, "まちがいがあるとき: ブロックは前のプログラムと知らせ、ブロックでは直せない");
  await page.click('button:has-text("テキストにもどって直す")');
  ok((await page.inputValue("textarea.code")).includes("でなければ"), "テキストにもどると、書きかけが残っている");
  await page.click('.tabs button:has-text("ブロック")');
  await page.click('button:has-text("書きかけをやめて、ブロックで続ける")');
  ok(!(await page.evaluate(() => document.querySelector(".blk-editor").inert)), "書きかけをやめると、ブロックで続けられる");

  // MC-10: プログラムの上の「テストを実行」と ○× のまとめ
  await page.click('.editor-card button:has-text("テストを実行")');
  const mini = await page.textContent(".test-mini");
  ok(/テスト \d\/3 合格/.test(mini) && mini.includes("夕方から夜になる"), "プログラムの上にテスト結果のまとめ: " + mini.slice(0, 40));

  // MC-06: 改善メモの例が答えにならない
  const ph = await page.getAttribute(`#memo-streetlight`, "placeholder");
  ok(!/50|150|しきい値/.test(ph), "改善メモの例に答えがない: " + ph);

  // 記録: 組・番号がないと書き出さない。書き出したらファイル名を出す
  await go("#/records");
  ok((await page.textContent("#view")).includes("先生に出すのは JSON のファイルです"), "記録: 先生に出すファイルの説明");
  let downloaded = false;
  page.on("download", () => (downloaded = true));
  await page.click('button:has-text("JSONで書き出す")');
  await page.waitForTimeout(200);
  ok(!downloaded && (await page.textContent(".export-note")) === "組と番号を入れてから書き出そう", "組・番号が空なら書き出さない");
  await page.fill("#stu-cls", "2");
  await page.fill("#stu-num", "15");
  const dl = page.waitForEvent("download");
  await page.click('button:has-text("JSONで書き出す")');
  const d = await dl;
  const note = await page.textContent(".export-note");
  ok(Boolean(d) && note.includes("ファイルを保存しました（ファイル名: 計測制御_記録_215.json）。先生に言われた場所に出そう。"), "書き出したあとにファイル名と出し方");

  await ctx.close();
  ok(errors.length === 0, "コンソールのエラーなし " + errors.join(" / "));
  ok(reqs.length === 0, "外部へのリクエストなし " + reqs.join(" "));
  await browser.close();
})();
