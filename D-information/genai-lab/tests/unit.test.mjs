// 文章AI・画像AIの模型と、教材のデータの点検。実行: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const LM = require("../js/lm.js");
globalThis.GenaiImg = require("../js/img.js");
const IM = globalThis.GenaiImg;
const D = require("../js/data.js");

test("n-gram: 2語を見ると学習データの続きだけが候補になる", () => {
  const m = LM.buildModel(D.corpora.ichiban.sentences);
  const c = LM.candidates(m, ["富士山", "は"], 2);
  assert.deepEqual(c.list.map((x) => x.word), ["日本"]);
  const c2 = LM.candidates(m, ["日本", "で", "いちばん"], 2);
  assert.equal(c2.used, 2);
  assert.ok(c2.list.length >= 5);
  assert.ok(Math.abs(c2.list.reduce((s, x) => s + x.p, 0) - 1) < 1e-9);
});

test("ランダムさ: 小さいといちばん多い言葉に集まる", () => {
  const list = [{ word: "a", count: 3, p: 0.6 }, { word: "b", count: 2, p: 0.4 }];
  const low = LM.withTemperature(list, 0.1);
  assert.ok(low[0].q > 0.98);
  const one = LM.withTemperature(list, 1);
  assert.ok(Math.abs(one[0].q - 0.6) < 1e-9);
});

test("生成: 文は「。」でおわり、学習データにある言葉だけを使う", () => {
  for (const key of Object.keys(D.corpora)) {
    const m = LM.buildModel(D.corpora[key].sentences);
    const words = new Set(m.sentences.flat());
    for (let s = 1; s <= 200; s++) {
      for (const order of [1, 2]) {
        const t = LM.generate(m, { order, temperature: 1.5, rnd: LM.seeded(s) });
        assert.ok(t.length > 0);
        t.forEach((w) => assert.ok(words.has(w), w));
        assert.ok(LM.isEnd(t[t.length - 1]) || t.length >= 30);
      }
    }
  }
});

test("日本のいちばん: 学習データにない「新しい文」が作られる(ハルシネーションの体験)", () => {
  const m = LM.buildModel(D.corpora.ichiban.sentences);
  let fresh = 0;
  for (let s = 1; s <= 200; s++) {
    const t = LM.generate(m, { order: 2, temperature: 1, rnd: LM.seeded(s) });
    if (!LM.inData(m, t)) fresh++;
  }
  assert.ok(fresh > 50, `新しい文 ${fresh} 本`);
});

test("個人情報: 1回だけ入れた電話番号が、そのまま出てくる", () => {
  const phone = D.privacyChoices.find((c) => c.key === "phone");
  const m = LM.buildModel(D.chatBase.concat([phone.template.replace("{v}", phone.values[0])]));
  const t = LM.generate(m, { start: ["わたし", "の", "電話番号", "は"], order: 2, temperature: 1, rnd: LM.seeded(3) });
  assert.equal(t.join(""), "わたしの電話番号は" + phone.values[0] + "です。");
});

test("トークン: 知っている言葉は1つ、知らない文字は1文字ずつ", () => {
  const v = LM.makeVocab(["学校", "です", "は"]);
  const t = LM.tokenize("学校はです猫", v).map((x) => x.text);
  assert.deepEqual(t, ["学校", "は", "です", "猫"]);
  const a = LM.tokenize("I like soccer.", v).map((x) => x.text);
  assert.deepEqual(a, ["I", "like", "socce", "r", "."]);
});

test("絵: 6枚とも16×16で、知っている色だけ", () => {
  assert.equal(D.pictures.length, 6);
  D.pictures.forEach((p) => assert.equal(IM.decode(p.rows).length, IM.DIM));
});

test("画像AI: ノイズから20ステップで、学習した絵の近くに着く", () => {
  const pics = D.pictures.map((p) => ({ word: p.word, x: IM.decode(p.rows) }));
  const sched = IM.schedule(20, 1.6, 0.04);
  const rnd = LM.seeded(42);
  let x = IM.addNoise(new Float32Array(IM.DIM), IM.noise(rnd), sched[0]);
  let w;
  for (let k = 0; k < 20; k++) {
    const d = IM.denoise(x, sched[k], pics, { ねこ: 1 });
    w = d.weights;
    x = IM.step(x, sched[k], sched[k + 1], d.x0, IM.noise(rnd), 0.6);
  }
  // ねこ以外の絵の重さは 0
  pics.forEach((p, i) => { if (p.word !== "ねこ") assert.equal(w[i], 0); });
  const best = Math.min(...pics.filter((p) => p.word === "ねこ").map((p) => IM.dist2(x, p.x)));
  assert.ok(Math.sqrt(best / IM.DIM) < 0.08);
});

test("クイズ: 正解の番号が選択肢の中にある", () => {
  D.quiz.forEach((q) => assert.ok(q.c >= 0 && q.c < q.a.length));
  D.guessGame.forEach((g) => assert.equal(g.options.length, 4));
});

test("クイズ: 正解の位置が全部同じではない(読まずに当てられない)", () => {
  const pos = new Set(D.quiz.map((q) => q.c));
  assert.ok(pos.size >= 3, `正解の位置 ${[...pos]}`);
  D.quiz.forEach((q) => assert.equal(new Set(q.a).size, q.a.length));
});
test("クイズ: いちばん長い選択肢を選べば正解、にならない(正解だけがいちばん長い問題は4割以下)", () => {
  const len = (s) => [...s].length;
  const hits = D.quiz.filter((q) => q.a.every((t, i) => i === q.c || len(q.a[q.c]) > len(t)));
  assert.ok(hits.length / D.quiz.length <= 0.4, `正解だけがいちばん長い問題 ${hits.length}/${D.quiz.length}`);
});
