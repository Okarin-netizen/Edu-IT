// 暗号ラボで使う計算(sha256Hex・hexBitDiff は倉庫に移したハッシュ体験が使っていたもの)（画面に依存しない純粋な関数。tests/ で既知ベクタを検証）
// RSA はしくみを体験するための小さな数で計算する。実際の暗号に使える強さではない。

const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// シーザー暗号: 英字だけをずらし、それ以外（空白・記号）はそのまま
export function caesar(text, shift) {
  const s = ((shift % 26) + 26) % 26;
  return text.toUpperCase().replace(/[A-Z]/g, (c) => A[(A.indexOf(c) + s) % 26]);
}

// ヴィジュネル暗号: 鍵の文字ごとにずらす量を変える。decrypt=true で復号
export function vigenere(text, key, decrypt = false) {
  const k = key.toUpperCase().replace(/[^A-Z]/g, "");
  if (!k) return text.toUpperCase();
  let i = 0;
  return text.toUpperCase().replace(/[A-Z]/g, (c) => {
    const shift = A.indexOf(k[i++ % k.length]);
    return A[(A.indexOf(c) + (decrypt ? 26 - shift : shift)) % 26];
  });
}

// 英字の出現回数（A〜Zの26要素）
export function letterCounts(text) {
  const counts = new Array(26).fill(0);
  for (const c of text.toUpperCase()) {
    const i = A.indexOf(c);
    if (i >= 0) counts[i]++;
  }
  return counts;
}

// 頻度表（割合）に対してカイ二乗が最小になるずらし量を推定する
export function guessCaesarShift(cipherText, expectedFreq) {
  const counts = letterCounts(cipherText);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  let best = { shift: 0, score: Infinity };
  for (let s = 0; s < 26; s++) {
    let score = 0;
    for (let i = 0; i < 26; i++) {
      const observed = counts[(i + s) % 26];
      const expected = (expectedFreq[i] || 0.0005) * total;
      score += (observed - expected) ** 2 / expected;
    }
    if (score < best.score) best = { shift: s, score };
  }
  return best.shift;
}

export function gcd(a, b) {
  a = BigInt(a); b = BigInt(b);
  while (b) [a, b] = [b, a % b];
  return a < 0n ? -a : a;
}

// a の mod m での逆元（拡張ユークリッドの互除法）。存在しなければ null
export function modInverse(a, m) {
  a = BigInt(a); m = BigInt(m);
  let [oldR, r] = [((a % m) + m) % m, m];
  let [oldS, s] = [1n, 0n];
  while (r) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  if (oldR !== 1n) return null;
  return ((oldS % m) + m) % m;
}

// 繰り返し二乗法で base^exp mod m
export function modPow(base, exp, m) {
  base = BigInt(base); exp = BigInt(exp); m = BigInt(m);
  if (m === 1n) return 0n;
  let result = 1n;
  base %= m;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % m;
    base = (base * base) % m;
    exp >>= 1n;
  }
  return result;
}

export function isPrime(n) {
  n = Number(n);
  if (!Number.isInteger(n) || n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

// 小さな素数 p, q から鍵を作る。e は φ と互いに素な小さい数から選ぶ（指定があればそれを使う）
export function rsaKeygen(p, q, preferredE) {
  if (!isPrime(p) || !isPrime(q)) throw new Error("p と q は素数にしてください");
  if (p === q) throw new Error("p と q は別の素数にしてください");
  const n = BigInt(p) * BigInt(q);
  const phi = BigInt(p - 1) * BigInt(q - 1);
  const candidates = preferredE ? [BigInt(preferredE)] : [];
  candidates.push(3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 65537n);
  const e = candidates.find((x) => x > 1n && x < phi && gcd(x, phi) === 1n);
  const d = modInverse(e, phi);
  return { p, q, n, phi, e, d };
}

export const rsaEncrypt = (m, e, n) => modPow(m, e, n);
export const rsaDecrypt = (c, d, n) => modPow(c, d, n);

// SHA-256（Web Crypto API）。16進文字列で返す
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 2つの16進文字列で、違っているビットの数を数える（なだれ効果の確認用）
export function hexBitDiff(a, b) {
  let diff = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      diff += x & 1;
      x >>= 1;
    }
  }
  return diff;
}

// 頻度分析のヒント: いちばん多い文字が A・I・O のどれかだとしたら、ずらした数はいくつか（A がいちばん多いとは限らない）
export function freqHint(top) {
  const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const t = L[top];
  const guess = (v) => `${v}→${t} なら ${(top - L.indexOf(v) + 26) % 26}`;
  return `暗号文でいちばん多い文字は「${t}」。もとの文でよく出るのは A・I・O です。${guess("A")}、${guess("I")}、${guess("O")} ずらしたのかもしれません。3つとも試してみよう。`;
}

// 素因数分解チャレンジの答えを判定する（全角の数字も受け付ける。数でないときや 1・n 自身などには、やさしく返す）
export function judgeFactor(n, value) {
  const v = String(value ?? "").normalize("NFKC").trim().replace(/,/g, "");
  if (!v) return { ok: false, title: "答えを入れよう", text: "数を入れてから「たしかめる」を押そう。" };
  if (!/^[+-]?\d+$/.test(v)) return { ok: false, title: "数字で入れよう", text: "わり切れる数を、半角の数字（例: 7）で入れよう。" };
  const g = Number(v);
  if (g <= 1 || g >= n) return { ok: false, title: "もう一度", text: `1 と ${n} 自身のほかで、${n} をわり切れる数を探そう。` };
  if (n % g === 0) return { ok: true, text: `${n} ＝ ${g} × ${n / g}。これが分かると秘密鍵が計算できてしまいます。` };
  return { ok: false, title: "ちがうみたい", text: `${n} は ${g} でわり切れません。小さな素数（2、3、5、7、11 …）から順にわってみよう。` };
}
