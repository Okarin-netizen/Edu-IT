// ブラウザでの自動テスト(A-materials で python3 build/build-single.py のあと NODE_PATH=… node m7-solid-maker/tests/e2e.browser.cjs)
// 1ファイル版の M7 を、PC(1366×650)とタブレット縦(810×1080・指)で操作して、中学生目線レビューで直した所を確かめる。
const { chromium } = require("playwright");
const path = require("path");

const file = path.join(__dirname, "..", "..", "dist", "材料と加工_教材アプリ.html");
const url = "file://" + file.split(path.sep).map(encodeURIComponent).join("/") + "#m7-solid-maker";
let pass = 0, fail = 0;
const check = (ok, label) => { ok ? pass++ : fail++; console.log(`${ok ? "✓" : "✗"} ${label}`); };

async function open(browser, opt) {
  const ctx = await browser.newContext(opt);
  const page = await ctx.newPage();
  page.errors = []; page.outside = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  page.on("request", (r) => { if (!/^(file|data|blob|about):/.test(r.url())) page.outside.push(r.url()); });
  await page.addInitScript(() => {
    // 保存しようとしたファイルを横取りする(headless ではファイル名が取れないため)
    const blobs = new Map(), orig = URL.createObjectURL;
    URL.createObjectURL = (b) => { const u = orig(b); blobs.set(u, b); return u; };
    HTMLAnchorElement.prototype.click = function () {
      const b = blobs.get(this.href);
      if (b) window.top.__saved = b.text().then((text) => ({ name: this.download, text }));
    };
  });
  await page.goto(url);
  await page.waitForTimeout(900);
  const f = page.frameLocator("#view");
  const frame = () => page.frames().find((x) => x !== page.mainFrame());
  // ふりがなを除いた文字
  const plain = (sel) => frame().evaluate((s) => G.ruby.plain(document.querySelector(s)), sel);
  return { page, f, frame, plain };
}

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  // ---- PC 1366×650 ----
  let { page, f, frame, plain } = await open(browser, { viewport: { width: 1366, height: 650 } });
  const fb = await f.locator(".m7-front .m7-border").boundingBox();
  check(fb && fb.y + fb.height <= 650, "開いたとき、正面図が画面の中に入る(1366×650)");
  await f.locator("#clear").click(); await f.locator("dialog button[value=yes]").click();
  for (const i of [0, 1, 2]) await f.locator(`.m7-front .m7-hit[data-i="${i}"]`).click();
  check(await f.locator(".m7-mis").count() === 0, "正面図だけかいた途中では、赤い「!」を出さない");
  check(/つぎは「平面図」と「右側面図」/.test(await plain("#check")), "つぎにかく図を知らせる");
  await f.locator(`.m7-top .m7-hit[data-i="0"]`).click();
  await f.locator(`.m7-side .m7-hit[data-i="0"]`).click();
  const msg = await plain("#check");
  check(await f.locator(".m7-mis").count() === 2 && /正面図 2 こ/.test(msg), "3つそろったら、合わないマスと図の名前・数を知らせる");
  // ドラッグ中は立体を作り直さない
  const before = await frame().evaluate(() => document.querySelector("#info").textContent);
  const a = await f.locator(`.m7-top .m7-hit[data-i="1"]`).boundingBox(), b = await f.locator(`.m7-top .m7-hit[data-i="2"]`).boundingBox();
  await page.mouse.move(a.x + 5, a.y + 5); await page.mouse.down(); await page.mouse.move(b.x + 5, b.y + 5, { steps: 4 });
  await page.waitForTimeout(100);
  const during = await frame().evaluate(() => document.querySelector("#info").textContent);
  await page.mouse.up(); await page.waitForTimeout(150);
  const after = await frame().evaluate(() => document.querySelector("#info").textContent);
  check(before === during && after !== during, "ドラッグ中はマスだけ描き、はなしてから立体を作り直す");
  // 大きさを変えて元に戻す
  await f.locator("#sz-w").fill("20"); await f.locator("#sz-w").press("Tab");
  check(await f.locator("#sz-w").inputValue() === "16", "マスの数は 16 までにする");
  await f.locator(".m7-front").focus(); await page.keyboard.press("End");
  await f.locator("#undo").click(); await f.locator("#undo").click();
  check(page.errors.length === 0, "大きさを変えて元に戻してもエラーが出ない");
  // ななめのアイコンに見出し
  check(await f.locator(".m7-tool-sep", { hasText: "ななめ半分" }).count() === 1, "ななめの道具に「ななめ半分」の見出し");
  // 名前をふりかえりで入れて書き出す(メニューで入れていない)
  await f.locator("[data-tab=review]").click();
  await f.locator("#rf-cls").fill("3"); await f.locator("#rf-no").fill("7"); await f.locator("#rf-name").fill("南 太郎");
  await f.locator("#b-export").click(); await page.waitForTimeout(300);
  const out = await page.evaluate(() => window.__saved);
  const j = out && JSON.parse(out.text);
  check(j && j.student && j.student.class === "3" && j.student.name === "南 太郎", "書き出したファイルに、ふりかえりで入れた組・番号・名前が入る");
  // 長い作品名でも表題欄からはみ出さない
  await f.locator("[data-tab=sheet]").click();
  await f.locator("#sh-title").fill("とても長い名前の作品(コの字の本立てとふた付きの小物入れ)");
  const sizes = await frame().evaluate(() => [...document.querySelectorAll("#sheet-box text")].filter((t) => t.textContent.startsWith("とても")).map((t) => +t.getAttribute("font-size")));
  check(sizes.length === 2 && sizes.every((z) => z < 3.6), "長い作品名は小さくして欄に入れる");
  check(page.errors.length === 0 && page.outside.length === 0, "エラーが出ず、外に通信しない(PC)");
  await page.context().close();

  // ---- タブレット縦 810×1080(指) ----
  ({ page, f, frame } = await open(browser, { viewport: { width: 810, height: 1080 }, hasTouch: true, isMobile: true }));
  const ed = await f.locator(".m7-editor-card").boundingBox(), pv = await f.locator("#preview").boundingBox();
  check(pv.x > ed.x + ed.width - 5 && pv.y < ed.y + ed.height, "タブレット縦でも、立体の図が三面図のとなりに見える");
  await f.locator(`.m7-top .m7-hit[data-i="0"]`).tap();
  check(page.errors.length === 0, "指でマスをぬれる");
  await f.locator("[data-tab=sheet]").click();
  const sb = await f.locator("#sheet-box").boundingBox(), fm = await f.locator(".m7-sheet-form").boundingBox();
  check(sb.y < fm.y, "タブレット縦の図面タブでは、図面の見本が上に出る");
  check(page.errors.length === 0 && page.outside.length === 0, "エラーが出ず、外に通信しない(タブレット)");
  await browser.close();
  console.log(`\n${pass} 件 OK / ${fail} 件 NG`);
  process.exit(fail ? 1 : 0);
})();
