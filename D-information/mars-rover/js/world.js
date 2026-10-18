// 火星のフィールドとロボットのしくみ（DOM を使わない。テストからも使う）
// 長さの単位は cm、角度はラジアン。画面と同じく y は下向き（右に回ると向きの角度が増える）。

export const ROBOT_R = 15; // ぶつかりを調べるロボットの大きさ（半径）
export const BODY_L = 32; // 絵のロボットの長さ
export const BODY_W = 26; // 絵のロボットの幅
// 左右の車輪の間かく。ふつうの速さ（20cm/秒）で「その場で回る」と、1秒で90°回る
export const TRACK = 80 / Math.PI;
export const DIST_MAX = 300; // 距離センサがはかれるいちばん遠い距離（何もないときの値）
export const DIST_MIN = 2;
export const SPREAD = (8 * Math.PI) / 180; // 超音波は少し広がって進む（±8°）
export const LINE_W = 10; // 目印の線の太さ

// モーターの速さ（ロボットの設計でえらぶ）
export const SPEEDS = {
  slow: { label: "ゆっくり", v: 10, cost: 600 },
  normal: { label: "ふつう", v: 20, cost: 800 },
  fast: { label: "はやい", v: 30, cost: 1400 },
};

// 距離センサを付けられる場所。dir: ロボットの前から右回りの角度（度）、side: 横へのずれ、fwd: 前へのずれ
export const DIST_SLOTS = [
  { id: "front", name: "前の距離", short: "前", dir: 0, fwd: 15, side: 0 },
  { id: "frontLeft", name: "左前の距離", short: "左前", dir: -45, fwd: 13, side: -9 },
  { id: "frontRight", name: "右前の距離", short: "右前", dir: 45, fwd: 13, side: 9 },
  { id: "left", name: "左の距離", short: "左", dir: -90, fwd: 0, side: -13 },
  { id: "right", name: "右の距離", short: "右", dir: 90, fwd: 0, side: 13 },
];
// 色センサ（下向き。線の上なら 1）
export const COLOR_SETS = {
  0: [],
  1: [{ id: "c", name: "色", fwd: 11, side: 0 }],
  2: [
    { id: "cl", name: "左の色", fwd: 11, side: -7 },
    { id: "cr", name: "右の色", fwd: 11, side: 7 },
  ],
};
export const PART_COST = { body: 2000, dist: 400, color: 250 };
export const MAX_DIST_SENSORS = 3;

// 電池（%/秒）。モーターは速いほど多く使う。止まっていても、コンピュータとセンサは電気を使う
export const BATTERY = { base: 0.08, sensor: 0.02, wheel: (v) => 0.04 + 0.00025 * v * v };

export function designCost(design) {
  const sp = SPEEDS[design.speed] || SPEEDS.normal;
  return PART_COST.body + design.dist.length * PART_COST.dist + (Number(design.color) || 0) * PART_COST.color + sp.cost;
}

// 設計から、プログラムで使えるセンサの一覧を作る
export function sensorsOf(design) {
  const list = [];
  for (const id of design.dist) {
    const s = DIST_SLOTS.find((x) => x.id === id);
    if (s) list.push({ ...s, kind: "dist", unit: "cm", min: DIST_MIN, max: DIST_MAX });
  }
  for (const c of COLOR_SETS[Number(design.color) || 0]) list.push({ ...c, kind: "color", min: 0, max: 1 });
  return list;
}

// ---- 図形 ----
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

// ロボットに付いた部品（前へ fwd、右へ side）のフィールドでの位置
export function mountPoint(robot, fwd, side) {
  const [dx, dy] = rot(fwd, side, robot.a);
  return [robot.x + dx, robot.y + dy];
}

// 半直線（ox,oy から dx,dy の向き）と円のあたる距離（あたらなければ Infinity）
function rayCircle(ox, oy, dx, dy, cx, cy, r) {
  const fx = ox - cx;
  const fy = oy - cy;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const s = Math.sqrt(disc);
  const t1 = -b - s;
  if (t1 >= 0) return t1;
  const t2 = -b + s;
  return t2 >= 0 && c < 0 ? 0 : Infinity;
}

// 半直線と長方形（x,y,w,h）のあたる距離
function rayRect(ox, oy, dx, dy, rx, ry, rw, rh) {
  let tmin = -Infinity;
  let tmax = Infinity;
  for (const [o, d, lo, hi] of [
    [ox, dx, rx, rx + rw],
    [oy, dy, ry, ry + rh],
  ]) {
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return Infinity;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  if (tmax < 0) return Infinity;
  return Math.max(0, tmin);
}

// フィールドのふち（崖）までの距離（中から外へ）
function rayBounds(ox, oy, dx, dy, W, H) {
  let t = Infinity;
  if (dx > 1e-12) t = Math.min(t, (W - ox) / dx);
  if (dx < -1e-12) t = Math.min(t, -ox / dx);
  if (dy > 1e-12) t = Math.min(t, (H - oy) / dy);
  if (dy < -1e-12) t = Math.min(t, -oy / dy);
  return Math.max(0, t);
}

// 1本の線でいちばん近いものまでの距離
export function castRay(field, ox, oy, ang) {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  let t = rayBounds(ox, oy, dx, dy, field.W, field.H);
  for (const o of field.obstacles) {
    const d = o.type === "wall" ? rayRect(ox, oy, dx, dy, o.x, o.y, o.w, o.h) : rayCircle(ox, oy, dx, dy, o.x, o.y, o.r);
    if (d < t) t = d;
  }
  return t;
}

// 距離センサの値（cm、整数）。3本の線（まん中と ±8°）のいちばん近いもの
export function readDistance(field, robot, slot) {
  const [ox, oy] = mountPoint(robot, slot.fwd, slot.side);
  const a = robot.a + (slot.dir * Math.PI) / 180;
  let t = Infinity;
  for (const k of [-1, 0, 1]) t = Math.min(t, castRay(field, ox, oy, a + k * SPREAD));
  return Math.max(DIST_MIN, Math.min(DIST_MAX, Math.round(t)));
}

// 点から折れ線までの距離
export function distToPolyline(px, py, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    const vx = x2 - x1;
    const vy = y2 - y1;
    const L = vx * vx + vy * vy;
    let u = L ? ((px - x1) * vx + (py - y1) * vy) / L : 0;
    u = Math.max(0, Math.min(1, u));
    const qx = x1 + u * vx - px;
    const qy = y1 + u * vy - py;
    best = Math.min(best, Math.hypot(qx, qy));
  }
  return best;
}

export function readColor(field, robot, c) {
  if (!field.lines?.length) return 0;
  const [px, py] = mountPoint(robot, c.fwd, c.side);
  return field.lines.some((ln) => distToPolyline(px, py, ln) <= LINE_W / 2) ? 1 : 0;
}

// いまのセンサの値をまとめて読む
export function readSensors(field, robot, sensors) {
  const out = {};
  for (const s of sensors) out[s.name] = s.kind === "dist" ? readDistance(field, robot, s) : readColor(field, robot, s);
  return out;
}

// ロボットが何かにぶつかっているか。ぶつかっていれば、そのものを返す
export function collision(field, x, y) {
  const R = ROBOT_R;
  if (x < R || y < R || x > field.W - R || y > field.H - R) return { type: "edge" };
  for (const o of field.obstacles) {
    if (o.type === "wall") {
      const cx = Math.max(o.x, Math.min(x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(y, o.y + o.h));
      if (Math.hypot(x - cx, y - cy) < R) return o;
    } else if (Math.hypot(x - o.x, y - o.y) < R + o.r) return o;
  }
  return null;
}

// 左右の車輪の向き（1 前・0 止まる・-1 後ろ）から、dt 秒ぶん動かす（こまかく分けて、ぶつかりも調べる）
export function moveRobot(field, robot, wl, wr, v, dt) {
  const n = 5;
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const vl = wl * v;
    const vr = wr * v;
    const fwd = (vl + vr) / 2;
    const w = (vl - vr) / TRACK; // 左が速いと右に回る
    const a2 = robot.a + w * h;
    const am = robot.a + (w * h) / 2;
    const nx = robot.x + Math.cos(am) * fwd * h;
    const ny = robot.y + Math.sin(am) * fwd * h;
    const hit = collision(field, nx, ny);
    robot.a = a2;
    if (hit) return hit;
    robot.dist += Math.hypot(nx - robot.x, ny - robot.y);
    robot.x = nx;
    robot.y = ny;
  }
  return null;
}

export function normAngle(a) {
  const t = a % (2 * Math.PI);
  return t < 0 ? t + 2 * Math.PI : t;
}

// ---- フィールドを作る道具 ----

// 100cm のます目の道（一本道の谷）から、まわりの岩壁を作る。path: [[列, 行], ...]
export function mazeWalls(cols, rows, path, cell = 100, thick = 10) {
  const key = (c, r) => `${c},${r}`;
  const onPath = new Set(path.map(([c, r]) => key(c, r)));
  const link = new Set();
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]];
    link.add(`${key(...a)}|${key(...b)}`);
    link.add(`${key(...b)}|${key(...a)}`);
  }
  const open = (a, b) => link.has(`${key(...a)}|${key(...b)}`);
  const walls = [];
  const half = thick / 2;
  // たての壁（列と列のあいだ）
  for (let c = 1; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const L = [c - 1, r];
      const Rr = [c, r];
      if ((onPath.has(key(...L)) || onPath.has(key(...Rr))) && !open(L, Rr)) walls.push({ type: "wall", x: c * cell - half, y: r * cell - half, w: thick, h: cell + thick });
    }
  }
  // 横の壁（行と行のあいだ）
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const U = [c, r - 1];
      const D = [c, r];
      if ((onPath.has(key(...U)) || onPath.has(key(...D))) && !open(U, D)) walls.push({ type: "wall", x: c * cell - half, y: r * cell - half, w: cell + thick, h: thick });
    }
  }
  // 道でないますは、岩でうめる
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (!onPath.has(key(c, r))) walls.push({ type: "wall", x: c * cell, y: r * cell, w: cell, h: cell, fill: true });
  return walls;
}

// なめらかな線（点をつないで、あいだを細かくする）
export function smoothLine(points, steps = 8) {
  const out = [];
  const P = (i) => points[Math.max(0, Math.min(points.length - 1, i))];
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points.at(-1));
  return out;
}
