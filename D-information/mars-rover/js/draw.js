// 上から見た火星のフィールドとロボットをかく（canvas）
import { BODY_L, BODY_W, LINE_W, DIST_MAX, SPREAD, mountPoint, castRay } from "./world.js";

const C = {
  ground: "#f3d9bd",
  ground2: "#ecc9a4",
  dot: "rgba(150, 90, 50, 0.12)",
  rock: "#9a6b4f",
  rockEdge: "#6e4632",
  rockLight: "#b88b6c",
  wall: "#8a5d44",
  wallFill: "#b9876a",
  crater: "#d9b08a",
  craterRim: "#8d5c40",
  line: "#2a3f8f",
  target: "#1a5fc8",
  done: "#1f7a3a",
  goal: "#1f7a3a",
  trail: "rgba(26, 95, 200, 0.45)",
  beam: "rgba(26, 95, 200, 0.16)",
  beamEdge: "rgba(26, 95, 200, 0.55)",
  body: "#e9edf3",
  bodyEdge: "#3a4556",
  wheel: "#333a44",
  wheelOn: "#eb6834",
  crash: "#b3261e",
};

// 地面の小石（場所は決まっている。毎回同じ絵になる）
function speckles(W, H) {
  const out = [];
  let s = 12345;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const n = Math.round((W * H) / 2500);
  for (let i = 0; i < n; i++) out.push([rnd() * W, rnd() * H, 1 + rnd() * 2.5]);
  return out;
}

export function createView(canvas) {
  const ctx = canvas.getContext("2d");
  let cache = null;
  let fieldW = 1000;
  let fk = 1; // 文字の大きさの倍率（画面が小さいときも、文字が小さくなりすぎないように）

  function size(field) {
    const cssW = canvas.clientWidth || 600;
    const scale = cssW / field.W;
    const cssH = Math.round(field.H * scale);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.height = `${cssH}px`;
    }
    return { scale: scale * dpr, dpr };
  }

  function draw(sim, opts = {}) {
    const field = sim.field;
    fieldW = field.W;
    const { scale, dpr } = size(field);
    fk = Math.min(2.2, Math.max(0.9, 1 / (scale / dpr)));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // 地面
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, 0, field.W, field.H);
    if (!cache || cache.W !== field.W || cache.H !== field.H) cache = { W: field.W, H: field.H, pts: speckles(field.W, field.H) };
    ctx.fillStyle = C.dot;
    for (const [x, y, r] of cache.pts) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 迷路の谷は、ますの目もり（100cm）を薄く
    if (field.path) {
      ctx.strokeStyle = "rgba(120, 70, 40, 0.10)";
      ctx.lineWidth = 1 / (scale / (window.devicePixelRatio || 1));
      for (let x = 100; x < field.W; x += 100) line(x, 0, x, field.H);
      for (let y = 100; y < field.H; y += 100) line(0, y, field.W, y);
    }
    // 目印の線
    for (const ln of field.lines || []) {
      ctx.strokeStyle = C.line;
      ctx.lineWidth = LINE_W;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ln.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    // ゴール（基地・旗）
    if (field.goal) drawGoal(field.goal, sim.goalReached, sim.targets.every((t) => t.done), field.start);
    // 障害物
    for (const o of field.obstacles) {
      if (o.type === "wall") drawWall(o);
      else if (o.type === "crater") drawCrater(o);
      else drawRock(o);
    }
    // 調査地点・サンプル（名前が壁にかくれないように、障害物のあとにかく）
    for (const t of sim.targets) {
      if (t.mode === "near") continue;
      drawTarget(t);
    }
    // 岩の調査の印
    for (const t of sim.targets) {
      if (t.mode !== "near") continue;
      const o = field.obstacles[t.obstacle];
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = t.done ? C.done : C.target;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r + t.near + 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      label(t.done ? "✓ 調べた" : "岩を調べる", o.x, o.y - o.r - 8, t.done ? C.done : C.target);
    }
    // 走ったあと
    if (sim.trail.length > 1) {
      ctx.strokeStyle = C.trail;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      sim.trail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.lineTo(sim.robot.x, sim.robot.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // センサの線
    if (opts.beams !== false) {
      for (const s of sim.sensorList) if (s.kind === "dist") drawBeam(sim, s);
    }
    drawRobot(sim);
    if (sim.crash) {
      ctx.fillStyle = C.crash;
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("💥", sim.crash.x, sim.crash.y - 18);
    }
  }

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function label(text, x, y, color) {
    ctx.font = `bold ${Math.round(12 * fk)}px sans-serif`;
    ctx.textAlign = "center";
    // フィールドの右・左のはしで文字が切れないように
    const half = ctx.measureText(text).width / 2 + 2;
    x = Math.max(half, Math.min(fieldW - half, x));
    y = Math.max(12 * fk, y);
    ctx.lineWidth = 3 * fk;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawRock(o) {
    ctx.fillStyle = C.rock;
    ctx.strokeStyle = C.rockEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + 0.06 * Math.sin(i * 2.7 + o.x);
      const x = o.x + Math.cos(a) * o.r * k;
      const y = o.y + Math.sin(a) * o.r * k;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.rockLight;
    ctx.beginPath();
    ctx.arc(o.x - o.r * 0.3, o.y - o.r * 0.3, o.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCrater(o) {
    ctx.fillStyle = C.crater;
    ctx.strokeStyle = C.craterRim;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(110, 60, 30, 0.25)";
    ctx.beginPath();
    ctx.arc(o.x + o.r * 0.15, o.y + o.r * 0.15, o.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWall(o) {
    ctx.fillStyle = o.fill ? C.wallFill : C.wall;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    if (o.fill) {
      ctx.strokeStyle = "rgba(90, 50, 30, 0.25)";
      ctx.lineWidth = 1.5;
      for (let k = 12; k < o.w + o.h; k += 18) line(o.x + Math.max(0, k - o.h), o.y + Math.min(k, o.h), o.x + Math.min(k, o.w), o.y + Math.max(0, k - o.w));
    }
  }

  function drawTarget(t) {
    ctx.fillStyle = t.done ? "rgba(31, 122, 58, 0.18)" : "rgba(26, 95, 200, 0.14)";
    ctx.strokeStyle = t.done ? C.done : C.target;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // サンプル（青い石）
    if (!t.done) {
      ctx.fillStyle = C.target;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - 7);
      ctx.lineTo(t.x + 7, t.y);
      ctx.lineTo(t.x, t.y + 7);
      ctx.lineTo(t.x - 7, t.y);
      ctx.closePath();
      ctx.fill();
    }
    label(t.done ? "✓" : t.label || "", t.x, t.y - t.r - 5, t.done ? C.done : C.target);
  }

  function drawGoal(g, reached, ready, start) {
    ctx.fillStyle = reached ? "rgba(31, 122, 58, 0.22)" : "rgba(31, 122, 58, 0.10)";
    ctx.strokeStyle = C.goal;
    ctx.lineWidth = 2;
    ctx.setLineDash(ready || reached ? [] : [6, 5]);
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.strokeRect(g.x, g.y, g.w, g.h);
    ctx.setLineDash([]);
    // 旗
    const fx = g.x + g.w / 2;
    const fy = g.y + g.h / 2;
    ctx.strokeStyle = "#3b3b3b";
    ctx.lineWidth = 2;
    line(fx, fy + 12, fx, fy - 14);
    ctx.fillStyle = "#e0453a";
    ctx.beginPath();
    ctx.moveTo(fx, fy - 14);
    ctx.lineTo(fx + 14, fy - 9);
    ctx.lineTo(fx, fy - 4);
    ctx.closePath();
    ctx.fill();
    // ロボットが基地から出発するときは、名前がロボットにかくれないように枠の上に書く
    const startIn = start && start.x > g.x && start.x < g.x + g.w && start.y > g.y && start.y < g.y + g.h;
    label(reached ? "✓ " + (g.label || "ゴール") : g.label || "ゴール", fx, !startIn && g.y + g.h - 6 > fy + 26 ? fy + 28 : g.y - 5, C.goal);
  }

  function drawBeam(sim, s) {
    const [ox, oy] = mountPoint(sim.robot, s.fwd, s.side);
    const a = sim.robot.a + (s.dir * Math.PI) / 180;
    const d = Math.min(DIST_MAX, castRay(sim.field, ox, oy, a));
    const val = sim.sensors[s.name];
    const len = Math.min(d, val ?? d);
    ctx.fillStyle = C.beam;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, len, a - SPREAD, a + SPREAD);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.beamEdge;
    ctx.lineWidth = 1;
    line(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
    const tx = ox + Math.cos(a) * Math.min(len, 60) * 0.6;
    const ty = oy + Math.sin(a) * Math.min(len, 60) * 0.6;
    if (val != null) label(`${val}`, tx, ty - 4, "#1a3f80");
  }

  function drawRobot(sim) {
    const r = sim.robot;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.a);
    // 車輪（クローラー）。回っているほうは色を付ける
    const [wl, wr] = sim.wheels;
    for (const [side, w] of [[-1, wl], [1, wr]]) {
      ctx.fillStyle = w ? C.wheelOn : C.wheel;
      const y = side * (BODY_W / 2 - 1);
      ctx.fillRect(-BODY_L / 2, y - 4, BODY_L, 8);
      if (w) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(w > 0 ? "▶" : "◀", 0, y + 3);
      }
    }
    ctx.fillStyle = sim.crash ? "#f6d4d1" : C.body;
    ctx.strokeStyle = C.bodyEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-BODY_L / 2 + 3, -BODY_W / 2 + 5, BODY_L - 6, BODY_W - 10, 4) : ctx.rect(-BODY_L / 2 + 3, -BODY_W / 2 + 5, BODY_L - 6, BODY_W - 10);
    ctx.fill();
    ctx.stroke();
    // 前の印
    ctx.fillStyle = C.bodyEdge;
    ctx.beginPath();
    ctx.moveTo(BODY_L / 2 - 4, 0);
    ctx.lineTo(BODY_L / 2 - 11, -5);
    ctx.lineTo(BODY_L / 2 - 11, 5);
    ctx.closePath();
    ctx.fill();
    // センサ
    for (const s of sim.sensorList) {
      if (s.kind === "dist") {
        ctx.save();
        ctx.translate(s.fwd, s.side);
        ctx.rotate((s.dir * Math.PI) / 180);
        ctx.fillStyle = "#1a5fc8";
        ctx.fillRect(-3, -5, 5, 10);
        ctx.restore();
      } else {
        const on = sim.sensors[s.name];
        ctx.fillStyle = on ? "#1baf7a" : "#ffffff";
        ctx.strokeStyle = "#1b1b1a";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(s.fwd, s.side, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  return { draw };
}
