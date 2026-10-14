// ネットワーク図（SVG）とパケットのアニメーション
import { NODE_TYPES, nodeById } from "./netlib.js";

const NS = "http://www.w3.org/2000/svg";
export const VIEW_W = 920;
export const VIEW_H = 540;

// サイト名（nn-host）の置き方。x は機器の中心の位置（図の座標）
export function hostAnchor(x, edge = 200) {
  if (x > VIEW_W - edge) return { x: Math.min(40, VIEW_W - 8 - x), "text-anchor": "end" };
  if (x < edge) return { x: Math.max(-40, 8 - x), "text-anchor": "start" };
  return { x: 0, "text-anchor": "middle" };
}

function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v);
  for (const c of children.flat()) if (c !== null && c !== undefined) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

// アニメーションの速さ（1 = ふつう）。動きを減らす設定のときは速くする
let speed = 1;
export const getSpeed = () => speed;
export const setSpeed = (v) => {
  speed = v;
};
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// 一時停止（NW-02）。止めているあいだは、パケットも待ち時間も進まない
let paused = false;
let resumeWaiters = [];
export const isPaused = () => paused;
export function setPaused(v) {
  paused = Boolean(v);
  if (!paused) resumeWaiters.splice(0).forEach((f) => f());
}
// 止めていなければすぐ、止めていれば「つづける」まで待つ
export const whenResumed = () => (paused ? new Promise((r) => resumeWaiters.push(r)) : Promise.resolve());

export const wait = (ms) =>
  new Promise((r) => {
    let left = reducedMotion() ? Math.min(ms, 60) : ms / speed;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      if (!paused) left -= now - last;
      last = now;
      if (left <= 0) r();
      else setTimeout(tick, Math.min(left, 50));
    };
    tick();
  });

// 速さの切りかえボタン
export function speedControl(h) {
  const opts = [
    [0.5, "ゆっくり"],
    [1, "ふつう"],
    [2, "はやい"],
  ];
  const btns = opts.map(([v, label]) => {
    const b = h("button", { type: "button", class: "chip", "aria-pressed": v === speed ? "true" : "false" }, label);
    b.addEventListener("click", () => {
      setSpeed(v);
      btns.forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    });
    return b;
  });
  return h("div", { class: "chip-row", role: "group", "aria-label": "アニメーションの速さ" }, h("span", { class: "hint" }, "速さ："), ...btns);
}

// 指で操作したときは、少しぶれても「押した」と見なす（NW-14）
export const DRAG_THRESHOLD = { mouse: 4, touch: 12, pen: 8 };
export const dragThreshold = (pointerType) => DRAG_THRESHOLD[pointerType] ?? DRAG_THRESHOLD.mouse;

/**
 * ネットワーク図を作る。
 * opts: { net, draggable（true/false か、いま動かせるかを返す関数）, onNodeClick(node), onLinkClick(link), label, onChange(), onBeforeChange() }
 */
export function createNetView(opts) {
  setPaused(false); // 前の画面で止めたままにしない
  let net = opts.net;
  const canDrag = () => (typeof opts.draggable === "function" ? opts.draggable() : Boolean(opts.draggable));
  const marks = { nodes: new Map(), links: new Map(), path: null, oldPath: null, spyLink: null, selected: null };

  const svg = s("svg", { viewBox: `0 0 ${VIEW_W} ${VIEW_H}`, class: "net-svg", role: "group", "aria-label": opts.label || "ネットワーク図" });
  const linkLayer = s("g", { class: "links" });
  const nodeLayer = s("g", { class: "nodes" });
  const pktLayer = s("g", { class: "packets", "aria-hidden": "true" });
  svg.append(linkLayer, nodeLayer, pktLayer);

  const toSvgPoint = (clientX, clientY) => {
    const m = svg.getScreenCTM();
    if (!m) return { x: VIEW_W / 2, y: VIEW_H / 2 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function pathHasLink(l, p = marks.path) {
    if (!p) return false;
    for (let i = 0; i < p.length - 1; i++) if ((p[i] === l.a && p[i + 1] === l.b) || (p[i] === l.b && p[i + 1] === l.a)) return true;
    return false;
  }

  function render() {
    linkLayer.replaceChildren();
    nodeLayer.replaceChildren();
    for (const l of net.links) {
      const a = nodeById(net, l.a);
      const b = nodeById(net, l.b);
      if (!a || !b) continue;
      const onPath = pathHasLink(l);
      const cls = ["nl", l.cut ? "cut" : "", onPath ? "on-path" : "", !onPath && pathHasLink(l, marks.oldPath) ? "old-path" : "", marks.links.get(l.id) || ""].join(" ");
      const g = s("g", { class: cls, "data-link": l.id });
      g.append(s("line", { class: "nl-line", x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if (l.cut) g.append(s("text", { class: "nl-mark", x: mx, y: my + 7, "text-anchor": "middle" }, "✂"));
      if (marks.spyLink === l.id) g.append(s("text", { class: "nl-spy", x: mx, y: my + 9, "text-anchor": "middle" }, "👀"));
      if (opts.onLinkClick) {
        const hit = s("line", { class: "nl-hit", x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        g.append(hit);
        g.setAttribute("tabindex", "0");
        g.setAttribute("role", "button");
        g.setAttribute("aria-label", `${a.name} と ${b.name} の回線${l.cut ? "（切れている）" : ""}`);
        g.addEventListener("click", () => opts.onLinkClick(l));
        g.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            opts.onLinkClick(l);
          }
        });
      }
      linkLayer.append(g);
    }
    for (const n of net.nodes) {
      const t = NODE_TYPES[n.type] || NODE_TYPES.pc;
      const onPath = marks.path?.includes(n.id);
      const cls = ["nn", `t-${n.type}`, n.down ? "down" : "", onPath ? "on-path" : "", marks.selected === n.id ? "selected" : "", marks.nodes.get(n.id) || ""].join(" ");
      const g = s("g", { class: cls, transform: `translate(${n.x} ${n.y})`, "data-node": n.id, tabindex: opts.onNodeClick || opts.draggable ? "0" : null, role: opts.onNodeClick ? "button" : "img" });
      g.setAttribute("aria-label", `${t.label}「${n.name}」 IPアドレス ${n.ip}${n.host ? ` 名前 ${n.host}` : ""}${n.down ? "（止まっている）" : ""}`);
      g.append(
        s("circle", { class: "nn-bg", r: 30 }),
        s("text", { class: "nn-icon", y: 10, "text-anchor": "middle" }, t.icon),
        s("text", { class: "nn-name", y: 50, "text-anchor": "middle" }, n.name),
        s("text", { class: "nn-ip", y: 70, "text-anchor": "middle" }, n.ip),
      );
      // サイト名は長いので、図の右はし・左はしでは図の内側にそろえる（文字を大きくしても切れないように）
      if (n.host) g.append(s("text", { class: "nn-host", y: -38, ...hostAnchor(n.x) }, n.host));
      if (n.down) g.append(s("text", { class: "nn-x", y: 14, "text-anchor": "middle" }, "✕"));
      attachNodeEvents(g, n);
      nodeLayer.append(g);
    }
  }

  function attachNodeEvents(g, n) {
    let start = null;
    let moved = false;
    // 動かせるときだけ、機器の上での指の動きでページがスクロールしないようにする（図のほかの所ではスクロールできる）
    g.addEventListener(
      "touchstart",
      (e) => {
        if (canDrag()) e.preventDefault();
      },
      { passive: false },
    );
    g.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, limit: dragThreshold(e.pointerType), drag: canDrag() };
      moved = false;
      if (start.drag) {
        g.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    });
    g.addEventListener("pointermove", (e) => {
      if (!start || !start.drag) return;
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > start.limit) {
        moved = true;
        opts.onBeforeChange && opts.onBeforeChange();
      }
      if (!moved) return;
      const p = toSvgPoint(e.clientX, e.clientY);
      n.x = Math.round(clamp(p.x, 40, VIEW_W - 40));
      n.y = Math.round(clamp(p.y, 50, VIEW_H - 75));
      g.setAttribute("transform", `translate(${n.x} ${n.y})`);
      for (const line of linkLayer.querySelectorAll("line")) {
        const l = net.links.find((x) => x.id === line.parentNode.dataset.link);
        if (!l) continue;
        if (l.a === n.id) line.setAttribute("x1", n.x), line.setAttribute("y1", n.y);
        if (l.b === n.id) line.setAttribute("x2", n.x), line.setAttribute("y2", n.y);
      }
    });
    const end = () => {
      if (!start) return;
      const wasMoved = moved;
      start = null;
      if (wasMoved) {
        render();
        opts.onChange && opts.onChange();
      } else if (opts.onNodeClick) opts.onNodeClick(n);
    };
    g.addEventListener("pointerup", end);
    g.addEventListener("pointercancel", () => (start = null));
    g.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && opts.onNodeClick) {
        e.preventDefault();
        opts.onNodeClick(n);
      }
      // 矢印キーでも動かせる
      if (canDrag() && e.key.startsWith("Arrow")) {
        e.preventDefault();
        opts.onBeforeChange && opts.onBeforeChange();
        const d = e.shiftKey ? 40 : 10;
        if (e.key === "ArrowLeft") n.x = clamp(n.x - d, 40, VIEW_W - 40);
        if (e.key === "ArrowRight") n.x = clamp(n.x + d, 40, VIEW_W - 40);
        if (e.key === "ArrowUp") n.y = clamp(n.y - d, 50, VIEW_H - 75);
        if (e.key === "ArrowDown") n.y = clamp(n.y + d, 50, VIEW_H - 75);
        render();
        nodeLayer.querySelector(`[data-node="${n.id}"]`)?.focus();
        opts.onChange && opts.onChange();
      }
    });
  }

  // パケットを道にそって動かす。kind: "dns" | "req" | "data" | "secure" | "lost"
  function animate(path, { label = "", kind = "data", hopMs = 650, stopAt = null, onHop = null } = {}) {
    const pts = path.map((id) => nodeById(net, id)).filter(Boolean);
    if (stopAt !== null) pts.splice(stopAt + 1);
    const g = s("g", { class: `pkt k-${kind}` }, s("rect", { x: -16, y: -12, width: 32, height: 24, rx: 6 }), s("text", { y: 5, "text-anchor": "middle" }, label));
    pktLayer.append(g);
    const place = (x, y) => g.setAttribute("transform", `translate(${x} ${y - 30})`);
    place(pts[0].x, pts[0].y);
    if (pts.length < 2) {
      return wait(300).then(() => g.remove());
    }
    const hop = reducedMotion() ? 40 : hopMs;
    return new Promise((resolve) => {
      let i = 0;
      let t0 = null;
      let lastTs = null;
      const step = (ts) => {
        if (!g.isConnected) return resolve();
        if (t0 === null) t0 = ts;
        // 一時停止のあいだは、時間を進めない
        if (paused && lastTs !== null) t0 += ts - lastTs;
        lastTs = ts;
        if (paused) return requestAnimationFrame(step);
        const dur = hop / speed;
        let k = (ts - t0) / dur;
        while (k >= 1 && i < pts.length - 1) {
          i++;
          t0 += dur;
          k = (ts - t0) / dur;
          if (onHop) onHop(pts[i - 1].id, pts[i].id);
        }
        if (i >= pts.length - 1) {
          place(pts[pts.length - 1].x, pts[pts.length - 1].y);
          setTimeout(() => g.remove(), 150);
          return resolve();
        }
        const a = pts[i];
        const b = pts[i + 1];
        place(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  render();
  return {
    el: svg,
    render,
    animate,
    toSvgPoint,
    get net() {
      return net;
    },
    setNet(next) {
      net = next;
      render();
    },
    setPath(path) {
      marks.path = path;
      render();
    },
    // こわす前の道を点線で見せる（null で消す）
    setOldPath(path) {
      marks.oldPath = path;
      render();
    },
    setSelected(id) {
      marks.selected = id;
      render();
    },
    markNode(id, cls) {
      if (cls) marks.nodes.set(id, cls);
      else marks.nodes.delete(id);
      render();
    },
    setSpyLink(id) {
      marks.spyLink = id;
      render();
    },
    clearMarks() {
      marks.nodes.clear();
      marks.links.clear();
      marks.path = null;
      marks.oldPath = null;
      render();
    },
    clearPackets() {
      pktLayer.replaceChildren();
    },
  };
}

// 道を「A → B → C」の文に
export const pathText = (net, path) => path.map((id) => nodeById(net, id)?.name || id).join(" → ");
