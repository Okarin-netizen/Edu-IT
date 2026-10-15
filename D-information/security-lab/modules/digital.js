// モジュール11: 情報のデジタル化と情報量（画像の解像度・階調、音の標本化・量子化、圧縮）
import { h, explainCard, stepCard, reflectionBox, choiceQuiz } from "../js/ui.js";
import { imageBits, audioBits, formatBits, quantize, rle, log2 } from "../js/digitallib.js";

const ID = "digital";
const STEPS = [
  { id: "resolution", title: "解像度：画素の数を変えてみよう" },
  { id: "tone", title: "階調：色の段階の数を変えてみよう" },
  { id: "sound", title: "音のデジタル化（標本化・量子化・符号化）" },
  { id: "compress", title: "圧縮：データを小さくするしくみ" },
  { id: "calc", title: "データ量を計算しよう" },
  { id: "reflect", title: "ふりかえり" },
];
const RESOLUTIONS = [8, 16, 32, 64, 128, 256];
const LEVELS = [2, 4, 8, 16, 64, 256];
const RATES = [4000, 8000, 16000, 44100];
const DEPTHS = [2, 3, 4, 8, 16];
const SRC = 256;

// 元の画像（なめらかな色の変化がある風景）を作る
let srcPixels = null;
function sourcePixels() {
  if (srcPixels) return srcPixels;
  const c = document.createElement("canvas");
  c.width = c.height = SRC;
  const g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 170);
  sky.addColorStop(0, "#2f7fd6");
  sky.addColorStop(1, "#fbd9b0");
  g.fillStyle = sky;
  g.fillRect(0, 0, SRC, SRC);
  const sun = g.createRadialGradient(185, 70, 4, 185, 70, 38);
  sun.addColorStop(0, "#fff7c2");
  sun.addColorStop(1, "rgba(255,190,70,0)");
  g.fillStyle = sun;
  g.fillRect(140, 25, 90, 90);
  const mt = g.createLinearGradient(0, 110, 0, 256);
  mt.addColorStop(0, "#5e9c5a");
  mt.addColorStop(1, "#1e4a2a");
  g.fillStyle = mt;
  g.beginPath();
  g.moveTo(0, 190);
  g.lineTo(70, 105);
  g.lineTo(125, 160);
  g.lineTo(175, 120);
  g.lineTo(256, 185);
  g.lineTo(256, 256);
  g.lineTo(0, 256);
  g.fill();
  g.fillStyle = "#c94f3d";
  g.beginPath();
  g.moveTo(40, 200);
  g.lineTo(70, 176);
  g.lineTo(100, 200);
  g.fill();
  g.fillStyle = "#f2efe6";
  g.fillRect(48, 200, 44, 34);
  g.fillStyle = "#3d6fa8";
  g.fillRect(58, 208, 12, 12);
  srcPixels = g.getImageData(0, 0, SRC, SRC).data;
  return srcPixels;
}

// n×n に縮め、各色を levels 段階にして canvas に描く
function drawImage(canvas, n, levels) {
  const px = sourcePixels();
  const g = canvas.getContext("2d");
  const cell = canvas.width / n;
  const block = SRC / n;
  for (let by = 0; by < n; by++) {
    for (let bx = 0; bx < n; bx++) {
      let r = 0, gg = 0, b = 0, cnt = 0;
      const step = Math.max(1, Math.floor(block / 4)); // 大きなブロックは間引いて平均
      for (let y = by * block; y < (by + 1) * block; y += step)
        for (let x = bx * block; x < (bx + 1) * block; x += step) {
          const i = (Math.floor(y) * SRC + Math.floor(x)) * 4;
          r += px[i];
          gg += px[i + 1];
          b += px[i + 2];
          cnt++;
        }
      const q = (v) => Math.round(quantize(v / cnt / 255, levels) * 255);
      g.fillStyle = `rgb(${q(r)},${q(gg)},${q(b)})`;
      g.fillRect(Math.floor(bx * cell), Math.floor(by * cell), Math.ceil(cell), Math.ceil(cell));
    }
  }
}

function sliderField(id, label, values, initialIndex, fmt) {
  const input = h("input", { type: "range", id, min: "0", max: String(values.length - 1), value: String(initialIndex), step: "1" });
  const out = h("output", { for: id });
  const set = () => (out.textContent = fmt(values[Number(input.value)]));
  input.addEventListener("input", set);
  set();
  return { el: h("div", { class: "field" }, h("label", { for: id }, label, "：", out), input), input, value: () => values[Number(input.value)] };
}

const HEART = ["0000000000000000", "0011100000111000", "0111110001111100", "1111111011111110", "1111111111111110", "1111111111111110", "0111111111111100", "0011111111111000", "0001111111110000", "0000111111100000", "0000011111000000", "0000001110000000", "0000000100000000", "0000000000000000", "0000000000000000", "0000000000000000"];

export const digitalModule = {
  id: ID,
  minutes: "15〜20分",
  lead: "コンピュータは、画像も音も「0と1の数」にして扱います（デジタル化）。どうやって数にするのか、そのときデータの量（情報量）がどう変わるのかを体験しよう。",
  steps: STEPS,
  async render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));

    // ステップ1: 解像度
    {
      const c = cards[0];
      const canvas = h("canvas", { width: 256, height: 256, class: "pixel-canvas", role: "img", "aria-label": "風景の画像。画素の数を減らすと、四角いモザイクのようになる。" });
      const res = sliderField("dig-res", "画素の数（横×縦）", RESOLUTIONS, 2, (n) => `${n} × ${n}`);
      const info = h("div", { class: "result-box", "aria-live": "polite" });
      const update = (touched) => {
        const n = res.value();
        drawImage(canvas, n, 256);
        info.replaceChildren(h("div", {}, `画素の数: ${n} × ${n} ＝ ${(n * n).toLocaleString("ja-JP")} 個`), h("div", {}, "1画素の色: 24ビット（赤・緑・青 各8ビット）"), h("div", {}, "データ量: ", h("strong", { class: "big-number" }, formatBits(imageBits(n, n, 24))), h("span", { class: "hint" }, `（${(n * n).toLocaleString("ja-JP")} × 24 ＝ ${imageBits(n, n, 24).toLocaleString("ja-JP")} ビット）`)));
        if (touched) c.done();
      };
      res.input.addEventListener("input", () => update(true));
      c.body.append(
        h("p", {}, "デジタルの画像は、小さな四角（画素・ピクセル）がたくさん集まってできています。画素の数を変えてみよう。"),
        h("div", { class: "field-row digital-row" }, h("div", {}, canvas), h("div", {}, res.el, info)),
        explainCard("解像度", "画素の数が多いほど（解像度が高いほど）細かいところまで表せますが、データ量は画素の数に比例して増えます。横と縦を2倍にすると、データ量は4倍です。"),
      );
      update(false);
    }

    // ステップ2: 階調
    {
      const c = cards[1];
      const canvas = h("canvas", { width: 256, height: 256, class: "pixel-canvas", role: "img", "aria-label": "風景の画像。色の段階を減らすと、空のグラデーションが縞模様になる。" });
      const lv = sliderField("dig-lv", "1色あたりの段階の数", LEVELS, 5, (l) => `${l}段階（${log2(l)}ビット）`);
      const info = h("div", { class: "result-box", "aria-live": "polite" });
      const update = (touched) => {
        const l = lv.value();
        const bpp = log2(l) * 3;
        drawImage(canvas, 128, l);
        info.replaceChildren(h("div", {}, `表せる色の数: ${l}³ ＝ ${(l ** 3).toLocaleString("ja-JP")} 色`), h("div", {}, `1画素: ${log2(l)}ビット × 3色 ＝ ${bpp}ビット`), h("div", {}, "128×128画素のデータ量: ", h("strong", { class: "big-number" }, formatBits(imageBits(128, 128, bpp)))));
        if (touched) c.done();
      };
      lv.input.addEventListener("input", () => update(true));
      c.body.append(
        h("p", {}, "1つの画素の色を、赤・緑・青をそれぞれ何段階で表すかを「階調」といいます。段階を減らすと、空のなめらかな色の変化はどうなるかな？"),
        h("div", { class: "field-row digital-row" }, h("div", {}, canvas), h("div", {}, lv.el, info)),
        explainCard("階調とビット数", "2段階なら1ビット、4段階なら2ビット、256段階なら8ビット。ビット数が1増えるごとに、表せる段階は2倍になります。赤・緑・青を各256段階で表すと、約1677万色（フルカラー）です。"),
      );
      update(false);
    }

    // ステップ3: 音
    {
      const c = cards[2];
      const rate = sliderField("dig-rate", "標本化周波数（1秒に何回はかるか）", RATES, 1, (r) => `${r.toLocaleString("ja-JP")} Hz`);
      const depth = sliderField("dig-depth", "量子化ビット数（何段階で表すか）", DEPTHS, 1, (b) => `${b}ビット（${(2 ** b).toLocaleString("ja-JP")}段階）`);
      const chart = h("div", { class: "chart" });
      const info = h("div", { class: "result-box", "aria-live": "polite" });
      const moved = new Set();
      const wave = (t) => 0.5 + 0.3 * Math.sin(2 * Math.PI * 1000 * t) + 0.15 * Math.sin(2 * Math.PI * 3000 * t + 0.6);
      const draw = () => {
        const r = rate.value(), b = depth.value();
        const W = 600, H = 220, m = 20;
        const T = 0.001; // 1ミリ秒
        const x = (t) => m + (t / T) * (W - 2 * m);
        const y = (v) => H - m - v * (H - 2 * m);
        let orig = "";
        for (let i = 0; i <= 200; i++) orig += `${i ? "L" : "M"}${x((i / 200) * T).toFixed(1)},${y(wave((i / 200) * T)).toFixed(1)}`;
        const levels = 2 ** b;
        const n = Math.floor(T * r);
        let stair = "";
        let dots = "";
        for (let k = 0; k <= n; k++) {
          const t = k / r;
          const v = quantize(wave(t), levels);
          const tNext = Math.min(T, (k + 1) / r);
          stair += `${k ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}L${x(tNext).toFixed(1)},${y(v).toFixed(1)}`;
          dots += `<circle cx="${x(t).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4" fill="var(--series-2)" stroke="var(--surface-1)" stroke-width="2"/>`;
        }
        const grid = levels <= 16 ? Array.from({ length: levels }, (_, i) => `<line x1="${m}" x2="${W - m}" y1="${y(i / (levels - 1)).toFixed(1)}" y2="${y(i / (levels - 1)).toFixed(1)}" stroke="var(--border)" stroke-width="1"/>`).join("") : "";
        chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="1ミリ秒分の音の波。もとの波（点線）を、${r}Hzではかり、${levels}段階で表したもの（階段状の線）。">
          ${grid}
          <path d="${orig}" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-dasharray="5 4"/>
          <path d="${stair}" fill="none" stroke="var(--series-1)" stroke-width="2.5"/>
          ${dots}
          <text x="${m}" y="14" class="axis">0ミリ秒</text><text x="${W - m}" y="14" class="axis" text-anchor="end">1ミリ秒</text>
        </svg>`;
        const bits = audioBits(r, b, 60, 2);
        info.replaceChildren(
          h("div", {}, `1ミリ秒の間にはかる回数: 約${(r / 1000).toFixed(1).replace(/\.0$/, "")}回`),
          h("div", {}, "1分間・ステレオ（2チャンネル）のデータ量: ", h("strong", { class: "big-number" }, formatBits(bits))),
          h("div", { class: "hint" }, `${r.toLocaleString("ja-JP")} × ${b} × 60秒 × 2 ＝ ${bits.toLocaleString("ja-JP")} ビット`),
        );
      };
      const onMove = (key) => {
        moved.add(key);
        draw();
        if (moved.size >= 2) c.done();
      };
      rate.input.addEventListener("input", () => onMove("rate"));
      depth.input.addEventListener("input", () => onMove("depth"));
      const play = h("button", { class: "btn secondary", type: "button" }, "🔊 この設定の音を聞く");
      play.addEventListener("click", () => playTone(rate.value(), depth.value()));
      c.body.append(
        h("p", {}, "音は空気のふるえ（波）です。デジタル化では、波の高さを一定の時間ごとにはかり（標本化）、その高さを決まった段階の数で表します（量子化）。最後に、その段階の番号を0と1の並びにします（符号化）。"),
        h("ul", { class: "legend", "aria-hidden": "true" }, h("li", {}, h("span", { class: "sw", style: "background:var(--text-muted)" }), "もとの音の波"), h("li", {}, h("span", { class: "sw", style: "background:var(--series-1)" }), "デジタル化した波"), h("li", {}, h("span", { class: "sw", style: "background:var(--series-2);height:8px;width:8px;border-radius:50%" }), "はかった点")),
        chart,
        h("p", { class: "hint step-goal" }, "「標本化周波数」と「量子化ビット数」の両方のスライダーを動かしてみよう（2つとも動かすと「✓ できた」になります）。"),
        h("div", { class: "field-row" }, rate.el, depth.el),
        info,
        h("div", { class: "btn-row" }, play, h("span", { class: "hint" }, "音が出ます。音量に注意しよう。")),
        explainCard("音楽CDでは", "標本化周波数 44,100 Hz、量子化ビット数 16ビット、ステレオ。1分間で約10MBになります。はかる回数や段階を増やすほど元の音に近くなりますが、データ量も増えます。"),
      );
      draw();
    }

    // ステップ4: 圧縮
    {
      const c = cards[3];
      const seen = new Set();
      const grid = h("div", { class: "rle-grid", role: "img" });
      const codes = h("ol", { class: "rle-codes mono" });
      const info = h("div", { "aria-live": "polite" });
      const show = (rows, kind) => {
        grid.replaceChildren(...rows.flatMap((r) => [...r].map((ch) => h("span", { class: ch === "1" ? "on" : "" }))));
        grid.setAttribute("aria-label", kind === "heart" ? "16×16のハートの絵" : "16×16のでたらめな点の絵");
        let runs = 0;
        codes.replaceChildren(
          ...rows.map((r) => {
            const rr = rle([...r]);
            runs += rr.length;
            return h("li", {}, rr.map(([v, n]) => `${v === "1" ? "黒" : "白"}${n}`).join(" "));
          }),
        );
        const original = 16 * 16;
        const compressed = runs * 5; // 色1ビット＋長さ4ビット
        const ratio = Math.round((compressed / original) * 100);
        info.replaceChildren(
          h("div", { class: "result-box" }, `もとのデータ: ${original}ビット（1画素1ビット）→ 圧縮後: ${compressed}ビット（${runs}組 × 5ビット）＝ もとの `, h("strong", {}, `${ratio}%`)),
          kind === "heart"
            ? explainCard("小さくなった！", "同じ色が続くところを「白が5個」のようにまとめると、データを小さくできます（ランレングス圧縮）。", "good")
            : explainCard("逆に大きくなった！", "同じ色が続かないデータは、まとめられないので、かえって大きくなることもあります。圧縮できる量は、データの性質で変わります。", "warn"),
        );
        seen.add(kind);
        if (seen.size >= 2) c.done();
      };
      const noise = () => Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => (Math.random() < 0.5 ? "1" : "0")).join(""));
      c.body.append(
        h("p", {}, "データ量を小さくすることを「圧縮」といいます。白黒の絵で、同じ色が続く数を数えてまとめる方法を試そう。"),
        h("p", { class: "hint step-goal" }, "「でたらめな点の絵」も押して、ハートの絵とくらべよう（でたらめな点の絵も見ると「✓ できた」になります）。"),
        h("div", { class: "btn-row" }, h("button", { class: "btn small secondary", type: "button", onclick: () => show(HEART, "heart") }, "ハートの絵"), h("button", { class: "btn small secondary", type: "button", onclick: () => show(noise(), "noise") }, "でたらめな点の絵")),
        h("div", { class: "field-row digital-row" }, grid, h("details", { open: true }, h("summary", {}, "各行の圧縮結果"), codes)),
        info,
        explainCard(
          "可逆圧縮と非可逆圧縮",
          "ランレングス圧縮のように、完全に元に戻せる圧縮を<strong>可逆圧縮</strong>（例: ZIP、PNG）といいます。写真の JPEG や音楽の MP3 などは、人が気づきにくい細かい部分を捨ててさらに小さくする<strong>非可逆圧縮</strong>で、元には完全には戻りません。",
        ),
      );
      show(HEART, "heart"); // はじめに出ているハートも「見た」に数える（SEC-16）
    }

    // ステップ5: 計算
    {
      const c = cards[4];
      const answered = new Set();
      const mark = (k) => {
        answered.add(k);
        if (answered.size >= 2) c.done();
      };
      c.body.append(
        explainCard("計算のしかた", "画像: 横の画素数 × 縦の画素数 × 1画素のビット数<br>音: 標本化周波数 × 量子化ビット数 × 秒数 × チャンネル数<br>8ビット ＝ 1バイト、1024バイト ＝ 1KB、1024KB ＝ 1MB"),
        choiceQuiz(
          {
            question: "横1920 × 縦1080画素、1画素24ビット（フルカラー）の画像。圧縮しないときのデータ量はおよそいくら？",
            choices: ["約6MB", "約60KB", "約600MB"],
            answer: 0,
            explain: "1920 × 1080 × 24 ＝ 49,766,400ビット。8でわると 6,220,800バイト。1024 で2回わると約5.9MB、つまり約6MBです。",
          },
          () => mark("img"),
        ),
        choiceQuiz(
          {
            question: "音楽CDと同じ設定（44,100Hz・16ビット・ステレオ）で、1分間録音したときのデータ量はおよそいくら？",
            choices: ["約1MB", "約10MB", "約100MB"],
            answer: 1,
            explain: "44,100 × 16 × 60 × 2 ＝ 84,672,000ビット ＝ 10,584,000バイト。1024 で2回わると約10MBです。",
          },
          () => mark("audio"),
        ),
      );
    }

    cards[5].body.append(reflectionBox(ID, "画質や音質をよくすると、データ量が増えるのはなぜだと思う？", () => cards[5].done()));
    root.append(...cards.map((c) => c.el));
  },
};

// 選んだ標本化周波数と量子化ビット数で、短い音を鳴らす（ユーザーがボタンを押したときだけ）
let audioCtx = null;
function playTone(rate, bits) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audioCtx ||= new Ctx();
  const sr = audioCtx.sampleRate;
  const dur = 1.2;
  const buf = audioCtx.createBuffer(1, Math.floor(sr * dur), sr);
  const data = buf.getChannelData(0);
  const levels = 2 ** bits;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const held = Math.floor(t * rate) / rate; // 標本化（はかった値を次の点まで保つ）
    const v = 0.5 + 0.3 * Math.sin(2 * Math.PI * 440 * held) + 0.15 * Math.sin(2 * Math.PI * 1320 * held);
    const q = quantize(v, levels) * 2 - 1; // 量子化
    const env = Math.min(1, t / 0.05, (dur - t) / 0.1);
    data[i] = q * 0.25 * env;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(audioCtx.destination);
  src.start();
}
