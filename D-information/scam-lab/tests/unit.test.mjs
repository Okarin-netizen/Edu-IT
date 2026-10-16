// 場面のデータと、進めるしくみの点検。実行: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("../js/engine.js");
const D = require("../js/data.js");

test("場面は5つで、番号と id がそろっている", () => {
  assert.equal(D.scenarios.length, 5);
  assert.deepEqual(D.scenarios.map((s) => s.no), ["1", "2", "3", "4", "5"]);
  assert.equal(new Set(D.scenarios.map((s) => s.id)).size, 5);
});

for (const sc of D.scenarios) {
  test(`${sc.no} ${sc.title}: 行き先・ボタン・やることリストのつながりにまちがいがない`, () => {
    assert.deepEqual(E.validate(sc), []);
  });
  test(`${sc.no} ${sc.title}: やることを全部やればクリアできる`, () => {
    const path = E.solve(sc);
    assert.ok(path, "クリアまでの道がない");
  });
  test(`${sc.no} ${sc.title}: だまされるおわりが1つ以上あり、説明と教訓がある`, () => {
    const bad = Object.entries(sc.ends).filter(([, e]) => e.type === "bad");
    assert.ok(bad.length >= 1);
    for (const [id, e] of bad) assert.ok(e.title && e.text && e.lesson, id);
    assert.ok(sc.tricks.length >= 3 && sc.ifDone && sc.goal && sc.story);
  });
  test(`${sc.no} ${sc.title}: 最後の行動を先に押しても、クリアにならない`, () => {
    let st = E.init(sc);
    for (const nid of Object.keys(sc.nodes)) {
      for (const a of E.acts(sc, nid)) {
        if (a.to && sc.ends[a.to] && sc.ends[a.to].type === "clear") {
          const n = E.apply(sc, { ...st, node: nid }, a);
          assert.equal(n.cleared, false);
          assert.equal(n.msg.tone, "need");
        }
      }
    }
  });
  test(`${sc.no} ${sc.title}: 架空のアドレスだけを使う`, () => {
    const text = JSON.stringify(sc);
    const hosts = text.match(/[a-z0-9.-]+\.[a-z]{2,}(?=[/"')\s]|$)/gi) || [];
    for (const h of hosts) if (/[a-z]/i.test(h) && !/^\d/.test(h)) assert.match(h, /\.example$/, h);
    for (const ip of text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) || []) assert.match(ip, /^203\.0\.113\./);
  });
}

test("だまされたら失敗が1つ増え、その前の画面にもどれる(✓ は残る)", () => {
  const sc = D.scenarios[0];
  let st = E.init(sc);
  st = E.apply(sc, st, E.findAct(sc, "site", "play"));
  st = E.apply(sc, st, E.findAct(sc, "bill", "look"));
  st = E.apply(sc, st, E.findAct(sc, "bill", "pay"));
  assert.equal(st.end, "bad_pay");
  assert.equal(st.misses, 1);
  st = E.back(sc, st);
  assert.equal(st.node, "bill");
  assert.equal(st.end, null);
  assert.ok(st.done.look);
});

test("ヒントは、まだやっていないいちばん上のことを教え、数を数える", () => {
  const sc = D.scenarios[3];
  let st = E.init(sc);
  st = E.useHint(sc, st);
  assert.equal(st.hint, sc.steps[0].hint);
  assert.equal(st.hints, 1);
});

test("はじめからやり直しても、クリアの記録・失敗・ヒントの数は残る", () => {
  const sc = D.scenarios[1];
  let st = { ...E.init(sc), cleared: true, clearedAt: "x", misses: 2, hints: 1, done: { apply: true }, node: "app" };
  st = E.restart(sc, st);
  assert.equal(st.node, sc.start);
  assert.deepEqual(st.done, {});
  assert.equal(st.cleared, true);
  assert.equal(st.misses, 2);
});
