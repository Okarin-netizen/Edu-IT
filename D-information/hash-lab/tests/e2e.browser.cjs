// ブラウザでの自動テスト（npm run build のあと node tests/e2e.browser.cjs）
// ダブルクリックで開いたときと同じ file:// で開き、6つのチャレンジ・書き出し・はじめからやり直す・
// 外部に通信しないことを確かめる。SHOTS=1 で tests/shots/ に画面の例を保存する。
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const file = path.join(__dirname, "..", "dist", "hash-lab.html");
const url = "file://" + file.split(path.sep).map(encodeURIComponent).join("/");
const shots = process.env.SHOTS ? path.join(__dirname, "shots") : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "✓" : "✗"} ${label}`);
};

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = [];
  const external = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  p.on("request", (r) => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  const go = async (id) => { await p.goto(url + "#" + id); await p.waitForTimeout(120); };
  const shot = async (name) => { if (shots) await p.screenshot({ path: path.join(shots, name + ".png"), fullPage: true }); };
  const done = (id) => p.evaluate((k) => !!(JSON.parse(localStorage.getItem("eduit-hash-lab") || "{}").missions || {})[k], id);

  // 全ページが開ける
  for (const id of ["intro", "make", "avalanche", "toy", "oneway", "password", "tamper", "quiz", "records"]) {
    await go(id);
    check((await p.locator(".sec-title").count()) === 1, `${id} が開ける`);
  }
  await go("intro");
  await shot("00_はじめに");
  check((await p.locator(".ef-footer, [data-ef-footer]").count()) >= 1, "共通の枠のフッターがある");

  // 1: ハッシュ値を作る
  await go("make");
  await p.click("button.ef-btn-primary:has-text('ハッシュ化する')");
  const hex = await p.locator(".hash-out .hex").getAttribute("aria-label");
  check(/125aeadf27b0459b8760c13a3d80912dfa8a81a68261906f60d87f4a0268646c/.test(hex), "「こんにちは」の SHA-256 が正しい");
  await p.click("button:has-text('(長い文)')");
  await p.click("button:has-text('Hello')");
  check(await done("hash"), "チャレンジ1(短い文・長い文・3つ)が達成になる");
  check((await p.locator("table.data tbody tr").count()) === 3, "ハッシュ化した文の表が3行");
  await shot("01_ハッシュ値を作る");

  // 2: なだれ効果
  await go("avalanche");
  check((await p.locator(".result.info").first().textContent()).includes("同じ文"), "はじめは同じ文・同じハッシュ値");
  await p.fill("#av-b", "2年1組 集合は9時");
  await p.waitForTimeout(100);
  check(await done("avalanche"), "チャレンジ2(1文字だけ変える)が達成になる");
  const marks = await p.locator(".pair-row").nth(1).locator("mark").count();
  check(marks > 40, `ハッシュ値の大部分が変わる(ちがう文字 ${marks})`);
  await shot("02_なだれ効果");

  // 3: 手作りハッシュの衝突
  await go("toy");
  await p.fill("#toy-a", "あい");
  await p.fill("#toy-b", "いあ");
  await p.waitForTimeout(100);
  check(await done("collision"), "チャレンジ3(衝突)が達成になる");
  check((await p.locator(".result.ng").count()) === 1, "衝突のメッセージが出る");
  await shot("03_手作りハッシュ");

  // 4: 総当たり
  await go("oneway");
  await p.fill("#pin-guess", "123");
  await p.press("#pin-guess", "Enter");
  check((await p.locator(".try-list li").count()) + (await p.locator(".result.ok").count()) >= 1, "自分で予想してくらべられる");
  if (!(await done("crack"))) {
    await p.click("text=総当たりをはじめる");
    await p.waitForSelector(".result.ok", { timeout: 15000 });
  }
  check(await done("crack"), "チャレンジ4(暗証番号を見つける)が達成になる");
  await p.locator("#len").fill("12");
  await p.click("text=英大文字・小文字+数字+記号");
  check((await p.locator(".stat.good").count()) === 1, "12文字・記号ありは時間が長い(緑)");
  await shot("04_もとにもどせる");

  // 5: パスワード
  await go("password");
  await p.fill("#login-pass", "minami2026");
  await p.click("button:has-text('ログイン')");
  check((await p.locator(".login-res .result.ok").count()) === 1, "正しいパスワードでログインできる");
  await p.click(".user-btn:has-text('sora')");
  await p.click(".user-btn:has-text('mei')");
  check(await done("leak"), "チャレンジ5(同じパスワードの2人)が達成になる");
  await p.click("text=よく使われるパスワード辞書");
  check((await p.locator("tr.is-cracked").count()) === 4, "辞書で4人のパスワードが見つかる");
  await p.click("text=ソルトを付けて保存する");
  check((await p.locator("tr.is-cracked").count()) === 0, "ソルトを付けると辞書では見つからない");
  await shot("05_パスワード");

  // 6: 改ざん
  await go("tamper");
  for (let i = 0; i < 3; i++) await p.locator(".copy").nth(i).locator("text=ハッシュ値を計算する").click();
  await p.locator(".copy").nth(0).locator("text=本物").click();
  await p.locator(".copy").nth(1).locator("text=書きかえられている").click();
  await p.locator(".copy").nth(2).locator("text=書きかえられている").click();
  check(await done("tamper"), "チャレンジ6(改ざんを見分ける)が達成になる");
  await p.fill("#tamper-edit", "【校外学習のお知らせ】 ");
  check((await p.locator("#tamper-edit ~ div .result.ng, .card .result.ng").count()) >= 1, "自分で書きかえるとハッシュ値が一致しない");
  await shot("06_改ざん");

  // 7: クイズとふりかえり。ボタンを押しても画面がとばない
  await go("quiz");
  const pos = await p.evaluate(() => HashData.quiz.map((q) => q.c));
  check(new Set(pos).size >= 3, `クイズの正解の位置がばらばら (${pos.join(",")})`);
  const q5 = p.locator(".quiz-opts").nth(4).locator(".choice").first();
  await q5.scrollIntoViewIfNeeded();
  const y0 = await p.evaluate(() => window.scrollY);
  await q5.click();
  await p.waitForTimeout(100);
  const y1 = await p.evaluate(() => window.scrollY);
  check(y0 > 300 && Math.abs(y1 - y0) < 5, `クイズを押してもスクロール位置が変わらない (${y0} → ${y1})`);
  for (let i = 0; i < 8; i++) {
    const c = p.locator(".quiz-opts").nth(i).locator(".choice:not([disabled])").first();
    if (await c.count()) await c.click();
  }
  check((await p.locator("text=8問中").count()) === 1, "8問答えると点数が出る");
  await p.fill("#refl-r1", "同じ文なら同じハッシュ値になる。");
  await p.fill("#refl-r2", "長いパスワードにする。");
  await p.fill("#refl-r3", "ダウンロードの確認。");
  await shot("07_クイズとふりかえり");

  // 記録の書き出し
  await go("records");
  await p.click("text=記録を書き出す(JSON・提出用)");
  check((await p.locator(".export-note.warn").count()) === 1, "組・番号がないと書き出さない");
  await p.fill("#rec-cls", "2");
  await p.fill("#rec-num", "15");
  await p.fill("#rec-name", "山田花子");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("text=記録を書き出す(JSON・提出用)")]);
  // (file:// の自動テストのブラウザでは保存名が「download」になるので、ファイル名は知らせの文で確かめる)
  check((await p.locator(".export-note.good").textContent()).includes("ハッシュ化体験ラボ_2_15_山田花子.json"), "ファイル名に組・番号・名前が入る");
  const rec = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
  check(rec.app === "ハッシュ化体験ラボ" && rec.student.num === "15", "JSON に教材名と組・番号が入る");
  check(rec.challenges.length === 6 && rec.challenges.every((c) => c.cleared), "JSON に6つのチャレンジの達成が入る");
  check(rec.quiz.total === 8 && rec.quiz.answered === 8, "JSON にクイズの結果が入る");
  check(rec.reflection.r2 === "長いパスワードにする。", "JSON にふりかえりが入る");
  if (process.env.SAVE_JSON) fs.writeFileSync(process.env.SAVE_JSON, JSON.stringify(rec, null, 2));
  await shot("08_ふりかえり・記録");

  // 読みこみ直しても残る
  await p.reload();
  await p.waitForTimeout(150);
  check((await p.locator("#rec-name").inputValue()) === "山田花子", "読みこみ直しても名前が残る");

  // ふりがな・大きな文字
  await p.click("button.toggle:has-text('ふりがな')");
  check((await p.locator("#view ruby").count()) > 0, "ふりがなが付く");

  // はじめからやり直す
  await p.click(".reset-btn");
  check((await p.locator(".reset-confirm").count()) === 1, "消す前に確かめる");
  await p.click(".reset-confirm .danger");
  await p.waitForTimeout(150);
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem("eduit-hash-lab") || "{}"));
  check(!after.missions && !after.refl && !after.student, "記録・チャレンジ・ふりかえり・名前が消える");
  check(after.furigana === true, "ふりがなの設定は残る");
  check((await p.locator("#rec-name").inputValue()) === "", "名前の欄が空になる");
  await go("quiz");
  check((await p.locator(".choice:disabled").count()) === 0, "クイズの答えも消える");
  await go("make");
  check((await p.locator(".hash-out").count()) === 0, "ハッシュ化した文も消える");

  // 小さい画面
  await p.setViewportSize({ width: 390, height: 800 });
  await go("password");
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, `スマホの幅で横にはみ出さない (${overflow}px)`);

  check(errors.length === 0, "エラーが出ない" + (errors.length ? ": " + errors.join(" / ") : ""));
  check(external.length === 0, "外部に通信しない" + (external.length ? ": " + external.join(" ") : ""));

  await browser.close();
  console.log(`\n${pass} 件 OK / ${fail} 件 NG`);
  process.exit(fail ? 1 : 0);
})();
