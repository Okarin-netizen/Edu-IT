// 仮想CPUのシミュレーター画面（プログラム欄・5つの装置・記憶装置・操作ボタン）
import { h, explain, term, reducedMotion, sleep } from "./ui.js";
import { assemble, createMachine, stepPhase, isStopped, wordText, wordMeaning, isInstruction, numText, shortList, UNIT_NAMES, PHASE_NAMES } from "./vm.js";

// 速さ: 1段階ごとの待ち時間（ミリ秒）。最後は「最速」（アニメなしでまとめて実行）
const SPEEDS = [
  { label: "とてもゆっくり", wait: 1600 },
  { label: "ゆっくり", wait: 1000 },
  { label: "ふつう", wait: 550 },
  { label: "はやい", wait: 200 },
  { label: "最速", wait: 0 },
];

// 入力の数を読む。−（数学のマイナス）・ー（長音）・‐ などもマイナスとして読む。
// 戻り値: { values: 読めた整数, dropped: 読めなかった文字（1.5、abc など） }
export function readInputs(text) {
  const values = [];
  const dropped = [];
  for (const raw of String(text ?? "").split(/[\s,、，]+/)) {
    const t = raw.normalize("NFKC").replace(/^[\u2212\u30FC\u2010-\u2015\uFE63]/, "-");
    if (t === "") continue;
    if (/^[+-]?\d+$/.test(t)) values.push(Number(t));
    else dropped.push(raw);
  }
  return { values, dropped };
}
export const parseInputs = (text) => readInputs(text).values;

// プログラムの読み方（#・箱・名前・番地）。open=false なら、たたんで表示
export function readingCard(open = true) {
  const row = (code, text) => h("li", {}, h("code", {}, code), h("span", { class: "rc-arrow", "aria-hidden": "true" }, " → "), text);
  const body = h(
    "ul",
    { class: "reading-list" },
    row("LOAD #5", "5 という数そのものを ACC（計算用の箱）に入れる"),
    row("LOAD x", "箱 x に入っている数を ACC に入れる（# がないときは「箱の中身」）"),
    row("x: DATA 0", "0 の入った箱 x を用意する。HALT より後ろに書く"),
    row("loop: OUT", "この行に loop という名前をつける。JUMP loop でここにとぶ"),
    h("li", {}, "記憶装置のマスの左上の数は「番地」で、0 から数えます。エラーの「○行目」は 1 から数えます。"),
    h("li", {}, "名前は大文字と小文字を区別します（sum と Sum は別の箱）。"),
  );
  return open
    ? h("section", { class: "card reading-card" }, h("h3", {}, "プログラムの読み方"), body)
    : h("details", { class: "isa-table reading-card" }, h("summary", {}, "プログラムの読み方（#・箱・名前・番地）"), body);
}

// 命令表（たたんで表示）
export function isaTable(isa, open = false) {
  return h(
    "details",
    { class: "isa-table", open },
    h("summary", {}, "命令表（使える命令の一覧）"),
    h(
      "div",
      { class: "table-wrap" },
      h(
        "table",
        { class: "data" },
        h("thead", {}, h("tr", {}, h("th", {}, "命令"), h("th", {}, "読み"), h("th", {}, "はたらき"), h("th", {}, "書き方の例"))),
        h("tbody", {}, isa.instructions.map((i) => h("tr", {}, h("td", {}, h("code", { class: "op" }, i.op)), h("td", {}, i.name), h("td", {}, i.desc), h("td", {}, h("code", {}, i.example))))),
        h("tbody", {}, h("tr", {}, h("td", {}, h("code", { class: "op" }, "DATA")), h("td", {}, "データ"), h("td", {}, "命令ではなく、数を入れた箱を用意する（はじめの値）"), h("td", {}, h("code", {}, "x: DATA 0")))),
      ),
    ),
    h("ul", { class: "syntax-notes" }, isa.syntax.map((t) => h("li", {}, t))),
  );
}

// opts: { isa, source, inputs, onSourceChange(text), onHalt(machine) , title }
export function createSimulator(opts) {
  const { isa } = opts;
  let source = opts.source ?? "";
  let prog = null;
  let m = null;
  let mode = "edit"; // edit | run
  let running = false;
  let runToken = 0;
  let speed = 2;
  let lastEvent = null;

  // ---- 左: プログラム ----
  const textarea = h("textarea", { class: "editor", spellcheck: "false", autocapitalize: "off", autocomplete: "off", autocorrect: "off", "aria-label": "プログラム", rows: 14 });
  textarea.value = source;
  textarea.addEventListener("input", () => {
    source = textarea.value;
    opts.onSourceChange?.(source);
  });
  const listing = h("ol", { class: "listing", "aria-label": "実行中のプログラム" });
  const errorsBox = h("div", { class: "asm-errors", role: "alert" });
  const editBtn = h("button", { class: "btn small secondary", type: "button", onclick: () => toEdit() }, "✎ プログラムを書きかえる");
  const inputField = h("input", { type: "text", inputmode: "numeric", value: (opts.inputs || []).join(", "), "aria-describedby": "in-hint" });
  // 読めなかった文字があれば知らせる（だまって捨てない）
  const inputNote = h("p", { class: "input-note", "aria-live": "polite" });
  const updateInputNote = () => {
    const { dropped } = readInputs(inputField.value);
    inputNote.textContent = dropped.length ? `${dropped.map((d) => `「${d}」`).join("")}は読めないので入れませんでした（整数だけ入れられます）` : "";
    inputNote.hidden = !dropped.length;
  };
  updateInputNote();
  inputField.addEventListener("input", () => {
    updateInputNote();
    if (mode === "run") reset();
    opts.onInputsChange?.(parseInputs(inputField.value));
  });

  const left = h(
    "div",
    { class: "sim-left" },
    h("div", { class: "panel-head" }, h("h3", {}, opts.title || "プログラム"), editBtn, opts.headExtra || null),
    textarea,
    listing,
    errorsBox,
    h("div", { class: "field" }, h("label", {}, "入力装置に入れる数", h("span", { class: "hint", id: "in-hint" }, "（「,」で区切る。IN 命令で前から順に読まれます）"), inputField), inputNote),
  );

  // ---- 右: 操作と装置 ----
  const btn = (label, onclick, extra = {}) => h("button", { class: "btn small", type: "button", onclick, ...extra }, label);
  const runBtn = btn("▶ 実行", () => startRun());
  const pauseBtn = btn("⏸ 一時停止", () => stopRun(), { class: "btn small secondary" });
  const phaseBtn = btn("1段階すすむ", () => manualStep("phase"), { class: "btn small secondary", title: "取り出し・解読・実行のどれか1つだけ進める" });
  const instrBtn = btn("1命令すすむ", () => manualStep("instr"), { class: "btn small secondary" });
  const resetBtn = btn("↺ 最初から", () => reset(), { class: "btn small secondary" });
  const speedInput = h("input", { type: "range", min: 0, max: SPEEDS.length - 1, step: 1, value: speed, "aria-label": "実行の速さ" });
  const speedLabel = h("span", { class: "speed-label" }, SPEEDS[speed].label);
  speedInput.addEventListener("input", () => {
    speed = Number(speedInput.value);
    speedLabel.textContent = SPEEDS[speed].label;
  });
  const controls = h(
    "div",
    { class: "sim-controls" },
    h("div", { class: "btn-row" }, runBtn, pauseBtn, phaseBtn, instrBtn, resetBtn),
    h("label", { class: "speed" }, "速さ", speedInput, speedLabel),
    h("p", { class: "step-help speed-help" }, "くり返しの多いプログラムは「はやい」か「最速」で実行しよう"),
    h("p", { class: "step-help" }, h("b", {}, "1段階"), ": 取り出し・解読・実行のうち1つだけ進む　", h("b", {}, "1命令"), ": 3つをまとめて進む"),
  );

  // 装置
  const unit = (key, cls, ...children) => h("section", { class: `unit ${cls}`, dataset: { unit: key }, "aria-label": UNIT_NAMES[key] }, ...children);
  const inQueue = h("div", { class: "queue" });
  const pcVal = h("span", { class: "reg-val" });
  const irVal = h("span", { class: "reg-val ir" });
  const phasePills = h("div", { class: "phase-pills" }, Object.entries(PHASE_NAMES).map(([k, v]) => h("span", { class: "pill", dataset: { phase: k } }, v)));
  const stepsVal = h("span", { class: "reg-val small" });
  const accVal = h("span", { class: "acc-val" });
  const calcLine = h("div", { class: "calc" });
  const outScreen = h("div", { class: "screen", "aria-live": "polite" });
  const memGrid = h("div", { class: "mem-grid" });
  const cellInfo = h("p", { class: "cell-info", "aria-live": "polite" }, "マスを押すと、中身の意味が出ます。");
  let cellInfoAddr = null;
  // 用語の説明（押すと出る）
  const tPC = term("PC（次の番地）", "PC は「プログラムカウンタ」。次に取り出す命令の番地を覚えておく、CPU の中の小さな記憶の箱（レジスタ）です。");
  const tIR = term("いまの命令", "制御装置が記憶装置から取り出して、いま解読・実行している命令です（命令レジスタという箱に入っています）。");
  const tACC = term("ACC（計算用の箱）", "ACC は「アキュムレータ」。計算に使う、CPU の中の小さな記憶の箱（レジスタ）です。LOAD で数を入れ、ADD・SUB で計算します。");

  const board = h(
    "div",
    { class: "board" },
    unit("in", "u-in", h("h4", {}, "入力装置"), h("div", { class: "unit-sub" }, "キーボードなど"), inQueue),
    h(
      "div",
      { class: "cpu" },
      h("div", { class: "cpu-label" }, "CPU（中央処理装置）"),
      unit(
        "ctrl",
        "u-ctrl",
        h("h4", {}, "制御装置"),
        h("div", { class: "regs" }, h("div", {}, tPC.btn, pcVal), tPC.note, h("div", {}, tIR.btn, irVal), tIR.note),
        phasePills,
        h("div", { class: "steps-line" }, "実行した命令の数: ", stepsVal),
      ),
      unit("alu", "u-alu", h("h4", {}, "演算装置"), h("div", { class: "regs" }, tACC.btn, tACC.note), accVal, calcLine),
    ),
    unit("out", "u-out", h("h4", {}, "出力装置"), h("div", { class: "unit-sub" }, "ディスプレイ"), outScreen),
    unit("mem", "u-mem", h("h4", {}, "記憶装置（メモリ）", h("span", { class: "unit-sub" }, ` 0〜${isa.memorySize - 1}番地。命令もデータも入る`)), memGrid, cellInfo),
  );
  const flyLayer = h("div", { class: "fly-layer", "aria-hidden": "true" });
  board.append(flyLayer);
  const narration = h("div", { class: "narration", "aria-live": "polite" });
  const statusBox = h("div", { class: "sim-status" });
  // 説明欄は操作ボタンのすぐ下に置く（ボタンを押しながら、何が起きたかを読めるように）
  const right = h("div", { class: "sim-right" }, controls, narration, statusBox, board);

  const el = h("div", { class: "sim" }, left, right);

  // ---- 動き ----
  function compile() {
    prog = assemble(source, isa);
    errorsBox.replaceChildren();
    if (!prog.ok) {
      errorsBox.append(
        explain(
          "プログラムに書きまちがいがあります",
          h("ul", { class: "err-list" }, prog.errors.map((e) => h("li", {}, h("button", { class: "linkish", type: "button", onclick: () => gotoLine(e.line) }, `${e.line}行目`), `: ${e.message}`))),
          "bad",
        ),
      );
      return false;
    }
    return true;
  }

  function gotoLine(line) {
    const lines = textarea.value.split("\n");
    const start = lines.slice(0, line - 1).reduce((a, l) => a + l.length + 1, 0);
    textarea.focus();
    textarea.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
  }

  function toRun() {
    if (!compile()) {
      toEdit(true);
      return false;
    }
    mode = "run";
    m = createMachine(prog, { inputs: parseInputs(inputField.value), maxSteps: isa.maxSteps });
    lastEvent = null;
    buildListing();
    render();
    return true;
  }

  function toEdit(keepErrors = false) {
    stopRun();
    mode = "edit";
    m = null;
    lastEvent = null;
    if (!keepErrors) errorsBox.replaceChildren();
    render();
  }

  function reset() {
    stopRun();
    if (mode === "run") toRun();
    else render();
  }

  function buildListing() {
    listing.replaceChildren(
      ...source.split("\n").map((text, i) => {
        const line = i + 1;
        const addr = prog.addrOfLine[line];
        return h("li", { dataset: { line } }, h("span", { class: "addr" }, addr === undefined ? "" : addr), h("code", {}, text || " "));
      }),
    );
  }

  function ensureMachine() {
    if (mode === "edit" || !m) return toRun();
    if (isStopped(m)) return toRun();
    return true;
  }

  function doPhase(quiet = false) {
    const ev = stepPhase(m, quiet);
    if (ev) lastEvent = ev;
    if (isStopped(m)) opts.onHalt?.(m);
    return ev;
  }

  function manualStep(kind) {
    if (running) stopRun();
    if (!ensureMachine()) return;
    if (kind === "phase") {
      const ev = doPhase();
      render(ev);
      if (ev) fly(ev, 500);
    } else {
      do {
        const ev = doPhase();
        render(ev);
      } while (m.phase !== "fetch" && !isStopped(m));
    }
  }

  async function startRun() {
    if (running) return;
    if (!ensureMachine()) return;
    running = true;
    const token = ++runToken;
    render();
    while (running && token === runToken && !isStopped(m)) {
      const { wait } = SPEEDS[speed];
      if (wait === 0) {
        // 最速: まとめて実行して、ときどき画面を更新
        const until = performance.now() + 30;
        while (!isStopped(m) && performance.now() < until) doPhase(m.steps % 50 !== 0);
        render(lastEvent);
        await new Promise((r) => requestAnimationFrame(r));
      } else {
        const ev = doPhase();
        render(ev);
        if (ev) fly(ev, wait * 0.8);
        await sleep(wait);
      }
    }
    if (token === runToken) running = false;
    render(lastEvent);
  }

  function stopRun() {
    running = false;
    runToken++;
    render(lastEvent);
  }

  // 装置から装置へ、値が飛んでいくアニメーション
  function fly(ev, dur) {
    if (!ev.flow || reducedMotion() || dur < 120) return;
    const from = board.querySelector(`[data-unit="${ev.flow.from}"]`);
    const to = board.querySelector(`[data-unit="${ev.flow.to}"]`);
    if (!from || !to) return;
    const b = board.getBoundingClientRect();
    const center = (r) => [r.left - b.left + r.width / 2, r.top - b.top + Math.min(r.height / 2, 60)];
    const fromCell = ev.read !== null && ev.flow.from === "mem" ? memGrid.children[ev.read] : null;
    const toCell = ev.write !== null && ev.flow.to === "mem" ? memGrid.children[ev.write] : null;
    const [x1, y1] = center((fromCell || from).getBoundingClientRect());
    const [x2, y2] = center((toCell || to).getBoundingClientRect());
    const chip = h("span", { class: "fly-chip" }, ev.flow.value);
    flyLayer.replaceChildren(chip);
    chip.animate([{ transform: `translate(${x1}px, ${y1}px) translate(-50%, -50%)`, opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.85 }, { transform: `translate(${x2}px, ${y2}px) translate(-50%, -50%)`, opacity: 0 }], { duration: dur, easing: "ease-in-out" })
      .finished.catch(() => {}) // 次の値が飛んで、とちゅうで消されたとき（エラーにしない）
      .then(() => chip.remove());
  }

  function render(ev = lastEvent) {
    const editing = mode === "edit";
    textarea.hidden = !editing;
    listing.hidden = editing;
    editBtn.hidden = editing;
    inputField.disabled = running;
    runBtn.disabled = running;
    pauseBtn.disabled = !running;
    runBtn.textContent = m && !isStopped(m) && m.steps + (m.phase === "fetch" ? 0 : 1) > 0 ? "▶ つづきを実行" : "▶ 実行";

    const mach = m;
    const mem = mach ? mach.mem : new Array(isa.memorySize).fill(null);
    // 入力装置
    const inputs = mach ? mach.inputs : parseInputs(inputField.value);
    const used = mach ? mach.inputPos : 0;
    inQueue.replaceChildren(...(inputs.length ? inputs.map((v, i) => h("span", { class: `chip ${i < used ? "used" : ""}` }, v)) : [h("span", { class: "muted" }, "（入力なし）")]));
    // 制御装置
    pcVal.textContent = mach ? mach.pc : "—";
    irVal.textContent = mach?.ir ? wordText(mach.ir) : "—";
    stepsVal.textContent = mach ? mach.steps : 0;
    for (const p of phasePills.children) p.classList.toggle("on", Boolean(ev) && p.dataset.phase === ev.phase);
    // 演算装置
    accVal.textContent = mach ? numText(mach.acc) : "—";
    calcLine.textContent = ev?.calc || "";
    // 出力装置
    const outs = mach ? mach.outputs : [];
    outScreen.replaceChildren(...outs.map((v) => h("div", {}, numText(v))));
    outScreen.scrollTop = outScreen.scrollHeight;
    // 記憶装置
    const labelOf = {};
    if (prog && mode === "run") for (const [name, a] of Object.entries(prog.labels)) (labelOf[a] ||= []).push(name);
    memGrid.replaceChildren(
      ...mem.map((w, addr) => {
        const cls = ["cell"];
        if (mach) {
          if (isInstruction(w)) cls.push("instr");
          else if (addr >= prog.used) cls.push("unused");
          else cls.push("data");
          if (addr === mach.pc && !isStopped(mach)) cls.push("pc");
          if (addr === mach.irAddr) cls.push("now");
          if (ev?.read === addr) cls.push("read");
          if (ev?.write === addr) cls.push("write");
        } else cls.push("unused");
        const meaning = mach ? `${addr}番地: ${wordMeaning(w)}` : `${addr}番地（まだ何も読み込んでいません）`;
        return h(
          "button",
          { type: "button", class: cls.join(" "), title: meaning, "aria-label": meaning, onclick: () => showCell(addr) },
          h("span", { class: "cell-addr" }, addr, labelOf[addr] ? h("span", { class: "cell-label" }, labelOf[addr].join(",")) : null),
          h("span", { class: "cell-val" }, mach ? wordText(w) : ""),
        );
      }),
    );
    if (cellInfoAddr !== null) showCell(cellInfoAddr);
    // 光っている装置
    for (const u of board.querySelectorAll("[data-unit]")) u.classList.toggle("active", Boolean(ev?.units?.includes(u.dataset.unit)));
    // プログラムの行
    if (!editing && mach) {
      const nowLine = mach.irAddr !== null ? prog.lineOfAddr[mach.irAddr] : null;
      const nextLine = !isStopped(mach) ? prog.lineOfAddr[mach.pc] : null;
      for (const li of listing.children) {
        const line = Number(li.dataset.line);
        li.classList.toggle("now", line === nowLine);
        li.classList.toggle("next", line === nextLine && line !== nowLine);
      }
      listing.querySelector(".now")?.scrollIntoView?.({ block: "nearest" });
    }
    // 説明
    if (!mach) narration.textContent = editing ? "「▶ 実行」か「1段階すすむ」を押すと、プログラムが記憶装置に読み込まれて動き始めます。" : "";
    else if (ev) narration.replaceChildren(h("span", { class: `phase-tag ${ev.phase}` }, PHASE_NAMES[ev.phase] || "停止"), " ", ev.message);
    else narration.textContent = "プログラムを記憶装置の 0番地から順に読み込みました。PC は 0。ここから命令を1つずつ取り出して実行します。";

    statusBox.replaceChildren();
    if (mach?.status === "halted") statusBox.append(explain("終わりました", `命令を ${mach.steps} 回実行しました。出力: ${shortList(mach.outputs)}`, "good"));
    else if (mach?.status === "error") statusBox.append(explain("止まりました", mach.error, "bad"));
    else if (mach?.status === "limit") statusBox.append(explain("自動で止めました", mach.error, "warn"));
  }

  // マスを押したときの説明（指でも見られるように）
  function showCell(addr) {
    cellInfoAddr = addr;
    const w = m ? m.mem[addr] : null;
    cellInfo.textContent = m ? (isInstruction(w) ? `${addr}番地: 命令「${wordText(w)}」… ${wordMeaning(w)}` : `${addr}番地: 数 ${w}（データ）`) : `${addr}番地: まだ何も読み込んでいません。「▶ 実行」か「1段階すすむ」を押すと、プログラムが読み込まれます。`;
  }

  render();

  return {
    el,
    get source() {
      return source;
    },
    setSource(text) {
      source = text;
      textarea.value = text;
      toEdit();
      opts.onSourceChange?.(source);
    },
    get inputs() {
      return parseInputs(inputField.value);
    },
    setInputs(list) {
      inputField.value = list.join(", ");
      updateInputNote();
      reset();
    },
    // 速さを変える（0〜4。4 は「最速」）
    setSpeed(i) {
      speed = Math.max(0, Math.min(SPEEDS.length - 1, i));
      speedInput.value = speed;
      speedLabel.textContent = SPEEDS[speed].label;
    },
    FASTEST: SPEEDS.length - 1,
    focusInputs() {
      inputField.scrollIntoView?.({ block: "center", behavior: "smooth" });
    },
    stop: stopRun,
    showErrors: compile,
  };
}
