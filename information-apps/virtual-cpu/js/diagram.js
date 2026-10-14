// 図解: コンピュータの5つの装置と、データ・制御の流れ（3 + 5 を計算して表示するまで）
import { h, s, explain, reducedMotion, sleep } from "./ui.js";
import { store } from "./store.js";

const BOX = {
  ctrl: { x: 285, y: 18, w: 150, h: 66, title: "制御装置", sub: "命令を読んで指示を出す", cpu: true },
  in: { x: 16, y: 158, w: 148, h: 66, title: "入力装置", sub: "キーボード・マウスなど" },
  mem: { x: 285, y: 158, w: 150, h: 66, title: "記憶装置", sub: "メモリ（主記憶）" },
  out: { x: 556, y: 158, w: 148, h: 66, title: "出力装置", sub: "ディスプレイなど" },
  alu: { x: 285, y: 298, w: 150, h: 66, title: "演算装置", sub: "計算・くらべる" },
};

// 矢印（data=データの流れ、ctrl=制御の信号）
const ARROWS = {
  inMem: { kind: "data", d: "M164 191 H283" },
  memOut: { kind: "data", d: "M435 191 H554" },
  memAlu: { kind: "data", d: "M340 224 V296" },
  aluMem: { kind: "data", d: "M380 298 V226" },
  memCtrl: { kind: "data", d: "M360 158 V86" },
  ctrlIn: { kind: "ctrl", d: "M285 40 H90 V156" },
  ctrlOut: { kind: "ctrl", d: "M435 40 H630 V156" },
  ctrlMem: { kind: "ctrl", d: "M310 84 V156" },
  ctrlAlu: { kind: "ctrl", d: "M285 70 H250 V331 H283" },
};

const STEPS = [
  {
    title: "コンピュータの5つの装置",
    text: "コンピュータは「入力」「記憶」「演算」「制御」「出力」の5つの装置（はたらき）が協力して動きます。制御装置と演算装置をまとめて CPU（中央処理装置）とよびます。これから「3 + 5 を計算して画面に表示する」ようすを、順番に見ていきます。",
    active: ["in", "mem", "alu", "ctrl", "out"],
  },
  {
    title: "① 入力: 3 を入れる",
    text: "キーボードから「3」を入力すると、制御装置の指示で、その数が記憶装置にしまわれます。実線の矢印はデータの流れ、点線の矢印は制御装置からの指示（制御の信号）です。",
    active: ["in", "mem", "ctrl"],
    arrows: ["ctrlIn", "inMem"],
    packet: { arrow: "inMem", from: "in", label: "3" },
    values: { in: "「3」", mem: "3" },
  },
  {
    title: "② 入力: 5 を入れる",
    text: "同じように「5」も記憶装置にしまわれます。記憶装置には、いくつもの数を番地（場所の番号）ごとに分けてしまっておけます。",
    active: ["in", "mem", "ctrl"],
    arrows: ["ctrlIn", "inMem"],
    packet: { arrow: "inMem", from: "in", label: "5" },
    values: { in: "「5」", mem: "3, 5" },
  },
  {
    title: "③ 制御: 命令を取り出す",
    text: "記憶装置には、データだけでなくプログラム（命令の並び）も入っています。制御装置は命令を1つずつ取り出して解読し、ほかの装置に「何をするか」を指示します。",
    active: ["mem", "ctrl"],
    arrows: ["memCtrl"],
    packet: { arrow: "memCtrl", from: "mem", label: "たし算せよ" },
    values: { mem: "3, 5", ctrl: "命令: たし算" },
  },
  {
    title: "④ 演算: 3 + 5 を計算する",
    text: "制御装置の指示で、記憶装置から 3 と 5 が演算装置に送られ、たし算が行われます。演算装置は計算や、数の大小くらべをします。",
    active: ["mem", "alu", "ctrl"],
    arrows: ["ctrlAlu", "memAlu"],
    packet: { arrow: "memAlu", from: "mem", label: "3, 5" },
    values: { mem: "3, 5", ctrl: "命令: たし算", alu: "3 + 5 = 8" },
  },
  {
    title: "⑤ 記憶: 答えをしまう",
    text: "計算の結果 8 は、記憶装置にもどしてしまわれます。",
    active: ["alu", "mem", "ctrl"],
    arrows: ["ctrlMem", "aluMem"],
    packet: { arrow: "aluMem", from: "alu", label: "8" },
    values: { mem: "3, 5, 8", alu: "8" },
  },
  {
    title: "⑥ 出力: 画面に表示する",
    text: "最後に、制御装置の指示で記憶装置の 8 が出力装置（ディスプレイ）に送られ、画面に表示されます。",
    active: ["mem", "out", "ctrl"],
    arrows: ["ctrlOut", "memOut"],
    packet: { arrow: "memOut", from: "mem", label: "8" },
    values: { mem: "3, 5, 8", out: "8" },
  },
  {
    title: "まとめ",
    text: "入力 → 記憶 → 演算 → 記憶 → 出力 と、データが流れました。その流れ全体を指示していたのが制御装置です。実際のコンピュータの CPU は、このような命令を 1秒間に何十億回もくり返しています。電源を切ると消えるメモリ（主記憶装置）のほかに、電源を切っても消えない SSD などの補助記憶装置もあります。",
    active: ["in", "mem", "alu", "ctrl", "out"],
    arrows: ["inMem", "memAlu", "aluMem", "memOut", "memCtrl", "ctrlIn", "ctrlOut", "ctrlMem", "ctrlAlu"],
    values: { in: "「3」「5」", mem: "3, 5, 8", alu: "3 + 5 = 8", ctrl: "命令: たし算", out: "8" },
  },
];

// why: まちがえたときに出す理由（1行）
export const DEVICES = [
  { name: "キーボード", answer: "in", why: "キーを打って、文字を受け取る" },
  { name: "ディスプレイ", answer: "out", why: "文字や絵を画面に映して、人に伝える" },
  { name: "マウス", answer: "in", why: "手の動きやクリックを受け取る" },
  { name: "プリンタ", answer: "out", why: "紙に印刷して、人に伝える" },
  { name: "メモリ（パソコンの中の部品）", answer: "mem", why: "動いているプログラムやデータをためておく（電源を切ると消える主記憶装置）" },
  { name: "SSD（パソコンの中の部品）", answer: "mem", why: "ファイルをためておく（電源を切っても消えない補助記憶装置）" },
  { name: "マイク", answer: "in", why: "音を受け取る" },
  { name: "スピーカー", answer: "out", why: "音を出して、人に伝える" },
  { name: "CPU", answer: "cpu", why: "計算をして、ほかの装置に指示を出す" },
  { name: "デジタルカメラ（光を受け取る部品）", answer: "in", why: "光（景色）を受け取って、データにする" },
];
const CHOICES = { in: "入力装置", out: "出力装置", mem: "記憶装置", cpu: "演算装置・制御装置" };

// まちがえた機器の理由（例: 「プリンタ: 紙に印刷して、人に伝える → 出力装置」）
export function wrongReasons(picks) {
  return DEVICES.filter((d, i) => picks[i] && picks[i] !== d.answer).map((d) => `${d.name.replace(/（.*）$/, "")}: ${d.why} → ${CHOICES[d.answer]}`);
}

export function renderDiagram(view) {
  store.markVisited("diagram");
  let index = 0;
  let token = 0;

  const arrowEls = {};
  const valueEls = {};
  const boxEls = {};
  const defs = s(
    "defs",
    {},
    ["data", "ctrl", "data-on", "ctrl-on"].map((k) => s("marker", { id: `ah-${k}`, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 12, markerHeight: 12, markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" }, s("path", { d: "M0 0 L10 5 L0 10 z", class: `ah ah-${k}` }))),
  );
  const svg = s("svg", { viewBox: "0 0 720 380", class: "five-units", role: "img", "aria-label": "入力装置・記憶装置・演算装置・制御装置・出力装置の関係の図" }, defs);
  for (const [id, a] of Object.entries(ARROWS)) {
    arrowEls[id] = s("path", { d: a.d, class: `arr ${a.kind}`, "marker-end": `url(#ah-${a.kind})` });
    svg.append(arrowEls[id]);
  }
  for (const [key, b] of Object.entries(BOX)) {
    valueEls[key] = s("text", { x: b.x + b.w / 2, y: b.y + b.h + 18, class: "box-value", "text-anchor": "middle" });
    boxEls[key] = s(
      "g",
      { class: `box ${b.cpu || key === "alu" ? "cpu" : ""}` },
      s("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 10 }),
      s("text", { x: b.x + b.w / 2, y: b.y + 28, class: "box-title", "text-anchor": "middle" }, b.title),
      s("text", { x: b.x + b.w / 2, y: b.y + 50, class: "box-sub", "text-anchor": "middle" }, b.sub),
    );
    svg.append(boxEls[key], valueEls[key]);
  }
  // 値の表示位置の調整（制御装置は上に余白がないので右に出す）
  valueEls.ctrl.setAttribute("x", BOX.ctrl.x + BOX.ctrl.w + 8);
  valueEls.ctrl.setAttribute("y", BOX.ctrl.y + 60);
  valueEls.ctrl.setAttribute("text-anchor", "start");
  valueEls.mem.setAttribute("x", BOX.mem.x + BOX.mem.w + 8);
  valueEls.mem.setAttribute("y", BOX.mem.y + BOX.mem.h + 18);
  valueEls.mem.setAttribute("text-anchor", "start");
  valueEls.alu.setAttribute("x", BOX.alu.x + BOX.alu.w + 10);
  valueEls.alu.setAttribute("y", BOX.alu.y + 38);
  valueEls.alu.setAttribute("text-anchor", "start");
  svg.append(
    s("g", { class: "legend-g" },
      s("line", { x1: 16, y1: 300, x2: 52, y2: 300, class: "arr data" }), s("text", { x: 58, y: 304, class: "legend-t" }, "データの流れ"),
      s("line", { x1: 16, y1: 326, x2: 52, y2: 326, class: "arr ctrl" }), s("text", { x: 58, y: 330, class: "legend-t" }, "制御の信号（指示）"),
      s("rect", { x: 16, y: 344, width: 36, height: 18, rx: 4, class: "legend-cpu" }), s("text", { x: 58, y: 358, class: "legend-t" }, "CPU（制御装置＋演算装置）"),
    ),
  );
  const packet = s("g", { class: "packet", opacity: 0 }, s("rect", { x: -34, y: -14, width: 68, height: 28, rx: 14 }), s("text", { x: 0, y: 5, "text-anchor": "middle" }, ""));
  svg.append(packet);

  const stepTitle = h("h3", { "aria-live": "polite" });
  const stepText = h("p");
  const counter = h("span", { class: "muted" });
  const prev = h("button", { class: "btn secondary", type: "button", onclick: () => go(index - 1) }, "← 前へ");
  const next = h("button", { class: "btn", type: "button", onclick: () => go(index + 1) }, "次へ →");
  const replay = h("button", { class: "btn secondary", type: "button", onclick: () => go(index) }, "↻ もう一度");

  async function movePacket(arrowId, label, my) {
    const path = arrowEls[arrowId];
    packet.querySelector("text").textContent = label;
    const w = Math.max(44, label.length * 15 + 20);
    const r = packet.querySelector("rect");
    r.setAttribute("width", w);
    r.setAttribute("x", -w / 2);
    const len = path.getTotalLength();
    const dur = reducedMotion() ? 0 : 1300;
    const start = performance.now();
    packet.setAttribute("opacity", 1);
    while (my === token) {
      const t = dur ? Math.min(1, (performance.now() - start) / dur) : 1;
      const p = path.getPointAtLength(len * (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2));
      packet.setAttribute("transform", `translate(${p.x} ${p.y})`);
      if (t >= 1) break;
      await new Promise((res) => requestAnimationFrame(res));
    }
    await sleep(dur ? 500 : 0);
    if (my === token) packet.setAttribute("opacity", 0);
  }

  async function go(i) {
    index = Math.max(0, Math.min(STEPS.length - 1, i));
    const my = ++token;
    const st = STEPS[index];
    stepTitle.textContent = st.title;
    stepText.textContent = st.text;
    counter.textContent = `${index + 1} / ${STEPS.length}`;
    prev.disabled = index === 0;
    next.disabled = index === STEPS.length - 1;
    for (const [k, g] of Object.entries(boxEls)) g.classList.toggle("active", st.active.includes(k));
    for (const [k, a] of Object.entries(arrowEls)) {
      const on = Boolean(st.arrows?.includes(k));
      a.classList.toggle("on", on);
      a.setAttribute("marker-end", `url(#ah-${ARROWS[k].kind}${on ? "-on" : ""})`);
    }
    const setValues = (vals) => {
      for (const [k, v] of Object.entries(valueEls)) v.textContent = vals?.[k] || "";
    };
    packet.setAttribute("opacity", 0);
    if (st.packet) {
      // 前の段階の値を出しておいてから、データを動かす
      const before = index > 0 ? STEPS[index - 1].values || {} : {};
      const src = st.packet.from;
      setValues({ ...before, [src]: st.values?.[src] ?? before[src] });
      await movePacket(st.packet.arrow, st.packet.label, my);
      if (my !== token) return;
    }
    setValues(st.values);
  }

  // 機器の仲間分け
  const selects = DEVICES.map((d) => h("select", { "aria-label": `${d.name}はどの装置？` }, h("option", { value: "" }, "えらぶ"), Object.entries(CHOICES).map(([v, t]) => h("option", { value: v }, t))));
  const marks = DEVICES.map(() => h("span", { class: "mark" }));
  const sortResult = h("div", { "aria-live": "polite" });
  const checkSort = () => {
    let ok = 0;
    const blank = selects.filter((x) => !x.value).length;
    DEVICES.forEach((d, i) => {
      const v = selects[i].value;
      const right = v === d.answer;
      if (right) ok++;
      marks[i].textContent = !v ? "" : right ? "○" : "×";
      marks[i].className = `mark ${!v ? "" : right ? "good" : "bad"}`;
    });
    const reasons = wrongReasons(selects.map((x) => x.value));
    sortResult.replaceChildren(
      explain(
        `${DEVICES.length}問中 ${ok}問 正解`,
        h(
          "div",
          {},
          ok === DEVICES.length ? h("p", {}, "全部正解！") : reasons.length ? h("div", {}, h("p", {}, "× の機器の理由:"), h("ul", { class: "why-list" }, reasons.map((t) => h("li", {}, t)))) : null,
          h("p", {}, "タッチパネルのように、入力と出力の両方をこなす機器もあります。スマートフォンにも5つの装置がそろっているか、考えてみよう。"),
        ),
        ok === DEVICES.length ? "good" : "info",
      ),
      blank ? h("p", { class: "hint" }, `まだえらんでいない機器が ${blank} こあります。全部えらんで答え合わせをすると、このページに ✓ がつきます。`) : null,
    );
    // ✓ は、全部えらんで答え合わせをしたときにつける（開いただけではつけない）
    if (!blank) {
      const first = !store.isDone("diagram");
      store.markDone("diagram", { score: ok, total: DEVICES.length });
      if (first) document.dispatchEvent(new CustomEvent("vcpu:progress"));
    }
  };

  view.replaceChildren(
    h("div", { class: "page-head" }, h("h2", {}, "図解: コンピュータの5つの装置"), h("p", { class: "muted" }, "「次へ」を押して、データがどの装置を通るか見てみよう。")),
    h("div", { class: "card" }, h("div", { class: "diagram-wrap" }, svg), stepTitle, stepText, h("div", { class: "btn-row" }, prev, next, replay, counter)),
    h(
      "div",
      { class: "card" },
      h("h3", {}, "やってみよう: どの装置の仲間？"),
      h("p", {}, "身のまわりの機器は、5つの装置のどれにあたるでしょう。"),
      h("div", { class: "sort-grid" }, DEVICES.map((d, i) => h("label", { class: "sort-item" }, h("span", {}, d.name), h("span", { class: "sort-pick" }, selects[i], marks[i])))),
      h("div", { class: "btn-row" }, h("button", { class: "btn", type: "button", onclick: checkSort }, "答え合わせ")),
      sortResult,
    ),
    h("div", { class: "btn-row next-link" }, h("a", { class: "btn", href: "#/sim" }, "次: 仮想CPUで命令を動かしてみよう →")),
  );
  go(0);
  return () => token++;
}
