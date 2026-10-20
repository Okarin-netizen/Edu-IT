// モジュール1: 画像のデジタル化（画素と符号化、解像度と階調、RGB）
import { h, explainCard, stepCard, reflectionBox, choiceQuiz, toast } from "../js/ui.js";
import { imageBits, formatBits, unitSteps, COLOR_MODES, colorCount, applyColorMode, toBinary, wrongRows, wrongRowsMessage, pickAround } from "../js/digilib.js";

const ID = "image";
const STEPS = [
  { id: "pixels", title: "画素を0と1で表そう（符号化）" },
  { id: "quality", title: "解像度と階調を変えてみよう" },
  { id: "rgb", title: "色の表し方（光の三原色 RGB）" },
  { id: "quiz", title: "確かめよう" },
  { id: "reflect", title: "ふりかえり" },
];
const RESOLUTIONS = [8, 16, 32, 64, 128, 256];
const SRC = 256;
const fmt = (n) => n.toLocaleString("ja-JP");

// ---------- 元の画像（アプリの中で作る。外部の素材は使わない） ----------
function makeCanvas(w, h2 = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h2;
  return c;
}
function landscape() {
  const c = makeCanvas(SRC);
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
  return g.getImageData(0, 0, SRC, SRC).data;
}
function letters() {
  const c = makeCanvas(SRC);
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, SRC, SRC);
  g.fillStyle = "#1b1b1a";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = 'bold 92px "BIZ UDPGothic", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif';
  g.fillText("情報", 128, 92);
  g.font = 'bold 30px "BIZ UDPGothic", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif';
  g.fillStyle = "#c94f3d";
  g.fillText("デジタル化", 128, 172);
  g.font = '16px "BIZ UDPGothic", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif';
  g.fillStyle = "#256abf";
  g.fillText("小さな文字はどこまで読める？", 128, 216);
  return g.getImageData(0, 0, SRC, SRC).data;
}
// 読み込んだ写真を正方形に切り取って 256×256 にする（この画面の中だけで使い、保存しない）
function photoPixels(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const c = makeCanvas(SRC);
      const g = c.getContext("2d");
      g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SRC, SRC);
      URL.revokeObjectURL(url);
      resolve(g.getImageData(0, 0, SRC, SRC).data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした"));
    };
    img.src = url;
  });
}

// n×n の画素にし（標本化）、色を mode の段階にして（量子化）、canvas に描く
function drawDigitized(canvas, px, n, mode) {
  const g = canvas.getContext("2d");
  const cell = canvas.width / n;
  const block = SRC / n;
  const step = Math.max(1, Math.floor(block / 4)); // 大きなブロックは間引いて平均
  for (let by = 0; by < n; by++) {
    for (let bx = 0; bx < n; bx++) {
      let r = 0, gg = 0, b = 0, cnt = 0;
      for (let y = by * block; y < (by + 1) * block; y += step)
        for (let x = bx * block; x < (bx + 1) * block; x += step) {
          const i = (Math.floor(y) * SRC + Math.floor(x)) * 4;
          r += px[i];
          gg += px[i + 1];
          b += px[i + 2];
          cnt++;
        }
      const [qr, qg, qb] = applyColorMode(r / cnt, gg / cnt, b / cnt, mode);
      g.fillStyle = `rgb(${qr},${qg},${qb})`;
      g.fillRect(Math.floor(bx * cell), Math.floor(by * cell), Math.ceil(cell), Math.ceil(cell));
    }
  }
}

function sliderField(id, label, values, initialIndex, fmtValue) {
  const input = h("input", { type: "range", id, min: "0", max: String(values.length - 1), value: String(initialIndex), step: "1" });
  const out = h("output", { for: id });
  const set = () => (out.textContent = fmtValue(values[Number(input.value)]));
  input.addEventListener("input", set);
  set();
  return { el: h("div", { class: "field" }, h("label", { for: id }, label, "：", out), input), input, value: () => values[Number(input.value)] };
}

// 0と1から描く課題（8×8）
const TARGETS = [
  { name: "にっこり顔", rows: ["00111100", "01000010", "10100101", "10000001", "10100101", "10011001", "01000010", "00111100"] },
  { name: "家", rows: ["00011000", "00111100", "01111110", "11111111", "01000010", "01011010", "01011010", "01111110"] },
  { name: "音符", rows: ["00011110", "00010010", "00010010", "00010010", "01110010", "11110110", "11101110", "00001110"] },
];

export const imageModule = {
  id: ID,
  minutes: "20〜25分",
  lead: "デジタルの画像は、小さな四角（画素・ピクセル）の集まりです。1つ1つの画素の色を数にして、0と1で表しています。画素の数や色の段階を変えると、見た目とデータ量がどう変わるかを体験しよう。",
  steps: STEPS,
  async render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));

    // ---------- ステップ1: 8×8 の画素を塗る・0と1から描く ----------
    {
      const c = cards[0];
      let cells = Array.from({ length: 64 }, () => 0);
      let target = null;
      const grid = h("div", { class: "paint-grid", role: "grid", "aria-label": "8×8の画素。押すと白と黒が切りかわる" });
      const codes = h("tbody");
      const cmpTable = h("table", { class: "row-compare mono" }, h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "行"), h("th", { scope: "col" }, "お題"), h("th", { scope: "col" }, "今の絵"), h("th", { scope: "col" }, h("span", { class: "visually-hidden" }, "同じか")))), codes);
      let checked = false; // 答え合わせを押したあとは、行ごとに ○／× を出す
      const info = h("div", { class: "result-box", "aria-live": "polite" });
      const fb = h("div", { "aria-live": "polite" });
      const targetBox = h("div");
      const buttons = cells.map((_, i) => {
        const b = h("button", { type: "button", class: "px", "aria-label": `${Math.floor(i / 8) + 1}行${(i % 8) + 1}列`, "aria-pressed": "false" });
        b.addEventListener("click", () => {
          cells[i] = cells[i] ? 0 : 1;
          refresh();
        });
        return b;
      });
      for (let r = 0; r < 8; r++) grid.append(h("div", { role: "row", class: "px-row" }, buttons.slice(r * 8, r * 8 + 8)));
      const rowsNow = () => Array.from({ length: 8 }, (_, r) => cells.slice(r * 8, r * 8 + 8).join(""));
      function refresh() {
        buttons.forEach((b, i) => {
          b.classList.toggle("on", cells[i] === 1);
          b.setAttribute("aria-pressed", cells[i] ? "true" : "false");
        });
        const now = rowsNow();
        codes.replaceChildren(
          ...now.map((row, r) => {
            const same = target && row === target.rows[r];
            const mark = checked && target ? h("td", { class: same ? "ok" : "ng", "aria-label": same ? "同じ" : "ちがう" }, same ? "○" : "×") : h("td", {}, "");
            return h("tr", { class: checked && target && !same ? "ng" : "" }, h("th", { scope: "row" }, String(r + 1)), h("td", {}, target ? target.rows[r] : ""), h("td", {}, row), mark);
          }),
        );
        const ones = cells.filter(Boolean).length;
        info.replaceChildren(h("div", {}, `画素 64個 × 1ビット（白=0・黒=1）＝ `, h("strong", {}, "64ビット ＝ 8バイト")), h("div", { class: "hint" }, `黒の画素: ${ones}個`));
      }
      const check = h("button", { class: "btn", type: "button" }, "答え合わせ");
      check.addEventListener("click", () => {
        if (!target) return;
        const wrong = wrongRows(target.rows, rowsNow());
        checked = true;
        refresh();
        if (wrong.length === 0) {
          fb.replaceChildren(explainCard("正解！", `0と1の並びから「${target.name}」を復元できました。コンピュータも、こうして数から画像を描いています（復号）。`, "good"));
          c.done();
        } else fb.replaceChildren(explainCard("もう少し", wrongRowsMessage(wrong), "warn"));
      });
      const startTarget = (t) => {
        target = t;
        checked = false;
        cells = cells.map(() => 0);
        targetBox.replaceChildren(h("p", {}, h("strong", {}, `お題：右の表の「お題」の0と1から、左の画素に絵を描こう（1＝黒）`)));
        fb.replaceChildren();
        refresh();
      };
      const clear = () => {
        cells = cells.map(() => 0);
        refresh();
      };
      c.body.append(
        h("p", {}, "画素を押すと白と黒が切りかわります。白を0、黒を1とすると、絵は0と1の並びで表せます。これを「符号化」といいます。"),
        h(
          "div",
          { class: "btn-row" },
          ...TARGETS.map((t) => h("button", { class: "btn small secondary", type: "button", onclick: () => startTarget(t) }, `お題：${t.name}`)),
          h("button", { class: "btn small secondary", type: "button", onclick: clear }, "全部白にする"),
        ),
        targetBox,
        h("div", { class: "field-row digital-row" }, h("div", {}, grid), h("div", {}, h("div", { class: "hint" }, "お題と今の絵の0と1（1行ずつ）"), cmpTable, h("div", { class: "btn-row" }, check), fb)),
        info,
        explainCard("ポイント", "白黒の2色なら、1画素は1ビット（0か1）で表せます。8×8＝64画素なら64ビット。画素が増えると、ビット数も同じだけ増えます。<br>8ビットをまとめて1バイトといいます（8ビット ＝ 1バイト）。だから 64ビット ÷ 8 ＝ 8バイトです。"),
      );
      startTarget(TARGETS[0]);
    }

    // ---------- ステップ2: 解像度と階調 ----------
    {
      const c = cards[1];
      const sources = { landscape: null, letters: null, photo: null };
      let srcKey = "landscape";
      const canvas = h("canvas", { width: 256, height: 256, class: "pixel-canvas", role: "img", "aria-label": "デジタル化した画像" });
      const res = sliderField("img-res", "画素の数（解像度）", RESOLUTIONS, 3, (n) => `横${n} × 縦${n}`);
      const modeSel = sliderField("img-mode", "色の表し方（階調）", COLOR_MODES, 7, (m) => `${m.label}（1画素 ${m.bits}ビット）`);
      const info = h("div", { class: "result-box", "aria-live": "polite" });
      const compareBody = h("tbody");
      const moved = new Set();
      const pixels = () => (sources[srcKey] ||= srcKey === "landscape" ? landscape() : letters());
      const update = () => {
        const n = res.value();
        const mode = modeSel.value();
        drawDigitized(canvas, pixels(), n, mode);
        const bits = imageBits(n, n, mode.bits);
        info.replaceChildren(
          h("div", {}, `画素の数: ${n} × ${n} ＝ ${fmt(n * n)}個`),
          h("div", {}, `1画素: ${mode.bits}ビット → ${fmt(colorCount(mode))}通りの色`),
          h("div", {}, "データ量: ", h("strong", { class: "big-number" }, formatBits(bits))),
          h("div", { class: "math-line" }, `${fmt(n * n)} × ${mode.bits} ＝ ${unitSteps(bits).join("　")}`),
          h("div", { class: "hint unit-rule" }, "単位: 8ビット ＝ 1バイト、1024バイト ＝ 1KB、1024KB ＝ 1MB（このラボは 1KB ＝ 1024バイト）"),
        );
      };
      const onMove = (k) => {
        moved.add(k);
        update();
        if (moved.size >= 2) c.done();
      };
      res.input.addEventListener("input", () => onMove("res"));
      modeSel.input.addEventListener("input", () => onMove("mode"));

      const srcButtons = h("div", { class: "scenario-tabs", role: "group", "aria-label": "画像を選ぶ" });
      const fileInput = h("input", { type: "file", accept: "image/*", class: "visually-hidden", id: "img-file" });
      const setSrc = (key) => {
        srcKey = key;
        for (const b of srcButtons.querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.key === key ? "true" : "false");
        update();
      };
      const srcBtn = (key, label, onclick) => h("button", { type: "button", "aria-pressed": "false", dataset: { key }, onclick }, label);
      srcButtons.append(
        srcBtn("landscape", "風景", () => setSrc("landscape")),
        srcBtn("letters", "文字", () => setSrc("letters")),
        srcBtn("photo", "自分の写真を使う", () => fileInput.click()),
      );
      fileInput.addEventListener("change", async () => {
        const f = fileInput.files?.[0];
        fileInput.value = "";
        if (!f) return;
        try {
          sources.photo = await photoPixels(f);
          setSrc("photo");
          toast("写真を読み込みました（保存はしません）");
        } catch (e) {
          toast(e.message);
        }
      });

      const addCompare = () => {
        const n = res.value();
        const mode = modeSel.value();
        const thumb = h("canvas", { width: 64, height: 64, class: "thumb" });
        drawDigitized(thumb, pixels(), Math.min(n, 64), mode);
        compareBody.append(h("tr", {}, h("td", {}, thumb), h("td", {}, `${n} × ${n}`), h("td", {}, mode.label), h("td", { class: "num" }, formatBits(imageBits(n, n, mode.bits)))));
      };

      c.body.append(
        h("p", {}, "画素の数を減らす（標本化を粗くする）と、どう変わるかな？ 色の段階を減らす（量子化を粗くする）と、どうかな？ 見た目とデータ量をくらべよう。白黒 → グレー → カラーの順に、色の表し方も変えてみよう。"),
        srcButtons,
        fileInput,
        h("div", { class: "field-row digital-row" }, h("div", {}, canvas), h("div", {}, res.el, modeSel.el, h("p", { class: "hint mode-note" }, "注意：「グレー256段階」は1画素8ビット、「カラー8色」は1画素3ビットです。だから、カラー8色に進むとデータ量は減ります。データ量を決めるのは、色の種類ではなく1画素のビット数です。"), info)),
        h("div", { class: "btn-row" }, h("button", { class: "btn small secondary", type: "button", onclick: addCompare }, "＋ この設定をくらべる表に入れる")),
        h("div", { class: "table-wrap" }, h("table", { class: "data compare" }, h("thead", {}, h("tr", {}, h("th", {}, "見た目"), h("th", {}, "画素の数"), h("th", {}, "色"), h("th", {}, "データ量"))), compareBody)),
        explainCard("わかったこと", "画素の数が多い（解像度が高い）ほど、細かく表せます。色の段階が多い（階調が多い）ほど、なめらかに表せます。どちらもデータ量が増えます。横と縦を2倍にすると、データ量は4倍です。1画素のビット数を2倍にすると、データ量も2倍です。"),
        h("p", { class: "hint" }, "※自分の写真は、この画面の中で計算に使うだけです。保存も送信もせず、ほかのページに移ると消えます。人の写真を使うときは、写っている人の許可を取ろう。"),
      );
      setSrc("landscape");
    }

    // ---------- ステップ3: RGB ----------
    {
      const c = cards[2];
      const val = { r: 255, g: 128, b: 0 };
      const swatch = h("div", { class: "swatch", role: "img" });
      const codeBox = h("div", { class: "rgb-codes mono", "aria-live": "polite" });
      const goals = [
        { name: "黄色", test: ({ r, g, b }) => r >= 200 && g >= 200 && b <= 60 },
        { name: "水色", test: ({ r, g, b }) => r <= 60 && g >= 200 && b >= 200 },
        { name: "白", test: ({ r, g, b }) => r >= 230 && g >= 230 && b >= 230 },
        { name: "黒", test: ({ r, g, b }) => r <= 25 && g <= 25 && b <= 25 },
      ];
      const hit = new Set();
      const goalList = h("ul", { class: "goal-list" });
      const sliders = ["r", "g", "b"].map((k) => {
        const label = { r: "赤（R）", g: "緑（G）", b: "青（B）" }[k];
        const input = h("input", { type: "range", min: "0", max: "255", value: String(val[k]), id: `rgb-${k}`, class: `rgb-${k}` });
        const out = h("output", { for: `rgb-${k}` });
        input.addEventListener("input", () => {
          val[k] = Number(input.value);
          update();
        });
        return { k, out, el: h("div", { class: "field" }, h("label", { for: `rgb-${k}` }, label, "：", out), input) };
      });
      const hex = (n) => n.toString(16).toUpperCase().padStart(2, "0");
      function update() {
        const { r, g, b } = val;
        swatch.style.background = `rgb(${r},${g},${b})`;
        swatch.setAttribute("aria-label", `赤${r}・緑${g}・青${b}の色`);
        for (const s of sliders) s.out.textContent = String(val[s.k]);
        codeBox.replaceChildren(
          h("div", {}, `R ${String(r).padStart(3)} → ${toBinary(r, 8)}`),
          h("div", {}, `G ${String(g).padStart(3)} → ${toBinary(g, 8)}`),
          h("div", {}, `B ${String(b).padStart(3)} → ${toBinary(b, 8)}`),
          h("div", { class: "hint" }, `合わせて24ビット　カラーコード #${hex(r)}${hex(g)}${hex(b)}`),
          h("div", { class: "hint wrap-note" }, "カラーコードは、ウェブページの色の書き方です。16進数という数の表し方を使います。"),
        );
        for (const gl of goals) if (gl.test(val)) hit.add(gl.name);
        goalList.replaceChildren(...goals.map((gl) => h("li", { class: hit.has(gl.name) ? "done" : "" }, hit.has(gl.name) ? "✓ " : "□ ", gl.name)));
        if (hit.size >= 3) c.done();
      }
      c.body.append(
        h("p", {}, "画面の色は、光の三原色（赤・緑・青）をどれだけ強く光らせるかで作っています。フルカラーでは、それぞれを0〜255の256段階（8ビット）で表します。"),
        h("div", { class: "field-row digital-row" }, h("div", {}, swatch, codeBox), h("div", {}, ...sliders.map((s) => s.el), h("p", { class: "hint" }, "お題：次の色を作ってみよう（3つ以上でクリア）"), goalList)),
        explainCard("光の三原色", "赤と緑を混ぜると黄色、緑と青で水色、全部を強くすると白、全部0で黒になります。8ビット × 3色 ＝ 24ビットで、256 × 256 × 256 ＝ 約1677万色を表せます。"),
      );
      update();
    }

    // ---------- ステップ4: 確かめ ----------
    {
      const c = cards[3];
      const answered = new Set();
      const mark = (k) => {
        answered.add(k);
        if (answered.size >= 3) c.done();
      };
      c.body.append(
        choiceQuiz({ question: "画像の横と縦の画素の数を、それぞれ2倍にしました。データ量は何倍になる？", choices: ["4倍", "2倍", "8倍"], answer: 0, explain: "画素の数は 横 × 縦 なので、2 × 2 ＝ 4倍。データ量も4倍になります。" }, () => mark(1)),
        choiceQuiz({ question: "グレー16段階の画像を、グレー256段階にしました。1画素のビット数は？", choices: ["4ビット → 8ビット", "16ビット → 256ビット", "1ビット → 2ビット"], answer: 0, explain: "16段階は 2⁴（2×2×2×2）なので4ビット。256段階は 2⁸（2を8回かける）なので8ビット。データ量は2倍になります。" }, () => mark(2)),
        choiceQuiz({ question: "横100 × 縦100画素・フルカラー（24ビット）の画像のデータ量は？", choices: ["30,000バイト", ...pickAround(["3,750バイト", "10,000バイト"], ["240,000バイト", "1,920,000バイト"])], answer: 0, explain: "100 × 100 × 24 ＝ 240,000ビット。8でわって 30,000バイト。さらに1024でわると、約29KBです。" }, () => mark(3)),
      );
    }

    cards[4].body.append(reflectionBox(ID, "画質をよくすると、データ量が増えるのはなぜ？「画素」「階調」という言葉を使って書こう。", () => cards[4].done()));
    root.append(...cards.map((c) => c.el));
  },
};
