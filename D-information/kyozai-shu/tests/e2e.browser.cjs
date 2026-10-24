// ブラウザでの自動テスト（npm run build のあと node tests/e2e.browser.cjs）
// ダブルクリックで開いたときと同じ file:// で開き、11の教材が動くこと・基本編と発展編に分かれていること・外部に通信しないことを確かめる。
const { chromium } = require("playwright");
const path = require("path");

const file = path.join(__dirname, "..", "..", "dist", "情報の技術_体験教材集.html");
const url = "file://" + file.split(path.sep).map(encodeURIComponent).join("/");
const IDS = ["virtual-cpu", "digitization-lab", "network-sim", "security-lab", "scam-lab", "interactive-studio", "measure-control-sim", "mars-rover", "genai-lab", "hash-lab", "mondai-note"];
const NAMES = ["仮想CPUラボ", "デジタル化ラボ", "ネットワーク通信シミュレータ", "情報セキュリティ体験ラボ", "ネット詐欺 追体験ラボ", "双方向コンテンツ制作スタジオ", "計測・制御シミュレータ", "火星探査ロボット・シミュレータ", "生成AIのしくみラボ", "ハッシュ化体験ラボ", "問題解決ノート"];

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

  // メニューのカードを押して教材を開く（基本編にないときは発展編のタブにかえる）
  const openCard = async (id) => {
    await page.goto(url + "#/");
    const sel = `.ef-mcard-go[href="#/${id}"]`;
    for (const tab of ["basic", "advanced"]) if (!(await page.locator(sel).count())) await page.click(`.ef-level-tab.ef-level-${tab}`);
    await page.click(sel);
  };

  await page.goto(url);
  check((await page.locator(".ef-level-tab").count()) === 2 && (await page.locator('.ef-level-basic[aria-selected="true"]').count()) === 1, "メニューに「基本編」「発展編」のタブがあり、はじめは基本編");
  check((await page.locator(".ef-mcard").count()) === 10 && (await page.locator('.ef-mcard-go[href="#/hash-lab"]').count()) === 0, "基本編に教材カードが10枚ある（ハッシュ化体験ラボは発展編だけ）");
  check((await page.locator(".ef-mcard .ef-level-parts").count()) === 10 && /使うところ/.test(await page.locator(".ef-mcard .ef-level-parts").first().innerText()), "カードに「使うところ」（その編で使うページ）が出る");
  await page.click(".ef-level-tab.ef-level-advanced");
  check((await page.locator(".ef-mcard").count()) === 7 && (await page.locator('.ef-mcard-go[href="#/hash-lab"]').count()) === 1 && (await page.locator('.ef-mcard-go[href="#/scam-lab"]').count()) === 0, "発展編に教材カードが7枚ある");
  await page.reload();
  check((await page.locator('.ef-level-advanced[aria-selected="true"]').count()) === 1, "選んだ編は読みこみ直しても残る");
  await page.click(".ef-level-tab.ef-level-basic");
  check(/技術[ 　]岡田/.test(await page.locator(".shell-footer").innerText()), "トップページに作成者の表示がある（下のフッター）");
  check(/技術[ 　]岡田/.test(await page.locator("footer").innerText()), "フッターに作成者の表示がある");
  // 記号（D1〜D11）: 上のバーの名前・カード・おすすめの順番
  check((await page.locator("#bar-title").innerText()).replace(/\s+/g, " ").trim() === "D 情報の技術 教材集", "メニューの上のバーの左に「D 情報の技術 教材集」");
  check((await page.locator(".ef-mcard .ef-code").allInnerTexts()).join(",") === "D1,D2,D3,D4,D5,D6,D7,D8,D11,D9", "基本編のカードは教科書の章ごとに番号順（D11 は2章・3章の区切りで D8 のあと）");
  check(/おすすめの順番\s*D1 → D2 → D3 → D4 → D5 → D6 → D7 → D8 → D9 → D11/.test(await page.locator(".ef-level-order").innerText()), "基本編の上に「おすすめの順番: D1 → … → D9 → D11」の1行");
  check(!/おすすめ \d+番|はじめての人は/.test(await page.locator("#menu").innerText()), "「おすすめ N番」「はじめての人は、ここから」は出ない");
  const order = await page.evaluate(() => [...document.querySelectorAll("#menu > *")].map((e) => (e.classList.contains("levels") ? "levels" : e.querySelector("h2")?.id || e.className)));
  check(order.join(",") === "hero,levels,g-export,g-teacher" && (await page.locator(".records #g-reset").count()) === 1, `メニューの下の順は 基本編・発展編 → 記録 → 先生用（${order.join(",")}）`);
  await page.click("#go-teacher");
  await page.waitForTimeout(200);
  check(await page.evaluate(() => { const r = document.getElementById("teacher").getBoundingClientRect(); return r.top >= 0 && r.top < 200; }), "上のバーの「先生用」で先生用のところへ移る");
  await page.evaluate(() => window.scrollTo(0, 0));

  // 11の教材を順に開く
  for (const id of IDS) {
    await openCard(id);
    const frame = page.frameLocator(`iframe[data-id="${id}"]`);
    await frame.locator("h1, h2").first().waitFor({ timeout: 10000 });
    const text = await frame.locator("body").innerText();
    check(text.length > 200 && /技術[ 　]岡田/.test(text), `${id}: 開いて中身と作成者が表示される`);
    check(await page.locator(`iframe[data-id="${id}"]`).isVisible(), `${id}: 表示中`);
    // 名前は上のバーの切りかえ（開いている教材は「D1 CPU」）に出る。はばが広いとき（1441px 以上）は「D1 仮想CPUラボ」も出る
    const bar = await page.locator("#bar-title").getAttribute("title");
    const cur = (await page.locator('.switcher a[aria-current="page"]').innerText()).replace(/\s+/g, " ").trim();
    check(bar === `D${IDS.indexOf(id) + 1} ${NAMES[IDS.indexOf(id)]}` && cur.startsWith(`D${IDS.indexOf(id) + 1} `) && (await page.locator("#back-link").isVisible()), `${id}: 上のバーに「◀ メニュー」と「${cur}」（${bar}）`);
    await page.click("#back-link");
    const back = await page.locator("#menu").waitFor({ timeout: 3000 }).then(() => true, () => false);
    check(back && !(await page.locator(`iframe[data-id="${id}"]`).isVisible()), `${id}: メニューに戻れる`);
  }
  check((await page.locator("iframe").count()) === 11, "開いた教材は閉じずに残る（作業が消えない）");
  // 教材の中のリンク（#/…）を押しても、教材の中で画面が切りかわる（親のURLへ飛んで開けなくならない）
  // （生成AI・ネット詐欺・ハッシュ化のラボは #guess のように「/」なしで切りかえる）
  for (const id of IDS) {
    await openCard(id);
    const el = page.locator(`iframe[data-id="${id}"]`);
    await page.frameLocator(`iframe[data-id="${id}"]`).locator("h1, h2").first().waitFor();
    const hrefs = await (await (await el.elementHandle()).contentFrame()).$$eval('a[href^="#"]', (as) => [...new Set(as.map((a) => a.getAttribute("href")))].filter((h) => h !== "#/" && (h.startsWith("#/") || (/^#[a-z][\w-]*$/.test(h) && !document.getElementById(h.slice(1))))));
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

  // 重なる単元の案内(bridges): 2026-10-23 にセキュリティラボの重なる単元(デジタル化・通信の模擬)を倉庫に移したので、今は案内がない
  await page.goto(url + "#/security-lab");
  const sec = page.frameLocator('iframe[data-id="security-lab"]');
  await sec.locator("h1").first().waitFor();
  await page.locator('iframe[data-id="security-lab"]').evaluate((f) => (f.contentWindow.location.hash = "#/password"));
  await page.waitForTimeout(400);
  check((await sec.locator(".kyozai-link").count()) === 0, "案内のない単元には案内が出ない");

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
  check(/① ネットワークを組み立てる/.test(await nextText("network-sim", "#/")), "KS-08: ネットワーク通信シミュレータの「はじめに」に「つぎはこれ」が出る");
  check(/情報を守るしくみ/.test(await nextText("security-lab", "#/")), "KS-08: 情報セキュリティ体験ラボの「はじめに」に「つぎはこれ」が出る");
  check(/ふりかえり・記録 →/.test(await nextText("security-lab", "#/check")), "KS-08: 理解度チェックのつぎは「ふりかえり・記録」");
  check(/つぎの教材「/.test(await nextText("security-lab", "#/records")), "KS-08: つぎの教材の案内は「ふりかえり・記録」のページに出る");
  const dlHome = await nextText("digitization-lab", "#/");
  check(/画像のデジタル化/.test(dlHome) || (await page.frameLocator('iframe[data-id="digitization-lab"]').locator('#view a.btn[href="#/image"]').count()) > 0, "KS-08: デジタル化ラボの「はじめに」から1つめの単元へ進める");

  // 教材の中から記録をファイルに書き出せる
  await page.goto(url + "#/network-sim");
  const net = page.frameLocator('iframe[data-id="network-sim"]');
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
  check((await page.locator(".next-panel").count()) === 0, "「はじめての人は、ここから」の箱はない（おすすめの順番は基本編の上の1行）");
  check((await page.locator(".ef-mcard.seen .seen-mark").count()) >= 1, "開いたことのある教材のカードに印がつく");
  check((await page.locator(".hero .resume-go").count()) === 1, "メニューに「前回のつづき」が出る");
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
  await page.waitForFunction(() => location.hash === "#/network-sim", null, { timeout: 5000 }).catch(() => {});
  check((await page.evaluate(() => location.hash)) === "#/network-sim", "教材のさいごで、次の教材を開ける（D2 のつぎは D3）");

  // ---- KS-01: 上のバーの「ふりがな」「文字」が11の教材にかかる（全教材で共通の EduitFrame.prefs） ----
  await page.goto(url + "#/");
  // KS-09: 生徒向けのカードには学習指導要領の記号を出さず、「先生用」に対応をまとめる
  check(!/D\(\d\)/.test(await page.locator(".ef-mgrid").first().innerText()) && (await page.locator(".group .curr").count()) === 0, "KS-09: 教材のカードとグループ名に D(1) などの記号が出ない");
  const curr = await page.locator(".note .curriculum").evaluate((e) => { const c = e.cloneNode(true); c.querySelectorAll("rt").forEach((r) => r.remove()); return c.textContent; });
  check(/D1仮想CPUラボD\(1\)、D2デジタル化ラボD\(1\)、D3ネットワーク通信シミュレータD\(1\)\(2\)、D4情報セキュリティ体験ラボD\(1\)\(4\)、D5ネット詐欺追体験ラボD\(1\)\(4\)、D6双方向コンテンツ制作スタジオD\(2\)、D7計測・制御シミュレータD\(3\)、D8火星探査ロボット・シミュレータD\(3\)、D9生成AIのしくみラボD\(1\)\(4\)、D10ハッシュ化体験ラボD\(1\)\(4\)、D11問題解決ノートD\(2\)\(3\)\(4\)/.test(curr.replace(/\s+/g, "")), "KS-09: 「先生用」に学習指導要領との対応がある");
  check((await page.locator("#tg-ruby[data-ef-pref=ruby]").count()) === 1 && (await page.locator("#tg-large[data-ef-pref=fs]").count()) === 1, "上のバーに「ふりがな」「文字」のボタンがある");
  await page.click("#tg-ruby");
  await page.click("#tg-large"); // 文字 中 → 大
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
        large: d.documentElement.hasAttribute("data-ef-prefs") && parseFloat(f.contentWindow.getComputedStyle(d.documentElement).fontSize) === 20,
        shown: [...d.querySelectorAll("header [data-ef-pref]")].filter((b) => b.offsetParent).length,
      };
    }, SKIPSEL);
    const rubyOk = ["security-lab", "scam-lab", "genai-lab", "hash-lab"].includes(id) ? r.own > 0 && r.kz === 0 : r.kz > 0;
    check(rubyOk && r.nested === 0 && r.bad === 0, `${id}: ふりがなが付く（二重にならない・入力欄やプログラムには付かない）${JSON.stringify(r)}`);
    check(r.large && r.shown === 0, `${id}: 文字が「大」(20px)になり、教材の同じボタンは上のバーにまとまる`);
  }
  await page.goto(url + "#/digitization-lab");
  await page.click("#tg-ruby");
  await page.waitForTimeout(300);
  const off = await page.evaluate(() => [...document.querySelectorAll("iframe")].map((f) => f.contentDocument.querySelectorAll("ruby").length).reduce((a, b) => a + b, 0));
  check(off === 0, `「ふりがな」をもう一度押すと、11の教材のふりがなが外れる（残り ${off}）`);
  await page.click("#tg-ruby");
  check(await page.evaluate(() => JSON.parse(localStorage.getItem("eduit.prefs") || "{}").ruby === true), "ふりがなの設定が保存される（全教材で共通の eduit.prefs）");

  // ---- 上のバー: 4分野共通のアプリの上のバー（.ef-appbar。C エネルギー変換と同じ形）と D1〜D11 の切りかえ ----
  check((await page.locator(".shell-header").evaluate((e) => e.getBoundingClientRect().height)) <= 56, "教材を開いたときの上のバーは C と同じ高さ（56px 以下）");
  check((await page.locator(".shell-header.ef-appbar [data-ef-fs], .shell-header.ef-appbar [data-ef-about] button").count()) >= 2, "上のバーに「全画面」「ⓘ このアプリについて」がある");
  // 11の切りかえが、1366px・1280px で上のバーからはみ出さず、2段にならない。開いている教材だけ短い名前も出る
  for (const w of [1366, 1280]) {
    await page.setViewportSize({ width: w, height: 650 });
    const fit = await page.evaluate(() => {
      const bar = document.querySelector(".shell-header"), nav = document.querySelector(".switcher"), links = [...nav.querySelectorAll("a")];
      const tops = new Set(links.map((a) => Math.round(a.getBoundingClientRect().top)));
      const named = links.filter((a) => a.querySelector(".ef-sw-n").offsetParent).map((a) => a.getAttribute("aria-current"));
      return { rows: tops.size, navScroll: nav.scrollWidth - nav.clientWidth, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, barScroll: bar.scrollWidth - bar.clientWidth, named };
    });
    check(fit.rows === 1 && fit.navScroll <= 0 && fit.scroll <= 0 && fit.barScroll <= 0 && fit.named.length === 1 && fit.named[0] === "page", `${w}px: 11の切りかえが1段で、横にはみ出さない（${JSON.stringify(fit)}）`);
  }
  await page.setViewportSize({ width: 1366, height: 650 });
  const tabs = (await page.locator(".switcher a").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  check(tabs.length === 11 && tabs.every((t, i) => t.startsWith(`D${i + 1}`)), `切りかえは D1〜D11 の記号（${tabs.slice(0, 3).join(" / ")}）`);
  check(await page.locator(".switcher a").evaluateAll((as, names) => as.every((a, i) => a.getAttribute("aria-label").includes(names[i])), NAMES), "切りかえには教材の名前が読み上げ用に付く");
  await page.setViewportSize({ width: 810, height: 1080 });
  await page.locator(".switcher a", { hasText: "D3" }).click();
  await page.waitForFunction(() => location.hash === "#/network-sim" && document.querySelector('.switcher a[aria-current="page"]')?.getAttribute("href") === "#/network-sim");
  const curName = (await page.locator('.switcher a[aria-current="page"]').innerText()).replace(/\s+/g, " ").trim();
  check(curName === "D3 ネットワーク", `タブレット縦でも記号を押すと教材が開き、開いた教材は名前も出る（${curName}）`);
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
  // ハッシュ化体験ラボのふりかえり（問いの id ごと）も、まとめに入る
  await page.evaluate(() => {
    const k = "eduit-hash-lab";
    const v = JSON.parse(localStorage.getItem(k) || "{}");
    v.refl = { r1: "同じ文なら同じ値になる" };
    v.furigana = true;
    localStorage.setItem(k, JSON.stringify(v));
    // 問題解決ノートの振り返り（refl.learned / refl.next）も、まとめに入る
    localStorage.setItem("mondainote.v1", JSON.stringify({ v: 1, note: {}, refl: { learned: "使う人の立場で評価する", next: "" }, visited: ["find"] }));
  });
  await page.reload();
  const [dj] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }).catch(() => null), page.click("#export-json")]);
  let json = null;
  try {
    json = JSON.parse(require("fs").readFileSync(await dj.path(), "utf8"));
  } catch {}
  // （file:// の自動テストのブラウザでは保存名が「download」になるので、ファイル名は a 要素の download と知らせの文で確かめる）
  const doneMsg = await plain("#export-msg");
  const fname = (doneMsg.match(/ファイル名: ([^）]+)）/) || [])[1] || "";
  check(Boolean(dj) && /^情報の技術_記録まとめ_3組7番_\d{4}-\d{2}-\d{2}\.json$/.test(fname), `まとめのファイル名に組・番号・日付が入る（${fname}）`);
  check(json && json.materials.length === 11 && json.student.num === "7" && json.materials.find((m) => m.id === "virtual-cpu").raw["vcpu.v1"], "1つの JSON に11の教材の記録が入る");
  const hr = json && json.materials.find((m) => m.id === "hash-lab");
  check(hr && hr.hasRecord && hr.reflections.some((r) => r.question === "ハッシュ関数の性質" && r.text === "同じ文なら同じ値になる" && r.page === ""), "まとめにハッシュ化体験ラボのふりかえりが問いの名前つきで入る");
  const nr = json && json.materials.find((m) => m.id === "mondai-note");
  check(nr && nr.hasRecord && nr.reflections.some((r) => r.question === "分かったこと・できるようになったこと" && r.text === "使う人の立場で評価する"), `まとめに問題解決ノートの振り返りが問いの名前つきで入る ${JSON.stringify(nr && nr.reflections)}`);
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
  const left = await page.evaluate(() => ["digilab.v1", "vcpu.v1", "netsim.v1", "seclab.v1", "istudio.works.v1", "istudio.student.v1", "istudio.server.v1", "mcsim.v1", "rover.v1", "mondainote.v1", "kyozai.seen.v1", "kyozai.student.v1"].filter((k) => localStorage.getItem(k) !== null)
    .concat(["eduit-scam-lab", "eduit-genai-lab", "eduit-hash-lab"].filter((k) => Object.keys(JSON.parse(localStorage.getItem(k) || "{}")).length > 0)));
  check(before.includes("リセット確認") && left.length === 0, `全リセットで11の教材とメニューの記録が消える${left.length ? "（残り: " + left.join(", ") + "）" : ""}`);
  const hashLeft = await page.evaluate(() => localStorage.getItem("eduit-hash-lab"));
  check(hashLeft === null, `全リセットで、ハッシュ化体験ラボの記録が消える（${hashLeft}）`);
  check((await page.locator(".ef-mcard.seen").count()) === 0 && (await page.locator(".hero .resume-go").count()) === 0 && (await page.locator("iframe").count()) === 0, "全リセットで「開いたことがある」の印と開いていた教材が消える");
  check(/消しました/.test(await page.locator("#reset-msg").innerText()), "全リセットのあとに知らせが出る");
  check(await page.evaluate(() => JSON.parse(localStorage.getItem("eduit.prefs") || "{}").ruby === true), "全リセットでも、ふりがな・文字の大きさの設定は残る");
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
