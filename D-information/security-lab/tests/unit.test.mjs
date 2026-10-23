// 暗号処理・パスワード推定の既知ベクタによるテスト。実行: node --test tests/unit.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { caesar, vigenere, letterCounts, guessCaesarShift, gcd, modInverse, modPow, isPrime, rsaKeygen, rsaEncrypt, rsaDecrypt, sha256Hex, hexBitDiff } from "../js/cryptolib.js";
import { analyze, findWeakness, formatDuration, bigJa, rating, crackSeconds } from "../js/passwordlib.js";
import { readFileSync } from "node:fs";

const cryptoData = JSON.parse(readFileSync(new URL("../data/crypto.json", import.meta.url)));
const common = new Set(JSON.parse(readFileSync(new URL("../data/common-passwords.json", import.meta.url))).words);

test("シーザー暗号: 既知の例と往復", () => {
  assert.equal(caesar("HELLO", 3), "KHOOR");
  assert.equal(caesar("xyz abc", 3), "ABC DEF");
  assert.equal(caesar(caesar("HIMITSU NO AIKOTOBA", 11), -11), "HIMITSU NO AIKOTOBA");
  assert.equal(caesar("ABC", 29), "DEF");
});

test("ヴィジュネル暗号: 教科書の例（ATTACKATDAWN / LEMON）", () => {
  assert.equal(vigenere("ATTACKATDAWN", "LEMON"), "LXFOPVEFRNHR");
  assert.equal(vigenere("LXFOPVEFRNHR", "LEMON", true), "ATTACKATDAWN");
  assert.equal(vigenere("ATTACK AT DAWN", "lemon"), "LXFOPV EF RNHR");
});

test("頻度分析: 用意した文章はどれも鍵を当てられる", () => {
  const freq = cryptoData.romajiFrequency.values;
  assert.equal(freq.length, 26);
  for (const msg of cryptoData.messages) {
    for (const key of [3, 7, 13, 20, 23]) {
      assert.equal(guessCaesarShift(caesar(msg, key), freq), key, `key=${key} msg=${msg.slice(0, 20)}`);
    }
  }
  assert.deepEqual(letterCounts("AAB").slice(0, 3), [2, 1, 0]);
});

test("RSA: 有名な例 p=61, q=53, e=17 → d=2753, 65 → 2790", () => {
  assert.equal(gcd(17, 3120), 1n);
  assert.equal(modInverse(17, 3120), 2753n);
  assert.equal(modInverse(4, 8), null);
  assert.equal(modPow(65, 17, 3233), 2790n);
  assert.equal(modPow(2790, 2753, 3233), 65n);
  const k = rsaKeygen(61, 53, 17);
  assert.equal(k.n, 3233n);
  assert.equal(k.d, 2753n);
});

test("RSA: 教材で選べる素数の組み合わせすべてで往復できる", () => {
  for (const p of cryptoData.rsaPrimes) {
    assert.ok(isPrime(p), `${p} は素数`);
    for (const q of cryptoData.rsaPrimes) {
      if (p === q) continue;
      const k = rsaKeygen(p, q);
      assert.equal((k.e * k.d) % k.phi, 1n);
      for (let m = 1n; m <= 26n; m++) assert.equal(rsaDecrypt(rsaEncrypt(m, k.e, k.n), k.d, k.n), m);
    }
  }
  assert.throws(() => rsaKeygen(15, 17));
  assert.throws(() => rsaKeygen(17, 17));
});

test("SHA-256: 既知ベクタ", async () => {
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(await sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("パスワード推定: 文字種と組み合わせの数", () => {
  const a = analyze("abcdefgh", common);
  assert.equal(a.poolSize, 26);
  assert.ok(Math.abs(a.log10Combos - 8 * Math.log10(26)) < 1e-9);
  assert.equal(analyze("Ab1!", common).poolSize, 95);
  assert.equal(analyze("ねこ", common).poolSize, 100);
  assert.equal(analyze("", common).log10Combos, 0);
});

test("パスワード推定: 弱いパターンを見つける", () => {
  assert.equal(findWeakness("password", common).kind, "common");
  assert.equal(findWeakness("Password123!", common).kind, "common-variant");
  assert.equal(findWeakness("zzzzzzz", common).kind, "repeat");
  assert.equal(findWeakness("wxyz", common).kind, "sequence");
  assert.equal(findWeakness("20090415", common).kind, "date");
  assert.equal(findWeakness("kumo-ringo-hashiru-ame", common), null);
});

test("パスワード推定: 時間の表示と判定", () => {
  assert.equal(formatDuration(-5), "一瞬（0.001秒未満）");
  assert.equal(formatDuration(Math.log10(90)), "約1.5分");
  assert.equal(formatDuration(Math.log10(86400 * 3)), "約3日");
  assert.match(formatDuration(Math.log10(86400 * 365 * 2e8)), /億年$/);
  assert.equal(bigJa(12345), "1.2万");
  assert.equal(bigJa(3e16), "3京");
  assert.equal(rating(crackSeconds(12 * Math.log10(95), 10), null).level, "good");
  assert.equal(rating(crackSeconds(6 * Math.log10(26), 10), null).level, "bad");
  assert.equal(rating(30, { kind: "common" }).level, "bad");
});

test("フィッシング素材: 実在しない .example のアドレスだけを使う", () => {
  const { scenarios } = JSON.parse(readFileSync(new URL("../data/phishing.json", import.meta.url)));
  const text = JSON.stringify(scenarios);
  const hosts = text.match(/[a-z0-9-]+(\.[a-z0-9-]+)+\.?[a-z]*/gi).filter((x) => /\.[a-z]{2,}$/i.test(x) && !/^\d/.test(x));
  for (const host of hosts) assert.match(host, /\.example$/, host);
  for (const sc of scenarios) assert.ok(sc.action.answer < sc.action.choices.length);
});

test("ハッシュ: ビットの違いを数える", async () => {
  assert.equal(hexBitDiff("00", "ff"), 8);
  assert.equal(hexBitDiff("a5", "a5"), 0);
  const d = hexBitDiff(await sha256Hex("こんにちは"), await sha256Hex("こんにちわ"));
  assert.ok(d > 80 && d < 176, `${d}`);
});

const readData = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url)));

test("教材データ: 理解度チェックの問題が、実在するモジュールとステップを指している", async () => {
  const { CATALOG } = await import("../js/catalog.js");
  const { questions } = readData("quiz");
  const ids = new Set();
  for (const q of questions) {
    assert.ok(!ids.has(q.id), `重複: ${q.id}`);
    ids.add(q.id);
    const entry = CATALOG.find((c) => c.id === q.module);
    assert.ok(entry, `モジュールがない: ${q.module}`);
    assert.ok(entry.module.steps.some((s) => s.id === q.step), `ステップがない: ${q.module}/${q.step}`);
    assert.ok(q.answer >= 0 && q.answer < q.choices.length, q.id);
  }
  for (const c of CATALOG) assert.equal(questions.filter((q) => q.module === c.id && q.core).length, 1, `事前・事後テスト用の問題は各モジュール1問: ${c.id}`);
});

test("教材データ: 分岐（著作権・ロールプレイ）の行き先がすべて存在し、必ず終わりにたどり着く", () => {
  const graphs = [...readData("copyright").cases, ...readData("roleplay").stories];
  for (const g of graphs) {
    assert.ok(g.nodes[g.start], `${g.id}: start がない`);
    const seen = new Set();
    const walk = (id, depth) => {
      assert.ok(depth < 20, `${g.id}: ループしている`);
      const node = g.nodes[id];
      assert.ok(node, `${g.id}: ${id} がない`);
      seen.add(id);
      if (node.end || !node.choices) return;
      for (const c of node.choices) if (c.next) walk(c.next, depth + 1);
    };
    walk(g.start, 0);
    assert.deepEqual([...seen].sort(), Object.keys(g.nodes).sort(), `${g.id}: たどり着けないノードがある`);
  }
});

test("教材データ: 設定ファイルとふりがな辞書", async () => {
  const { CATALOG } = await import("../js/catalog.js");
  const cfg = readData("config");
  for (const id of cfg.enabledModules) assert.ok(CATALOG.some((c) => c.id === id), id);
  const { words } = readData("ruby");
  for (const [w, r] of Object.entries(words)) {
    assert.ok(w && r, w);
    assert.match(r, /^[ぁ-ゖー]+$/, `${w} の読みはひらがなで: ${r}`);
  }
});

