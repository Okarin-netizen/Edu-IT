// 第2段（共通部分と後半のモジュール）の直しのテスト。実行: npm test
// SEC-11 表示の切りかえで作業が消えない / SEC-14・66・67 ふりがな・やさしい日本語 / SEC-22 章ナビの高さ /
// SEC-54 先生用ページ / SEC-55 事前・事後テスト / SEC-58 拡散シミュレーション / SEC-59 ふりがなで文がばらけない /
// SEC-60 記録の書き出し / SEC-61 見出しがバーにかくれない / SEC-62 ロールプレイの結末 / SEC-63 相談窓口
// ブラウザでの確認は Playwright があるときだけ動く（なければ skip）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { store } from "../js/store.js";
import { testPolicy } from "../js/check.js";
import { canExport, hasRecord, savedMessage, exportEntries, buildExport, exportRows, localDateTime, MSG_NEED_ID, MSG_HAND_IN, MSG_IMPORT_CONFIRM, CONFIRM_APPLY } from "../js/records.js";
import { CATALOG, EASY_STEPS, EASY_PAGES } from "../js/catalog.js";
import { nextEndings, BEST_SUFFIX, GRADE_NOTE } from "../modules/roleplay.js";
import { spreadStep, DELETE_AT, SPREAD_DONE_AT } from "../modules/tattoo.js";
import { DATA_NAMES } from "../js/data.js";
import { quizVerdict } from "../js/ui.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const json = (p) => JSON.parse(read(p));

// ---- SEC-55 ----
test("SEC-55: 事前テストは1回目だけ記録し、事後テストが終わるまで答えを見せない", () => {
  const first = testPolicy("事前テスト", {});
  assert.equal(first.record, true);
  assert.equal(first.showAnswers, false, "事前テストのあとは答えを見せない");
  assert.equal(first.addToReview, false);
  const again = testPolicy("事前テスト", { pre: "5/11" });
  assert.equal(again.record, false, "2回目は記録しない（練習）");
  assert.equal(again.retake, true);
  assert.equal(testPolicy("事前テスト", { pre: "5/11", post: "9/11" }).showAnswers, true, "事後テストのあとなら見せる");
  assert.equal(testPolicy("事後テスト", {}).needsPreNotice, true, "事前テストがまだなら知らせる");
  assert.equal(testPolicy("事後テスト", { pre: "5/11" }).needsPreNotice, false);
  assert.equal(testPolicy("事後テスト", { pre: "5/11" }).record, true);
  assert.equal(testPolicy("事後テスト", { pre: "5/11", post: "8/11" }).record, false, "事後テストも1回目の点を残す");
  assert.equal(testPolicy("練習", { pre: "5/11" }).hideCore, true, "事後テストの前は、練習に事前・事後の問題を出さない");
  assert.equal(testPolicy("復習", { pre: "5/11", post: "8/11" }).hideCore, false);
  // 事後テストの前でも、練習できる問題がどのモジュールにも残る（理解度チェックが空にならない）
  const qs = json("data/quiz.json").questions;
  assert.ok(qs.filter((q) => !q.core).length >= 20);
});

// ---- SEC-60 ----
test("SEC-60: 組と番号がないと書き出さない。文言は共通の決まりどおり", () => {
  assert.equal(canExport({ cls: "2年3組", num: "12" }), true);
  assert.equal(canExport({ cls: "2年3組", num: "" }), false);
  assert.equal(canExport({ cls: " ", num: "12" }), false);
  assert.equal(canExport({}), false);
  assert.equal(MSG_NEED_ID, "組と番号を入れてから書き出そう");
  assert.equal(MSG_HAND_IN, "先生に出すのは JSON のファイルです");
  assert.equal(savedMessage("seclab-2年3組-12-2026-10-13.json"), "ファイルを保存しました（ファイル名: seclab-2年3組-12-2026-10-13.json）。先生に言われた場所に出そう。");
  assert.match(MSG_IMPORT_CONFIRM, /置きかわります/);
  store.reset();
  assert.equal(hasRecord(), false, "何もない端末では、読み込みの確認はいらない");
  store.setStudent({ cls: "2年3組" });
  assert.equal(hasRecord(), true);
  store.reset();
  // CSV の日時は、この端末の時刻で「年-月-日 時:分」
  assert.match(localDateTime("2026-10-12T23:30:00.000Z"), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
});

// ---- SEC-54 ----
test("SEC-54: 章ナビに先生用ページがない。反映の前に確認、標準に戻すボタンがある。表示していないモジュールの記録も書き出す", () => {
  const app = read("js/app.js");
  assert.doesNotMatch(app, /link\("#\/teacher"/, "章ナビに先生用ページを出さない");
  assert.match(app, /id === "teacher"\) renderTeacher/, "#/teacher で開ける");
  assert.match(CONFIRM_APPLY, /先生の指示がないときは押さないでください/);
  const rec = read("js/records.js");
  assert.match(rec, /if \(!confirm\(CONFIRM_APPLY\)\) return;/);
  assert.match(rec, /"標準に戻す"/);
  store.reset();
  store.completeStep("sns", "photo");
  store.setReflection("sns", "位置情報をオフにする");
  const available = CATALOG.filter((c) => c.id !== "sns" && c.id !== "tattoo");
  const ids = exportEntries(available).map((c) => c.id);
  assert.ok(ids.includes("sns"), "表示していなくても記録があれば入れる");
  assert.ok(!ids.includes("tattoo"), "記録がなければ入れない");
  const exp = buildExport(available);
  assert.equal(exp.reflections.find((r) => r.module === "sns")?.text, "位置情報をオフにする");
  assert.ok(exportRows(exp).some((r) => r[3] === "SNS投稿の個人情報チェック"));
  store.reset();
});

// ---- SEC-62 ----
test("SEC-62: ロールプレイは最初の結末といちばんよかった結末の両方を残し、成績にしないと伝える", () => {
  let r = nextEndings({}, "bad");
  assert.deepEqual(r, { first: "bad", best: "bad" });
  r = nextEndings(r, "good");
  assert.deepEqual(r, { first: "bad", best: "good" });
  r = nextEndings(r, "ok");
  assert.deepEqual(r, { first: "bad", best: "good" }, "よい結末は下がらない");
  assert.deepEqual(nextEndings({ first: "ok", best: "ok" }, "bad"), { first: "ok", best: "ok" });
  assert.equal(BEST_SUFFIX, "_best");
  assert.match(GRADE_NOTE, /成績にはしません/);
  const knowpw = json("data/roleplay.json").stories.find((s) => s.id === "knowpw");
  assert.match(knowpw.nodes.e_bad.text, /もしログインしてしまったら/);
  assert.match(json("data/quiz.json").questions.find((q) => q.id === "roleplay-1").explain, /写真や会う約束/);
});

// ---- SEC-58 ----
function testNet() {
  // 0 を中心に 1〜6、その外に 7〜24 がつながる小さな網
  const neighbors = new Map();
  const link = (a, b) => {
    neighbors.set(a, [...(neighbors.get(a) || []), b]);
    neighbors.set(b, [...(neighbors.get(b) || []), a]);
  };
  for (let i = 1; i <= 6; i++) link(0, i);
  for (let i = 7; i <= 24; i++) link(1 + ((i - 7) % 6), i);
  return neighbors;
}
test("SEC-58: 広がらない運でも止まらず10人に届き、削除できる時点で保存した人が1人以上いる", () => {
  const neighbors = testNet();
  const never = () => 0.999; // いつも「広がらない」側の乱数
  let state = Array.from({ length: 25 }, (_, i) => ({ seen: i === 0, copy: i === 0, sharing: i === 0 }));
  const seen = (st) => st.filter((s, i) => i && s.seen).length;
  let ticks = 0;
  while (seen(state) < SPREAD_DONE_AT && ticks < 30) {
    state = spreadStep(state, neighbors, 0.25 * 0.4, false, never);
    ticks++;
  }
  assert.ok(seen(state) >= SPREAD_DONE_AT, `30回までに${SPREAD_DONE_AT}人に届く（${seen(state)}人）`);
  assert.ok(seen(state) >= DELETE_AT);
  assert.ok(state.some((s, i) => i && s.copy), "保存した人が1人以上いる");
  // 削除したあとは、自分と共有しただけの人からは広がらない
  const del = spreadStep(state.map((s, i) => (i === 0 ? { ...s, copy: false } : s)), neighbors, 0.1, true, () => 0);
  assert.ok(del.every((s) => !s.sharing));
  const src = read("modules/tattoo.js");
  assert.match(src, /見た人が8人以上になったら/);
  assert.match(src, /今回は、保存した人がいませんでした/);
  assert.match(src, /seen >= DELETE_AT && !deleted/, "削除のあとに削除ボタンを押せるようにしない");
});

// ---- SEC-63 ----
test("SEC-63: 相談窓口は JSON（先生が直せる）で、公式ページで確かめた番号だけ", () => {
  const c = json("data/consult.json");
  assert.ok(DATA_NAMES.includes("consult"), "先生用ページで差し替えられる");
  assert.equal(c.school, "学校の先生や家の人にも相談しよう。");
  assert.ok(c.lines.length >= 2 && c.lines.length <= 3);
  const tel = Object.fromEntries(c.lines.map((x) => [x.name, x.tel]));
  assert.equal(tel["24時間こどもSOSダイヤル"], "0120-0-78310");
  assert.equal(tel["子どもの人権110番"], "0120-007-110");
  assert.match(c._note, /2026-10-13/);
  for (const m of ["tattoo", "roleplay", "declare"]) assert.match(read(`modules/${m}.js`), /consultCard\(\)/, `${m} に相談窓口`);
  assert.match(read("sw.js"), /data\/consult\.json/);
  assert.match(read("sw.js"), /js\/consult\.js/);
});

// ---- SEC-66・SEC-14・SEC-67 ----
test("SEC-66/14: ふりがなの辞書に、指摘された言葉が入っている", () => {
  const { words } = json("data/ruby.json");
  for (const w of ["侵害", "違法", "撮影", "公衆", "営利", "表記", "悪用", "勝手", "迫られ", "誘われ", "距離", "日課", "土手", "提供元", "届け出", "自動的", "犯人", "感情的", "評判", "手続き", "登録", "採点", "正答率", "事前", "事後", "任意", "怪し", "脅す", "頻度", "模擬", "扱", "避け", "途中", "応募"]) {
    assert.ok(words[w], `${w} がない`);
  }
});
test("SEC-14/67: やさしい日本語は、ページのまとめと、ステップごとの「やること」がある", () => {
  for (const k of ["home", "check", "records"]) assert.ok(EASY_PAGES[k]?.length > 10, k);
  for (const c of CATALOG) {
    const steps = EASY_STEPS[c.id];
    assert.ok(steps, `${c.id} のやさしい日本語`);
    // 後半のモジュールは、すべてのステップにある
    if (["sns", "tattoo", "copyright", "roleplay", "declare"].includes(c.id)) for (const st of c.module.steps) assert.ok(steps[st.id], `${c.id}/${st.id}`);
  }
  assert.match(read("js/app.js"), /"やさしい日本語のまとめ"/);
});

// ---- SEC-11・SEC-59・SEC-22・SEC-61（ソース） ----
test("SEC-11/59/22/61: 切りかえで画面を作り直さない。ふりがなは1つのまとまり。章ナビの高さ。見出しの余白", () => {
  const app = read("js/app.js");
  const toggleFn = app.slice(app.indexOf("async function setDisplay"), app.indexOf("async function applyDisplay"));
  assert.doesNotMatch(toggleFn, /route\(\)/, "切りかえで route() を呼ばない");
  assert.match(read("js/settings.js"), /export function unrubyfy/);
  const css = read("css/style.css");
  assert.match(css, /max-height: calc\(100vh - var\(--header-h, 60px\) - 24px\); overflow-y: auto;/);
  assert.match(css, /scroll-margin-top: calc\(var\(--header-h, 60px\) \+ 12px\)/);
  assert.match(css, /\.check-item > span, \.check-item > \.rb-run \{ flex: 1 1 auto;/);
  assert.match(read("sw.js"), /seclab-v(?:[6-9]|[1-9]\d)"/, "第2段で v6 にした（あとの段でさらに上げてよい）");
});

// ---- SEC-13（ui.js へ移した、やり直せるクイズ） ----
test("SEC-13: やり直せるクイズは ui.js の choiceQuiz。後半のモジュールも同じ動き", () => {
  const ui = read("js/ui.js");
  assert.match(ui, /export function choiceQuiz\(q, onAnswer\)/);
  assert.doesNotMatch(ui, /"おしい！"/);
  assert.equal(quizVerdict({ answer: 1 }, 0, 1).heading, "ちがいます");
  assert.equal(quizVerdict({ answer: 1, danger: [2] }, 2, 1).heading, "それは危ない選び方です");
  for (const m of ["copyright", "tattoo"]) assert.match(read(`modules/${m}.js`), /choiceQuiz\(/, m);
  assert.doesNotMatch(read("modules/password.js"), /function retryQuiz/);
  assert.match(read("js/catalog.js"), /昔の暗号を作って破り（1回目）、鍵の受け渡しと公開鍵暗号のしくみを知る（2回目）。RSAの計算は発展/);
});

// ---- ブラウザでの確認 ----
function loadPlaywright() {
  for (const base of [process.env.NODE_PATH, "/opt/node22/lib/node_modules", root].filter(Boolean)) {
    try {
      return createRequire(join(base, "noop.js"))("playwright");
    } catch {
      // 次をためす
    }
  }
  return null;
}
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
// 共通の枠（../../shared/）も読めるように、リポジトリのいちばん上から配る
const SERVE_ROOT = join(root, "../..");
function serve() {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "") || "index.html";
    const file = join(SERVE_ROOT, path);
    if (!file.startsWith(SERVE_ROOT) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }).end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

const pw = loadPlaywright();
test("第2段（ブラウザ）: 切りかえ・テスト・記録・先生用ページ・ロールプレイ・相談窓口", { skip: pw ? false : "Playwright がないので省略" }, async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/information-apps/security-lab/index.html`;
  let browser;
  try {
    browser = await pw.chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1366, height: 650 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const startMode = (name) => page.locator(".module-card", { has: page.locator(".mc-title", { hasText: new RegExp(`^${name}$`) }) }).getByRole("button", { name: "はじめる" }).click();
    const toggle = (key) => page.locator(`#display-toggles button[data-pref="${key}"]`);

    // SEC-11: 作業の途中で3つの切りかえを押しても、選んだものと書きかけの文が残る
    await page.goto(`${base}#/sns`);
    const fixCard = page.locator("section", { has: page.locator("#step-sns-fix") });
    await fixCard.waitFor();
    await fixCard.locator("label.check-item", { hasText: "位置情報をオフ" }).locator("input").check();
    const ta = page.locator("#reflect-sns");
    await ta.fill("書きかけの文");
    const y = await page.evaluate(() => window.scrollY);
    for (const k of ["ruby", "easy", "largeText"]) {
      await toggle(k).click();
      assert.equal(await toggle(k).getAttribute("aria-pressed"), "true");
    }
    assert.equal(await fixCard.locator("label.check-item").first().locator("input").isChecked(), true, "選んだものが残る");
    assert.equal(await ta.inputValue(), "書きかけの文");
    const y2 = await page.evaluate(() => window.scrollY);
    assert.ok(y > 300 && y2 > 300, `ページの一番上に戻らない（${y} → ${y2}）`);
    assert.ok((await page.locator("#view ruby").count()) > 0, "ふりがなが付く");
    assert.ok(await page.locator(".easy-step").first().isVisible(), "ステップごとのやさしい日本語が出る");
    // SEC-59: ふりがなを付けても、チェックボックスの横の文は1つのまとまり（同じ行の高さに横ならびにならない）
    const pieces = await fixCard.locator("label.check-item", { hasText: "毎日この時間" }).evaluate((el) => [...el.children].filter((c) => c.tagName !== "INPUT").length);
    assert.equal(pieces, 1);
    // ふりがなをオフにすると、元の文にもどる
    await toggle("ruby").click();
    assert.equal(await page.locator("#view ruby").count(), 0);
    assert.match(await fixCard.innerText(), /「毎日この時間」を消し、投稿は家に帰ってから時間をずらしてする/);
    await toggle("easy").click();
    await toggle("largeText").click();

    // SEC-22: 章ナビは画面の中に収まり、下の「ふりかえり・記録」までスクロールで届く
    const navBox = await page.locator("#chapter-nav").boundingBox();
    assert.ok(navBox.y + navBox.height <= 650 + 1, `章ナビが画面の中（下端 ${navBox.y + navBox.height}）`);
    assert.equal(await page.locator(".chapter-nav a", { hasText: "先生用ページ" }).count(), 0, "SEC-54: 章ナビに先生用ページがない");

    // SEC-55: 事後テストを先に押すと知らせる
    await page.goto(`${base}#/check`);
    await startMode("事後テスト");
    await page.getByRole("heading", { name: "事前テストがまだです" }).waitFor();
    await page.getByRole("button", { name: "事前テストをする" }).click();
    // 事前テスト: 全部1つ目を選んで採点 → 答えは出ない、点は記録
    const answerAll = async () => {
      for (const fs of await page.locator("fieldset.check-q").all()) await fs.locator("input[type=radio]").first().check();
      await page.getByRole("button", { name: "採点する" }).click();
      await page.locator(".check-result h2").waitFor();
    };
    await answerAll();
    assert.equal(await page.locator(".q-feedback .explain").count(), 0, "事前テストのあとは答えと解説を見せない");
    assert.match(await page.locator(".check-result").innerText(), /事後テストのあとで/);
    // SEC-61: 結果の見出しが上のバーにかくれない
    await page.waitForTimeout(800);
    const headerBottom = (await page.locator(".app-header").boundingBox()).height;
    const resTop = (await page.locator(".check-result h2").boundingBox()).y;
    assert.ok(resTop >= headerBottom - 1, `結果の見出し ${resTop} がバー ${headerBottom} の下`);
    const firstPre = await page.evaluate(() => JSON.parse(localStorage.getItem("seclab.v1")).modules.check.score["事前テスト"]);
    // もう一度: 練習あつかいで、記録は変わらない
    await page.getByRole("button", { name: "チェックのトップへ" }).click();
    await startMode("事前テスト");
    await page.getByText("2回目からは練習です").waitFor();
    for (const fs of await page.locator("fieldset.check-q").all()) await fs.locator("input[type=radio]").last().check();
    await page.getByRole("button", { name: "採点する" }).click();
    await page.getByText("練習として採点しました").waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("seclab.v1")).modules.check.score["事前テスト"]), firstPre);
    // 事後テストのあとは答えと解説が出る
    await page.getByRole("button", { name: "チェックのトップへ" }).click();
    await startMode("事後テスト");
    await answerAll();
    assert.ok((await page.locator(".q-feedback .explain").count()) > 0);

    // SEC-60: 組と番号がないと書き出さない／書き出すとファイル名が出る／読み込む前に確認
    await page.goto(`${base}#/records`);
    await page.getByRole("button", { name: "JSONで書き出す" }).click();
    assert.match(await page.locator(".export-msg").first().innerText(), /組と番号を入れてから書き出そう/);
    assert.match(await page.locator("#view").innerText(), /先生に出すのは JSON のファイルです/);
    assert.match(await page.locator("table.data").innerText(), /事前 \d+\/\d+・事後 \d+\/\d+/);
    await page.fill("#stu-cls", "2年3組");
    await page.fill("#stu-num", "12");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "JSONで書き出す" }).click()]);
    assert.match(await page.locator(".export-msg").first().innerText(), /^ファイルを保存しました（ファイル名: seclab-2年3組-12-\d{4}-\d{2}-\d{2}\.json）。先生に言われた場所に出そう。$/);
    const exported = readFileSync(await dl.path(), "utf8");
    let asked = "";
    page.once("dialog", (d) => {
      asked = d.message();
      d.dismiss();
    });
    await page.locator("#import-file").setInputFiles({ name: "friend.json", mimeType: "application/json", buffer: Buffer.from(exported.replace("2年3組", "2年1組")) });
    await page.waitForTimeout(300);
    assert.match(asked, /置きかわります/);
    assert.equal(await page.inputValue("#stu-cls"), "2年3組", "やめたら記録はそのまま");

    // SEC-54: #/teacher で開ける。反映は確認でやめられる。標準に戻す
    await page.goto(`${base}#/teacher`);
    await page.getByRole("heading", { name: "先生用ページ" }).waitFor();
    await page.locator("label.check-item", { hasText: "SNS投稿の個人情報チェック" }).locator("input").uncheck();
    page.once("dialog", (d) => {
      asked = d.message();
      d.dismiss();
    });
    await page.getByRole("button", { name: "この端末に反映" }).click();
    assert.match(asked, /先生の指示がないときは押さないでください/);
    assert.equal(await page.evaluate(() => localStorage.getItem("seclab.data.config")), null, "やめたら反映しない");
    await page.locator("label.check-item", { hasText: "SNS投稿の個人情報チェック" }).locator("input").uncheck();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "この端末に反映" }).click();
    await page.waitForFunction(() => !document.querySelector('.chapter-nav a[href="#/sns"]'));
    await page.getByRole("button", { name: "標準に戻す", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.chapter-nav a[href="#/sns"]'));
    assert.equal(await page.evaluate(() => localStorage.getItem("seclab.data.config")), null);

    // SEC-62: ロールプレイの表は2列で、「成績にはしません」
    await page.goto(`${base}#/roleplay`);
    await page.locator("#step-roleplay-all").waitFor();
    const all = page.locator("section", { has: page.locator("#step-roleplay-all") });
    assert.match(await all.innerText(), /最初に選んだ結末/);
    assert.match(await all.innerText(), /いちばんよかった結末/);
    assert.match(await all.innerText(), /成績にはしません/);
    assert.match(await all.innerText(), /0120-0-78310/, "SEC-63: 相談窓口");

    // SEC-63: デジタルタトゥーにも相談窓口
    await page.goto(`${base}#/tattoo/quiz`);
    await page.locator(".consult").waitFor();
    assert.match(await page.locator(".consult").innerText(), /学校の先生や家の人にも相談しよう/);

    // SEC-13: 著作権のクイズ。まちがえると答えは出さずに、もう一度えらべる。2回目で答えが出る
    await page.goto(`${base}#/copyright/responsibility`);
    const cq = page.locator(".retry-quiz").filter({ hasText: "人気マンガ" });
    await cq.waitFor();
    await cq.getByRole("button", { name: "書店の責任" }).click();
    assert.match(await cq.innerText(), /もう一度考えて、えらび直してみよう/);
    assert.doesNotMatch(await cq.innerText(), /正しいのは/);
    assert.equal(await cq.getByRole("button", { name: /書店の責任/ }).isDisabled(), true);
    await cq.getByRole("button", { name: "SNSの会社の責任なので、自分は関係ない" }).click();
    assert.match(await cq.innerText(), /ちがいます。ここが大事/);
    assert.match(await cq.innerText(), /正しいのは「のせた（発信した）自分の責任」です/);
    // フィッシングの行動のクイズ（危ない選び方）
    await page.goto(`${base}#/phishing`);
    await page.locator("section", { has: page.locator("#step-phishing-first") }).getByRole("button", { name: "答え合わせ" }).click();
    const pq = page.locator(".retry-quiz").first();
    await pq.waitFor();
    await pq.getByRole("button", { name: /リンクを開いて/ }).click();
    assert.match(await pq.innerText(), /それは危ない選び方です/);
    assert.match(await pq.innerText(), /どうして危ないのか考えて、もう一度えらんでみよう/);
    assert.doesNotMatch(await pq.innerText(), /正しいのは/);
    assert.doesNotMatch(await page.locator("#view").innerText(), /おしい/);

    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.close();
  }
});
