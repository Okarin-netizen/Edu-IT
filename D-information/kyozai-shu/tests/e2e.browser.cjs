// ブラウザでの自動テスト（npm run build のあと node tests/e2e.browser.cjs）
// ダブルクリックで開いたときと同じ file:// で開き、6つの教材が動くこと・外部に通信しないことを確かめる。
const { chromium } = require("playwright");
const path = require("path");

const file = path.join(__dirname, "..", "..", "dist", "情報の技術_体験教材集.html");
const url = "file://" + file.split(path.sep).map(encodeURIComponent).join("/");
const IDS = ["digitization-lab", "virtual-cpu", "network-sim", "security-lab", "interactive-studio", "measure-control-sim"];

let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "✓" : "✗"} ${label}`);
};

(async () => {
  const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args } : { args });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("request", (r) => !/^(file|data|blob|about):/.test(r.url()) && external.push(r.url()));

  await page.goto(url);
  check((await page.locator(".mcard").count()) === 6, "メニューに教材カードが6枚ある");
  check(/羽生市立南中学校[ 　]技術[ 　]岡田/.test(await page.locator(".hero").innerText()), "トップページに作成者の表示がある");
  check(/羽生市立南中学校[ 　]技術[ 　]岡田/.test(await page.locator("footer").innerText()), "フッターに作成者の表示がある");

  // 6つの教材を順に開く
  for (const id of IDS) {
    await page.click(`.mcard[href="#/${id}"]`).catch(async () => {
      await page.goto(url + "#/");
      await page.click(`.mcard[href="#/${id}"]`);
    });
    const frame = page.frameLocator(`iframe[data-id="${id}"]`);
    await frame.locator("h1, h2").first().waitFor({ timeout: 10000 });
    const text = await frame.locator("body").innerText();
    check(text.length > 200 && /羽生市立南中学校/.test(text), `${id}: 開いて中身と作成者が表示される`);
    check(await page.locator(`iframe[data-id="${id}"]`).isVisible(), `${id}: 表示中`);
    await page.click("#home-link");
    const back = await page.locator("#menu").waitFor({ timeout: 3000 }).then(() => true, () => false);
    check(back && !(await page.locator(`iframe[data-id="${id}"]`).isVisible()), `${id}: メニューに戻れる`);
  }
  check((await page.locator("iframe").count()) === 6, "開いた教材は閉じずに残る（作業が消えない）");
  // 教材の中のリンク（#/…）を押しても、教材の中で画面が切りかわる（親のURLへ飛んで開けなくならない）
  for (const id of IDS) {
    await page.click(`.mcard[href="#/${id}"]`).catch(async () => {
      await page.goto(url + "#/");
      await page.click(`.mcard[href="#/${id}"]`);
    });
    const el = page.locator(`iframe[data-id="${id}"]`);
    const hrefs = await (await (await el.elementHandle()).contentFrame()).$$eval('a[href^="#/"]', (as) => [...new Set(as.map((a) => a.getAttribute("href")))].filter((h) => h !== "#/"));
    let ok = hrefs.length > 0;
    for (const h of hrefs.slice(0, 3)) {
      const fr = await (await el.elementHandle()).contentFrame();
      const a = fr.locator(`a[href="${h}"]:visible`).first();
      if (!(await a.count())) continue;
      await a.click();
      await page.waitForTimeout(200);
      const now = await (await el.elementHandle()).contentFrame();
      ok = ok && now.url().startsWith("about:srcdoc") && (await now.evaluate(() => location.hash)) === h;
    }
    check(ok, `${id}: 教材の中のリンクで画面が切りかわる`);
  }
  // 教材の中の画面を最初にもどす（あとの確認のため）
  await page.goto(url + "#/");
  // SEC-23 で教材の中の場所を覚えるようになったので、それも消してから読みこみ直す
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();

  // 記録の保存（localStorage）が教材の中で使える
  const stored = await page.evaluate(() => Object.keys(localStorage).join(","));
  check(/seclab|digilab|netsim|vcpu|mcsim|istudio/.test(stored) || stored === "", `localStorage を使える（${stored || "まだ空"}）`);

  // 重なる単元の案内: セキュリティラボ → デジタル化ラボ
  await page.goto(url + "#/security-lab");
  const sec = page.frameLocator('iframe[data-id="security-lab"]');
  await sec.locator("h1").first().waitFor();
  await page.locator('iframe[data-id="security-lab"]').evaluate((f) => (f.contentWindow.location.hash = "#/digital"));
  await sec.locator(".kyozai-link").waitFor({ timeout: 5000 });
  check(/デジタル化ラボ/.test(await sec.locator(".kyozai-link").innerText()), "セキュリティラボ「デジタル化と情報量」にデジタル化ラボへの案内が出る");
  // SEC-15: 案内はモジュールのさいご（「次へ」の行の前）に、白いボタンで。もどり方も書いてある
  const linkPos = await sec.locator(".kyozai-link").evaluate((b) => ({
    beforeNav: Boolean(b.nextElementSibling && b.nextElementSibling.classList.contains("btn-row")),
    afterSteps: !b.nextElementSibling.nextElementSibling && Boolean(b.previousElementSibling && b.previousElementSibling.querySelector(".reflection")),
    secondary: b.querySelector("button").classList.contains("secondary"),
  }));
  check(linkPos.beforeNav && linkPos.afterSteps && linkPos.secondary, `SEC-15: 案内はふりかえりのあと・「次へ」の前に、控えめなボタンで出る ${JSON.stringify(linkPos)}`);
  check(/「← 情報セキュリティ体験ラボにもどる」を押すと、このページにもどれます/.test(await sec.locator(".kyozai-link").innerText()) && !/体験版/.test(await sec.locator(".kyozai-link").innerText()), "SEC-15: 案内にもどり方が書いてある（「体験版」ということばは使わない）");
  await sec.locator(".kyozai-link button").click();
  await page.waitForFunction(() => location.hash === "#/digitization-lab");
  check(await page.locator('iframe[data-id="digitization-lab"]').isVisible(), "案内のボタンでデジタル化ラボが開く");

  // セキュリティラボ → ネットワーク通信シミュレータの「のぞき見と暗号化」
  await page.goto(url + "#/security-lab");
  await sec.locator("h1").first().waitFor();
  await page.locator('iframe[data-id="security-lab"]').evaluate((f) => (f.contentWindow.location.hash = "#/network"));
  await sec.locator(".kyozai-link").waitFor({ timeout: 5000 });
  await sec.locator(".kyozai-link button").click();
  await page.waitForFunction(() => location.hash === "#/network-sim");
  const net = page.frameLocator('iframe[data-id="network-sim"]');
  await net.locator("h1").first().waitFor();
  await page.waitForTimeout(500);
  const netHash = await page.locator('iframe[data-id="network-sim"]').evaluate((f) => f.contentWindow.location.hash);
  check(netHash === "#/spy", `ネットワーク通信シミュレータが「のぞき見と暗号化」で開く（${netHash}）`);
  check(/のぞき見/.test(await net.locator("h1").first().innerText()), "のぞき見の画面が表示されている");
  // NW-18: 案内から来たときは、上と下に「← 情報セキュリティ体験ラボにもどる」が出る
  const backInfo = await page.locator('iframe[data-id="network-sim"]').evaluate((f) => {
    const v = f.contentDocument.getElementById("view");
    const t = v.querySelector(".kyozai-back-top"), b = v.querySelector(".kyozai-back-bottom");
    return { top: Boolean(t) && v.firstElementChild === t && t.innerText.trim(), bottom: Boolean(b) && v.lastElementChild === b && b.innerText.trim() };
  });
  check(backInfo.top === "← 情報セキュリティ体験ラボにもどる" && backInfo.bottom === "← 情報セキュリティ体験ラボにもどる", `NW-18: 移った先の上と下に「もどる」が出る ${JSON.stringify(backInfo)}`);
  await net.locator(".kyozai-back-bottom button").click();
  await page.waitForFunction(() => location.hash === "#/security-lab", null, { timeout: 5000 }).catch(() => {});
  const backHash = await page.locator('iframe[data-id="security-lab"]').evaluate((f) => f.contentWindow.location.hash);
  check((await page.evaluate(() => location.hash)) === "#/security-lab" && backHash === "#/network", `NW-18: 「もどる」で情報セキュリティ体験ラボの同じ単元にもどる（${backHash}）`);
  check((await net.locator(".kyozai-back").count()) === 0, "NW-18: もどったあとは「もどる」が消える");
  // メニューから開いたときは出ない
  await sec.locator(".kyozai-link button").click();
  await page.waitForFunction(() => location.hash === "#/network-sim");
  await net.locator(".kyozai-back-top").waitFor({ timeout: 5000 }).catch(() => {});
  await page.goto(url + "#/");
  await page.click('.mcard[href="#/network-sim"]');
  await page.waitForTimeout(300);
  check((await net.locator(".kyozai-back").count()) === 0, "NW-18: メニューから開き直したときは「もどる」は出ない");

  // 案内は教材集の中だけ。セキュリティラボのほかの単元には出ない
  await page.locator('iframe[data-id="security-lab"]').evaluate((f) => (f.contentWindow.location.hash = "#/password"));
  await page.goto(url + "#/security-lab");
  await sec.locator("h1").first().waitFor();
  await page.locator('iframe[data-id="security-lab"]').evaluate((f) => (f.contentWindow.location.hash = "#/password"));
  await page.waitForTimeout(400);
  check((await sec.locator(".kyozai-link").count()) === 0, "関係のない単元には案内が出ない");

  // SEC-23: 再読みこみしても、教材の中のさいごのページにもどる
  await page.goto(url + "#/security-lab");
  await sec.locator("h1").first().waitFor();
  await page.locator('iframe[data-id="security-lab"]').evaluate((f) => (f.contentWindow.location.hash = "#/crypto"));
  await page.waitForTimeout(200);
  await page.reload();
  await sec.locator("h1").first().waitFor();
  await page.waitForFunction(() => document.querySelector('iframe[data-id="security-lab"]')?.contentWindow.location.hash === "#/crypto", null, { timeout: 5000 }).catch(() => {});
  const reHash = await page.locator('iframe[data-id="security-lab"]').evaluate((f) => f.contentWindow.location.hash);
  check(reHash === "#/crypto" && /暗号/.test(await sec.locator("h1").first().innerText()), `SEC-23: 再読みこみのあと、さいごに開いていたページ（#/crypto）にもどる（${reHash}）`);
  check(await page.evaluate(() => JSON.parse(sessionStorage.getItem("kyozai.place.v1") || "{}").inner?.["security-lab"] === "#/crypto"), "SEC-23: 場所は sessionStorage（kyozai.place.v1）に覚える");
  await page.goto(url + "#/security-lab/teacher");
  await page.waitForTimeout(400);
  check((await page.locator('iframe[data-id="security-lab"]').evaluate((f) => f.contentWindow.location.hash)) === "#/teacher" && (await page.evaluate(() => location.hash)) === "#/security-lab", "#/security-lab/teacher で教材の中の場所を指定して開ける");

  // KS-08: どの教材も「はじめに」に「つぎはこれ」（または教材の「はじめよう」ボタン）、さいごの案内は「ふりかえり・記録」
  const nextText = async (id, hash) => {
    await page.goto(url + "#/" + id);
    const fl = page.locator(`iframe[data-id="${id}"]`);
    await page.frameLocator(`iframe[data-id="${id}"]`).locator("h1, h2").first().waitFor();
    await fl.evaluate((f, h) => (f.contentWindow.location.hash = h), hash);
    await page.waitForTimeout(300);
    return fl.evaluate((f) => (f.contentDocument.querySelector("#view .kyozai-next") || {}).innerText || "");
  };
  check(/1 ネットワークを組み立てる/.test(await nextText("network-sim", "#/")), "KS-08: ネットワーク通信シミュレータの「はじめに」に「つぎはこれ」が出る");
  check(/デジタル化と情報量/.test(await nextText("security-lab", "#/")), "KS-08: 情報セキュリティ体験ラボの「はじめに」に「つぎはこれ」が出る");
  check(/ふりかえり・記録 →/.test(await nextText("security-lab", "#/check")), "KS-08: 理解度チェックのつぎは「ふりかえり・記録」");
  check(/つぎの教材「/.test(await nextText("security-lab", "#/records")), "KS-08: つぎの教材の案内は「ふりかえり・記録」のページに出る");
  const dlHome = await nextText("digitization-lab", "#/");
  check(/画像のデジタル化/.test(dlHome) || (await page.frameLocator('iframe[data-id="digitization-lab"]').locator('#view a.btn[href="#/image"]').count()) > 0, "KS-08: デジタル化ラボの「はじめに」から1つめの単元へ進める");

  // 教材の中から記録をファイルに書き出せる
  await page.goto(url + "#/network-sim");
  await page.locator('iframe[data-id="network-sim"]').evaluate((f) => (f.contentWindow.location.hash = "#/records"));
  // 書き出す前に組と番号を入れる（どの教材も、空のままでは書き出さない）
  for (const [k, v] of [["cls", "1"], ["num", "2"]]) if (await net.locator(`#stu-${k}`).count()) await net.locator(`#stu-${k}`).fill(v);
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }).catch(() => null), net.getByRole("button", { name: /JSON/ }).first().click()]);
  check(Boolean(dl), `教材の中から記録を書き出せる（${dl ? dl.suggestedFilename() : "なし"}）`);

  // スタジオの「HTMLで書き出す」も教材集の中で動く
  await page.goto(url + "#/interactive-studio");
  const st = page.frameLocator('iframe[data-id="interactive-studio"]');
  await st.locator("h1, h2").first().waitFor();
  const exportBtn = st.getByText("HTMLで書き出す").first();
  if (await exportBtn.count()) {
    const [dl2] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }).catch(() => null), exportBtn.click()]);
    check(Boolean(dl2), `スタジオの作品をHTMLで書き出せる（${dl2 ? dl2.suggestedFilename() : "なし"}）`);
  } else check(false, "スタジオの「HTMLで書き出す」ボタンが見つからない");

  // デジタル化ラボの録音（マイク）が教材集の中でも使える
  await page.goto(url + "#/digitization-lab");
  await page.frameLocator('iframe[data-id="digitization-lab"]').locator("h1").first().waitFor();
  const mic = await page.locator('iframe[data-id="digitization-lab"]').evaluate(async (f) => {
    try {
      const s = await f.contentWindow.navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      return "ok";
    } catch (e) {
      return e.name;
    }
  });
  check(mic === "ok", `教材の中でマイクを使える（${mic}）`);

  // 「つぎはこれ」: メニューの案内と、教材の中の案内
  await page.goto(url + "#/");
  check(/つぎはこれ|はじめての人は/.test(await page.locator(".next-panel").innerText()), "メニューに「つぎはこれ」の案内がある");
  check((await page.locator(".route li.seen").count()) >= 1, "開いたことのある教材に印がつく");
  await page.goto(url + "#/measure-control-sim");
  const mc = page.frameLocator('iframe[data-id="measure-control-sim"]');
  await mc.locator("h1, h2").first().waitFor();
  await page.locator('iframe[data-id="measure-control-sim"]').evaluate((f) => (f.contentWindow.location.hash = "#/s/streetlight"));
  await mc.locator(".kyozai-next a").click({ timeout: 5000 });
  await page.waitForTimeout(400);
  const mcHash = await page.locator('iframe[data-id="measure-control-sim"]').evaluate((f) => f.contentWindow.location.hash);
  check(mcHash === "#/s/door", `教材の中の「つぎはこれ」で次の場面へ進める（${mcHash}）`);
  await page.goto(url + "#/digitization-lab");
  const dg = page.frameLocator('iframe[data-id="digitization-lab"]');
  await dg.locator("h1, h2").first().waitFor();
  await page.locator('iframe[data-id="digitization-lab"]').evaluate((f) => (f.contentWindow.location.hash = "#/records"));
  await dg.locator(".kyozai-next button").click({ timeout: 5000 });
  await page.waitForFunction(() => location.hash === "#/virtual-cpu", null, { timeout: 5000 }).catch(() => {});
  check((await page.evaluate(() => location.hash)) === "#/virtual-cpu", "教材のさいごで、次の教材を開ける");

  // ---- KS-01: 上のバーの「ふりがな」「大きな文字」が6つの教材にかかる ----
  await page.goto(url + "#/");
  // KS-09: 生徒向けのカードには学習指導要領の記号を出さず、「先生へ」に対応をまとめる
  check(!/D\(\d\)/.test(await page.locator(".grid").first().innerText()) && (await page.locator(".group .curr").count()) === 0, "KS-09: 教材のカードとグループ名に D(1) などの記号が出ない");
  const curr = await page.locator(".note .curriculum").evaluate((e) => { const c = e.cloneNode(true); c.querySelectorAll("rt").forEach((r) => r.remove()); return c.textContent; });
  check(/デジタル化ラボD\(1\)、仮想CPUラボD\(1\)、ネットワーク通信シミュレータD\(1\)\(2\)、情報セキュリティ体験ラボD\(1\)\(4\)、双方向コンテンツ制作スタジオD\(2\)、計測・制御シミュレータD\(3\)/.test(curr.replace(/\s+/g, "")), "KS-09: 「先生へ」に学習指導要領との対応がある");
  check((await page.locator("#tg-ruby").count()) === 1 && (await page.locator("#tg-large").count()) === 1, "上のバーに「ふりがな」「大きな文字」のボタンがある");
  await page.click("#tg-ruby");
  await page.click("#tg-large");
  check((await page.locator("#menu ruby.kz-ruby").count()) > 10, "メニューにふりがなが付く");
  const SKIPSEL = "textarea, input, select, code, pre, svg, [contenteditable], .editor, .listing, .editor-grid, .workspace, .stage-frame, .code-wrap, .code-view, .blk-editor";
  for (const id of IDS) {
    await page.goto(url + "#/" + id);
    const fl = page.locator(`iframe[data-id="${id}"]`);
    await page.frameLocator(`iframe[data-id="${id}"]`).locator("h1, h2").first().waitFor();
    await page.waitForTimeout(400);
    const r = await fl.evaluate((f, sel) => {
      const d = f.contentDocument;
      return {
        own: d.querySelectorAll("ruby:not(.kz-ruby)").length,
        kz: d.querySelectorAll("ruby.kz-ruby").length,
        nested: d.querySelectorAll("ruby ruby").length,
        bad: [...d.querySelectorAll("ruby")].filter((r) => r.parentElement.closest(sel)).length,
        large: d.documentElement.classList.contains("large-text") && parseFloat(f.contentWindow.getComputedStyle(d.documentElement).fontSize) >= 18,
        shown: [...d.querySelectorAll("header button")].filter((b) => {
          const c = b.cloneNode(true);
          c.querySelectorAll("rt, rp").forEach((x) => x.remove());
          return b.offsetParent && /^(大きな文字|ふりがな)$/.test(c.textContent.trim());
        }).length,
      };
    }, SKIPSEL);
    const rubyOk = id === "security-lab" ? r.own > 0 && r.kz === 0 : r.kz > 0;
    check(rubyOk && r.nested === 0 && r.bad === 0, `${id}: ふりがなが付く（二重にならない・入力欄やプログラムには付かない）${JSON.stringify(r)}`);
    check(r.large && r.shown === 0, `${id}: 大きな文字になり、教材の同じボタンは上のバーにまとまる`);
  }
  await page.goto(url + "#/digitization-lab");
  await page.click("#tg-ruby");
  await page.waitForTimeout(300);
  const off = await page.evaluate(() => [...document.querySelectorAll("iframe")].map((f) => f.contentDocument.querySelectorAll("ruby").length).reduce((a, b) => a + b, 0));
  check(off === 0, `「ふりがな」をもう一度押すと、6つの教材のふりがなが外れる（残り ${off}）`);
  await page.click("#tg-ruby");
  check(await page.evaluate(() => JSON.parse(localStorage.getItem("kyozai.prefs.v1") || "{}").ruby === true), "ふりがなの設定が保存される（kyozai.prefs.v1）");

  // ---- KS-03 / KS-04: 細い上のバーと、名前の見える教材の切りかえ ----
  check((await page.locator(".shell-header").evaluate((e) => e.getBoundingClientRect().height)) <= 41, "教材集の上のバーは 40px 以下");
  await page.setViewportSize({ width: 1366, height: 650 });
  check((await page.locator(".switcher a .short:visible").count()) === 6, "ノートPCの幅では、切りかえのアイコンに名前が出る");
  await page.setViewportSize({ width: 810, height: 1080 });
  await page.click("#switch-btn");
  const names = await page.locator(".switcher a:visible").allInnerTexts();
  check(names.length === 6 && names.every((t, i) => t.includes(["デジタル化ラボ", "仮想CPUラボ", "ネットワーク通信シミュレータ", "情報セキュリティ体験ラボ", "双方向コンテンツ制作スタジオ", "計測・制御シミュレータ"][i])), "タブレット縦では「教材をかえる」で教材の名前の一覧が出る");
  await page.locator(".switcher a", { hasText: "ネットワーク通信シミュレータ" }).click();
  await page.waitForFunction(() => location.hash === "#/network-sim");
  check(!(await page.locator(".switcher a").first().isVisible()), "一覧から選ぶと教材が開き、一覧は閉じる");
  // ---- KS-02: タブレット縦でも、左のメニューのいまのページと「ふりかえり・記録」が見える ----
  await page.goto(url + "#/security-lab");
  await page.locator('iframe[data-id="security-lab"]').evaluate((f) => (f.contentWindow.location.hash = "#/copyright"));
  await page.waitForTimeout(400);
  const navInfo = await page.locator('iframe[data-id="security-lab"]').evaluate((f) => {
    const d = f.contentDocument;
    const vis = (el) => el && el.getBoundingClientRect().right <= f.contentWindow.innerWidth && el.getBoundingClientRect().left >= 0;
    return { cur: vis(d.querySelector('.chapter-nav [aria-current="page"]')), rec: vis(d.querySelector('.chapter-nav a[href="#/records"]')), ow: d.documentElement.scrollWidth - f.contentWindow.innerWidth };
  });
  check(navInfo.cur && navInfo.rec && navInfo.ow <= 0, `タブレット縦で、左のメニューのいまのページと「ふりかえり・記録」が画面の中にある ${JSON.stringify(navInfo)}`);
  await page.setViewportSize({ width: 1280, height: 720 });

  // ---- KS-05: 記録をまとめて書き出す ----
  await page.goto(url + "#/");
  // ふりがなが付いていても、読みをのぞいた文で確かめる
  const plain = (sel) => page.locator(sel).evaluate((e) => {
    const c = e.cloneNode(true);
    c.querySelectorAll("rt, rp").forEach((x) => x.remove());
    return c.textContent;
  });
  check(/先生に出すのは JSON のファイルです/.test(await plain(".note.export")), "まとめて書き出す欄に「先生に出すのは JSON のファイルです」とある");
  await page.fill("#ex-cls", "");
  await page.fill("#ex-num", "");
  const noDl = await Promise.all([page.waitForEvent("download", { timeout: 1500 }).catch(() => null), page.click("#export-json")]);
  check(!noDl[0] && /組と番号を入れてから書き出そう/.test(await plain("#export-msg")), "組・番号が空のときは書き出さず「組と番号を入れてから書き出そう」と出る");
  await page.fill("#ex-cls", "3");
  await page.fill("#ex-num", "７");
  await page.fill("#ex-name", "テスト");
  const [dj] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }).catch(() => null), page.click("#export-json")]);
  let json = null;
  try {
    json = JSON.parse(require("fs").readFileSync(await dj.path(), "utf8"));
  } catch {}
  // （file:// の自動テストのブラウザでは保存名が「download」になるので、ファイル名は a 要素の download と知らせの文で確かめる）
  const doneMsg = await plain("#export-msg");
  const fname = (doneMsg.match(/ファイル名: ([^）]+)）/) || [])[1] || "";
  check(Boolean(dj) && /^情報の技術_記録まとめ_3組7番_\d{4}-\d{2}-\d{2}\.json$/.test(fname), `まとめのファイル名に組・番号・日付が入る（${fname}）`);
  check(json && json.materials.length === 6 && json.student.num === "7" && json.materials.find((m) => m.id === "virtual-cpu").raw["vcpu.v1"], "1つの JSON に6つの教材の記録が入る");
  check(/ファイルを保存しました（ファイル名: .+）。先生に言われた場所に出そう。/.test(doneMsg), "書き出したあとにファイル名と出し方が出る");
  const [dc] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }).catch(() => null), page.click("#export-csv")]);
  const csvText = dc ? require("fs").readFileSync(await dc.path(), "utf8") : "";
  check(/\.csv）/.test(await plain("#export-msg")) && /^\ufeff"組","番号","名前","教材"/.test(csvText), "CSV（表計算ソフト用）も書き出せる");
  check(await page.evaluate(() => JSON.parse(localStorage.getItem("kyozai.student.v1") || "{}").cls === "3"), "組・番号・名前は1回入れれば残る（kyozai.student.v1）");

  // はじめからやり直す（全リセット）: 開いたままの教材が閉じるときに書き戻しても、記録が残らない
  await page.goto(url + "#/virtual-cpu");
  const vf = page.locator('iframe[data-id="virtual-cpu"]');
  const vc = page.frameLocator('iframe[data-id="virtual-cpu"]');
  await vc.locator("h1, h2").first().waitFor();
  await vf.evaluate((f) => (f.contentWindow.location.hash = "#/records"));
  await vc.locator("#stu-name").fill("リセット確認");
  await vc.locator("#stu-name").dispatchEvent("change");
  await vf.evaluate((f) => (f.contentWindow.location.hash = "#/task/show"));
  await vc.locator(".task-card").waitFor({ timeout: 5000 }).catch(() => {});
  await page.goto(url + "#/");
  const before = await page.evaluate(() => localStorage.getItem("vcpu.v1") || "");
  page.once("dialog", (d) => d.accept());
  await page.click("#reset-all");
  const left = await page.evaluate(() => ["digilab.v1", "vcpu.v1", "netsim.v1", "seclab.v1", "istudio.works.v1", "istudio.student.v1", "istudio.server.v1", "mcsim.v1", "kyozai.seen.v1", "kyozai.student.v1"].filter((k) => localStorage.getItem(k) !== null));
  check(before.includes("リセット確認") && left.length === 0, `全リセットで6つの教材とメニューの記録が消える${left.length ? "（残り: " + left.join(", ") + "）" : ""}`);
  check((await page.locator(".route li.seen").count()) === 0 && (await page.locator("iframe").count()) === 0, "全リセットで「開いたことがある」の印と開いていた教材が消える");
  check(/消しました/.test(await page.locator("#reset-msg").innerText()), "全リセットのあとに知らせが出る");
  check(await page.evaluate(() => JSON.parse(localStorage.getItem("kyozai.prefs.v1") || "{}").ruby === true), "全リセットでも、ふりがな・大きな文字の設定は残る");
  check((await page.locator("#ex-cls").inputValue()) === "", "全リセットで、まとめて書き出す欄の組・番号・名前も消える");
  await page.goto(url + "#/virtual-cpu");
  await vc.locator("h1, h2").first().waitFor();
  await vf.evaluate((f) => (f.contentWindow.location.hash = "#/records"));
  check((await vc.locator("#stu-name").inputValue()) === "", "全リセットのあと、教材を開き直しても名前が残っていない");

  // スマホ幅で横スクロールが出ない
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(url + "#/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `スマホ幅でメニューがはみ出さない（${overflow}px）`);

  check(external.length === 0, `外部への通信なし${external.length ? "：" + external.join(", ") : ""}`);
  const realErrors = errors.filter((e) => !/favicon/.test(e));
  check(realErrors.length === 0, `エラーなし${realErrors.length ? "：" + realErrors.slice(0, 5).join(" / ") : ""}`);

  await browser.close();
  console.log(`\n${pass} 件成功、${fail} 件失敗`);
  process.exit(fail ? 1 : 0);
})();
