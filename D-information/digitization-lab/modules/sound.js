// モジュール2: 音のデジタル化（標本化・量子化を見る、聞きくらべる、データ量）
import { h, explainCard, stepCard, reflectionBox, choiceQuiz, shuffled, toast } from "../js/ui.js";
import { audioBits, formatBits, unitSteps, quantize, pickAround } from "../js/digilib.js";

const ID = "sound";
const STEPS = [
  { id: "see", title: "標本化と量子化を見てみよう" },
  { id: "listen", title: "聞きくらべよう" },
  { id: "amount", title: "音のデータ量" },
  { id: "reflect", title: "ふりかえり" },
];
const RATES = [1000, 2000, 4000, 8000, 16000, 22050, 44100];
const DEPTHS = [2, 3, 4, 6, 8, 16];
const fmt = (n) => n.toLocaleString("ja-JP");

function sliderField(id, label, values, initialIndex, fmtValue) {
  const input = h("input", { type: "range", id, min: "0", max: String(values.length - 1), value: String(initialIndex), step: "1" });
  const out = h("output", { for: id });
  const set = () => (out.textContent = fmtValue(values[Number(input.value)]));
  input.addEventListener("input", set);
  set();
  const setValue = (v) => {
    const i = values.indexOf(v);
    if (i >= 0) {
      input.value = String(i);
      set();
    }
  };
  return { el: h("div", { class: "field" }, h("label", { for: id }, label, "：", out), input), input, value: () => values[Number(input.value)], setValue };
}
const rateLabel = (r) => `${fmt(r)} Hz（1秒に${fmt(r)}回）`;
const depthLabel = (b) => `${b}ビット（${fmt(2 ** b)}段階）`;

// ---------- 音を作る ----------
// 音の材料: 周波数・強さ・始まる時刻・長さ（減衰）のある「成分」の集まり
const NOTE = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, C6: 1046.5 };
const MELODY = ["C5", "D5", "E5", "F5", "G5", "G5", "A5", "G5"];
function melodyPartials() {
  const parts = [];
  MELODY.forEach((n, k) => {
    for (let m = 1; m <= 16; m++) parts.push({ f: NOTE[n] * m, a: 0.5 / m, t0: k * 0.28, dur: 0.26, decay: 2 + m * 0.4 });
  });
  return { parts, length: MELODY.length * 0.28 + 0.2 };
}
function bellPartials() {
  const parts = [];
  for (const [t0, base] of [[0, 1], [0.7, 1.12]]) for (const [f, a] of [[1960, 0.5], [3720, 0.35], [5450, 0.3], [7900, 0.2], [10400, 0.15]]) parts.push({ f: f * base, a, t0, dur: 1.2, decay: 4 + f / 3000 });
  return { parts, length: 2 };
}
export const SOUNDS = {
  melody: { label: "メロディ（ドレミ）", make: melodyPartials },
  bell: { label: "鈴の音（高い音）", make: bellPartials },
};

// 標本化周波数 rate で波の高さをはかる。rate の半分以上の高い成分は記録できない（実際の機器でも取りのぞく）
function sampleAt(sound, rate) {
  const { parts, length } = sound;
  const n = Math.floor(length * rate);
  const out = new Float32Array(n);
  const usable = parts.filter((p) => p.f < rate / 2);
  for (const p of usable) {
    const s0 = Math.floor(p.t0 * rate);
    const s1 = Math.min(n, Math.floor((p.t0 + p.dur) * rate));
    for (let i = s0; i < s1; i++) {
      const t = i / rate - p.t0;
      const env = Math.min(1, t / 0.008) * Math.exp(-p.decay * t) * Math.min(1, (p.dur - t) / 0.02);
      out[i] += p.a * env * Math.sin(2 * Math.PI * p.f * t);
    }
  }
  return out;
}
function normalize(arr, peak = 0.9) {
  let m = 0;
  for (const v of arr) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < arr.length; i++) arr[i] = (arr[i] / m) * peak;
  return arr;
}
// -1〜1 の値を 2^bits 段階にする
function quantizeAll(arr, bits) {
  const levels = 2 ** bits;
  return arr.map((v) => quantize((v + 1) / 2, levels) * 2 - 1);
}
// ---------- 聞きくらべの図と説明（音を出せない教室でも、目で確かめられるように） ----------
// 音の成分の高さ（Hz）を、記録できるもの・できないものに分ける（sampleAt と同じ決まり: 標本化周波数の半分より低いものだけ）
export function splitByRate(sound, rate) {
  const limit = rate / 2;
  const uniq = (list) => [...new Set(list.map((p) => Math.round(p.f)))].sort((a, b) => a - b);
  return { limit, kept: uniq(sound.parts.filter((p) => p.f < limit)), lost: uniq(sound.parts.filter((p) => p.f >= limit)) };
}
// 今の設定で、どんな音になるか（何も記録できないときは、その理由）を短い文で返す
export function listenMessage(label, rate, bits, split) {
  const { limit, kept, lost } = split;
  const lines = [];
  if (!kept.length) {
    lines.push(`この設定（標本化周波数 ${fmt(rate)}Hz）で記録できるのは、${fmt(limit)}Hz より低い音だけです。${label}は、いちばん低い成分でも約${fmt(lost[0])}Hz なので、まったく記録できません。だから何も聞こえません（下の波も平らになります）。`);
  } else if (lost.length) {
    lines.push(`${fmt(limit)}Hz より高い成分（${lost.length}個）は記録できず、消えました。高い音がなくなるので、音がこもって聞こえます。`);
  } else {
    lines.push(`この音の成分は、すべて記録できます（${fmt(limit)}Hz より低い音まで記録できる）。`);
  }
  if (kept.length && bits <= 4) lines.push(`段階が${fmt(2 ** bits)}しかないので、波がガタガタになり、ザラザラした雑音がまじります。`);
  else if (kept.length && bits <= 6) lines.push(`段階が${fmt(2 ** bits)}なので、波が少しガタガタになり、小さな雑音がまじります。`);
  return { silent: !kept.length, lines };
}

// 成分の高さの図（横: 音の高さ 0〜20,000Hz、線の長さ: 成分の強さ）。記録できない成分は灰色の点線
function freqSvg(sound, rate) {
  const W = 360, H = 160, m = 12, FMAX = 20000, base = H - 34, top = 26;
  const x = (f) => m + (Math.min(f, FMAX) / FMAX) * (W - 2 * m);
  const amp = new Map();
  for (const p of sound.parts) amp.set(Math.round(p.f), Math.max(amp.get(Math.round(p.f)) || 0, p.a));
  const maxA = Math.max(...amp.values());
  const limit = rate / 2;
  let out = "";
  if (limit < FMAX) {
    out += `<rect x="${x(limit).toFixed(1)}" y="${top - 6}" width="${(W - m - x(limit)).toFixed(1)}" height="${base - top + 6}" fill="var(--surface-2)"/>`;
    out += `<line x1="${x(limit).toFixed(1)}" x2="${x(limit).toFixed(1)}" y1="${top - 6}" y2="${base}" stroke="var(--series-2)" stroke-width="2" stroke-dasharray="6 4"/>`;
    out += `<text x="${W - m}" y="${top - 10}" class="label-strong" text-anchor="end">${fmt(limit)}Hz より高い音は記録できない</text>`;
  } else {
    out += `<text x="${W - m}" y="${top - 10}" class="label-strong" text-anchor="end">${fmt(limit)}Hz より低い音は、すべて記録できる</text>`;
  }
  for (const [f, a] of amp) {
    if (f > FMAX) continue;
    const keep = f < limit;
    const y = base - Math.max(10, (a / maxA) * (base - top - 16));
    out += `<line x1="${x(f).toFixed(1)}" x2="${x(f).toFixed(1)}" y1="${base}" y2="${y.toFixed(1)}" stroke="${keep ? "var(--series-1)" : "var(--text-muted)"}" stroke-width="3"${keep ? "" : ' stroke-dasharray="3 3" opacity="0.7"'}/>`;
  }
  out += `<line x1="${m}" x2="${W - m}" y1="${base}" y2="${base}" stroke="var(--border)" stroke-width="1.5"/>`;
  for (const f of [0, 5000, 10000, 15000, 20000]) out += `<text x="${x(f).toFixed(1)}" y="${base + 15}" class="axis" text-anchor="${f === 0 ? "start" : f === FMAX ? "end" : "middle"}">${fmt(f)}Hz</text>`;
  out += `<text x="${W / 2}" y="${H - 2}" class="axis" text-anchor="middle">低い音 ←　音の高さ　→ 高い音</text>`;
  const sp = splitByRate(sound, rate);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="音の成分の高さ。${sp.kept.length}個を記録でき、${sp.lost.length}個は記録できない。">${out}</svg>`;
}

// 波の形の図（6ミリ秒分）。点線: もとの波、階段の線: 今の設定でデジタル化した波（再生する音と同じ作り方）
const WAVE_FROM = { melody: 0.03, bell: 0.02 };
const WAVE_LEN = 0.006;
function waveSvg(orig, origRate, dig, rate, bits, t0) {
  const W = 360, H = 160, m = 8;
  const x = (t) => m + ((t - t0) / WAVE_LEN) * (W - 2 * m);
  const y = (v) => H / 2 - v * (H / 2 - m);
  let o = "";
  const i0 = Math.floor(t0 * origRate), i1 = Math.floor((t0 + WAVE_LEN) * origRate);
  for (let i = i0; i <= i1; i++) o += `${i === i0 ? "M" : "L"}${x(i / origRate).toFixed(1)},${y(orig[i] ?? 0).toFixed(1)}`;
  const levels = 2 ** bits;
  const k0 = Math.ceil(t0 * rate), k1 = Math.floor((t0 + WAVE_LEN) * rate);
  let stair = "", dots = "";
  for (let k = k0; k <= k1; k++) {
    const v = quantize(((dig[k] ?? 0) + 1) / 2, levels) * 2 - 1;
    const tA = k / rate, tB = Math.min(t0 + WAVE_LEN, (k + 1) / rate);
    stair += `${k === k0 ? "M" : "L"}${x(tA).toFixed(1)},${y(v).toFixed(1)}L${x(tB).toFixed(1)},${y(v).toFixed(1)}`;
    if (k1 - k0 <= 60) dots += `<circle cx="${x(tA).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5" fill="var(--series-2)" stroke="var(--surface-1)" stroke-width="1.5"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="6ミリ秒分の波。もとの波（点線）と、${fmt(rate)}Hz・${fmt(levels)}段階でデジタル化した波（階段の線）。">
    <line x1="${m}" x2="${W - m}" y1="${H / 2}" y2="${H / 2}" stroke="var(--border)" stroke-width="1"/>
    <path d="${o}" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-dasharray="5 4"/>
    ${stair ? `<path d="${stair}" fill="none" stroke="var(--series-1)" stroke-width="2.5"/>` : ""}
    ${dots}
  </svg>`;
}

// 再生用に、スピーカーの標本化周波数まで点と点を直線でつなぐ
function resample(arr, fromRate, toRate) {
  const n = Math.floor((arr.length / fromRate) * toRate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * fromRate) / toRate;
    const k = Math.floor(x);
    const a = arr[k] ?? 0;
    const b = arr[k + 1] ?? a;
    out[i] = a + (b - a) * (x - k);
  }
  return out;
}
// 録音した音を rate に標本化する（区間の平均をとって、高い成分を弱めてから間引く）
function downsample(arr, fromRate, rate) {
  const n = Math.floor((arr.length / fromRate) * rate);
  const out = new Float32Array(n);
  const w = fromRate / rate;
  for (let i = 0; i < n; i++) {
    const s = Math.floor(i * w);
    const e = Math.max(s + 1, Math.floor((i + 1) * w));
    let sum = 0;
    for (let j = s; j < e && j < arr.length; j++) sum += arr[j];
    out[i] = sum / (e - s);
  }
  return out;
}

let audioCtx = null;
let playing = null;
function ctx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error("このブラウザでは音を鳴らせません");
  audioCtx ||= new Ctx();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function playSamples(samples, volume = 0.3) {
  const ac = ctx();
  playing?.stop();
  const buf = ac.createBuffer(1, Math.max(1, samples.length), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < samples.length; i++) data[i] = samples[i] * volume;
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.connect(ac.destination);
  src.start();
  playing = src;
  src.onended = () => playing === src && (playing = null);
}
// デジタル化した音を作って鳴らす（rate=null のときは、もとの音）
function digitizeAndPlay(sound, rate, bits) {
  const ac = ctx();
  if (!rate) return playSamples(normalize(sampleAt(sound, ac.sampleRate)));
  const sampled = normalize(sampleAt(sound, rate));
  playSamples(resample(quantizeAll(sampled, bits), rate, ac.sampleRate));
}

// ---------- マイク（発展。押したときだけ。録音は保存しない） ----------
let mic = null;
function stopMic() {
  if (!mic) return;
  mic.proc.disconnect();
  mic.source.disconnect();
  mic.stream.getTracks().forEach((t) => t.stop());
  clearTimeout(mic.timer);
  clearInterval(mic.tick);
  mic = null;
}

export const soundModule = {
  id: ID,
  minutes: "20分",
  lead: "音は空気のふるえ（波）です。デジタル化では、まず波の高さを一定の時間ごとにはかります（標本化）。次に、その高さを決まった段階の数にあてはめます（量子化）。最後に0と1にします（符号化）。はかる回数や段階の数を変えて、見て・聞いてくらべよう。",
  steps: STEPS,
  leave: stopMic,
  async render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));

    // ---------- ステップ1: 見る ----------
    {
      const c = cards[0];
      const rate = sliderField("snd-rate1", "標本化周波数（1秒に何回はかるか）", RATES, 3, rateLabel);
      const depth = sliderField("snd-depth1", "量子化ビット数（何段階で表すか）", DEPTHS, 1, depthLabel);
      const chart = h("div", { class: "chart" });
      const info = h("div", { class: "result-box", "aria-live": "polite" });
      const moved = new Set();
      const wave = (t) => 0.5 + 0.3 * Math.sin(2 * Math.PI * 1000 * t) + 0.15 * Math.sin(2 * Math.PI * 3000 * t + 0.6);
      const draw = () => {
        const r = rate.value(), b = depth.value();
        const W = 600, H = 230, m = 22;
        const T = 0.002; // 2ミリ秒
        const x = (t) => m + (t / T) * (W - 2 * m);
        const y = (v) => H - m - v * (H - 2 * m);
        let orig = "";
        for (let i = 0; i <= 300; i++) orig += `${i ? "L" : "M"}${x((i / 300) * T).toFixed(1)},${y(wave((i / 300) * T)).toFixed(1)}`;
        const levels = 2 ** b;
        const n = Math.floor(T * r);
        let stair = "", dots = "", codes = "";
        for (let k = 0; k <= n; k++) {
          const t = k / r;
          const v = quantize(wave(t), levels);
          const tNext = Math.min(T, (k + 1) / r);
          stair += `${k ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}L${x(tNext).toFixed(1)},${y(v).toFixed(1)}`;
          dots += `<circle cx="${x(t).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4" fill="var(--series-2)" stroke="var(--surface-1)" stroke-width="2"/>`;
          if (k < 8) codes += `${Math.round(v * (levels - 1)).toString(2).padStart(b, "0")} `;
        }
        const grid = levels <= 16 ? Array.from({ length: levels }, (_, i) => `<line x1="${m}" x2="${W - m}" y1="${y(i / (levels - 1)).toFixed(1)}" y2="${y(i / (levels - 1)).toFixed(1)}" stroke="var(--border)" stroke-width="1"/>`).join("") : "";
        chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="2ミリ秒分の音の波。もとの波（点線）を、${r}Hzではかり、${levels}段階で表したもの（階段状の線）。">
          ${grid}
          <path d="${orig}" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-dasharray="5 4"/>
          <path d="${stair}" fill="none" stroke="var(--series-1)" stroke-width="2.5"/>
          ${dots}
          <text x="${m}" y="14" class="axis">0ミリ秒</text><text x="${W - m}" y="14" class="axis" text-anchor="end">2ミリ秒</text>
        </svg>`;
        info.replaceChildren(
          h("div", {}, `2ミリ秒の間にはかる回数: ${(r * 2) % 1000 ? "約" : ""}${fmt(n)}回（${fmt(r)} × 0.002 ＝ ${fmt((r * 2) / 1000)}。図の点は、両はしをふくめて${fmt(n + 1)}個） ／ 高さは ${fmt(levels)}段階のどれかにあてはめる`),
          h("div", {}, "符号化（はじめの数回分）: ", h("span", { class: "mono" }, codes.trim() || "—")),
        );
      };
      const onMove = (k) => {
        moved.add(k);
        draw();
        if (moved.size >= 2) c.done();
      };
      rate.input.addEventListener("input", () => onMove("rate"));
      depth.input.addEventListener("input", () => onMove("depth"));
      c.body.append(
        h("ul", { class: "legend", "aria-hidden": "true" }, h("li", {}, h("span", { class: "sw", style: "background:var(--text-muted)" }), "もとの音の波（アナログ）"), h("li", {}, h("span", { class: "sw", style: "background:var(--series-1)" }), "デジタル化した波"), h("li", {}, h("span", { class: "sw", style: "background:var(--series-2);height:8px;width:8px;border-radius:50%" }), "はかった点（標本）")),
        chart,
        h("div", { class: "field-row" }, rate.el, depth.el),
        info,
        explainCard("見てみよう", "はかる回数を減らすと、細かい波の形が消えてしまいます。段階の数を減らすと、波が階段のようにガタガタになります。どちらも、もとの音から遠ざかります。"),
      );
      draw();
    }

    // ---------- ステップ2: 聞きくらべる ----------
    {
      const c = cards[1];
      let soundKey = "melody";
      const cache = {};
      const sound = () => (cache[soundKey] ||= SOUNDS[soundKey].make());
      const rate = sliderField("snd-rate2", "標本化周波数", RATES, 6, rateLabel);
      const depth = sliderField("snd-depth2", "量子化ビット数", DEPTHS, 5, depthLabel);
      const heard = new Set();
      const log = h("ul", { class: "listen-log" });
      const status = h("div", { class: "hint", "aria-live": "polite" });
      const tabs = h("div", { class: "scenario-tabs", role: "group", "aria-label": "音を選ぶ" });
      // 音を出せなくても学べるように: 今の設定で「残る音の高さ」と「波の形」を図で見せ、聞こえ方を文で伝える
      const sampledCache = {};
      const sampled = (r) => (sampledCache[`${soundKey}-${r}`] ||= normalize(sampleAt(sound(), r)));
      const ORIG_RATE = 48000;
      const sayBox = h("div", { class: "result-box listen-say", "aria-live": "polite" });
      const freqChart = h("div", { class: "chart" });
      const waveChart = h("div", { class: "chart" });
      const drawListen = () => {
        const r = rate.value(), b = depth.value();
        const msg = listenMessage(SOUNDS[soundKey].label, r, b, splitByRate(sound(), r));
        sayBox.classList.toggle("silent", msg.silent);
        sayBox.replaceChildren(h("div", {}, h("strong", {}, `${SOUNDS[soundKey].label}・${fmt(r)}Hz・${b}ビット：`), msg.silent ? "音が出ません" : "こう聞こえます"), ...msg.lines.map((t) => h("div", {}, t)));
        freqChart.innerHTML = freqSvg(sound(), r);
        waveChart.innerHTML = waveSvg(sampled(ORIG_RATE), ORIG_RATE, sampled(r), r, b, WAVE_FROM[soundKey]);
      };
      const setSound = (k) => {
        soundKey = k;
        for (const b of tabs.querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.key === k ? "true" : "false");
        drawListen();
      };
      for (const [k, s] of Object.entries(SOUNDS)) tabs.append(h("button", { type: "button", dataset: { key: k }, onclick: () => setSound(k) }, s.label));
      const play = (r, b) => {
        if (r) drawListen();
        try {
          digitizeAndPlay(sound(), r, b);
          status.textContent = "";
        } catch (e) {
          status.textContent = `${e.message}。下の図で、聞こえ方のちがいを確かめよう。`;
        }
        if (!r) return;
        const key = `${soundKey}-${r}-${b}`;
        if (!heard.has(key)) {
          heard.add(key);
          const silent = !splitByRate(sound(), r).kept.length;
          log.append(h("li", {}, `${SOUNDS[soundKey].label}：${fmt(r)}Hz・${b}ビット（1秒あたり ${formatBits(audioBits(r, b, 1))}）${silent ? "　→ 何も記録できない（音が出ない）" : ""}`));
        }
        quiz.update();
      };
      // クリアの条件: 3つ以上の設定をためして（聞くか図で見て）、気づいたことを選ぶ問題に正解する
      const quiz = (() => {
        const NEED = 3;
        const choices = [
          ["何も記録できず、音が出なかった（波が平らになった）", true],
          ["高い音のまま、少しザラザラした音になった", false],
          ["音が大きくなった", false],
        ];
        const gate = h("p", { class: "hint" });
        const fb = h("div", { "aria-live": "polite" });
        let solved = false;
        let lockedAt = -1; // まちがえたら、もう1つ設定をためすまで答えられない（当てずっぽうで押し続けないように）
        const buttons = shuffled(choices).map(([text, ok]) => {
          const btn = h("button", { type: "button" }, text);
          btn.addEventListener("click", () => {
            if (solved || heard.size < NEED || heard.size <= lockedAt) return;
            for (const x of buttons) x.classList.remove("wrong");
            if (ok) {
              solved = true;
              btn.classList.add("correct");
              fb.replaceChildren(explainCard("正解！", "標本化周波数 2,000Hz で記録できるのは、半分の 1,000Hz より低い音だけです。鈴の音の成分は、どれも約2,000Hz より高いです。だから何も残りませんでした。はかる回数が少ないと、高い音から消えていきます。", "good"));
              c.done();
            } else {
              btn.classList.add("wrong");
              lockedAt = heard.size;
              fb.replaceChildren(explainCard("もう一度", "「鈴の音」を選んで、「はかる回数がとても少ない」を押そう。上の図と説明を見てみよう。新しい設定をためすと、もう一度答えられます。", "warn"));
              update();
            }
          });
          return btn;
        });
        const update = () => {
          const left = Math.max(0, NEED - heard.size);
          const locked = heard.size <= lockedAt;
          for (const btn of buttons) btn.disabled = !solved && (left > 0 || locked);
          gate.textContent = solved ? "" : left > 0 ? `あと${left}つの設定をためすと、答えられます。「▶ この設定で聞く」か「おすすめ」を押そう。` : locked ? "新しい設定をためすと、もう一度答えられます。" : "答えを選ぼう。";
        };
        update();
        return {
          update,
          el: h("div", { class: "listen-quiz" }, h("p", {}, h("strong", {}, "問題：「鈴の音」を「はかる回数がとても少ない」（2,000Hz）にした。どうなった？")), gate, h("ul", { class: "choice-list" }, buttons.map((btn) => h("li", {}, btn))), fb),
        };
      })();
      rate.input.addEventListener("input", drawListen);
      depth.input.addEventListener("input", drawListen);
      const presets = [
        ["音楽CDくらい", 44100, 16],
        ["電話くらい", 8000, 8],
        ["はかる回数がとても少ない", 2000, 16],
        ["段階がとても少ない", 44100, 3],
      ];
      // 発展: マイク
      const micStatus = h("div", { class: "hint", "aria-live": "polite" });
      const micBtn = h("button", { class: "btn small secondary", type: "button" }, "🎙 3秒録音する");
      const micPlayOrig = h("button", { class: "btn small secondary", type: "button", disabled: true }, "録音をそのまま聞く");
      const micPlayDig = h("button", { class: "btn small secondary", type: "button", disabled: true }, "上の設定でデジタル化して聞く");
      let recorded = null; // この画面の中だけ。保存しない
      // 録音できなかったときの説明（Chromebook の Chrome を想定）
      const micErrorLines = (name) => {
        if (name === "NotFoundError" || name === "OverconstrainedError") {
          return [h("div", {}, "マイクが見つかりませんでした。録音しなくても、このステップはクリアできます。")];
        }
        return [
          h("div", {}, "マイクを使えませんでした。（「ブロック」を選んだか、マイクがありません）"),
          h("div", {}, "やり直し方：アドレスバーの左はしのマークを押して、「マイク」を「許可」にします。そのあと、ページを読みこみ直して、もう一度「3秒録音する」を押そう。分からないときは先生に聞こう。"),
          h("div", {}, "録音しなくても、このステップはクリアできます。"),
        ];
      };
      let micStarting = false; // 許可を待っているあいだに、もう一度押されても2つ目を始めない
      micBtn.addEventListener("click", async () => {
        if (mic || micStarting) return;
        if (!navigator.mediaDevices?.getUserMedia) {
          micStatus.textContent = "この端末・ブラウザではマイクを使えません。";
          return;
        }
        micStarting = true;
        try {
          const ac = ctx();
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // 許可を待っているあいだに、ほかのページへ移っていたら、すぐにマイクを止める
          if (!micBtn.isConnected) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          const source = ac.createMediaStreamSource(stream);
          const proc = ac.createScriptProcessor(4096, 1, 1);
          const chunks = [];
          proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
          source.connect(proc);
          proc.connect(ac.destination);
          micStatus.textContent = "録音中…あと3秒";
          mic = { stream, source, proc };
          let left = 3;
          const tick = setInterval(() => {
            left -= 1;
            if (left > 0 && mic) micStatus.textContent = `録音中…あと${left}秒`;
          }, 1000);
          mic.tick = tick;
          mic.timer = setTimeout(() => {
            stopMic();
            const len = chunks.reduce((a, ch) => a + ch.length, 0);
            recorded = new Float32Array(len);
            let o = 0;
            for (const ch of chunks) {
              recorded.set(ch, o);
              o += ch.length;
            }
            normalize(recorded, 0.9);
            micPlayOrig.disabled = micPlayDig.disabled = false;
            micStatus.textContent = "録音できました。マイクは止めました（録音はこのページを離れると消えます）。";
          }, 3000);
        } catch (err) {
          stopMic();
          micStatus.replaceChildren(...micErrorLines(err?.name));
        } finally {
          micStarting = false;
        }
      });
      micPlayOrig.addEventListener("click", () => recorded && playSamples(recorded, 0.8));
      micPlayDig.addEventListener("click", () => {
        if (!recorded) return;
        const ac = ctx();
        const r = rate.value();
        const d = quantizeAll(downsample(recorded, ac.sampleRate, r), depth.value());
        playSamples(resample(d, r, ac.sampleRate), 0.8);
      });

      c.body.append(
        h("p", {}, "音を選んで、設定を変えながら聞きくらべよう。下の図でも見くらべられます。3つ以上の設定をためしたら、いちばん下の問題に答えよう。正解でクリアです。"),
        explainCard("聞き方", "イヤホンをつけて自分の端末で聞くか、先生の画面でみんなでいっしょに聞きます。先生の指示にしたがおう。先生の画面で聞くときは、自分の端末は音を消して、同じ設定を選んで図を見よう。<br>🔊 音が出ます。はじめは音量を小さめにしておこう。"),
        tabs,
        h("div", { class: "btn-row" }, h("button", { class: "btn secondary", type: "button", onclick: () => play(null) }, "もとの音（アナログ）を聞く")),
        h("div", { class: "field-row" }, rate.el, depth.el),
        h("div", { class: "btn-row" }, h("button", { class: "btn", type: "button", onclick: () => play(rate.value(), depth.value()) }, "▶ この設定で聞く"), h("button", { class: "btn small secondary", type: "button", onclick: () => playing?.stop() }, "■ 止める")),
        h(
          "div",
          { class: "btn-row" },
          h("span", { class: "hint" }, "おすすめ："),
          ...presets.map(([label, r, b]) =>
            h("button", { class: "btn small secondary", type: "button", onclick: () => { rate.setValue(r); depth.setValue(b); play(r, b); } }, label),
          ),
        ),
        status,
        sayBox,
        h(
          "div",
          { class: "listen-charts" },
          h("figure", {}, h("figcaption", {}, "残る音の高さ（青い線は記録できる、灰色の点線は記録できない）"), freqChart),
          h("figure", {}, h("figcaption", {}, "波の形（点線: もとの音、青い階段: デジタル化した音）"), waveChart),
        ),
        h("div", { class: "hint" }, "ためした設定"),
        log,
        explainCard("聞こえ方のちがい", "はかる回数（標本化周波数）が少ないと、高い音の成分を記録できません。音がこもります。標本化周波数の半分より高い音は、記録できません。だから鈴の音のような高い音は消えます。段階の数（量子化ビット数）が少ないと、ザラザラした雑音がまじります。"),
        quiz.el,
        h(
          "details",
          { class: "advanced" },
          h("summary", {}, "発展：自分の声で試す（マイクを使う）"),
          explainCard("プライバシーの注意", "マイクは「録音する」を押したときだけ、3秒間使います。録音した声は保存も送信もせず、このページを離れると消えます。まわりの人の声が入らないようにしよう。", "warn"),
          h("p", { class: "hint" }, "はじめて押すと、ブラウザが「マイクを使ってもよいか」を聞いてきます。使うときは「許可」を押そう。録音しなくても、このステップはクリアできます。"),
          h("div", { class: "btn-row" }, micBtn, micPlayOrig, micPlayDig),
          micStatus,
        ),
      );
      setSound("melody");
    }

    // ---------- ステップ3: データ量 ----------
    {
      const c = cards[2];
      const rate = sliderField("snd-rate3", "標本化周波数", RATES, 6, (r) => `${fmt(r)} Hz`);
      const depth = sliderField("snd-depth3", "量子化ビット数", DEPTHS, 5, (b) => `${b}ビット`);
      const secs = sliderField("snd-sec", "時間", [1, 10, 60, 180, 600], 2, (s) => (s >= 60 ? `${s / 60}分` : `${s}秒`));
      const chs = sliderField("snd-ch", "チャンネル数", [1, 2], 1, (n) => (n === 2 ? "2（ステレオ）" : "1（モノラル）"));
      const info = h("div", { class: "result-box", "aria-live": "polite" });
      const update = () => {
        const r = rate.value(), b = depth.value(), s = secs.value(), ch = chs.value();
        const bits = audioBits(r, b, s, ch);
        info.replaceChildren(h("div", {}, "データ量: ", h("strong", { class: "big-number" }, formatBits(bits))), h("div", { class: "math-line" }, `${fmt(r)} × ${b} × ${s} × ${ch} ＝ ${unitSteps(bits).join("　")}`));
      };
      for (const s of [rate, depth, secs, chs]) s.input.addEventListener("input", update);
      const answered = new Set();
      const mark = (k) => {
        answered.add(k);
        if (answered.size >= 2) c.done();
      };
      c.body.append(
        explainCard("計算のしかた", "音のデータ量（ビット）＝ 標本化周波数 × 量子化ビット数 × 秒数 × チャンネル数<br>8ビット ＝ 1バイト、1024バイト ＝ 1KB、1024KB ＝ 1MB"),
        h("div", { class: "field-row" }, rate.el, depth.el, secs.el, chs.el),
        info,
        choiceQuiz({ question: "音楽CDと同じ設定（44,100Hz・16ビット・ステレオ）で1分間録音した。データ量は、およそいくら？", choices: ["約10MB", ...pickAround(["約1MB", "約100KB"], ["約100MB", "約1GB"])], answer: 0, explain: "44,100 × 16 × 60 × 2 ＝ 84,672,000ビット。これは 10,584,000バイトです。1024で2回わると約10MBです。" }, () => mark(1)),
        choiceQuiz({ question: "標本化周波数を2倍にすると、記録できる音とデータ量はどうなる？", choices: ["より高い音まで記録でき、データ量は2倍", "音は変わらず、データ量は2倍", "より高い音まで記録でき、データ量は変わらない"], answer: 0, explain: "1秒にはかる回数が2倍になるので、データ量も2倍。標本化周波数の半分までの高さの音を記録できるので、より高い音まで記録できます。" }, () => mark(2)),
      );
      update();
    }

    cards[3].body.append(reflectionBox(ID, "音質をよくするとデータ量が増えるのはなぜ？「標本化」「量子化」という言葉を使って書こう。", () => cards[3].done()));
    root.append(...cards.map((c) => c.el));
  },
};
