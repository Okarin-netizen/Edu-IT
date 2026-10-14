// グラフ: センサ・出力・変数の値の変化を、1つずつ横長の帯（レーン）にして並べる
// （ロジックアナライザのように、センサの変化と出力の切りかわりを同じ時間軸で見くらべられる）

function css(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const LANE_H = 44;
const LEFT = 96;

// series: [{ name, min, max, label?, color?（線の色）, marks?（しきい値の数の配列）, scale?（0と最大の数を書く） }] / samples: [{t, ...}] / windowSec: 表示する秒数（null なら全部）
export function drawChart(canvas, series, samples, windowSec = 30, markT = null) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 600;
  const height = series.length * LANE_H + 26;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, width, height);
  const colors = [css("--series-1", "#2a78d6"), css("--series-2", "#eb6834"), css("--series-3", "#1baf7a"), css("--series-4", "#eda100"), css("--series-5", "#8a5cd1")];
  const text = css("--text-secondary", "#555");
  const muted = css("--text-muted", "#777");
  const grid = css("--border", "#ddd");
  const band = css("--surface-2", "#f0f0f0");
  const font = getComputedStyle(document.body).fontFamily;

  const lastT = samples.length ? samples[samples.length - 1].t : 0;
  const t1 = windowSec ? Math.max(windowSec, lastT) : Math.max(lastT, 1);
  const t0 = windowSec ? t1 - windowSec : 0;
  const plotW = width - LEFT - 12;
  const x = (t) => LEFT + ((t - t0) / (t1 - t0)) * plotW;
  const vis = samples.filter((s) => s.t >= t0 - 0.2);

  series.forEach((s, i) => {
    const top = i * LANE_H;
    if (i % 2 === 0) {
      g.fillStyle = band;
      g.fillRect(0, top, width, LANE_H);
    }
    g.fillStyle = text;
    g.font = `12px ${font}`;
    g.textBaseline = "middle";
    g.fillText(s.label || s.name, 6, top + LANE_H / 2 - 7, LEFT - 10);
    const last = vis.length ? vis[vis.length - 1][s.name] : undefined;
    g.fillStyle = muted;
    g.font = `11px ${font}`;
    g.fillText(last === undefined ? "" : s.show ? s.show(last) : String(Math.round(last * 10) / 10), 6, top + LANE_H / 2 + 9, LEFT - 10);
    // 値の範囲
    let lo = s.min;
    let hi = s.max;
    if (lo === undefined || hi === undefined) {
      const vals = vis.map((v) => v[s.name]).filter((v) => typeof v === "number");
      lo = Math.min(0, ...vals);
      hi = Math.max(1, ...vals);
    }
    if (hi === lo) hi = lo + 1;
    const y = (v) => top + LANE_H - 6 - ((v - lo) / (hi - lo)) * (LANE_H - 12);
    g.font = `10px ${font}`;
    // 縦の目もり（いちばん下と上の数）と、しきい値（プログラムの中の数）の線
    if (s.scale) {
      g.fillStyle = muted;
      g.textAlign = "right";
      g.fillText(String(hi), LEFT - 4, y(hi));
      g.fillText(String(lo), LEFT - 4, y(lo));
      g.textAlign = "left";
    }
    for (const m of s.marks || []) {
      if (m < lo || m > hi) continue;
      g.strokeStyle = muted;
      g.lineWidth = 1;
      g.setLineDash([2, 3]);
      g.beginPath();
      g.moveTo(LEFT, y(m));
      g.lineTo(LEFT + plotW, y(m));
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = muted;
      g.textAlign = "right";
      g.fillText(`しきい値 ${m}`, LEFT + plotW - 2, Math.max(top + 6, y(m) - 6));
      g.textAlign = "left";
    }
    g.strokeStyle = s.color || colors[i % colors.length];
    g.lineWidth = 2;
    g.beginPath();
    let started = false;
    let prevY = null;
    for (const smp of vis) {
      const v = smp[s.name];
      if (typeof v !== "number") continue;
      const px = x(smp.t);
      const py = y(v);
      if (!started) {
        g.moveTo(px, py);
        started = true;
      } else if (s.step) {
        g.lineTo(px, prevY);
        g.lineTo(px, py);
      } else g.lineTo(px, py);
      prevY = py;
    }
    g.stroke();
  });
  // 時間の目もり
  const axisY = series.length * LANE_H;
  g.strokeStyle = grid;
  g.lineWidth = 1;
  g.fillStyle = muted;
  g.font = `11px ${font}`;
  g.textBaseline = "top";
  const stepT = t1 - t0 > 60 ? 10 : 5;
  for (let t = Math.ceil(t0 / stepT) * stepT; t <= t1 + 1e-9; t += stepT) {
    const px = x(t);
    g.beginPath();
    g.moveTo(px, 0);
    g.lineTo(px, axisY);
    g.stroke();
    g.fillText(`${t}秒`, px - 10, axisY + 6);
  }
  if (markT !== null && markT >= t0) {
    const bad = css("--bad", "#b3261e");
    // 不合格になった時刻の印（線の上に「× 9.7秒」）
    g.font = `bold 11px ${font}`;
    g.textBaseline = "top";
    const lab = `× ${Math.round(markT * 10) / 10}秒 不合格`;
    const lw = g.measureText(lab).width;
    const lx = x(markT) + 4 + lw > width - 2 ? x(markT) - 4 - lw : x(markT) + 4;
    g.fillStyle = css("--surface-1", "#fff");
    g.fillRect(lx - 2, 1, lw + 4, 15);
    g.fillStyle = bad;
    g.fillText(lab, lx, 2);
    g.strokeStyle = bad;
    g.lineWidth = 2;
    g.setLineDash([4, 3]);
    g.beginPath();
    g.moveTo(x(markT), 0);
    g.lineTo(x(markT), axisY);
    g.stroke();
    g.setLineDash([]);
  }
}
