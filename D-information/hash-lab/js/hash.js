// ハッシュ化体験ラボ: ハッシュ関数の模型
//  - sha256(文字) … 本物の SHA-256(ブラウザの中だけで計算する。外部には何も送らない)
//  - toyHash(文字) … くらべるための「手作りハッシュ」(文字の番号をたして 100 でわった余り)
// ブラウザでは window.HashLab、node では require('./hash.js') で使う。
(function (root) {
  'use strict';

  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  // 文字 → UTF-8 のバイトのならび
  function utf8(str) {
    var out = [];
    var s = String(str);
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        var d = s.charCodeAt(i + 1);
        if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  // SHA-256(16進数 64 文字で返す)
  function sha256Bytes(bytes) {
    var msg = bytes.slice();
    var bitLen = bytes.length * 8;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    var hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
    msg.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Array(64);
    for (var off = 0; off < msg.length; off += 64) {
      for (var t = 0; t < 16; t++) {
        var j = off + t * 4;
        w[t] = ((msg[j] << 24) | (msg[j + 1] << 16) | (msg[j + 2] << 8) | msg[j + 3]) >>> 0;
      }
      for (t = 16; t < 64; t++) {
        var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return H.map(function (x) { return ('00000000' + x.toString(16)).slice(-8); }).join('');
  }
  function sha256(str) { return sha256Bytes(utf8(str)); }

  // 手作りハッシュ: 1文字ずつの番号(文字コード)をたして、100 でわった余り(00〜99)
  function toyParts(str) {
    return Array.from(String(str)).map(function (ch) { return { ch: ch, code: ch.codePointAt(0) }; });
  }
  function toyHash(str) {
    var sum = toyParts(str).reduce(function (s, p) { return s + p.code; }, 0);
    return ('0' + (sum % 100)).slice(-2);
  }
  function toySum(str) { return toyParts(str).reduce(function (s, p) { return s + p.code; }, 0); }

  // 2つのハッシュ値で、ちがう文字の数・ちがうビットの数
  function diffChars(a, b) {
    var n = 0;
    for (var i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) n++;
    return n;
  }
  function diffBits(a, b) {
    var n = 0;
    for (var i = 0; i < a.length; i++) {
      var x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
      while (x) { n += x & 1; x >>= 1; }
    }
    return n;
  }
  // 2つの文が「1文字だけちがう」か(1文字の書きかえ・足す・消す)
  function oneCharApart(a, b) {
    var x = Array.from(a), y = Array.from(b);
    if (x.join('') === y.join('')) return false;
    if (Math.abs(x.length - y.length) > 1) return false;
    if (x.length === y.length) {
      var n = 0;
      for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) n++;
      return n === 1;
    }
    var s = x.length < y.length ? x : y, l = x.length < y.length ? y : x;
    for (var k = 0; k < l.length; k++) {
      if (l.slice(0, k).concat(l.slice(k + 1)).join('') === s.join('')) return true;
    }
    return false;
  }

  // 総当たり: 全部ためすのにかかる時間(秒)
  function combos(kinds, len) { return Math.pow(kinds, len); }
  function duration(sec) {
    if (sec < 1) return '1秒より短い(一瞬)';
    var units = [['年', 365 * 24 * 3600], ['日', 24 * 3600], ['時間', 3600], ['分', 60], ['秒', 1]];
    var year = units[0][1];
    if (sec >= year * 1e4) {
      var y = sec / year;
      var big = [['兆', 1e12], ['億', 1e8], ['万', 1e4]];
      for (var i = 0; i < big.length; i++) {
        if (y >= big[i][1]) {
          var v = y / big[i][1];
          return '約' + (v >= 10000 ? Math.round(v).toLocaleString('ja-JP') : v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + big[i][0] + '年';
        }
      }
    }
    for (i = 0; i < units.length; i++) {
      if (sec >= units[i][1]) {
        var n = sec / units[i][1];
        return '約' + (n >= 100 ? Math.round(n).toLocaleString('ja-JP') : Math.round(n * 10) / 10) + units[i][0];
      }
    }
    return '1秒より短い(一瞬)';
  }
  function bigNumber(n) {
    if (n < 1e4) return String(n);
    var units = [['京', 1e16], ['兆', 1e12], ['億', 1e8], ['万', 1e4]];
    if (n >= 1e20) { var e = n.toExponential(1).split('e+'); return '約' + e[0] + '×10の' + e[1] + '乗'; }
    for (var i = 0; i < units.length; i++) {
      if (n >= units[i][1]) {
        var v = n / units[i][1];
        return (Number.isInteger(v) ? '' : '約') + (v >= 100 ? Math.round(v).toLocaleString('ja-JP') : Math.round(v * 10) / 10) + units[i][0];
      }
    }
    return String(n);
  }

  var api = {
    utf8: utf8, sha256: sha256, sha256Bytes: sha256Bytes,
    toyHash: toyHash, toyParts: toyParts, toySum: toySum,
    diffChars: diffChars, diffBits: diffBits, oneCharApart: oneCharApart,
    combos: combos, duration: duration, bigNumber: bigNumber
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HashLab = api;
})(this);
