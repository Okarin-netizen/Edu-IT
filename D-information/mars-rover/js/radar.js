// 評価のレーダーチャート（教科書と同じ5つの観点）。SVG の文字を返す
export const AXES = ["機能", "利便性", "費用", "安全性", "環境への配慮"];
export const AXIS_NOTE = {
  機能: "調査ロボットとして、やりたいこと（サンプルを集める・障害物をよける）ができたか",
  利便性: "使いやすいか。いろいろな場所（ケース）で、手直しなしで動くか",
  費用: "部品の費用をおさえられたか（安いほど高い点）",
  安全性: "岩や崖にぶつからず、こわれないか",
  環境への配慮: "電池（エネルギー）をむだに使っていないか",
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// series: [{ values: { 機能: 1..5, ... }, color, label }]
export function radarSvg(series, size = 320) {
  const cx = size / 2;
  const cy = size / 2 + 6;
  const R = size * 0.32;
  const n = AXES.length;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * R * (v / 5), cy + Math.sin(a) * R * (v / 5)];
  };
  let s = "";
  for (let lv = 1; lv <= 5; lv++) {
    const pts = AXES.map((_, i) => pt(i, lv).map((x) => x.toFixed(1)).join(",")).join(" ");
    s += `<polygon points="${pts}" class="rd-grid${lv === 5 ? " outer" : ""}"/>`;
  }
  AXES.forEach((name, i) => {
    const [x, y] = pt(i, 5);
    s += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="rd-axis"/>`;
    const [lx, ly] = pt(i, 6.3);
    const anchor = Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
    s += `<text x="${lx.toFixed(1)}" y="${(ly + 5).toFixed(1)}" text-anchor="${anchor}" class="rd-label">${esc(name)}</text>`;
  });
  for (let lv = 1; lv <= 5; lv++) {
    const [x, y] = pt(0, lv);
    s += `<text x="${(x + 4).toFixed(1)}" y="${(y + 4).toFixed(1)}" class="rd-num">${lv}</text>`;
  }
  for (const se of series) {
    const vals = AXES.map((a) => Number(se.values?.[a]) || 0);
    if (!vals.some((v) => v > 0)) continue;
    const pts = vals.map((v, i) => pt(i, Math.max(0, v)).map((x) => x.toFixed(1)).join(",")).join(" ");
    s += `<polygon points="${pts}" fill="${se.color}" fill-opacity="0.18" stroke="${se.color}" stroke-width="2.5"/>`;
    vals.forEach((v, i) => {
      if (!v) return;
      const [x, y] = pt(i, v);
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${se.color}"/>`;
    });
  }
  const label = series.filter((x) => x.label).map((x) => x.label).join("と");
  return `<svg class="radar" viewBox="-60 0 ${size + 120} ${size + 12}" role="img" aria-label="評価のレーダーチャート（${esc(label)}）">${s}</svg>`;
}
