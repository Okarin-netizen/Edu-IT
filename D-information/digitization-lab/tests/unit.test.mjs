// 計算の正しさのテスト（Node.js 20以上）: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../js/digilib.js";

test("画像のデータ量 = 画素数 × ビット数（理論値と一致）", () => {
  assert.equal(L.imageBits(8, 8, 1), 64);
  assert.equal(L.imageBits(100, 100, 24), 240000);
  assert.equal(L.imageBits(1920, 1080, 24), 49766400);
  assert.equal(L.imageBits(640, 480, 8) / 8, 307200); // 300KB
  assert.equal(L.inUnit(L.imageBits(640, 480, 8), "KB"), "300KB");
  assert.equal(L.inUnit(L.imageBits(1920, 1080, 24), "MB"), "約5.93MB");
  for (const m of L.COLOR_MODES) {
    assert.equal(L.imageBits(256, 256, m.bits), 256 * 256 * m.bits);
    assert.equal(L.colorCount(m), 2 ** m.bits);
  }
});

test("音・動画のデータ量", () => {
  assert.equal(L.audioBits(44100, 16, 60, 2), 84672000);
  assert.equal(L.inUnit(L.audioBits(44100, 16, 60, 2), "MB"), "約10.1MB");
  assert.equal(L.audioBits(8000, 8, 1), 64000);
  assert.equal(L.videoBits(1920, 1080, 24, 30, 1), 1492992000);
});

test("単位の表示", () => {
  assert.equal(L.formatBits(64), "64ビット");
  assert.equal(L.formatBits(8 * 1000), "1,000バイト");
  assert.equal(L.formatBits(8 * 1024 * 2), "2KB");
  assert.equal(L.formatBits(8 * 1024 ** 2 * 3), "3MB");
  assert.deepEqual(L.unitSteps(8 * 1024 * 1024), ["8,388,608 ビット", "÷ 8 ＝ 1,048,576 バイト", "÷ 1024 ＝ 1,024 KB", "÷ 1024 ＝ 1 MB"]);
});

test("量子化と色の表し方", () => {
  assert.equal(L.quantize(0.49, 2), 0);
  assert.equal(L.quantize(0.51, 2), 1);
  assert.equal(L.quantize(0.5, 3), 0.5);
  const mode = (id) => L.COLOR_MODES.find((m) => m.id === id);
  assert.deepEqual(L.applyColorMode(200, 200, 200, mode("bw")), [255, 255, 255]);
  assert.deepEqual(L.applyColorMode(30, 30, 30, mode("bw")), [0, 0, 0]);
  assert.deepEqual(L.applyColorMode(10, 200, 130, mode("c3")), [0, 255, 255]);
  assert.deepEqual(L.applyColorMode(12, 34, 56, mode("c24")), [12, 34, 56]);
  const g = L.applyColorMode(255, 0, 0, mode("g2"));
  assert.ok(g[0] === g[1] && g[1] === g[2]);
});

test("2進数と文字コード", () => {
  assert.equal(L.toBinary(5, 8), "00000101");
  assert.equal(L.toBinary(255), "11111111");
  assert.equal(L.fromBinary("1011"), 11);
  assert.equal(L.fromBinary("10 01"), 9);
  assert.ok(Number.isNaN(L.fromBinary("102")));
  assert.equal(L.binaryExplain("1011"), "1×8 + 0×4 + 1×2 + 1×1 ＝ 11");
  assert.deepEqual(L.utf8Bytes("A"), [65]);
  assert.equal(L.utf8Bytes("あ").length, 3);
  assert.equal(L.bitsNeeded(256), 8);
  assert.equal(L.bitsNeeded(200), 8);
  assert.equal(L.bitsNeeded(1000), 10);
  for (let n = 0; n < 256; n++) assert.equal(L.fromBinary(L.toBinary(n, 8)), n);
});

test("ランレングス圧縮は元に戻せる（可逆）", () => {
  assert.deepEqual(L.rleCounts("0001111000000000"), [3, 4, 9]);
  assert.deepEqual(L.rleCounts("1100000000000000"), [0, 2, 14]);
  assert.deepEqual(L.rleCounts("0000000000000000"), [16]);
  for (let i = 0; i < 200; i++) {
    const row = Array.from({ length: 16 }, () => (Math.random() < 0.5 ? "1" : "0")).join("");
    assert.equal(L.unrleCounts(L.rleCounts(row)), row);
  }
  assert.equal(L.rleImageBits(["0000000000000000"]), 5);
  assert.equal(L.rleImageBits(["0101010101010101"]), 16 * 5);
  assert.equal(L.rleText("AAAABBC"), "A4B2C1");
  assert.equal(L.unrleText("A4B2C1"), "AAAABBC");
  assert.deepEqual(L.unrle(L.rle([1, 1, 2, 3, 3, 3])), [1, 1, 2, 3, 3, 3]);
});

test("ドリル: 正解が式の値と一致し、選択肢が重ならない", () => {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (const kind of [...L.DRILL_KINDS.map((d) => d.id), "mix"]) {
    for (let i = 0; i < 300; i++) {
      const p = L.makeDrill(kind, rand);
      assert.ok(p.choices.length >= 3, `${kind}: 選択肢が少ない ${p.question} ${p.choices}`);
      assert.equal(new Set(p.choices).size, p.choices.length, `${kind}: 選択肢が重複 ${p.choices}`);
      assert.equal(p.answer, 0);
      assert.ok(p.question && p.explain);
    }
  }
  // 画像の問題は、問題文の数から計算した値が正解と一致する
  for (let i = 0; i < 200; i++) {
    const p = L.makeDrill("image", rand);
    const [, w, hh, b] = p.question.replace(/,/g, "").match(/横(\d+) × 縦(\d+)画素、1画素(\d+)ビット/).map(Number);
    const bits = L.imageBits(w, hh, b);
    const unit = p.choices[0].match(/(バイト|KB|MB|GB)$/)[1];
    assert.equal(p.choices[0], L.inUnit(bits, unit === "バイト" ? "B" : unit));
  }
  for (let i = 0; i < 200; i++) {
    const p = L.makeDrill("audio", rand);
    const [, r, d, ch, s] = p.question.replace(/,/g, "").match(/(\d+)Hz、量子化ビット数 (\d+)ビット、.*?（(\d)チャンネル）で (\d+)秒/).map(Number);
    const unit = p.choices[0].match(/(バイト|KB|MB|GB)$/)[1];
    assert.equal(p.choices[0], L.inUnit(L.audioBits(r, d, s, ch), unit === "バイト" ? "B" : unit));
  }
});
