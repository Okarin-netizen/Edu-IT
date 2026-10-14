// デジタル化と情報量の計算（画面に依存しない純粋な関数）
// 1バイト = 8ビット、1KB = 1024バイト、1MB = 1024KB として計算する（教科書の多くと同じ）

export const log2 = (n) => Math.log2(n);

// 画像のデータ量（ビット）= 横の画素数 × 縦の画素数 × 1画素あたりのビット数
export function imageBits(width, height, bitsPerPixel) {
  return width * height * bitsPerPixel;
}

// 音のデータ量（ビット）= 標本化周波数 × 量子化ビット数 × 秒数 × チャンネル数
export function audioBits(sampleRate, bitDepth, seconds, channels = 1) {
  return sampleRate * bitDepth * seconds * channels;
}

export function formatBits(bits) {
  const bytes = bits / 8;
  if (bits < 8 * 10) return `${bits}ビット`;
  if (bytes < 1024) return `${round(bytes)}バイト`;
  if (bytes < 1024 ** 2) return `約${round(bytes / 1024)}KB`;
  if (bytes < 1024 ** 3) return `約${round(bytes / 1024 ** 2)}MB`;
  return `約${round(bytes / 1024 ** 3)}GB`;
}
function round(x) {
  return x >= 100 ? Math.round(x).toLocaleString("ja-JP") : x >= 10 ? x.toFixed(1).replace(/\.0$/, "") : x.toFixed(2).replace(/\.?0+$/, "");
}

// 0〜1 の値を levels 段階に量子化する
export function quantize(value, levels) {
  if (levels <= 1) return 0;
  const v = Math.min(1, Math.max(0, value));
  return Math.round(v * (levels - 1)) / (levels - 1);
}

// ランレングス圧縮: [0,0,0,1,1] → [[0,3],[1,2]]
export function rle(values) {
  const runs = [];
  for (const v of values) {
    const last = runs[runs.length - 1];
    if (last && last[0] === v) last[1]++;
    else runs.push([v, 1]);
  }
  return runs;
}
export function unrle(runs) {
  return runs.flatMap(([v, n]) => new Array(n).fill(v));
}
