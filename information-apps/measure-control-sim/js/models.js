// 仮想世界のモデル: センサの値の作り方、出力（アクチュエータ）による変化、絵（SVG）
// どのモデルも DOM を使わない（自動テストで Node.js からも使うため）

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : Number(v) || 0);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const r1 = (v) => Math.round(v * 10) / 10;

// 出力の種類ごとの値のそろえ方
export const OUTPUT_KINDS = {
  led: { choices: ["オン", "オフ"], fix: (v) => (num(v) ? 1 : 0), show: (v) => (v ? "オン" : "オフ") },
  buzzer: { choices: ["オン", "オフ"], fix: (v) => (num(v) ? 1 : 0), show: (v) => (v ? "オン（鳴る）" : "オフ") },
  door: { choices: ["開く", "閉じる", "止める"], fix: (v) => Math.sign(num(v)), show: (v) => (v > 0 ? "開く" : v < 0 ? "閉じる" : "止める") },
  motor: { range: [-100, 100], fix: (v) => clamp(Math.round(num(v)), -100, 100), show: (v) => `${v}（${v > 0 ? "正転" : v < 0 ? "逆転" : "停止"}）` },
  servo: { range: [0, 180], fix: (v) => clamp(Math.round(num(v)), 0, 180), show: (v) => `${v}°` },
  display: { fix: (v) => (typeof v === "number" ? Math.round(v * 100) / 100 : String(v).slice(0, 16)), show: (v) => (v === "" ? "（空）" : String(v)) },
};

// テキストで、出力の種類に合わない言葉を入れたときの注意（例: ドア = オフ → 「止める」と同じで、ドアは閉まらない）
// program: プログラムの木 / device: 場面の装置。返り値: [{ line, message }]
export function outputWordWarnings(program, device) {
  const out = [];
  const walk = (list) => {
    for (const n of list) {
      if (n.type === "assign" && n.value?.type === "name") {
        const o = device.outputs.find((x) => x.name === n.name);
        const kind = o && OUTPUT_KINDS[o.kind];
        const w = n.value.name;
        if (kind?.choices && ["オン", "オフ", "開く", "閉じる", "止める"].includes(w) && !kind.choices.includes(w)) {
          const same = o.kind === "door" ? (w === "オン" ? "開く" : "止める") : w === "開く" ? "オン" : "オフ";
          const extra = o.kind === "door" && w !== "オン" ? "ドアは閉まりません。" : "";
          out.push({ line: n.line, message: `${n.line ? `${n.line}行目: ` : ""}「${n.name}」には「${kind.choices.join("」「")}」を使おう（「${w}」は「${same}」と同じ意味になります。${extra}）` });
        }
      }
      for (const k of ["body", "then", "else"]) if (Array.isArray(n[k])) walk(n[k]);
    }
  };
  walk(program);
  return out;
}

export function initialOutputs(model) {
  return Object.fromEntries(model.device.outputs.map((o) => [o.name, o.kind === "display" ? "" : 0]));
}

// ---------------- 自動ドア ----------------
const door = {
  id: "door",
  device: {
    sensors: [{ name: "距離", unit: "cm", min: 0, max: 400, typical: 150, note: "ドアの上のセンサから人までの距離。だれもいないときは 400" }],
    outputs: [{ name: "ドア", kind: "door", note: "ドアを動かすモーター。開く / 閉じる / 止める（開ききる・閉まりきると自動で止まる）" }],
  },
  env: [{ name: "人の位置", unit: "cm", min: -400, max: 400, step: 10, default: 400, interp: "linear", note: "ドアからの位置（+ が外、- が店の中）。±400 はだれもいない" }],
  init: () => ({ open: 0 }),
  sensors: (env) => ({ 距離: Math.min(400, Math.round(Math.abs(env.人の位置))) }),
  step(state, out, env, dt) {
    state.open = clamp(state.open + out.ドア * 100 * dt, 0, 100); // 1秒で開ききる
  },
  derived(state, out, env) {
    const p = Math.abs(env.人の位置);
    return { ドアの開き: Math.round(state.open), ぶつかった: p < 30 && state.open < 80 ? 1 : 0 };
  },
  draw(state, out, env, sensors, derived) {
    const o = state.open / 100;
    const pos = env.人の位置;
    const show = Math.abs(pos) < 400;
    const py = 130 + pos * 0.27;
    const hit = derived.ぶつかった;
    const lp = 180 - 58 * o;
    const rp = 240 + 58 * o;
    const motion = out.ドア > 0 && o < 1 ? "開いている" : out.ドア < 0 && o > 0 ? "閉じている" : o >= 1 ? "開ききった" : o <= 0 ? "閉まっている" : "止まっている";
    return `<svg viewBox="0 0 480 260" role="img" aria-label="自動ドアを上から見た図。ドアの開き${Math.round(state.open)}%。${show ? `人までの距離${sensors.距離}cm` : "だれもいない"}">
  <rect width="480" height="260" fill="#f2efe6"/>
  <rect y="0" width="480" height="125" fill="#e4ecf4"/>
  <text x="14" y="24" font-size="14" fill="#3d4a5c" font-weight="700">店の中</text>
  <text x="14" y="248" font-size="14" fill="#5c5446" font-weight="700">外（歩道）</text>
  <path d="M120 135 A120 120 0 0 0 360 135" fill="#2a78d6" fill-opacity="0.06" stroke="#2a78d6" stroke-dasharray="4 4" stroke-opacity="0.5"/>
  <path d="M120 125 A120 120 0 0 1 360 125" fill="#2a78d6" fill-opacity="0.06" stroke="#2a78d6" stroke-dasharray="4 4" stroke-opacity="0.5"/>
  <rect x="${lp}" y="127" width="60" height="6" fill="#9fd0f2" stroke="#3d7fb8"/>
  <rect x="${rp}" y="127" width="60" height="6" fill="#9fd0f2" stroke="#3d7fb8"/>
  <rect x="0" y="122" width="180" height="16" fill="#8b8579"/>
  <rect x="300" y="122" width="180" height="16" fill="#8b8579"/>
  <rect x="232" y="121" width="16" height="18" rx="3" fill="#33363b"/>
  <circle cx="240" cy="130" r="3" fill="${show ? "#ff6b4a" : "#7a7f87"}"/>
  ${show ? `<line x1="240" y1="130" x2="240" y2="${py}" stroke="#ff6b4a" stroke-width="2" stroke-dasharray="3 3"/>
  <g transform="translate(240 ${py})">
    <ellipse rx="20" ry="10" fill="${hit ? "#d93a2f" : "#e58a3a"}"/>
    <circle r="9" fill="#5a3b28"/>
    ${hit ? `<circle r="26" fill="none" stroke="#d93a2f" stroke-width="3"/>` : ""}
  </g>
  <text x="${pos > 0 ? 250 : 250}" y="${(130 + py) / 2 + 5}" font-size="13" fill="#b33a22" font-weight="700">${sensors.距離} cm</text>` : ""}
  ${hit ? `<text x="320" y="${py + 5}" font-size="18" font-weight="800" fill="#d93a2f">ぶつかる！</text>` : ""}
  <g font-size="12" fill="#33363b">
    <text x="14" y="114">ドア: ${motion}（開き ${Math.round(state.open)}%）</text>
    <text x="14" y="156">● 距離センサ（ドアの上）</text>
  </g>
</svg>`;
  },
};

// ---------------- 街灯 ----------------
function mix(a, b, t) {
  const pa = a.match(/\w\w/g).map((x) => parseInt(x, 16));
  const pb = b.match(/\w\w/g).map((x) => parseInt(x, 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

const streetlight = {
  id: "streetlight",
  device: {
    sensors: [{ name: "明るさ", unit: "", min: 0, max: 100, typical: 30, note: "まわりの明るさ。明るさセンサの電気信号を、インタフェースで 0〜100 の数にした値（0=真っ暗、100=昼の明るさ）" }],
    outputs: [{ name: "街灯", kind: "led", note: "街灯のLED。オン / オフ" }],
  },
  env: [
    { name: "明るさ", unit: "", min: 0, max: 100, step: 1, default: 80, interp: "linear", note: "空の明るさ" },
    { name: "車", unit: "", min: 0, max: 1, step: 1, default: 0, interp: "step", hidden: true },
  ],
  init: () => ({ carX: -120 }),
  sensors: (env) => ({ 明るさ: Math.round(env.明るさ) }),
  step(state, out, env, dt) {
    if (env.車) state.carX = Math.min(state.carX + 200 * dt, 560);
    else state.carX = -120;
  },
  derived: () => ({}),
  draw(state, out, env, sensors) {
    const b = clamp(env.明るさ / 100, 0, 1);
    const sky = mix("0b1530", "8fd0f7", Math.min(1, b * 1.15));
    const ground = mix("1d2a1c", "77a85a", b);
    const on = out.街灯;
    const sunY = 150 - b * 110;
    const stars = b < 0.35 ? [[40, 30], [90, 60], [150, 25], [200, 70], [260, 40], [420, 30], [455, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff" opacity="${1 - b * 2.5}"/>`).join("") : "";
    const car = env.車 ? `<g transform="translate(${state.carX} 214)"><polygon points="${state.carX > 0 ? "70,8 260,-30 260,40" : "70,8 70,8 70,8"}" fill="#fff6b0" opacity="0.55"/><rect x="0" y="-6" width="72" height="22" rx="6" fill="#c6463b"/><rect x="14" y="-18" width="38" height="14" rx="4" fill="#c6463b"/><circle cx="16" cy="18" r="6" fill="#222"/><circle cx="56" cy="18" r="6" fill="#222"/><circle cx="70" cy="4" r="4" fill="#fff8c4"/></g>` : "";
    return `<svg viewBox="0 0 480 260" role="img" aria-label="街灯の図。明るさ${sensors.明るさ}。街灯は${on ? "ついている" : "消えている"}">
  <rect width="480" height="260" fill="${sky}"/>
  ${stars}
  ${b >= 0.3 ? `<circle cx="90" cy="${sunY}" r="22" fill="#ffd34d" opacity="${Math.min(1, (b - 0.3) * 3)}"/>` : `<circle cx="400" cy="50" r="16" fill="#f4f1d0"/><circle cx="408" cy="45" r="14" fill="${sky}"/>`}
  <rect x="20" y="130" width="80" height="70" fill="${mix("2a2a36", "d9c7a8", b)}"/><polygon points="14,132 60,100 106,132" fill="${mix("3a2525", "b55a45", b)}"/>
  <rect x="44" y="150" width="18" height="18" fill="${b < 0.4 ? "#ffd27a" : "#9cc7e8"}"/>
  <rect x="160" y="140" width="70" height="60" fill="${mix("2a2a36", "c9d3dc", b)}"/><polygon points="154,142 195,112 236,142" fill="${mix("252a3a", "5b6f8f", b)}"/>
  <rect x="0" y="200" width="480" height="60" fill="${ground}"/>
  <rect x="0" y="212" width="480" height="30" fill="${mix("1b1b1f", "6f6f72", b)}"/>
  ${on ? `<polygon points="330,62 270,236 430,236" fill="#ffe680" opacity="0.38"/>` : ""}
  <rect x="356" y="56" width="6" height="180" fill="#5d636b"/>
  <path d="M359 60 Q359 46 340 46 L328 46" stroke="#5d636b" stroke-width="6" fill="none"/>
  <rect x="312" y="44" width="36" height="14" rx="5" fill="${on ? "#ffe680" : "#9aa0a6"}" stroke="#4b5056"/>
  ${on ? `<circle cx="330" cy="58" r="16" fill="#fff3b0" opacity="0.5"/>` : ""}
  <rect x="362" y="100" width="16" height="12" rx="3" fill="#33363b"/><circle cx="370" cy="106" r="3" fill="#7fd0ff"/>
  <text x="384" y="110" font-size="12" fill="${b < 0.5 ? "#e8eef7" : "#1d2a3a"}">明るさセンサ</text>
  ${car}
  <g font-size="13" font-weight="700" fill="${b < 0.5 ? "#e8eef7" : "#1d2a3a"}"><text x="16" y="24">明るさ ${sensors.明るさ}</text><text x="16" y="44">街灯 ${on ? "オン" : "オフ"}</text></g>
</svg>`;
  },
};

// ---------------- 信号機（時間式・押しボタン式） ----------------
const CAR = ["車の青", "車の黄", "車の赤"];
const PED = ["歩行者の青", "歩行者の赤"];
function lightName(out, names) {
  const on = names.filter((n) => out[n]);
  if (on.length === 0) return "消灯";
  if (on.length > 1) return "2つ以上ついている";
  return on[0].replace(/^.*の/, "");
}

// 横断歩道の上に歩行者がいて、車も横断歩道に入っているとき（絵の「危ない！」とテストで同じ条件を使う）
function isDanger(state) {
  return state.pedY < 232 && state.pedY > 160 && state.carX + 56 > 222 && state.carX < 262;
}

function trafficModel(withButton) {
  return {
    id: withButton ? "traffic-button" : "traffic",
    device: {
      sensors: withButton ? [{ name: "ボタン", unit: "", min: 0, max: 1, note: "歩行者用の押しボタン（押している間 1 = オン）" }] : [],
      outputs: [
        ...CAR.map((n) => ({ name: n, kind: "led", note: "車用の信号のランプ" })),
        ...PED.map((n) => ({ name: n, kind: "led", note: "歩行者用の信号のランプ" })),
      ],
    },
    env: withButton ? [{ name: "ボタン", unit: "", min: 0, max: 1, step: 1, default: 0, interp: "step", button: true, note: "押しボタン" }] : [],
    init: () => ({ carX: -40, pedY: 252, carWait: 0 }),
    sensors: (env) => (withButton ? { ボタン: env.ボタン ? 1 : 0 } : {}),
    step(state, out, env, dt) {
      const green = lightName(out, CAR) === "青";
      const front = state.carX + 56;
      const next = state.carX + 140 * dt;
      if (!green && front <= 196 && next + 56 > 196) state.carX = 196 - 56;
      else state.carX = next > 520 ? -80 : next;
      const walk = lightName(out, PED) === "青";
      if (state.pedY < 252 || walk) state.pedY -= 40 * dt;
      if (state.pedY < 138) state.pedY = 252;
    },
    derived(state, out) {
      const car = lightName(out, CAR);
      const ped = lightName(out, PED);
      // 交差点の状態（テストで「車が黄 → 全赤 → 歩行者が青 → 全赤 → 車が青」の順を確かめる）
      const phase = ped === "青" ? "歩行者が青" : car === "青" ? "車が青" : car === "黄" ? "車が黄" : car === "赤" && ped === "赤" ? "全赤" : "そのほか";
      // 危ない: 横断歩道に歩行者がいるのに、車が横断歩道に入っている（絵の「危ない！」と同じ条件）
      return { 車信号: car, 歩行者信号: ped, 交差点: phase, 危ない: isDanger(state) ? 1 : 0 };
    },
    draw(state, out, env, sensors, derived) {
      const lamp = (cx, cy, on, color) => `<circle cx="${cx}" cy="${cy}" r="11" fill="${on ? color : "#3a3d42"}" stroke="#15171a" stroke-width="2"/>${on ? `<circle cx="${cx}" cy="${cy}" r="16" fill="${color}" opacity="0.25"/>` : ""}`;
      const danger = isDanger(state);
      const stripes = Array.from({ length: 6 }, (_, i) => `<rect x="222" y="${168 + i * 11}" width="40" height="6" fill="#f2f2f2"/>`).join("");
      return `<svg viewBox="0 0 480 260" role="img" aria-label="交差点の図。車の信号は${derived.車信号}、歩行者の信号は${derived.歩行者信号}">
  <rect width="480" height="260" fill="#cfe7f7"/>
  <rect y="140" width="480" height="24" fill="#c9c2b4"/>
  <rect y="164" width="480" height="70" fill="#55585e"/>
  <rect y="234" width="480" height="26" fill="#c9c2b4"/>
  ${stripes}
  <rect x="196" y="166" width="4" height="66" fill="#f2f2f2"/>
  <rect x="96" y="40" width="6" height="124" fill="#6b7078"/>
  <rect x="56" y="22" width="96" height="32" rx="8" fill="#26292e"/>
  ${lamp(76, 38, out.車の青, "#19c37d")}${lamp(104, 38, out.車の黄, "#ffbf1f")}${lamp(132, 38, out.車の赤, "#ff3b30")}
  <text x="56" y="70" font-size="12" fill="#1d2a3a">車用</text>
  <rect x="318" y="40" width="6" height="124" fill="#6b7078"/>
  <rect x="330" y="18" width="40" height="70" rx="6" fill="#26292e"/>
  ${lamp(350, 38, out.歩行者の赤, "#ff3b30")}${lamp(350, 68, out.歩行者の青, "#19c37d")}
  <text x="378" y="42" font-size="12" fill="#1d2a3a">止まれ</text><text x="378" y="72" font-size="12" fill="#1d2a3a">進め</text>
  ${withButton ? `<rect x="324" y="100" width="34" height="30" rx="4" fill="#f3d23b" stroke="#6b5a00"/><circle cx="341" cy="115" r="8" fill="${sensors.ボタン ? "#ff8a3d" : "#c9a400"}" stroke="#6b5a00"/><text x="364" y="120" font-size="11" fill="#1d2a3a">押しボタン</text>` : ""}
  <g transform="translate(${state.carX} 186)"><rect x="0" y="0" width="56" height="26" rx="6" fill="#2a78d6"/><rect x="10" y="-10" width="30" height="12" rx="4" fill="#2a78d6"/><circle cx="12" cy="26" r="5" fill="#111"/><circle cx="44" cy="26" r="5" fill="#111"/></g>
  <g transform="translate(242 ${state.pedY})"><circle cy="-14" r="6" fill="#5a3b28"/><rect x="-6" y="-8" width="12" height="16" rx="4" fill="#e58a3a"/></g>
  ${danger ? `<text x="270" y="158" font-size="18" font-weight="800" fill="#d93a2f">危ない！</text>` : ""}
</svg>`;
    },
  };
}

// ---------------- 自由に作る（仮想マイコン） ----------------
const sandbox = {
  id: "sandbox",
  device: {
    sensors: [
      { name: "明るさ", unit: "", min: 0, max: 100, typical: 30, note: "光センサ（0〜100）" },
      { name: "温度", unit: "℃", min: -10, max: 50, typical: 28, note: "温度センサ" },
      { name: "距離", unit: "cm", min: 0, max: 400, typical: 100, note: "距離センサ（超音波）" },
      { name: "ボタン", unit: "", min: 0, max: 1, note: "押しボタン（押している間 1）" },
      { name: "人感", unit: "", min: 0, max: 1, note: "人感センサ（人が動くと 1）" },
    ],
    outputs: [
      { name: "LED", kind: "led", note: "LED。オン / オフ" },
      { name: "ブザー", kind: "buzzer", note: "ブザー。オン / オフ" },
      { name: "モーター", kind: "motor", note: "モーターの速さ（-100〜100。マイナスは逆回転）" },
      { name: "サーボ", kind: "servo", note: "サーボモーターの角度（0〜180°）" },
      { name: "表示", kind: "display", note: "文字の表示（16文字まで）" },
    ],
  },
  env: [
    { name: "明るさ", unit: "", min: 0, max: 100, step: 1, default: 60, interp: "linear" },
    { name: "温度", unit: "℃", min: -10, max: 50, step: 1, default: 22, interp: "linear" },
    { name: "距離", unit: "cm", min: 0, max: 400, step: 5, default: 200, interp: "linear" },
    { name: "ボタン", unit: "", min: 0, max: 1, step: 1, default: 0, interp: "step", button: true },
    { name: "人感", unit: "", min: 0, max: 1, step: 1, default: 0, interp: "step", toggle: true },
  ],
  init: () => ({ fan: 0 }),
  sensors: (env) => ({ 明るさ: Math.round(env.明るさ), 温度: Math.round(env.温度), 距離: Math.round(env.距離), ボタン: env.ボタン ? 1 : 0, 人感: env.人感 ? 1 : 0 }),
  step(state, out, env, dt) {
    state.fan = (state.fan + out.モーター * 3.6 * dt + 360) % 360;
  },
  derived: () => ({}),
  draw(state, out, env, sensors) {
    const ang = (out.サーボ - 90) * (Math.PI / 180);
    const ax = 400 + Math.sin(ang) * 40;
    const ay = 190 - Math.cos(ang) * 40;
    const blades = [0, 120, 240].map((a) => `<ellipse cx="0" cy="-16" rx="7" ry="16" fill="#7fb0e0" transform="rotate(${a + state.fan})"/>`).join("");
    const label = (x, y, t) => `<text x="${x}" y="${y}" font-size="12" fill="#1d2a3a" text-anchor="middle">${t}</text>`;
    return `<svg viewBox="0 0 480 260" role="img" aria-label="仮想マイコンの図">
  <rect width="480" height="260" fill="#eef2ec"/>
  <rect x="150" y="70" width="180" height="120" rx="10" fill="#1f6b4a" stroke="#0e3d29" stroke-width="2"/>
  <rect x="210" y="105" width="60" height="50" rx="4" fill="#222"/>
  <text x="240" y="135" font-size="11" fill="#cfd" text-anchor="middle">マイコン</text>
  ${Array.from({ length: 8 }, (_, i) => `<rect x="${162 + i * 21}" y="176" width="8" height="10" fill="#d8b24a"/>`).join("")}
  <rect x="160" y="16" width="160" height="40" rx="6" fill="#1b2a1b" stroke="#0e3d29" stroke-width="2"/>
  <text x="240" y="43" font-size="18" fill="#9cff9c" text-anchor="middle" font-family="monospace">${esc(out.表示 === "" ? "" : out.表示)}</text>
  ${label(240, 70, "表示")}
  <circle cx="70" cy="60" r="18" fill="${out.LED ? "#ff4d3a" : "#5a2b27"}" stroke="#2b1210" stroke-width="2"/>
  ${out.LED ? `<circle cx="70" cy="60" r="28" fill="#ff4d3a" opacity="0.25"/>` : ""}
  ${label(70, 96, "LED")}
  <circle cx="70" cy="160" r="20" fill="#2b2b2b"/><circle cx="70" cy="160" r="6" fill="#555"/>
  ${out.ブザー ? `<path d="M96 146 q10 14 0 28 M106 138 q16 22 0 44" stroke="#2a78d6" stroke-width="3" fill="none"/>` : ""}
  ${label(70, 198, "ブザー")}
  <g transform="translate(400 60)"><circle r="24" fill="#d9e3ee"/>${blades}<circle r="5" fill="#334"/></g>
  ${label(400, 100, `モーター ${out.モーター}`)}
  <rect x="380" y="186" width="40" height="22" rx="4" fill="#2a78d6"/>
  <line x1="400" y1="190" x2="${r1(ax)}" y2="${r1(ay)}" stroke="#eb6834" stroke-width="8" stroke-linecap="round"/>
  ${label(400, 228, `サーボ ${out.サーボ}°`)}
  <g font-size="12" fill="#1d2a3a">
    <text x="150" y="214">明るさ ${sensors.明るさ}　温度 ${sensors.温度}℃　距離 ${sensors.距離}cm</text>
    <text x="150" y="232">ボタン ${sensors.ボタン ? "オン" : "オフ"}　人感 ${sensors.人感 ? "オン" : "オフ"}</text>
  </g>
</svg>`;
  },
};

export const MODELS = { door, streetlight, traffic: trafficModel(false), "traffic-button": trafficModel(true), sandbox };
