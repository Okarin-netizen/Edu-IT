// ブラウザでの自動テスト（python3 build.py のあと NODE_PATH=… node tests/e2e.browser.cjs）
// 1ファイル版を開き、サンプルを読み込んで一覧・提出状況・CSV が出ること、外部に通信しないことを確かめる。
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "dist", "振り返り一覧.html");
const url = "file://" + file.split(path.sep).map(encodeURIComponent).join("/");
const samples = path.join(__dirname, "samples");
let pass = 0, fail = 0;
const check = (ok, label) => { ok ? pass++ : fail++; console.log(`${ok ? "✓" : "✗"} ${label}`); };

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1366, height: 650 } });
  const outside = [], errors = [];
  page.on("request", (r) => { if (!/^(file|data|blob):/.test(r.url())) outside.push(r.url()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  // headless ではダウンロードのファイル名が取れないことがあるので、保存しようとしたファイルを横取りして確かめる
  await page.addInitScript(() => {
    const blobs = new Map(), orig = URL.createObjectURL;
    URL.createObjectURL = (b) => { const u = orig(b); blobs.set(u, b); return u; };
    HTMLAnchorElement.prototype.click = function () {
      const b = blobs.get(this.href);
      window.__saved = b ? b.arrayBuffer().then((buf) => ({ name: this.download, text: new TextDecoder("utf-8", { ignoreBOM: true }).decode(buf) })) : null;
    };
  });
  const saved = () => page.evaluate(() => window.__saved);
  await page.goto(url);
  check(await page.locator(".ef-footer").count() === 1, "共通の枠のフッターが出る");
  // 日本語のファイル名をパスで渡すと Playwright が読めないので、中身を渡す
  const names = fs.readdirSync(samples).map((n) => ({ name: n, mimeType: "application/json", buffer: fs.readFileSync(path.join(samples, n)) }));
  await page.setInputFiles("#pick-files", names);
  await page.waitForSelector("#view table");
  const sum = await page.textContent("#file-sum");
  check(sum.includes(`${names.length} 個`) && sum.includes("読めなかった 2 個"), "読み込んだ数と読めなかった数: " + sum);
  const rows = await page.locator("#view tbody tr").count();
  check(rows > 30, "一覧に行が出る: " + rows);
  // 教材集の記録まとめと仮想CPUの書き出しの同じ振り返りは1行になる
  const acc = await page.locator("#view td.v", { hasText: "ACC の値が変わった" }).count();
  check(acc === 1, "教材集の記録まとめと1つずつの書き出しの同じ振り返りは1行: " + acc);
  await page.selectOption("#f-domain", "B");
  const bRows = await page.locator("#view tbody tr").count();
  const bDomains = await page.locator("#view td.dom").allTextContents();
  check(bRows > 0 && bDomains.every((d) => d === "B"), "分野で絞りこめる");
  await page.selectOption("#f-domain", "");
  await page.fill("#f-q", "山田");
  const yRows = await page.locator("#view tbody tr").count();
  check(yRows > 0 && yRows < rows, "名前で絞りこめる: " + yRows);
  await page.click("#csv");
  const dl = await saved();
  check(dl.name.startsWith("振り返り一覧_") && dl.text.startsWith("\ufeff組,番号,名前") && dl.text.split("\r\n").length === yRows + 2, "一覧の CSV: " + dl.name);
  await page.fill("#f-q", "");
  await page.click('[data-tab="matrix"]');
  const mRows = await page.locator("#view table.matrix tbody tr").count();
  check(mRows === 6, "提出状況の表(名前のないファイルも組・番号が同じならまとまる): " + mRows + " 人");
  await page.click("#csv");
  const dl2 = await saved();
  check(dl2.name.startsWith("提出状況_") && dl2.text.includes("山田花子"), "提出状況の CSV: " + dl2.name);
  await page.click('[data-tab="list"]');
  check(outside.length === 0, "外部に通信しない" + (outside.length ? ": " + outside.join(" ") : ""));
  check(errors.length === 0, "エラーが出ない" + (errors.length ? ": " + errors.join(" ") : ""));
  await browser.close();
  console.log(`\n${pass} 件 OK / ${fail} 件 NG`);
  process.exit(fail ? 1 : 0);
})();
