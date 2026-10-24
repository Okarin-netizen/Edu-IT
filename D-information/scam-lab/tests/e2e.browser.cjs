// ブラウザでの自動テスト（npm run build のあと node tests/e2e.browser.cjs）
// ダブルクリックで開いたときと同じ file:// で開き、5つの場面を最後までクリアできること、
// だまされたらやり直せること、記録の書き出し・はじめからやり直す・外部に通信しないことを確かめる。
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const file = path.join(__dirname, "..", "dist", "scam-lab.html");
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
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 650 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = [];
  const external = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  p.on("request", (r) => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  const go = async (id) => { await p.goto(url + "#" + id); await p.waitForTimeout(100); };

  // 全ページが開ける
  for (const id of ["intro", "oneclick", "prize", "virus", "support", "shop", "matome", "records"]) {
    await go(id);
    check((await p.locator(".sec-title").count()) === 1, `${id} が開ける`);
  }

  // だまされる → どうなったか出る → その前の場面にもどれる
  await go("oneclick");
  await p.click("text=体験をはじめる");
  await p.click(".device >> text=▶ 再生する");
  check((await p.locator(".device >> text=会員登録が完了しました").count()) === 1, "再生を押すと「登録完了」の画面になる");
  await p.click(".act >> text=「お客様の情報」で");
  check((await p.locator(".steps li.is-done").count()) === 1, "よい行動をすると、やることリストに ✓ が付く");
  await p.click(".device >> text=お支払い手続きへ");
  check((await p.locator(".end-card.bad").count()) === 1, "画面の「お支払い手続きへ」を押すと、だまされたおわりになる");
  await p.click("text=その前の場面にもどって、やり直す");
  check((await p.locator(".device >> text=会員登録が完了しました").count()) === 1, "その前の場面にもどれる");
  check((await p.locator(".steps li.is-done").count()) === 1, "もどっても ✓ は残る");
  // 先に最後の行動を押してもクリアにならない
  await p.click(".act >> text=ページ(タブ)を閉じる");
  await p.click(".act >> text=家の人に話して");
  check((await p.locator(".result.warn", { hasText: "ちょっと待って" }).count()) === 1, "やることが残っていると、最後の行動ではクリアにならない");
  await p.click("text=💡 ヒント");
  check((await p.locator(".hint-text").count()) === 1, "ヒントが出る");

  // 中学生目線レビュー(2026-10-16)で直した所
  // SL-01: 画面が変わったら、新しい画面の上まで動く(前は1つあとの操作で動いていた)
  await go("prize");
  await p.click("text=体験をはじめる");
  await p.evaluate(() => window.scrollTo(0, 400));
  await p.locator(".act-list").getByRole("button", { name: "当選のメールを開く", exact: true }).click();
  await p.waitForTimeout(150);
  const topAfter = await p.evaluate(() => document.getElementById("scene-top").getBoundingClientRect().top);
  check(topAfter >= 0 && topAfter < 140, `画面が変わると、場面の上が見える (top ${Math.round(topAfter)})`);
  const yKeep = await p.evaluate(() => window.scrollY);
  await p.locator(".act-list").getByRole("button", { name: /このお店のプレゼントに自分で応募したか/ }).click();
  await p.waitForTimeout(150);
  check(Math.abs((await p.evaluate(() => window.scrollY)) - yKeep) < 120, "同じ画面の中の行動では、あとから勝手にスクロールしない");
  // SL-02: 行動の順番が「よい行動がいつも上」になっていない
  const firstIsGood = await p.evaluate(() => ScamData.scenarios.map((sc) => Object.keys(sc.nodes).filter((n) => ScamEngine.acts(sc, n).filter((a) => a.panel !== false).length >= 4)).flat().length);
  check(firstIsGood >= 5, "行動が4つ以上ある画面がある(順番をまぜる対象)");
  await go("support");
  await p.click("text=体験をはじめる");
  await p.click(".device >> text=つぎのページ");
  const order = await p.locator(".act-list .act").allInnerTexts();
  check(!/パソコンの中を調べられる/.test(order[0]), "にせの警告で、いちばん上がいつも「よい行動」ではない: " + order[0]);
  // SL-03: 行動しても、カウントダウンが最初にもどらない
  await p.waitForTimeout(2300);
  const before = await p.textContent(".sb-timer-v");
  await p.locator(".act-list").getByRole("button", { name: /パソコンの中を調べられるのか/ }).click();
  await p.waitForTimeout(150);
  const after = await p.textContent(".sb-timer-v");
  check(after <= before, `行動してもカウントダウンがもどらない (${before} → ${after})`);
  // SL-04: 本物の Esc キーで全画面を終わらせられる
  await p.keyboard.press("Escape");
  await p.waitForTimeout(150);
  check((await p.locator(".steps li.is-done").count()) === 2, "本物の Esc キーでも「全画面を終わらせる」に ✓ が付く");
  await p.locator(".act-list").getByRole("button", { name: "タブ(ブラウザ)を閉じる", exact: true }).click();
  check((await p.locator(".device >> text=ブラウザを閉じました").count()) === 1, "Esc のあと、タブを閉じられる");
  // SL-05: 差出人の ▼ ボタンが指で押せる大きさ
  await go("virus");
  await p.click("text=体験をはじめる");
  await p.click(".device >> text=Re: 文化祭の写真");
  const more = await p.evaluate(() => { const r = document.querySelector(".sb-more").getBoundingClientRect(); return Math.min(r.width, r.height); });
  check(more >= 44, `差出人の ▼ ボタンが 44px 以上 (${more})`);
  await p.click(".sb-more");
  check((await p.locator(".sb-addr.flagged").count()) === 1, "▼ を押すとアドレスが出る");

  // 5つの場面を、しくみの中で見つけた道すじどおりに押してクリアする
  const ids = await p.evaluate(() => ScamData.scenarios.map((s) => s.id));
  for (const id of ids) {
    await go(id);
    if (await p.locator("text=体験をはじめる").count()) await p.click("text=体験をはじめる");
    if (await p.locator("text=この場面をはじめから").count()) await p.locator("text=この場面をはじめから").first().click();
    const labels = await p.evaluate((id) => {
      const sc = ScamData.scenarios.find((s) => s.id === id);
      const path = ScamEngine.solve(sc);
      let st = ScamEngine.init(sc);
      return path.map((aid) => {
        const a = ScamEngine.acts(sc, st.node).find((x) => (x.id || x.label) === aid);
        st = ScamEngine.apply(sc, st, a);
        return a.label;
      });
    }, id);
    for (const label of labels) await p.locator(".act-list").getByRole("button", { name: label, exact: true }).click();
    check((await p.locator(".end-card.clear").count()) === 1, `${id}: やることを全部やるとクリアになる(${labels.length} 手)`);
  }
  check((await p.locator(".chapter-nav li.done").count()) === 5, "メニューの5つの場面に ✓ が付く");

  // ふりかえり → 記録の書き出し → 振り返り一覧で読める形
  await go("matome");
  await p.fill("#refl-r1", "あわてさせて、お金や情報を出させようとしていた");
  await go("records");
  await p.click("text=記録を書き出す");
  check((await p.locator("text=組と番号を入れてから").count()) === 1, "組と番号がないと書き出さない");
  await p.fill("#rec-cls", "2");
  await p.fill("#rec-num", "15");
  await p.fill("#rec-name", "テスト");
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 5000 }).catch(() => null), p.click("text=記録を書き出す")]);
  check(Boolean(dl), "記録のファイルができる");
  if (dl) {
    const json = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
    check(json.app === "ネット詐欺 追体験ラボ" && json.student.cls === "2" && json.student.num === "15" && json.student.name === "テスト", "書き出しに組・番号・名前が入る");
    check(json.scenarios.filter((s) => s.cleared).length === 5 && json.scenarios[0].misses === 1, "書き出しにクリアとだまされた回数が入る");
    const FKR = require("../../../teacher-tools/furikaeri-ichiran/parse.js");
    const r = FKR.parse(json, "x.json");
    check(r.ok && /ネット詐欺 追体験ラボ$/.test(r.entries[0].app) && r.entries[0].student.num === "15" && r.entries[0].rows.some((x) => x.type === "ふりかえり"), "振り返り一覧(先生用)で読める");
  }
  check((await p.locator("text=ネット詐欺_追体験ラボ_2_15_テスト.json").count()) === 1, "知らせにファイル名が出る");

  // 読みこみ直しても残る
  await p.reload();
  await p.waitForTimeout(200);
  check((await p.locator(".chapter-nav li.done").count()) === 6, "読みこみ直しても ✓ が残る(5場面とまとめ)");
  check(/100%/.test(await p.locator("#overall-progress").innerText()), "上のバーの進み具合が 100%");

  // ふりがな
  await go("support");
  await p.click("text=ふりがな");
  check((await p.locator("#view ruby").count()) > 5, "ふりがなをおすと、むずかしい言葉にふりがながつく");
  await p.click("text=ふりがな");

  // はじめからやり直す
  await p.evaluate(() => EduitFrame.prefs.set("fs", 20)); // 文字「大」(全教材で共通の設定)
  await go("records");
  await p.click("text=この端末の記録をすべて消す");
  check((await p.locator(".reset-confirm").count()) === 1, "消す前に画面の中で確かめる");
  await p.click("text=やめる");
  check((await p.inputValue("#rec-cls")) === "2", "「やめる」なら何も消えない");
  await p.click("text=この端末の記録をすべて消す");
  await p.click("text=消す(はじめからやり直す)");
  await p.waitForTimeout(100);
  check((await p.locator("text=記録をすべて消しました").count()) === 1, "消したことが知らされる");
  check((await p.inputValue("#rec-cls")) === "" && (await p.locator(".chapter-nav li.done").count()) === 0, "組・番号・クリアの ✓ が消える");
  await go("matome");
  check((await p.inputValue("#refl-r1")) === "", "ふりかえりが消える");
  check((await p.evaluate(() => getComputedStyle(document.documentElement).fontSize)) === "20px", "文字の大きさの設定は残る");
  await p.evaluate(() => EduitFrame.prefs.set("fs", 17));

  // スマホ幅・タブレット縦ではみ出さない
  for (const [w, hgt] of [[390, 800], [810, 1080]]) {
    await p.setViewportSize({ width: w, height: hgt });
    for (const id of ["oneclick", "virus", "support", "shop"]) {
      await go(id);
      if (await p.locator("text=体験をはじめる").count()) await p.click("text=体験をはじめる");
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      check(sw <= w, `幅 ${w} で ${id} が横にはみ出さない (${sw})`);
    }
  }

  // SL-06: たてにならぶ画面では、「いまの状況」と知らせがスマホの画面より上に出る
  await p.setViewportSize({ width: 390, height: 800 });
  await go("prize");
  if (await p.locator("text=体験をはじめる").count()) await p.click("text=体験をはじめる");
  const pos = await p.evaluate(() => ["situation", "device"].map((c) => document.querySelector("." + c).getBoundingClientRect().top));
  check(pos[0] < pos[1], "スマホ幅で「いまの状況」がスマホの画面より上");
  await p.evaluate(() => EduitFrame.prefs.set("fs", 24)); // 文字「特大」
  for (const id of ["oneclick", "support", "shop"]) {
    await go(id);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    check(sw <= 390, `文字「特大」でもスマホ幅で ${id} がはみ出さない (${sw})`);
  }
  await p.evaluate(() => EduitFrame.prefs.set("fs", 17));

  check(errors.length === 0, "エラーが出ない" + (errors.length ? ": " + errors.join(" / ") : ""));
  check(external.length === 0, "外部への通信が0件" + (external.length ? ": " + external.join(" ") : ""));

  await browser.close();
  console.log(`\n${pass} 件 OK / ${fail} 件 NG`);
  process.exit(fail ? 1 : 0);
})();
