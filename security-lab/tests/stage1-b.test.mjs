// 第1段（後半のモジュールと共通部分）の直しのテスト。実行: npm test
// SEC-52 ふりかえりの自動保存 / SEC-51 私的使用の例外 / SEC-56 password-1 の正解が1つ /
// SEC-57 SNS「毎日この時間」 / SEC-64 架空の地名・学校名 / SEC-65 著作権の言い切り
// ブラウザでの確認（SEC-52・SEC-57）は Playwright があるときだけ動く（なければ skip）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { store } from "../js/store.js";
import { saveReflectionText, REFLECTION_MIN, REFLECTION_AUTOSAVE_HINT } from "../js/ui.js";
import { snsFixLevel, SNS_FIXES } from "../modules/sns.js";
import { analyze, crackSeconds } from "../js/passwordlib.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const json = (p) => JSON.parse(read(p));

// ---- SEC-52 ----
test("SEC-52: 自動保存はボタンと同じ場所に保存し、5文字以上でできたになる", () => {
  store.reset();
  const short = saveReflectionText("sns", "  あいう ");
  assert.equal(short.text, "あいう");
  assert.equal(short.enough, false, "5文字未満はステップ完了にしない");
  assert.equal(store.getReflection("sns"), "あいう", "短くても書いた文は消さない");

  const long = saveReflectionText("sns", "位置情報をオフにしてから投稿する");
  assert.equal(long.changed, true);
  assert.equal(long.enough, true);
  assert.equal(REFLECTION_MIN, 5);
  assert.equal(store.state.reflections.sns.text, "位置情報をオフにしてから投稿する");

  const again = saveReflectionText("sns", "位置情報をオフにしてから投稿する");
  assert.equal(again.changed, false, "同じ文なら保存し直さない");

  saveReflectionText("sns", "   ");
  assert.equal(store.state.reflections.sns, undefined, "全部消したら記録からも消える（「まだ書いていません」に戻る）");
  store.reset();
});

test("SEC-52: すべてのモジュールのふりかえりが共通の reflectionBox を通り、ページ移動・pagehide で保存される", () => {
  const ui = read("js/ui.js");
  assert.equal(REFLECTION_AUTOSAVE_HINT, "書いた文は、自動でこの端末に保存されます。");
  assert.match(ui, /addEventListener\("input"/);
  assert.match(ui, /REFLECTION_AUTOSAVE_MS = 400/);
  const app = read("js/app.js");
  assert.match(app, /async function route\(\) \{[\s\S]{0,200}flushReflections\(\)/, "route の最初で保存する");
  assert.match(app, /addEventListener\("pagehide", flushReflections\)/);
  for (const m of ["sns", "tattoo", "copyright", "roleplay", "declare", "password", "crypto", "hash", "phishing", "network", "digital"]) {
    const src = read(`modules/${m}.js`);
    assert.match(src, /reflectionBox\(ID,/, `${m}.js は共通のふりかえり欄を使う`);
    assert.doesNotMatch(src, /id: `?reflect-/, `${m}.js に自前のふりかえり欄がない`);
  }
});

// ---- SEC-51 ----
const DL = "違法にアップロードされたものと知りながらダウンロードすることも、法律で禁止されています。";
test("SEC-51: 私的使用のまとめに、違法アップロードのダウンロードとコピーガード外しが入っている", () => {
  const src = read("modules/copyright.js");
  const line = src.split("\n").find((l) => l.includes('"私的使用: "'));
  assert.ok(line);
  assert.match(line, /違法にアップロードされたものと知りながらダウンロードすること/);
  assert.match(line, /コピーガードを外してコピーすること/);
  assert.match(line, /ネットに上げるのもダメ/);
});

test("SEC-51: 場面3はどちらの道でもダウンロードの文が読め、copyright-2 の解説にもある", () => {
  const rec = json("data/copyright.json").cases.find((c) => c.id === "recording");
  const q2 = Object.values(rec.nodes).find((n) => /動画サイト/.test(n.text));
  assert.ok(q2, "場面3の2問目");
  for (const c of q2.choices) assert.ok(c.explain.includes(DL), `「${c.label}」の解説`);
  const cr2 = json("data/quiz.json").questions.find((q) => q.id === "copyright-2");
  assert.ok(cr2.explain.includes(DL));
});

// ---- SEC-56 ----
test("SEC-56: password-1 は、ラボと同じ計算で正解だけがいちばん時間がかかる", () => {
  const q = json("data/quiz.json").questions.find((x) => x.id === "password-1");
  assert.equal(q.answer, 0);
  assert.match(q.choices[0], /4文字長く/);
  // 英小文字9文字 sakuraumi を、それぞれの直し方で変えたもの
  const variants = ["sakuraumiyama", "sakura!mi", "sakuraumi7"];
  const secs = variants.map((p) => crackSeconds(analyze(p).log10Combos, 10));
  assert.ok(secs[0] > secs[1] && secs[0] > secs[2], "正解の選択肢がほかより大きい");
  assert.match(q.explain, /約7\.9年/);
  assert.match(q.explain, /約10日/);
  assert.match(q.explain, /約4\.2日/);
});

// ---- SEC-57 ----
test("SEC-57: 「毎日この時間」が残っていると「◎ 低い」にならない", () => {
  const four = ["geo", "blur", "tag", "scope"];
  assert.equal(snsFixLevel(four).level, "warn");
  assert.equal(snsFixLevel(four).routineLeft, true);
  assert.equal(snsFixLevel(["geo", "blur", "time", "scope"]).level, "warn", "ハッシュタグが残っていても低いにしない");
  assert.equal(snsFixLevel(["geo", "blur", "tag", "time"]).level, "good", "公開範囲はおまけ");
  assert.equal(snsFixLevel(SNS_FIXES.map((f) => f.id)).level, "good");
  assert.equal(snsFixLevel([]).level, "bad");
  // どの組み合わせでも、4つそろわないかぎり good にならない
  const ids = SNS_FIXES.map((f) => f.id);
  for (let mask = 0; mask < 1 << ids.length; mask++) {
    const pick = ids.filter((_, i) => mask & (1 << i));
    const allFour = ["geo", "blur", "tag", "time"].every((x) => pick.includes(x));
    assert.equal(snsFixLevel(pick).level === "good", allFour, pick.join(","));
  }
});

// ---- SEC-64 ----
test("SEC-64: 実在する地名・学校名を使っていない", () => {
  for (const p of ["modules/sns.js", "README.md", "docs/先生用の手引き.html"]) {
    const s = read(p);
    for (const w of ["みどり台", "桜ヶ丘中", "桜丘中", "run_run"]) assert.ok(!s.includes(w), `${p} に ${w}`);
  }
  assert.match(read("modules/sns.js"), /ほしぞら台駅/);
});

// ---- SEC-65 ----
test("SEC-65: 引用・肖像権・授業での利用・許可の言いかえ", () => {
  const cj = read("data/copyright.json");
  assert.match(cj, /①公表された作品から/);
  assert.match(cj, /変えずに使う/);
  assert.match(cj, /第35条）、教室で流したり（第38条）/);
  const src = read("modules/copyright.js");
  assert.match(src, /勝手に写真を公開されない権利（肖像権）/);
  assert.doesNotMatch(src, /気持ち（肖像権）/);
  assert.match(src, /許可をもらったことになりません/);
  assert.doesNotMatch(src, /許可したことになりません/);
  const cr1 = json("data/quiz.json").questions.find((q) => q.id === "copyright-1");
  assert.match(cr1.explain, /公表された作品/);
});

// ---- ブラウザでの確認（SEC-52・SEC-57） ----
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
function serve() {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "") || "index.html";
    const file = join(root, path);
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }).end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

const pw = loadPlaywright();
test("SEC-52/57（ブラウザ）: 書いたふりかえりは、保存を押さずにページを移っても残り、書き出しに入る", { skip: pw ? false : "Playwright がないので省略" }, async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  let browser;
  try {
    browser = await pw.chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1366, height: 650 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    // 1) 書いてすぐ「次へ」（保存ボタンは押さない）
    await page.goto(`${base}#/sns`);
    const ta = page.locator("#reflect-sns");
    await ta.waitFor();
    assert.equal((await page.locator(".reflection .hint", { hasText: REFLECTION_AUTOSAVE_HINT }).count()) > 0, true, "自動保存の説明が出ている");
    const text = "位置情報をオフにしてから投稿する";
    await ta.fill(text);
    await page.locator("a.btn", { hasText: "次へ" }).click();
    await page.waitForFunction(() => location.hash.startsWith("#/tattoo"));

    // 2) 記録ページに出て、JSON・CSVの書き出しに入っている
    await page.goto(`${base}#/records`);
    await page.locator("table.data").waitFor();
    assert.match(await page.locator("table.data").innerText(), /位置情報をオフにしてから投稿する/);
    // 第2段（SEC-60）から、組と番号を入れないと書き出せない
    await page.fill("#stu-cls", "2年3組");
    await page.fill("#stu-num", "12");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "JSONで書き出す" }).click()]);
    const exp = JSON.parse(readFileSync(await dl.path(), "utf8"));
    assert.equal(exp.reflections.find((r) => r.module === "sns")?.text, text);
    const [dl2] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "CSVで書き出す" }).click()]);
    assert.match(readFileSync(await dl2.path(), "utf8"), /位置情報をオフにしてから投稿する/);

    // 3) もどると入力欄に文が入っていて、ステップが「できた」
    await page.goto(`${base}#/sns`);
    await ta.waitFor();
    assert.equal(await ta.inputValue(), text);
    assert.match(await page.locator("#step-sns-reflect").innerText(), /できた/);

    // 4) 書いてすぐ再読み込み（pagehide で保存される）
    await page.goto(`${base}#/tattoo`);
    const tt = page.locator("#reflect-tattoo");
    await tt.waitFor();
    await tt.fill("一度広がると消せないので、投稿の前に考える");
    await page.reload();
    await tt.waitFor();
    assert.equal(await tt.inputValue(), "一度広がると消せないので、投稿の前に考える");

    // 5) 入力が止まると「保存しました」と静かに出る。短い文は保存するが、できたにはならない
    await page.goto(`${base}#/roleplay`);
    const rp = page.locator("#reflect-roleplay");
    await rp.waitFor();
    await rp.pressSequentially("あいう");
    await page.waitForTimeout(700);
    assert.equal(await page.locator("#reflect-roleplay ~ .saved-note").innerText(), "保存しました");
    assert.doesNotMatch(await page.locator("#step-roleplay-reflect").innerText(), /できた/);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("seclab.v1")).reflections.roleplay.text), "あいう");

    // 6) 書いてすぐ章ナビの「ふりかえり・記録」を押しても、1回で移れて、記録に出る
    await page.goto(`${base}#/copyright`);
    const cp = page.locator("#reflect-copyright");
    await cp.waitFor();
    await cp.fill("作った人の努力を守るため、使う前に確かめる");
    await page.locator(".chapter-nav a", { hasText: "ふりかえり・記録" }).click();
    await page.waitForFunction(() => location.hash === "#/records");
    await page.locator("table.data").waitFor();
    assert.match(await page.locator("table.data").innerText(), /作った人の努力を守るため/);

    // 7) SEC-57: 「毎日この時間」以外の4つを選んでも「◎ 低い」にならない
    await page.goto(`${base}#/sns/fix`);
    const fixCard = page.locator("section", { has: page.locator("#step-sns-fix") });
    await fixCard.waitFor();
    for (const label of ["位置情報をオフ", "看板・電柱・校章", "ハッシュタグを消す", "公開範囲"]) await fixCard.locator("label.check-item", { hasText: label }).locator("input").check();
    assert.match(await fixCard.innerText(), /△ まだある/);
    assert.match(await fixCard.innerText(), /待ちぶせに使われることがある/);
    assert.doesNotMatch(await page.locator("#step-sns-fix").innerText(), /できた/);
    await fixCard.locator("label.check-item", { hasText: "毎日この時間" }).locator("input").check();
    assert.match(await fixCard.innerText(), /◎ 低い/);
    assert.match(await page.locator("#step-sns-fix").innerText(), /できた/);

    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.close();
  }
});
