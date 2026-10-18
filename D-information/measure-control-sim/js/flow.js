// フローチャート: プログラムの木から SVG を作る（JIS のループ端・判断の記号を使う）
import { exprToText } from "./lang.js";

const BOX_H = 34;
const DIA_H = 58;
const GAP = 24;
const FONT = 13;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function textW(s) {
  let w = 0;
  for (const ch of String(s)) w += ch.charCodeAt(0) > 0xff ? FONT : FONT * 0.6;
  return w;
}

// 条件の記号は、ブロックと同じ「＜ ≦ ＞ ≧ ＝ ≠」で見せる（テキストは今のまま）
export function condText(e) {
  return exprToText(e).replace(/"[^"]*"|<=|>=|!=|==|<|>/g, (m) => ({ "<=": "≦", ">=": "≧", "!=": "≠", "==": "＝", "<": "＜", ">": "＞" })[m] ?? m);
}

export function labelOf(n, outputs) {
  switch (n.type) {
    case "assign":
      return outputs.has(n.name) ? `${n.name} を ${exprToText(n.value)} にする` : `${n.name} ← ${exprToText(n.value)}`;
    case "wait":
      return `${exprToText(n.secs)} 秒待つ`;
    case "if":
      return `${condText(n.cond)} ？`;
    case "forever":
      return "ずっとくり返す";
    case "repeat":
      return `${exprToText(n.count)} 回くり返す`;
    case "while":
      return `${condText(n.cond)} のあいだ`;
  }
  return "";
}

const line = (x1, y1, x2, y2, arrow = false) => `<line class="fc-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${arrow ? ' marker-end="url(#fc-arrow)"' : ""}/>`;
const poly = (pts, arrow = false) => `<polyline class="fc-line" fill="none" points="${pts.map((p) => p.join(",")).join(" ")}"${arrow ? ' marker-end="url(#fc-arrow)"' : ""}/>`;
const label = (x, y, s, cls = "fc-text", anchor = "middle") => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;

// 文の名前を決める関数（火星探査ロボット・シミュレータ（D10）は「前進する」などの名前にするために、ここを入れかえる）
let customLabel = null;

function layoutNode(n, outputs) {
  const text = customLabel?.(n) ?? labelOf(n, outputs);
  // 処理（出力を動かす・変数に入れる・待つ）は、JIS の「処理」の記号（長方形）でかく。「待つ」は色だけで見分ける
  if (n.type === "assign" || n.type === "wait") {
    const w = Math.max(120, textW(text) + 28);
    return {
      h: BOX_H,
      l: w / 2,
      r: w / 2,
      draw: (cx, y) =>
        `<g class="fc-node fc-${n.type}" data-id="${n.id}"><rect x="${cx - w / 2}" y="${y}" width="${w}" height="${BOX_H}" rx="3"/>${label(cx, y + BOX_H / 2 + 4.5, text)}</g>`,
    };
  }
  if (n.type === "if") {
    const dw = Math.max(150, textW(text) + 70);
    const T = layoutList(n.then, outputs);
    const E = layoutList(n.else || [], outputs);
    const ex = Math.max(dw / 2, T.r) + GAP + Math.max(E.l, 24);
    const bh = Math.max(T.h, E.h);
    const h = DIA_H + GAP + bh + GAP;
    return {
      h,
      l: Math.max(dw / 2, T.l),
      r: ex + Math.max(E.r, 24),
      draw: (cx, y) => {
        const top = y + DIA_H + GAP;
        const mergeY = top + bh + GAP / 2;
        let s = `<g class="fc-node fc-if" data-id="${n.id}"><polygon points="${cx},${y} ${cx + dw / 2},${y + DIA_H / 2} ${cx},${y + DIA_H} ${cx - dw / 2},${y + DIA_H / 2}"/>${label(cx, y + DIA_H / 2 + 4.5, text)}</g>`;
        s += label(cx + 6, y + DIA_H + 15, "はい", "fc-yes", "start");
        s += label(cx + dw / 2 + 6, y + DIA_H / 2 - 6, "いいえ", "fc-no", "start");
        s += line(cx, y + DIA_H, cx, top, T.h > 0);
        s += T.draw(cx, top);
        s += line(cx, top + T.h, cx, y + h);
        s += poly([[cx + dw / 2, y + DIA_H / 2], [cx + ex, y + DIA_H / 2], [cx + ex, top]], E.h > 0);
        s += E.draw(cx + ex, top);
        s += poly([[cx + ex, top + E.h], [cx + ex, mergeY], [cx, mergeY]]);
        return s;
      },
    };
  }
  // くり返し（ループ端の記号ではさむ）
  const B = layoutList(n.body, outputs);
  const tw = Math.max(140, textW(text) + 40);
  const endText = n.type === "forever" ? "ここまで（はじめにもどる）" : "ここまで";
  const ew = Math.max(140, textW(endText) + 40);
  const h = BOX_H + GAP + B.h + (B.h ? GAP : 0) + BOX_H;
  const c = 9;
  return {
    h,
    l: Math.max(tw / 2, ew / 2, B.l),
    r: Math.max(tw / 2, ew / 2, B.r),
    draw: (cx, y) => {
      const x0 = cx - tw / 2;
      const x1 = cx + tw / 2;
      let s = `<g class="fc-node fc-loop" data-id="${n.id}"><polygon points="${x0 + c},${y} ${x1 - c},${y} ${x1},${y + c} ${x1},${y + BOX_H} ${x0},${y + BOX_H} ${x0},${y + c}"/>${label(cx, y + BOX_H / 2 + 4.5, text)}</g>`;
      const bodyTop = y + BOX_H + GAP;
      const endY = y + h - BOX_H;
      if (B.h) {
        s += line(cx, y + BOX_H, cx, bodyTop, true);
        s += B.draw(cx, bodyTop);
        s += line(cx, bodyTop + B.h, cx, endY, true);
      } else s += line(cx, y + BOX_H, cx, endY, true);
      const e0 = cx - ew / 2;
      const e1 = cx + ew / 2;
      s += `<g class="fc-node fc-loop-end" data-id="${n.id}"><polygon points="${e0},${endY} ${e1},${endY} ${e1},${endY + BOX_H - c} ${e1 - c},${endY + BOX_H} ${e0 + c},${endY + BOX_H} ${e0},${endY + BOX_H - c}"/>${label(cx, endY + BOX_H / 2 + 4.5, endText)}</g>`;
      return s;
    },
  };
}

function layoutList(list, outputs) {
  const items = list.filter((n) => n.type !== "comment").map((n) => layoutNode(n, outputs));
  if (!items.length) return { h: 0, l: 0, r: 0, draw: () => "" };
  const h = items.reduce((a, it) => a + it.h, 0) + GAP * (items.length - 1);
  return {
    h,
    l: Math.max(...items.map((i) => i.l)),
    r: Math.max(...items.map((i) => i.r)),
    draw: (cx, y) => {
      let s = "";
      let yy = y;
      items.forEach((it, i) => {
        if (i) {
          s += line(cx, yy - GAP, cx, yy, true);
        }
        s += it.draw(cx, yy);
        yy += it.h + GAP;
      });
      return s;
    },
  };
}

// outputs: 出力の名前の Set（「〇〇 を オン にする」と書くため）
// label: 文の名前を変えるときの関数（n → 文字。undefined なら、ふつうの名前）
export function flowchartSvg(program, outputs = new Set(), label = null) {
  customLabel = label;
  const L = layoutList(program, outputs);
  const last = program.filter((n) => n.type !== "comment").at(-1);
  const endless = last && last.type === "forever";
  const pad = 20;
  const termW = 110;
  const left = Math.max(L.l, termW / 2) + pad;
  const width = left + Math.max(L.r, termW / 2) + pad;
  const cx = left;
  let y = pad;
  const pill = (yy, s) => `<g class="fc-node fc-term"><rect x="${cx - termW / 2}" y="${yy}" width="${termW}" height="${BOX_H - 4}" rx="${(BOX_H - 4) / 2}"/>${label(cx, yy + (BOX_H - 4) / 2 + 4.5, s)}</g>`;
  let body = pill(y, "はじめ");
  y += BOX_H - 4;
  if (L.h) {
    body += line(cx, y, cx, y + GAP, true);
    y += GAP;
    body += L.draw(cx, y);
    y += L.h;
  }
  if (!endless) {
    body += line(cx, y, cx, y + GAP, true);
    y += GAP;
    body += pill(y, "おわり");
    y += BOX_H - 4;
  }
  const height = y + pad;
  return `<svg class="flowchart" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}" width="${Math.ceil(width)}" height="${Math.ceil(height)}" role="img" aria-label="プログラムのフローチャート">
<defs><marker id="fc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="fc-arrowhead"/></marker></defs>
${body}
</svg>`;
}
