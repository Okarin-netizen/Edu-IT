// 第1段の修正（前半: パスワード・暗号・ハッシュ・フィッシング・デジタル化・ネットワーク）の回帰テスト。
// 実行: npm test（tests/*.test.mjs をまとめて実行）
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyze, findWeakness, formatDuration, bigJaLog10, rating, crackSeconds } from "../js/passwordlib.js";
import { caesar, letterCounts, freqHint, judgeFactor } from "../js/cryptolib.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const common = new Set(JSON.parse(read("data/common-passwords.json")).words);
const RATES = [3, 10, 12]; // 画面で選べる「攻撃する側の速さ」（1秒に 10^n 回）
const judge = (pw, rate = 10) => {
  const a = analyze(pw, common);
  return { a, r: rating(crackSeconds(a.log10Combos, rate), a.weakness) };
};

// SEC-01（A）: 記号・数字への置きかえ（P@ssw0rd など）を見抜く
test("SEC-01: 置きかえただけのパスワードは、どの速さでも「とても弱い」で、理由に置きかえが出る", () => {
  const cases = { "P@ssw0rd": "password", "Sakur@2026!": "sakura", "S@kura2026": "sakura", "P@ssw0rd2026": "password", "D0raem0n": "doraemon", "p4$$w0rd": "password", "N3k0!": "neko" };
  for (const [pw, word] of Object.entries(cases)) {
    for (const rate of RATES) {
      const { a, r } = judge(pw, rate);
      assert.equal(r.label, "とても弱い", `${pw} rate=1e${rate}`);
      assert.equal(r.level, "bad", pw);
    }
    const w = findWeakness(pw, common);
    assert.match(w.kind, /^leet/, pw);
    assert.match(w.text, /置きかえ/, pw);
    assert.ok(w.text.includes(`「${word}」`), `${pw}: ${w.text}`);
  }
});

test("SEC-01: これまでの判定（辞書・辞書＋数字・くり返し・並び・日付）は変わらない", () => {
  assert.equal(findWeakness("Sakura2026!", common).kind, "common-variant");
  assert.equal(findWeakness("Password123!", common).kind, "common-variant");
  assert.equal(findWeakness("2026sakura", common).kind, "common-variant");
  assert.equal(findWeakness("neko1234", common).kind, "common-variant");
  assert.equal(findWeakness("password", common).kind, "common");
  assert.equal(findWeakness("passw0rd", common).kind, "common");
  assert.equal(findWeakness("zzzzzzz", common).kind, "repeat");
  assert.equal(findWeakness("20090415", common).kind, "date");
});

test("SEC-01: ランダムな長い文字やパスフレーズは、置きかえと見まちがえず「強い」のまま", () => {
  for (const pw of ["tq7vmz2kpw9xrb", "kumo-ringo-hashiru-ame", "x7Rq-v2Lm-9pTz"]) {
    const { a, r } = judge(pw, 10);
    assert.equal(a.weakness, null, pw);
    assert.equal(r.label, "強い", pw);
  }
  // 決まった種から作るランダムな14文字（英小文字＋数字）300個で、まちがって「弱い」と言わない
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const ABC = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 300; i++) {
    const pw = Array.from({ length: 14 }, () => ABC[Math.floor(rnd() * ABC.length)]).join("");
    assert.equal(findWeakness(pw, common), null, pw);
  }
});

test("SEC-01: 例のボタン — P@ssw0rd があり、「強い」の手本は置きかえ型ではなく本当に強い", () => {
  const src = read("modules/password.js");
  const samples = JSON.parse(src.match(/const samples = (\[[^\]]*\]);/)[1]);
  assert.ok(samples.includes("P@ssw0rd"));
  assert.ok(!samples.includes("nEk0-SoRa-7x!"));
  const strong = samples.filter((s) => judge(s, 10).r.level === "good");
  assert.ok(strong.length >= 1, "強い例が1つはある");
  for (const s of strong) assert.equal(findWeakness(s, common), null, s);
  // クイズの「P@ssw0rd はすぐ見つかる」と、判定が食い違わない
  for (const s of ["P@ssw0rd", "Sakura2026!"]) assert.equal(judge(s, 3).r.label, "とても弱い");
});

// SEC-02（A）: グラフの説明
test("SEC-02: たてじくの説明が「1目もりで10倍」ではなく、目もりの倍率と合っている", () => {
  const src = read("modules/password.js");
  assert.ok(!src.includes("1目もりで10倍"));
  assert.ok(src.includes("1秒→1日は約9万倍、1日→1年は365倍"));
  assert.ok(Math.abs(86400 / 9e4 - 1) < 0.05, "1秒→1日 は約9万倍");
});

// SEC-03: パスフレーズのリストと初めの単語数
test("SEC-03: 単語リストは数千語・英小文字だけ・重なりなしで、初めの単語数なら「強い」側（100年以上）になる", () => {
  const { words } = JSON.parse(read("data/passphrase-words.json"));
  assert.ok(words.length >= 2000, `${words.length}語`);
  assert.equal(new Set(words).size, words.length, "重なりがない");
  for (const w of words) assert.match(w, /^[a-z]{3,10}$/, w);
  const src = read("modules/password.js");
  const n = Number(src.match(/selected: n === (\d+)/)[1]);
  assert.ok(n >= 5 && n <= 6, `初めの単語数 ${n}`);
  const logSec = crackSeconds(n * Math.log10(words.length), 10);
  assert.ok(logSec >= Math.log10(86400 * 365 * 100), formatDuration(logSec));
});

// SEC-04: 頻度分析のヒント
test("SEC-04: ヒントの3つの候補（A・I・O）のどれかが、用意したどの文・どの鍵でも正しい", () => {
  const { messages } = JSON.parse(read("data/crypto.json"));
  for (const msg of messages) {
    for (let key = 3; key <= 23; key++) {
      const counts = letterCounts(caesar(msg, key));
      const top = counts.indexOf(Math.max(...counts));
      const nums = [...freqHint(top).matchAll(/なら (\d+)/g)].map((m) => Number(m[1]));
      assert.equal(nums.length, 3);
      assert.ok(nums.includes(key), `key=${key} hint=${freqHint(top)}`);
    }
  }
});

// SEC-21: おかしな入力
test("SEC-21: 300文字でも Infinity にならない／全角は半角にそろえる", () => {
  const a = analyze("x".repeat(300), common);
  assert.ok(Number.isFinite(a.log10Combos));
  assert.equal(bigJaLog10(a.log10Combos), "10の424乗");
  assert.doesNotMatch(formatDuration(crackSeconds(a.log10Combos, 3)), /Infinity|NaN/);
  assert.doesNotMatch(formatDuration(5000), /Infinity|NaN/);
  assert.equal(bigJaLog10(16 + Math.log10(3)), "3京");
  const z = analyze("１２３４５６７８", common);
  assert.equal(z.converted, true);
  assert.equal(z.weakness.kind, "common");
  assert.equal(z.poolSize, 10);
  assert.equal(analyze("ねこがすき", common).hasOther, true);
});

test("SEC-21: 素因数分解チャレンジは、数学としてまちがった文を出さない", () => {
  assert.equal(judgeFactor(143, "11").ok, true);
  assert.equal(judgeFactor(143, "１３").ok, true);
  assert.equal(judgeFactor(143, " 13 ").ok, true);
  for (const v of ["1", "143", "-11", "0", "200"]) {
    const r = judgeFactor(143, v);
    assert.equal(r.ok, false, v);
    assert.match(r.text, /1 と 143 自身のほかで/, v);
  }
  assert.match(judgeFactor(143, "").text, /入れてから/);
  assert.match(judgeFactor(143, "abc").text, /半角/);
  assert.match(judgeFactor(143, "7").text, /143 は 7 でわり切れません/);
  for (const v of ["", "abc", "1.5", "7"]) assert.doesNotMatch(judgeFactor(143, v).text, /NaN|undefined/);
});
