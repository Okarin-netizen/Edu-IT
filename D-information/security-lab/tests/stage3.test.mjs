// 第3段（仕上げ）のテスト: SEC-16 / SEC-68 / SEC-69 / SEC-70
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { practiceSet, orderByModules, PRACTICE_MAX } from "../js/check.js";
import { betterChoices } from "../js/branch.js";
import { CATALOG } from "../js/catalog.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const json = (p) => JSON.parse(read(p));
const noMix = (a) => [...a];

// ---- SEC-69 ----
test("SEC-69: 練習は選んだモジュールだけ、1回に10問まで", () => {
  const pool = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, module: i < 25 ? "a" : "b" }));
  assert.equal(PRACTICE_MAX, 10);
  assert.equal(practiceSet(pool, ["a"], PRACTICE_MAX, noMix).length, 10);
  assert.ok(practiceSet(pool, ["a"]).every((q) => q.module === "a"));
  assert.deepEqual(practiceSet(pool, ["b"], PRACTICE_MAX, noMix).map((q) => q.id), ["q25", "q26", "q27", "q28", "q29"]);
  assert.equal(practiceSet(pool, []).length, 0);
});

test("SEC-69: 事前・事後テストは章の順（情報を守るしくみが第1問）", () => {
  const qs = json("data/quiz.json").questions;
  const order = CATALOG.map((c) => c.id);
  const core = orderByModules(qs, order).filter((q) => q.core);
  assert.equal(core[0].module, "protect");
  const ranks = core.map((q) => order.indexOf(q.module));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  // 同じモジュールの中の順は変えない
  const pw = orderByModules(qs, order).filter((q) => q.module === "password").map((q) => q.id);
  assert.deepEqual(pw, qs.filter((q) => q.module === "password").map((q) => q.id));
  assert.equal(orderByModules(qs, order).length, qs.length);
});

// ---- SEC-70 ----
test("SEC-70: △のときに出す「よりよい答え」がどの問いにもある", () => {
  const { cases } = json("data/copyright.json");
  for (const c of cases)
    for (const [id, n] of Object.entries(c.nodes)) {
      if (!n.choices) continue;
      for (const ch of n.choices) {
        const better = betterChoices(n, ch);
        if (ch.best) assert.equal(better.length, 0);
        else {
          assert.ok(better.length >= 1, `${c.id}/${id}`);
          assert.ok(better.every((b) => b.explain), `${c.id}/${id} の解説`);
        }
      }
    }
});

test("第3段: ふりがな・キャッシュ名", () => {
  assert.equal(json("data/ruby.json").words["枠"], "わく");
  assert.match(read("sw.js"), /seclab-v15"/);
});

// ---- ブラウザ ----
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
test("第3段（ブラウザ）: SNSのやり直し・練習・著作権のよりよい答え", { skip: pw ? false : "Playwright がないので省略" }, async () => {
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
    const card = (id) => page.locator("section", { has: page.locator(`#${id}`) });

    // SEC-68
    await page.goto(`${base}#/sns`);
    const photo = card("step-sns-photo");
    await photo.waitFor();
    assert.match(await photo.innerText(), /タップ（クリック）して選ぼう/);
    const hs = photo.locator(".photo-hs").first();
    const color = await hs.evaluate((el) => getComputedStyle(el).borderTopColor);
    assert.notEqual(color, "rgba(0, 0, 0, 0)", "指でも押せる場所が見える");
    await hs.tap();
    assert.equal(await hs.getAttribute("aria-pressed"), "true");
    const retry = photo.getByRole("button", { name: "もう一度やる" });
    assert.equal(await retry.isVisible(), false);
    await photo.getByRole("button", { name: "答え合わせ" }).click();
    assert.ok(await retry.isVisible());
    await retry.click();
    assert.equal(await photo.locator(".found, .missed, .false-pick, .picked").count(), 0);
    assert.equal(await photo.getByRole("button", { name: "答え合わせ" }).isEnabled(), true);
    assert.equal(await photo.locator(".feedback-list").count(), 0);
    await hs.tap();
    assert.equal(await hs.getAttribute("aria-pressed"), "true", "やり直しのあと、また選べる");
    assert.match(await card("step-sns-fix").innerText(), /スタンプでかくそう/);

    // SEC-69
    const quiz = json("data/quiz.json").questions;
    await page.goto(`${base}#/check`);
    const practice = page.locator(".module-card.practice-card");
    await practice.waitFor();
    assert.equal(await practice.locator("details").getAttribute("open"), "", "モジュールを選ぶ欄が開いている");
    assert.equal(await practice.locator("input[type=checkbox]:checked").count(), 0, "はじめはどれも選んでいない");
    await practice.getByRole("button", { name: "はじめる" }).click();
    assert.match(await page.locator(".toast").innerText(), /チェックを入れよう/);
    assert.equal(await page.locator("fieldset.check-q").count(), 0);
    await practice.locator("label.check-item", { hasText: "パスワード" }).locator("input").check();
    await practice.locator("label.check-item", { hasText: "暗号" }).locator("input").check();
    await practice.locator("label.check-item", { hasText: "SNS" }).locator("input").check();
    await practice.locator("label.check-item", { hasText: "フィッシング" }).locator("input").check();
    await practice.locator("label.check-item", { hasText: "著作権" }).locator("input").check();
    await practice.getByRole("button", { name: "はじめる" }).click();
    const n = await page.locator("fieldset.check-q").count();
    assert.ok(n > 0 && n <= 10, `1回に10問まで（${n}問）`);
    // わざとまちがえる
    for (const fs of await page.locator("fieldset.check-q").all()) {
      const id = (await fs.getAttribute("id")).slice(2);
      const q = quiz.find((x) => x.id === id);
      await fs.locator(`input[type=radio]:not([value="${q.answer}"])`).first().check();
    }
    await page.getByRole("button", { name: "採点する" }).click();
    await page.getByRole("button", { name: "チェックのトップへ" }).click();
    const links = page.locator(".review-links");
    await links.waitFor();
    await links.locator("summary").click();
    assert.equal(await links.locator("a").count(), n, "これまでの結果からも、ステップへ戻れる");
    // 事前テストは章の順（第1問が情報を守るしくみ）
    await page.locator(".module-card", { has: page.locator(".mc-title", { hasText: /^事前テスト$/ }) }).getByRole("button", { name: "はじめる" }).click();
    assert.match(await page.locator("fieldset.check-q legend").first().innerText(), /情報を守るしくみ/);

    // SEC-70
    const { cases } = json("data/copyright.json");
    const first = cases[0];
    const q1 = first.nodes[first.start];
    const wrong = q1.choices.find((c) => !c.best);
    const best = q1.choices.find((c) => c.best);
    await page.goto(`${base}#/copyright`);
    const cr = card("step-copyright-first");
    await cr.waitFor();
    await cr.locator(".choice-list button", { hasText: wrong.label }).click();
    assert.match(await cr.locator(".branch-log").innerText(), new RegExp(`よりよい答え: ${best.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    while ((await cr.locator(".choice-list button").count()) > 0) await cr.locator(".choice-list button").first().click();
    const again = cr.getByRole("button", { name: "この場面をもう一度" });
    assert.ok(await again.isVisible());
    await again.click();
    assert.equal(await cr.locator(".branch-log > li").count(), 0, "場面のはじめに戻る");
    assert.match(await card("step-copyright-all").innerText(), /残りの場面にも挑戦しよう/);

    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.close();
  }
});
