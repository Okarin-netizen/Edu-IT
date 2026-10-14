// 言語・ブロック変換・インタプリタ・作品データのテスト（Node.js 20以上: npm test）
import test from "node:test";
import assert from "node:assert/strict";
import { parse, tokenize, LangError } from "../js/lang.js";
import { codeToBlocks, blocksToCode, splitCompare, joinCompare, exprVarNames, hasJapanese, serverCommands } from "../js/blockmodel.js";
import { Interp, RunError, equals, autoNumber, typeName } from "../js/interp.js";
import { SAMPLES, BLANK, isUntouchedSample } from "../js/samples.js";
import { workFromFile, workToJson, sanitizeWork } from "../js/store.js";
import { bundleSources, ORDER } from "../js/bundle.js";
import { readFileSync } from "node:fs";

// プログラムを最後まで動かす。answers は ask / choose への答え
function runCode(code, { answers = [], parts = {} } = {}) {
  const out = [];
  const box = {};
  const host = {
    output: (t) => out.push(t),
    clear: () => out.push("<clear>"),
    part: (id) => (id in parts ? { setText: (t) => (parts[id] = t), getText: () => parts[id] } : null),
    partIds: () => Object.keys(parts),
    server: {
      save: (w, b, v) => ((box[b] ||= []).push(v), true),
      count: (w, b, v, eq) => (box[b] || []).filter((x) => v === undefined || eq(x, v)).length,
      list: (w, b) => box[b] || [],
      addScore: (w, b, name, score) => ((box[b] ||= []).push({ name, score }), true),
      ranking: (w, b, n) => [...(box[b] || [])].sort((a, c) => c.score - a.score).slice(0, n),
    },
  };
  const it = new Interp(parse(code), host);
  const g = it.main();
  let r;
  let val;
  let steps = 0;
  const a = [...answers];
  while (!(r = g.next(val)).done) {
    val = undefined;
    if (++steps > 1e6) throw new Error("too many steps");
    if (r.value.k === "ask" || r.value.k === "choose") val = a.shift();
  }
  return { out, vars: it.vars, it, box };
}

test("ひな形はすべて ブロック⇔コード で同じ形にもどる", () => {
  for (const s of SAMPLES) assert.equal(blocksToCode(codeToBlocks(s.code)), s.code, s.key);
});

test("else if の連なり・リスト・コメントも往復できる", () => {
  const code = `// メモ
let a = [1, 2, 3];
a[0] = 5;
if (a[0] > 3) {
  show("大");
} else if (a[0] > 1) {
  show("中");
} else {
  show("小");
}
x -= 2;
push(a, "b");
`;
  assert.equal(blocksToCode(codeToBlocks(code)), code);
});

test("四則演算・文字の連結・比較", () => {
  const { out } = runCode('show(1 + 2 * 3);\nshow((1 + 2) * 3);\nshow("合計" + 3);\nshow(7 % 3);\nshow(0.1 + 0.2);\nshow(10 / 4);');
  assert.deepEqual(out, ["7", "9", "合計3", "1", "0.3", "2.5"]);
});

test("ask の答えは数字だけなら数になる（全角もOK）、== は数と数字の文字を同じとみなす", () => {
  assert.equal(autoNumber("８"), 8);
  assert.equal(autoNumber(" 東京 "), "東京");
  assert.equal(equals(8, "8"), true);
  assert.equal(equals("08", 8), true);
  assert.equal(equals("a", "A"), false);
  const { out } = runCode('let n = ask("?");\nshow(n + 1);', { answers: ["４１"] });
  assert.deepEqual(out, ["42"]);
});

test("choose は選ばれた選択肢を返す（リストでもよい）", () => {
  const { out } = runCode('let a = choose("?", "A", "B");\nshow(a);\nlet b = choose("?", ["x", "y", "z"]);\nshow(b);', { answers: [1, 2] });
  assert.deepEqual(out, ["B", "z"]);
});

test("repeat / while / break", () => {
  const { vars } = runCode("let s = 0;\nrepeat (4) {\n  s += 2;\n}\nlet i = 0;\nwhile (true) {\n  i += 1;\n  if (i == 5) {\n    break;\n  }\n}");
  assert.equal(vars.get("s"), 8);
  assert.equal(vars.get("i"), 5);
});

test("when はボタンの処理として登録され、main では動かない", () => {
  const parts = { count: "0" };
  const { out, it } = runCode('let c = 0;\nwhen ("go") {\n  c += 1;\n  setText("count", c);\n}\nshow("ready");', { parts });
  assert.deepEqual(out, ["ready"]);
  const g = it.handler("go");
  while (!g.next().done);
  assert.equal(parts.count, "1");
});

test("サーバー: 保存・件数・ランキング", () => {
  const { out } = runCode(
    'server.save("q", "はい");\nserver.save("q", "いいえ");\nserver.save("q", "はい");\nshow(server.count("q", "はい"));\nshow(server.count("q"));\nserver.addScore("r", "A", 3);\nserver.addScore("r", "B", 5);\nshow(server.ranking("r", 1)[0]);',
  );
  assert.deepEqual(out, ["2", "3", "1位 B 5点"]);
});

test("文がとちゅうで止まれる（ステップ実行のため、文ごとに step を返す）", () => {
  const it = new Interp(parse("let a = 1;\nlet b = 2;\n"), { output() {}, clear() {}, part: () => null, partIds: () => [], server: {} });
  const g = it.main();
  assert.deepEqual(g.next().value, { k: "step", line: 1 });
  assert.equal(it.vars.size, 0);
  assert.deepEqual(g.next().value, { k: "step", line: 2 });
  assert.equal(it.vars.get("a"), 1);
});

test("空の while でも1回ごとに step を返す（無限ループを止められる）", () => {
  const it = new Interp(parse("while (true) {\n}\n"), {});
  const g = it.main();
  for (let i = 0; i < 1000; i++) assert.equal(g.next().value.k, "step");
});

const runErr = (code, opts) => {
  try {
    runCode(code, opts);
  } catch (e) {
    assert.ok(e instanceof RunError, e.message);
    return e;
  }
  assert.fail("エラーになりませんでした");
};
const parseErr = (code) => {
  try {
    parse(code);
  } catch (e) {
    assert.ok(e instanceof LangError, e.message);
    return e;
  }
  assert.fail("エラーになりませんでした");
};

test("実行時エラーは日本語で、行番号と直し方のヒント付き", () => {
  let e = runErr("let total = 0;\nshow(totl);");
  assert.equal(e.line, 2);
  assert.match(e.message, /totl.*もしかして「total」/);
  e = runErr("shw(1);");
  assert.match(e.message, /「shw」という命令はありません。もしかして「show」/);
  e = runErr('show(5 / 0);');
  assert.match(e.message, /0 でわる/);
  e = runErr('let a = [1, 2];\nshow(a[2]);');
  assert.match(e.message, /0 から 1 まで/);
  e = runErr('if ("はい") {\n}');
  assert.match(e.message, /true か false/);
  e = runErr('show("a" - 1);');
  assert.match(e.message, /数ではない/);
  e = runErr('setText("nai", 1);', { parts: { name: "" } });
  assert.match(e.message, /部品「nai」が画面にありません/);
  e = runErr("break;");
  assert.match(e.message, /くり返しの中/);
  e = runErr("show(1, 2);");
  assert.match(e.message, /1つわたします/);
});

test("構文エラーも日本語で（全角記号・= と == ・かっこの対応）", () => {
  assert.match(parseErr("show（1);").message, /全角の「（」/);
  assert.match(parseErr("if (a = 1) {\n}").message, /==/);
  assert.match(parseErr("if (a == 1) {\n  show(1);\n").message, /}/);
  assert.match(parseErr('show("abc);').message, /終わりの "/);
  assert.match(parseErr("repeat (3) {\n  when (\"x\") {\n  }\n}").message, /いちばん外側/);
  assert.equal(parseErr("let a = 1;\n\nshow(a +);").line, 3);
  // 全角スペースは空白として読む
  assert.doesNotThrow(() => parse("show(1);　show(2);"));
});

test("巨大な文字・リストは上限で止まる", () => {
  assert.match(runErr('let s = "x";\nrepeat (30) {\n  s = s + s;\n}').message, /長くなりすぎ/);
  assert.match(runErr("let a = [];\nrepeat (20000) {\n  push(a, 1);\n}").message, /リストが長く/);
});

test("作品ファイル: JSON の往復・HTML から取り出し・形のチェック", () => {
  const w = sanitizeWork({ title: "テスト", code: 'show("<\/script>");', ui: [{ type: "button", id: "go", text: "押す" }, { type: "evil", id: "x" }, { type: "label", id: "bad id" }] });
  assert.equal(w.ui.length, 1);
  const back = workFromFile(workToJson(w));
  assert.equal(back.code, w.code);
  const html = `<html><script type="application/json" id="studio-work">${JSON.stringify({ format: "interactive-studio-work", version: 1, work: w }).replace(/</g, "\\u003c")}</script></html>`;
  assert.equal(workFromFile(html).title, "テスト");
  assert.throws(() => workFromFile("ただの文字"), /読めません/);
});

test("1つのHTMLにまとめるとき、</script> が中に残らない", () => {
  const js = bundleSources(Object.fromEntries(ORDER.map((f) => [f, readFileSync(new URL(`../${f}`, import.meta.url), "utf8")])));
  assert.ok(!/<\/script/i.test(js));
  assert.ok(js.includes("__m_js_app_js"));
});

test("トークン: 文字の中の記号や // はそのまま", () => {
  const t = tokenize('show("a // b（）");');
  assert.equal(t[2].v, "a // b（）");
});

// ---- IS-01: 作品を作る → 開き直す（再読みこみ）→ 残っている ----
// localStorage のかわり（Node 用）。store.js を ?ver をつけて読み直すと、ページの開き直しと同じになる
function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    map: m,
  };
}
let storeVer = 0;
const freshStore = () => import(`../js/store.js?v=${++storeVer}`);

test("IS-01 作品を作る → 開き直す → 作品・企画メモ・ふりかえりが残っている", async () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = fakeStorage();
  try {
    const s1 = await freshStore();
    const a = s1.works.add({ title: "わたしのクイズ", code: 'show("1");', ui: [] });
    s1.works.update(a.id, { plan: { ...a.plan, who: "クラスの友だち", reflect: "選ぶだけで答えられるようにした" } });
    s1.works.add({ title: "アンケート集計", code: 'server.save("q", 1);', ui: [] });
    const s2 = await freshStore(); // 開き直し
    const titles = s2.works.all().map((w) => w.title);
    assert.deepEqual(titles, ["アンケート集計", "わたしのクイズ"]);
    const q = s2.works.all().find((w) => w.title === "わたしのクイズ");
    assert.equal(q.plan.who, "クラスの友だち");
    assert.equal(q.plan.reflect, "選ぶだけで答えられるようにした");
    assert.equal(s2.storageInfo().failed, false);
    assert.equal(s2.storageInfo().backups, 0);
  } finally {
    globalThis.localStorage = saved;
  }
});

test("IS-01 読みこめないデータは上書きで消さず、控えを残す", async () => {
  const saved = globalThis.localStorage;
  const ls = fakeStorage({ "istudio.works.v1": '{"works": [ {"title": "こわれ' });
  globalThis.localStorage = ls;
  try {
    const s = await freshStore();
    assert.equal(s.works.all().length, 0);
    const info = s.storageInfo();
    assert.equal(info.failed, true);
    assert.equal(info.kept, true);
    // 新しく作って保存しても、控えは残る
    s.works.add({ title: "新しい作品", code: "", ui: [] });
    const backups = JSON.parse(ls.getItem(s.BACKUP_KEY));
    assert.equal(backups.length, 1);
    assert.equal(backups[0].raw, '{"works": [ {"title": "こわれ');
    // 次に開いたときも控えはそのまま（新しい作品は読みこめる）
    const s2 = await freshStore();
    assert.equal(s2.works.all()[0].title, "新しい作品");
    assert.equal(s2.storageInfo().failed, false);
    assert.equal(s2.storageInfo().backups, 1);
    // 「この端末の記録をすべて消す」で控えも消える
    s2.works.reset();
    assert.equal(ls.getItem(s.BACKUP_KEY), null);
  } finally {
    globalThis.localStorage = saved;
  }
});

test("IS-01 控えを残せないときは、前のデータを上書きしない", async () => {
  const saved = globalThis.localStorage;
  const ls = fakeStorage({ "istudio.works.v1": "{bad" });
  const set = ls.setItem;
  ls.setItem = (k, v) => {
    if (k === "istudio.works.v1.backup") throw new Error("QuotaExceeded");
    set(k, v);
  };
  globalThis.localStorage = ls;
  try {
    const s = await freshStore();
    assert.equal(s.storageInfo().blocked, true);
    s.works.add({ title: "x", code: "", ui: [] });
    assert.equal(ls.getItem("istudio.works.v1"), "{bad");
  } finally {
    globalThis.localStorage = saved;
  }
});

test("IS-06 まちがえやすい書き方には、直し方が分かるエラーを出す", () => {
  let e = runErr("show(こんにちは);");
  assert.match(e.message, /「こんにちは」は変数の名前として読まれました。文字として使うときは "こんにちは" のように " でかこもう/);
  e = runErr('let answer = "x";\nif (answer == 富士山) {\n}');
  assert.equal(e.line, 2);
  assert.match(e.message, /"富士山"/);
  assert.match(runErr("let total = 0;\nshow(totl);").message, /もしかして「total」/); // 似た名前があるときは今まで通り
  assert.match(runErr("show(abc);").message, /先に abc = 0;/);
  e = parseErr("let a = 1;\nif (a === 1) {\n}");
  assert.equal(e.line, 2);
  assert.match(e.message, /「===」は使えません。同じかどうかをくらべるときは「==」/);
  assert.match(parseErr("if (a !== 1) {\n}").message, /「!=」/);
  assert.match(parseErr("let score = 0;\nscore++;").message, /「score\+\+」は使えません。1増やすときは score \+= 1;/);
  assert.match(parseErr("x--;").message, /x -= 1;/);
  assert.match(parseErr("for (let i = 0; i < 3; i++) {\n  show(i);\n}").message, /for は使えません。.*repeat \(3\).*while/);
  e = parseErr('let a = 1;\nif (a == 1) {\n  show("a");\n\nshow("b");\n');
  assert.equal(e.line, 2);
  assert.match(e.message, /2行目の if の「{」に対応する「}」がありません。if の中の最後の行の後ろに } を書こう/);
  e = parseErr('when ("go") {\n  if (a == 1) {\n    show(1);\n\n}\n');
  assert.equal(e.line, 2);
  // 文字の中の === や ++ はそのまま
  assert.deepEqual(runCode('show("a===b++");\nshow(5 - -3);').out, ["a===b++", "8"]);
});

// ---- 第2段 ----
test("IS-05 条件を［左］［記号］［右］に分けて、もとにもどせる", () => {
  assert.deepEqual(splitCompare('answer == "はい"'), { l: "answer", op: "==", r: '"はい"' });
  assert.deepEqual(splitCompare("i < length(options)"), { l: "i", op: "<", r: "length(options)" });
  assert.deepEqual(splitCompare("score + 1 >= 3"), { l: "score + 1", op: ">=", r: "3" });
  assert.equal(splitCompare("a == 1 and b == 2"), null); // and / or は「まとめて書く」
  assert.equal(splitCompare("true"), null);
  assert.equal(splitCompare("a =="), null);
  assert.equal(joinCompare({ l: "answer", op: "==", r: '"富士山"' }), 'answer == "富士山"');
  // 変数として読まれる名前（" " のつけ忘れを見つける）
  assert.deepEqual(exprVarNames('answer == 富士山'), ["answer", "富士山"]);
  assert.deepEqual(exprVarNames('"得点は" + score + "点"'), ["score"]);
  assert.deepEqual(exprVarNames("show("), []);
  assert.ok(hasJapanese("富士山") && hasJapanese("こんにちは") && hasJapanese("カタカナ") && !hasJapanese("score"));
});

test("IS-08 アンケートの見本は、箱の名前を1か所（box）で決める。箱の名前が変数でもブロックで往復できる", () => {
  const survey = SAMPLES.find((s) => s.key === "survey");
  assert.equal((survey.code.match(/"朝ごはん"/g) || []).length, 1);
  assert.match(survey.code, /箱の名前は、ここだけ変えればOK/);
  const blocks = codeToBlocks(survey.code);
  const save = blocks.find((b) => b.kind === "save");
  assert.equal(save.f.coll, "box"); // 「コード:」のブロックにならない
  assert.equal(blocksToCode(blocks), survey.code);
  // 箱の名前を1か所変えるだけで、保存と集計が同じ箱になる
  const changed = survey.code.replace('"朝ごはん"', '"好きな教科"');
  const r = runCode(changed, { answers: [0] });
  assert.deepEqual(r.box["好きな教科"], ["毎日"]);
  assert.ok(r.out.includes("毎日: 1人") && r.out.includes("合計: 1人"));
  // 文字の箱の名前も今まで通り
  assert.equal(blocksToCode(codeToBlocks('server.save("q", 1);\nserver.addScore("r", name, 3);\n')), 'server.save("q", 1);\nserver.addScore("r", name, 3);\n');
});

test("先生の決定: 作品の中の server の命令を見つける（メモや文字の中は数えない）", () => {
  assert.deepEqual(serverCommands(SAMPLES.find((s) => s.key === "survey").code), ["server.save", "server.count"]);
  assert.deepEqual(serverCommands(SAMPLES.find((s) => s.key === "ranking").code), ["server.addScore", "server.ranking"]);
  assert.deepEqual(serverCommands(SAMPLES.find((s) => s.key === "quiz").code), []);
  assert.deepEqual(serverCommands('// server.save("a", 1);\nshow("server.save(1)");\n'), []);
  // まちがいがあって読めないコードでも見つける
  assert.deepEqual(serverCommands('server.list("a");\nshow(1;\n// server.save("x", 1)'), ["server.list"]);
});

test("IS-09 さわっただけの見本かどうか", () => {
  for (const s of [...SAMPLES, BLANK]) assert.equal(isUntouchedSample({ code: s.code, ui: s.ui.map((p) => ({ ...p })) }), true, s.title);
  const c = SAMPLES[0];
  assert.equal(isUntouchedSample({ code: c.code + "show(1);\n", ui: c.ui }), false);
  assert.equal(isUntouchedSample({ code: c.code, ui: [...c.ui, { type: "label", id: "x", text: "" }] }), false);
  assert.equal(isUntouchedSample({ code: c.code, ui: c.ui.map((p, i) => (i === 0 ? { ...p, text: "かえた" } : p)) }), false);
  assert.equal(isUntouchedSample(null), false);
});

test("IS-15 教科書に合わせた言葉（はい／いいえ・( ) の中の値）", () => {
  assert.equal(typeName(true), "はい／いいえ（true / false）");
  assert.match(parseErr("show(1, 2;").message, /\( \) の中の値は「,」で区切ります/);
  assert.doesNotMatch(parseErr("show(1, 2;").message, /引数/);
});

// IS-12: 「バグを直そう」のメモ（どのボタンを押すか・正しい答え）と、行番号が変わらないこと
test("バグを直そう: メモに手順と正しい答え、エラーは9行目のまま、前の版のメモも見本のまま", () => {
  const bug = SAMPLES.find((s) => s.key === "bug");
  const lines = bug.code.split("\n");
  assert.match(lines[1], /「⏭ 1つずつ実行」を押してから「👣 1つ進む」/);
  assert.match(lines[1], /正しい答えは 15/);
  assert.equal(lines[8], 'show("1から5までの合計は " + totl);');
  assert.match(runErr(bug.code).message, /もしかして「total」/);
  assert.equal(runErr(bug.code).line, 9);
  // 2つとも直すと 15
  const fixed = bug.code.replace("i < 5", "i <= 5").replace("+ totl", "+ total");
  assert.deepEqual(runCode(fixed).out, ["1から5までの合計は 15"]);
  // 前の版のメモのまま保存された作品も「手を加えていない見本」
  const old = bug.code.replace(lines[1], "// デバッグタブで「1つ進む」を押しながら、変数 total と i の変化を見よう");
  assert.equal(isUntouchedSample({ code: old, ui: [] }), true);
  assert.equal(isUntouchedSample({ code: old + "show(1);\n", ui: [] }), false);
});
