/* 立体(積み木)を Canvas に立体表示し、ドラッグ・キー・ボタンで回せるようにする。
 * A4View3D.create(canvas, {onChange}) → { setSolid(s), setView(name), rotate(dy, dp), draw() }
 */
(function (root) {
  'use strict';
  var DEG = Math.PI / 180;
  var PRESETS = {
    iso: { yaw: -45, pitch: 35.26 },
    front: { yaw: 0, pitch: 0 },
    top: { yaw: 0, pitch: 90 },
    right: { yaw: -90, pitch: 0 }
  };
  var FACES = [
    { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.78 },
    { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.78 },
    { n: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], shade: 0.66 },
    { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.9 },
    { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 1.0 },
    { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.55 }
  ];

  function cssVar(name, fb) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fb;
  }
  function hexToRgb(h) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [200, 149, 91];
  }

  function create(canvas, opt) {
    opt = opt || {};
    var M = root.A4Core;
    var state = { yaw: PRESETS.iso.yaw, pitch: PRESETS.iso.pitch, solid: null };
    var ctx = canvas.getContext('2d');

    function size() {
      var dpr = window.devicePixelRatio || 1;
      var w = canvas.clientWidth || 320, h = canvas.clientHeight || 260;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: w, h: h };
    }

    function projector(s, W, H) {
      var cy = Math.cos(state.yaw * DEG), sy = Math.sin(state.yaw * DEG);
      var cp = Math.cos(state.pitch * DEG), sp = Math.sin(state.pitch * DEG);
      var cx0 = s.w / 2, cy0 = s.d / 2, cz0 = s.h / 2;
      var rad = 0.5 * Math.sqrt(s.w * s.w + s.d * s.d + s.h * s.h) + 0.9;
      var scale = Math.min(W, H) * 0.46 / rad;
      function rot(x, y, z) {
        var X = x - cx0, Y = y - cy0, Z = z - cz0;
        var x1 = X * cy - Y * sy, y1 = X * sy + Y * cy;
        return { sx: W / 2 + x1 * scale, sy: H / 2 - (y1 * sp + Z * cp) * scale, depth: y1 * cp - Z * sp };
      }
      function rotN(n) {
        var x1 = n[0] * cy - n[1] * sy, y1 = n[0] * sy + n[1] * cy;
        // 見る人のほうを向いていれば正
        return -y1 * cp + n[2] * sp;
      }
      return { p: rot, facing: rotN, scale: scale };
    }

    function draw() {
      var sz = size(), W = sz.w, H = sz.h;
      ctx.clearRect(0, 0, W, H);
      var s = state.solid;
      if (!s) return;
      var P = projector(s, W, H);
      var ink = cssVar('--ink', '#1f2328'), muted = cssVar('--muted', '#5b636d');
      var base = hexToRgb(cssVar('--wood', '#c8955b'));

      // 床の格子と「正面」の矢印
      ctx.lineWidth = 1;
      ctx.strokeStyle = cssVar('--line', '#d0d4d9');
      var x, y, a, b;
      for (x = 0; x <= s.w; x++) { a = P.p(x, 0, 0); b = P.p(x, s.d, 0); ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke(); }
      for (y = 0; y <= s.d; y++) { a = P.p(0, y, 0); b = P.p(s.w, y, 0); ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke(); }
      var t0 = P.p(s.w / 2, -1.25, 0), t1 = P.p(s.w / 2, -0.25, 0);
      if (Math.hypot(t1.sx - t0.sx, t1.sy - t0.sy) > 6) {
        ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(t0.sx, t0.sy); ctx.lineTo(t1.sx, t1.sy); ctx.stroke();
        var ang = Math.atan2(t1.sy - t0.sy, t1.sx - t0.sx);
        ctx.beginPath(); ctx.moveTo(t1.sx, t1.sy);
        ctx.lineTo(t1.sx - 11 * Math.cos(ang - 0.45), t1.sy - 11 * Math.sin(ang - 0.45));
        ctx.lineTo(t1.sx - 11 * Math.cos(ang + 0.45), t1.sy - 11 * Math.sin(ang + 0.45));
        ctx.closePath(); ctx.fill();
        ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var lab = P.p(s.w / 2, -1.7, 0);
        ctx.fillText('正面', lab.sx, lab.sy);
      }

      // ブロックを奥から順にかく(面ごとに奥行きで並べる)
      var polys = [];
      for (var z = 0; z < s.h; z++) for (y = 0; y < s.d; y++) for (x = 0; x < s.w; x++) {
        if (!M.get(s, x, y, z)) continue;
        FACES.forEach(function (f) {
          if (M.get(s, x + f.n[0], y + f.n[1], z + f.n[2])) return;
          if (P.facing(f.n) <= 1e-6) return;
          var pts = f.c.map(function (c) { return P.p(x + c[0], y + c[1], z + c[2]); });
          var c = P.p(x + 0.5 + f.n[0] * 0.5, y + 0.5 + f.n[1] * 0.5, z + 0.5 + f.n[2] * 0.5);
          polys.push({ pts: pts, depth: c.depth, shade: f.shade });
        });
      }
      polys.sort(function (p, q) { return q.depth - p.depth; });
      ctx.lineJoin = 'round';
      polys.forEach(function (pl) {
        ctx.beginPath();
        pl.pts.forEach(function (p, i) { if (i) ctx.lineTo(p.sx, p.sy); else ctx.moveTo(p.sx, p.sy); });
        ctx.closePath();
        ctx.fillStyle = 'rgb(' + base.map(function (v) { return Math.round(v * pl.shade); }).join(',') + ')';
        ctx.fill();
        ctx.strokeStyle = ink; ctx.lineWidth = 1.3;
        ctx.stroke();
      });

      ctx.fillStyle = muted; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('ブロック ' + M.count(s) + ' 個', 8, 8);
      canvas.setAttribute('aria-label', '立体の図。ブロック ' + M.count(s) + ' 個。横 ' + s.w + '、奥行き ' + s.d + '、高さ ' + s.h + '。ドラッグまたは矢印キーで回せます。');
    }

    function rotate(dy, dp) {
      state.yaw = ((state.yaw + dy + 540) % 360) - 180;
      state.pitch = Math.max(-10, Math.min(90, state.pitch + dp));
      draw();
    }
    function setView(name) {
      var p = PRESETS[name] || PRESETS.iso;
      state.yaw = p.yaw; state.pitch = p.pitch; draw();
    }

    // ドラッグ(タッチ・ペン・マウス)
    var drag = null;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      rotate((e.clientX - drag.x) * 0.6, (e.clientY - drag.y) * 0.5);
      drag = { x: e.clientX, y: e.clientY };
    });
    function end() { drag = null; }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.addEventListener('keydown', function (e) {
      var m = { ArrowLeft: [-15, 0], ArrowRight: [15, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
      if (m) { e.preventDefault(); rotate(m[0], m[1]); }
    });
    if (window.ResizeObserver) new ResizeObserver(function () { draw(); }).observe(canvas);

    return {
      setSolid: function (s) { state.solid = s; draw(); },
      setView: setView, rotate: rotate, draw: draw
    };
  }

  /* 立体表示と「回す」ボタンをまとめた部品 */
  function widget(opt) {
    var G = root.G;
    var canvas = G.h('canvas', { class: 'a4-3d' });
    var v = null;
    function btn(label, fn, title) { return G.h('button', { class: 'btn small', type: 'button', title: title || label, onclick: fn }, label); }
    var el = G.h('div', { class: 'a4-3d-wrap' },
      canvas,
      G.h('div', { class: 'g-row a4-3d-tools' },
        btn('◀', function () { v.rotate(-30, 0); }, '左へ回す'),
        btn('▶', function () { v.rotate(30, 0); }, '右へ回す'),
        btn('▲', function () { v.rotate(0, -15); }, '下から見る'),
        btn('▼', function () { v.rotate(0, 15); }, '上から見る'),
        opt && opt.noPresets ? null : [
          btn('ななめ', function () { v.setView('iso'); }, 'ななめ上から見る'),
          btn('正面', function () { v.setView('front'); }, '正面から見る'),
          btn('上', function () { v.setView('top'); }, '真上から見る'),
          btn('右', function () { v.setView('right'); }, '右から見る')
        ]));
    v = create(canvas);
    v.el = el;
    return v;
  }

  root.A4View3D = { create: create, widget: widget, PRESETS: PRESETS };
})(typeof self !== 'undefined' ? self : this);
