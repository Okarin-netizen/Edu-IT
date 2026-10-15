// 画像をつくるAIの小さな模型(拡散モデルのしくみをまねたもの)。画面を使わない計算だけ。
// 絵は 16×16 マスの色。値は -1〜1 の数にして計算する。
// 「ノイズを取る」AIは、学習した絵のうち「今のざらざらの絵に近いもの」ほど重く見て、もとの絵を予想する。
var GenaiImg = (function () {
  'use strict';
  var SIZE = 16;
  var DIM = SIZE * SIZE * 3;
  var PALETTE = {
    '.': [234, 242, 251], // 空
    k: [34, 34, 40],      // 黒(りんかく)
    o: [232, 137, 43],    // だいだい
    e: [92, 94, 104],     // はい色
    w: [255, 255, 255],   // 白
    p: [242, 140, 160],   // ピンク
    r: [201, 55, 44],     // 赤
    b: [58, 111, 209],    // 青
    y: [247, 214, 92],    // 黄
    c: [250, 236, 200],   // クリーム
    g: [86, 168, 70],     // 緑
    d: [38, 110, 52],     // こい緑
    n: [138, 90, 43]      // 茶
  };

  // 左半分(8マス)をかけば、左右対称の16マスにする
  function mirror(halfRows) {
    return halfRows.map(function (h) { return h + h.split('').reverse().join(''); });
  }
  function recolor(rows, map) {
    return rows.map(function (r) { return r.split('').map(function (c) { return map[c] || c; }).join(''); });
  }

  function decode(rows) {
    if (rows.length !== SIZE) throw new Error('絵の行の数が ' + SIZE + ' ではありません');
    var x = new Float32Array(DIM);
    rows.forEach(function (row, yy) {
      if (row.length !== SIZE) throw new Error('絵の ' + (yy + 1) + ' 行目が ' + SIZE + ' マスではありません: ' + row);
      for (var xx = 0; xx < SIZE; xx++) {
        var col = PALETTE[row[xx]];
        if (!col) throw new Error('知らない色の文字: ' + row[xx]);
        for (var ch = 0; ch < 3; ch++) x[(yy * SIZE + xx) * 3 + ch] = col[ch] / 127.5 - 1;
      }
    });
    return x;
  }

  // ふつう分布の乱数(ノイズ)
  function noise(rnd) {
    var z = new Float32Array(DIM);
    for (var i = 0; i < DIM; i += 2) {
      var u = Math.max(1e-9, rnd());
      var v = rnd();
      var r = Math.sqrt(-2 * Math.log(u));
      z[i] = r * Math.cos(2 * Math.PI * v);
      if (i + 1 < DIM) z[i + 1] = r * Math.sin(2 * Math.PI * v);
    }
    return z;
  }

  function addNoise(x0, z, sigma) {
    var x = new Float32Array(DIM);
    for (var i = 0; i < DIM; i++) x[i] = x0[i] + sigma * z[i];
    return x;
  }

  function dist2(a, b) {
    var s = 0;
    for (var i = 0; i < DIM; i++) { var d = a[i] - b[i]; s += d * d; }
    return s;
  }

  // images: [{ word, x }] / mix: { ねこ: 0.7, 家: 0.3 }(ことばの重さ)。
  // 返り値: x0 = AIが予想した「もとの絵」、weights = 学習した絵それぞれをどれだけ重く見たか(合計1)
  function denoise(x, sigma, images, mix) {
    var words = Object.keys(mix).filter(function (w) { return mix[w] > 0; });
    var totalMix = words.reduce(function (s, w) { return s + mix[w]; }, 0) || 1;
    var x0 = new Float32Array(DIM);
    var weights = images.map(function () { return 0; });
    var s2 = Math.max(sigma, 0.02);
    words.forEach(function (w) {
      var idx = [];
      images.forEach(function (im, i) { if (w === '*' || im.word === w) idx.push(i); });
      if (!idx.length) return;
      var logs = idx.map(function (i) { return -dist2(x, images[i].x) / (2 * s2 * s2); });
      var mx = Math.max.apply(null, logs);
      var ex = logs.map(function (l) { return Math.exp(l - mx); });
      var sum = ex.reduce(function (s, e) { return s + e; }, 0);
      var a = mix[w] / totalMix;
      idx.forEach(function (i, k) {
        var wt = a * ex[k] / sum;
        weights[i] += wt;
        var xi = images[i].x;
        for (var d = 0; d < DIM; d++) x0[d] += wt * xi[d];
      });
    });
    return { x0: x0, weights: weights };
  }

  // ノイズの大きさの予定(大→小、さいごは 0)
  function schedule(steps, smax, smin) {
    var out = [];
    for (var k = 0; k < steps; k++) out.push(smax * Math.pow(smin / smax, k / (steps - 1)));
    out.push(0);
    return out;
  }

  // 1ステップ: 予想した絵 x0 に向かって、ノイズを sigma から sigmaNext に減らす。
  // eta(0〜1)の分だけ新しいノイズをまぜる(毎回ちがう絵になる)
  function step(x, sigma, sigmaNext, x0, z, eta) {
    var out = new Float32Array(DIM);
    var keep = Math.sqrt(Math.max(0, 1 - eta * eta));
    for (var i = 0; i < DIM; i++) {
      var dir = sigma > 0 ? (x[i] - x0[i]) / sigma : 0;
      out[i] = x0[i] + sigmaNext * (keep * dir + eta * z[i]);
    }
    return out;
  }

  function toRGBA(x) {
    var px = new Uint8ClampedArray(SIZE * SIZE * 4);
    for (var p = 0; p < SIZE * SIZE; p++) {
      for (var ch = 0; ch < 3; ch++) px[p * 4 + ch] = Math.round((x[p * 3 + ch] + 1) * 127.5);
      px[p * 4 + 3] = 255;
    }
    return px;
  }

  return {
    SIZE: SIZE, DIM: DIM, PALETTE: PALETTE, mirror: mirror, recolor: recolor, decode: decode,
    noise: noise, addNoise: addNoise, dist2: dist2, denoise: denoise, schedule: schedule, step: step, toRGBA: toRGBA
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = GenaiImg;
