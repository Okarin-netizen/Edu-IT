// 第2段（前半: パスワード・暗号・ハッシュ・フィッシング・デジタル化・ネットワーク）の直しのテスト。実行: npm test
// SEC-08 RSA は発展 / SEC-09 大きな数の単位と「1秒に何回」 / SEC-10 暗号ラボを2回に分ける /
// SEC-13 選択クイズのやり直しと「危ない選び方」 / SEC-18 タブレットでグラフを押すと数字が出る
// ブラウザでの確認は Playwright があるときだけ動く（なければ skip）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, crackSeconds, formatDuration, bigJaLog10, powNote, universeCompare, durationLog10, rateLabel, splitPow } from "../js/passwordlib.js";
import { quizVerdict, QUIZ_MAX_TRIES } from "../js/ui.js";
import { cryptoModule, SESSION_BREAK_AFTER } from "../modules/crypto.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const json = (p) => JSON.parse(read(p));
// 京より大きい単位。画面の文には「正解」などがあるので、画面には BIG_TEXT（正・載・極を除く）を使う
const BIG = /[垓𥝱穣溝澗正載極]|恒河沙|阿僧祇|那由他|不可思議|無量大数/;
const BIG_TEXT = /[垓𥝱穣溝澗]|恒河沙|阿僧祇|那由他|不可思議|無量大数/;
const YEAR = Math.log10(86400 * 365);

// ---- SEC-09 ----
test("SEC-09: 京より大きい単位（垓・𥝱・穣・澗など）は出さず、「◯×10の◯乗」で表す", () => {
  for (let lg = 0; lg < 500; lg += 0.37) {
    assert.doesNotMatch(bigJaLog10(lg), BIG, `lg=${lg}`);
    assert.doesNotMatch(formatDuration(lg), BIG, `lg=${lg}`);
  }
  assert.equal(bigJaLog10(16 + Math.log10(3)), "3京", "京までは今までどおり");
  assert.equal(bigJaLog10(38 + Math.log10(9.09)), "9.1×10の38乗"); // kumo-ringo-hashiru-ame の組み合わせ（約909澗だった）
  assert.equal(bigJaLog10(20), "10の20乗");
  assert.deepEqual(splitPow(20 + Math.log10(9.97)), { m: 1, e: 21 }, "9.97 → 10 のくり上がり");
  assert.equal(powNote(38.96), "「10の38乗」は、1のあとに0が38個ならぶ数です。");
  assert.equal(powNote(10, 19.9), "", "使っていなければ説明もなし");
});

test("SEC-09: 宇宙の年齢（約138億年）とくらべる／速さの言葉", () => {
  assert.equal(universeCompare(YEAR + 4), "", "1万年は宇宙の年齢より短い");
  assert.equal(universeCompare(YEAR + 21 + Math.log10(2.9)), "宇宙の年齢（約138億年）の約2100億倍");
  assert.match(universeCompare(YEAR + 10.2), /同じくらい/);
  assert.equal(durationLog10(5), -Infinity, "年で表さない時間は10の何乗を使わない");
  assert.deepEqual([3, 10, 12].map(rateLabel), ["1秒に1,000回", "1秒に100億回", "1秒に1兆回"]);
  // パスフレーズ（ステップ3）の例: どの速さでも大きな単位が出ない
  const a = analyze("kumo-ringo-hashiru-ame", new Set());
  for (const r of [3, 10, 12]) assert.doesNotMatch(formatDuration(crackSeconds(a.log10Combos, r)), BIG);
});

test("SEC-09/18: パスワード画面の文言（速さを結果の上に出す・グラフの目もり・押すと出る説明）", () => {
  const src = read("modules/password.js");
  assert.doesNotMatch(src, BIG_TEXT, "グラフの目もりに垓・穣を使わない");
  assert.match(src, /試すと、すべての組み合わせを試し終わるまで/);
  assert.match(src, /運がよければ、その半分くらい/);
  assert.match(src, /グラフの上を押す（マウスをのせる）と、その長さの時間が出ます/);
  assert.match(src, /pointerType !== "mouse"\) return/, "指やペンで押したときは、はなしても吹き出しを消さない");
  assert.match(src, /pw-quick/, "入力欄のすぐ下に1行の結果");
});

// ---- SEC-13 ----
test("SEC-13: まちがえたら1回やり直せて、2回目で答えを出す。危ない行動は「それは危ない選び方です」", () => {
  const q = { answer: 1, danger: [0, 2], choices: ["a", "b", "c", "d"] };
  assert.equal(QUIZ_MAX_TRIES, 2);
  const right = quizVerdict(q, 1, 1);
  assert.deepEqual([right.ok, right.final, right.heading, right.kind], [true, true, "正解！", "good"]);
  const d1 = quizVerdict(q, 0, 1);
  assert.deepEqual([d1.ok, d1.final, d1.heading, d1.kind], [false, false, "それは危ない選び方です", "bad"]);
  assert.match(d1.retryText, /もう一度/);
  const w1 = quizVerdict(q, 3, 1);
  assert.deepEqual([w1.final, w1.heading, w1.kind], [false, "ちがいます", "warn"]);
  const w2 = quizVerdict(q, 3, 2);
  assert.deepEqual([w2.final, w2.heading], [true, "ちがいます。ここが大事"]);
  const d2 = quizVerdict(q, 2, 2);
  assert.deepEqual([d2.final, d2.heading], [true, "それは危ない選び方です"]);
  assert.ok(quizVerdict(q, 1, 2).ok, "2回目で正解");
  for (const v of [right, d1, w1, w2, d2]) assert.doesNotMatch(v.heading, /おしい/);
});

test("SEC-13: フィッシングの危ない行動に danger が付いていて、正解は入っていない", () => {
  const { scenarios } = json("data/phishing.json");
  for (const sc of scenarios) {
    const a = sc.action;
    assert.ok(Array.isArray(a.danger), sc.id);
    assert.ok(!a.danger.includes(a.answer), `${sc.id}: 正解が danger に入っている`);
    for (const i of a.danger) assert.ok(i >= 0 && i < a.choices.length, sc.id);
  }
  const pick = (id, text) => {
    const a = scenarios.find((s) => s.id === id).action;
    return a.danger.includes(a.choices.findIndex((c) => c.includes(text)));
  };
  assert.ok(pick("sms-delivery", "リンクを開いて"));
  assert.ok(pick("sms-delivery", "返信して"));
  assert.ok(pick("mail-bank", "急いでボタンを押して"));
  assert.ok(pick("web-game", "IDとパスワードだけ入力"));
  assert.ok(pick("dm-prize", "名前だけ入力"));
});

test("SEC-13: 前半の6モジュールの選択クイズは、やり直せるクイズを使う", () => {
  for (const m of ["password", "crypto", "hash", "phishing", "network", "digital"]) {
    const src = read(`modules/${m}.js`);
    // やり直せるクイズは js/ui.js の choiceQuiz にまとめた（ほかのモジュールも同じ動き）
    assert.match(src, /choiceQuiz\(/, m);
    assert.doesNotMatch(src, /retryQuiz/, m);
  }
});

// ---- SEC-08 / SEC-10 ----
test("SEC-08/10: 暗号ラボは RSA の計算を発展にし、素因数分解チャレンジまでで完了。ステップ3のあとで区切る", () => {
  const ids = cryptoModule.steps.map((s) => s.id);
  assert.deepEqual(ids, ["caesar", "brute", "freq", "vigenere", "keyx", "rsa", "reflect"]);
  assert.match(cryptoModule.steps[5].title, /素因数分解チャレンジ/, "ステップ6（id は前と同じ rsa）は全員がやる素因数分解");
  assert.equal(SESSION_BREAK_AFTER, "freq");
  assert.equal(cryptoModule.minutes, "2回に分けて 各15〜20分");
  const src = read("modules/crypto.js");
  assert.match(src, /ここまでで1回目。次の時間はステップ\$\{breakIdx \+ 2\}から/);
  assert.match(src, /φ（ファイ）/);
  assert.match(src, /391 でわったあまり/);
  assert.match(src, /高校・大学で学ぶ数学/);
  // 理解度チェックの復習リンク（#/crypto/<step>）が今のステップを指している
  for (const q of json("data/quiz.json").questions.filter((x) => x.module === "crypto")) assert.ok(ids.includes(q.step), q.id);
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
test("SEC-08/09/10/13/18（ブラウザ・タブレット縦）: グラフを指で押すと数字が残る、やり直し、暗号ラボの区切り", { skip: pw ? false : "Playwright がないので省略" }, async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/D-information/security-lab/index.html`;
  let browser;
  try {
    browser = await pw.chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 810, height: 1080 }, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

    // パスワード: 結果の上に速さ、入力欄のすぐ下に1行の結果、大きな単位なし
    await page.goto(`${base}#/password`);
    await page.locator("#pw-input").waitFor();
    await page.fill("#pw-input", "kumo-ringo-hashiru-ame");
    assert.match(await page.locator("#pw-result").innerText(), /1秒に100億回試すと、すべての組み合わせを試し終わるまで/);
    assert.match(await page.locator(".pw-quick").innerText(), /^結果: ◎ 強い（1秒に100億回試すと/);
    await page.selectOption("#rate-1", "3");
    assert.doesNotMatch(await page.locator("#view").innerText(), BIG_TEXT);

    // SEC-18: 指で押すと、はなしたあとも吹き出しが残る
    await page.locator(".chart svg").first().evaluate((e) => e.scrollIntoView({ block: "center" }));
    const box = await page.locator('.chart svg rect[fill="transparent"]').first().boundingBox();
    await page.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height / 2);
    await page.waitForTimeout(400);
    const tip = page.locator(".chart .tooltip").first();
    assert.equal(await tip.evaluate((e) => getComputedStyle(e).display), "block");
    assert.match(await tip.innerText(), /文字[\s\S]*英小文字だけ: 約/);

    // SEC-13: まちがえると「ちがいます」でやり直し、正解して「できた」
    const q2 = page.locator("section", { has: page.locator("#step-password-compare") });
    await q2.locator(".choice-list button", { hasText: "文字の種類を増やす" }).click();
    assert.match(await q2.innerText(), /ちがいます/);
    assert.doesNotMatch(await q2.innerText(), /おしい|約46万倍/, "答えの解説はまだ出さない");
    assert.doesNotMatch(await page.locator("#step-password-compare").innerText(), /できた/);
    await q2.locator(".choice-list button", { hasText: "12文字にする" }).click();
    assert.match(await q2.innerText(), /正解！[\s\S]*約46万倍/);
    assert.match(await page.locator("#step-password-compare").innerText(), /できた/);
    assert.ok(await noOverflow());

    // SEC-13: フィッシングで危ない行動を選ぶと「それは危ない選び方です」
    await page.goto(`${base}#/phishing`);
    await page.getByRole("button", { name: "答え合わせ" }).click();
    await page.locator(".choice-list button", { hasText: "リンクを開いて" }).click();
    assert.match(await page.locator("#view").innerText(), /それは危ない選び方です/);
    assert.doesNotMatch(await page.locator("#view").innerText(), /おしい/);
    await page.locator(".choice-list button", { hasText: "リンクは開かず" }).click();
    assert.match(await page.locator("#view").innerText(), /正解！/);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("seclab.v1")).modules.phishing.score["sms-delivery"].split("|")[1]), "○（2回目）");

    // SEC-10: ステップ3のあとの区切りと、2回目へのボタン。SEC-08: 発展は最後で、折りたたまれている
    await page.goto(`${base}#/crypto`);
    await page.locator(".session-break").waitFor();
    const order = await page.evaluate(() => [...document.querySelectorAll("#view .step-title .badge, #view .session-break")].map((e) => (e.classList.contains("session-break") ? "区切り" : e.textContent)));
    assert.deepEqual(order, ["ステップ1", "ステップ2", "ステップ3", "区切り", "ステップ4", "ステップ5", "ステップ6", "ステップ7", "発展"]);
    assert.match(await page.locator(".session-break").innerText(), /ここまでで1回目。次の時間はステップ4から/);
    assert.equal(await page.locator(".advanced-body").evaluate((e) => e.open), false);
    await page.getByRole("button", { name: /2回目の人/ }).click();
    await page.waitForFunction(() => Math.abs(document.getElementById("step-crypto-vigenere").getBoundingClientRect().top) < 200);
    // 素因数分解チャレンジで正解すると、ステップ6ができたになる
    await page.fill("#factor-guess", "13");
    await page.getByRole("button", { name: "たしかめる" }).click();
    assert.match(await page.locator("#step-crypto-rsa").innerText(), /できた/);
    assert.ok(await noOverflow());

    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.close();
  }
});
