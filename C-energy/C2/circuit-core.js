/* ===================================================================
   回路コア(部品定義+ソルバ) — C2 電気回路ラボ / C5 回路設計シート 共用
   window.EnergyApps.Circuit
   ・回路は「素子」の配列: { id, type, a: 端子aの節点名, b: 端子bの節点名,
       val(値), on(スイッチ), broken(切れた・こわれた・落ちた) }
   ・電池・電源・LED・メーター・モーターは 端子a が「+」側
   ・I は素子の中を a→b に流れる電流(電池では内部を流れる向き)
   =================================================================== */
(function () {
'use strict';
var NS = window.EnergyApps = window.EnergyApps || {};
if (NS.Circuit) return;

var GMIN = 1e-9, R_WIRE = 0.001;

/* 部品定義 ---------------------------------------------------------- */
var PARTS = {
  wire:      { name: '導線', kind: 'wire', R: R_WIRE },
  battery:   { name: '乾電池', kind: 'source', V: 1.5, r: 0.4, cap: 2.0, polar: true, desc: '単3形乾電池 1.5V。長い線が+極、短く太い線が−極。' },
  supply:    { name: '電源装置', kind: 'source', vals: [1.5, 3, 4.5, 6, 9, 12], def: 3, unit: 'V', r: 0.2, polar: true, desc: '電圧を切りかえられる直流電源。' },
  sw:        { name: 'スイッチ', kind: 'switch', R: R_WIRE, desc: 'タップで入(ON)・切(OFF)。切ると回路が切れて電流が流れない。' },
  lamp:      { name: '豆電球', kind: 'load', Vr: 2.5, Ir: 0.3, burn: 2.2, desc: '2.5V 0.3A 用。電流が流れるとフィラメントが熱くなって光る(電気→光・熱)。' },
  led:       { name: 'LED', kind: 'led', Vf: 1.8, Rs: 15, Imax: 0.02, Iburn: 0.04, polar: true, desc: '発光ダイオード。向きがある(+:アノード)。約1.8V以上で光り、20mAまで。抵抗といっしょに使う。' },
  resistor:  { name: '抵抗', kind: 'load', vals: [10, 47, 100, 220, 470, 1000], def: 100, unit: 'Ω', desc: '電流を流れにくくする部品。値(Ω:オーム)が大きいほど電流は小さくなる。' },
  motor:     { name: 'モーター', kind: 'load', R: 5, Vr: 3, polar: true, desc: '電気→運動。電流の向きを逆にすると回る向きも逆になる。' },
  fuse:      { name: 'ヒューズ', kind: 'protect', vals: [0.5, 1, 2], def: 1, unit: 'A', R: 0.05, desc: '決められた電流をこえると中の金属がとけて切れ、回路を守る。切れたら交換する。' },
  breaker:   { name: 'ブレーカー', kind: 'protect', vals: [0.5, 0.8, 1, 2], def: 1, unit: 'A', R: 0.01, desc: '決められた電流をこえると自動で切れる。原因を取り除いてから入れなおせば、くり返し使える。' },
  ammeter:   { name: '電流計', kind: 'meter', R: 0.01, polar: true, desc: '電流をはかる。はかりたい部分に「直列」につなぐ。+端子を電源の+側に。' },
  voltmeter: { name: '電圧計', kind: 'meter', R: 1e7, polar: true, desc: '電圧をはかる。はかりたい部分に「並列」につなぐ。+端子を電源の+側に。' }
};
function valOf(e) { var d = PARTS[e.type]; return e.val != null ? e.val : (d.def != null ? d.def : d.V); }
function lampR() { var d = PARTS.lamp; return d.Vr / d.Ir; }
function lowR(e) { /* ほぼ0Ωの通り道になる素子か */
  var t = e.type;
  if (t === 'wire' || t === 'ammeter') return true;
  if (t === 'sw') return !!e.on;
  if (t === 'fuse' || t === 'breaker') return !e.broken;
  return false;
}

/* 連立一次方程式(ガウスの消去法・部分ピボット) ------------------- */
function gauss(A, z) {
  var n = z.length, i, j, k;
  for (k = 0; k < n; k++) {
    var p = k, mx = Math.abs(A[k][k]);
    for (i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > mx) { mx = Math.abs(A[i][k]); p = i; }
    if (mx < 1e-300) continue;
    if (p !== k) { var t = A[k]; A[k] = A[p]; A[p] = t; var tz = z[k]; z[k] = z[p]; z[p] = tz; }
    for (i = k + 1; i < n; i++) {
      var f = A[i][k] / A[k][k]; if (f === 0) continue;
      for (j = k; j < n; j++) A[i][j] -= f * A[k][j];
      z[i] -= f * z[k];
    }
  }
  var x = new Array(n);
  for (i = n - 1; i >= 0; i--) {
    var s = z[i];
    for (j = i + 1; j < n; j++) s -= A[i][j] * x[j];
    x[i] = Math.abs(A[i][i]) < 1e-300 ? 0 : s / A[i][i];
  }
  return x;
}

/* 素子のモデル: 端子間コンダクタンス g と、a→b 向きの電流オフセット j
   (素子の電流 I = g·(Va−Vb) − j ) */
function model(e, ledOn) {
  var d = PARTS[e.type], v = valOf(e);
  switch (e.type) {
    case 'wire': return { g: 1 / R_WIRE, j: 0 };
    case 'battery': case 'supply': return { g: 1 / d.r, j: v / d.r };
    case 'sw': return { g: e.on ? 1 / R_WIRE : GMIN, j: 0 };
    case 'lamp': return { g: e.broken ? GMIN : 1 / lampR(), j: 0 };
    case 'led': return e.broken || !ledOn ? { g: GMIN, j: 0 } : { g: 1 / d.Rs, j: d.Vf / d.Rs };
    case 'resistor': return { g: 1 / v, j: 0 };
    case 'motor': return { g: 1 / d.R, j: 0 };
    case 'fuse': case 'breaker': return { g: e.broken ? GMIN : 1 / d.R, j: 0 };
    case 'ammeter': case 'voltmeter': return { g: 1 / d.R, j: 0 };
  }
  return { g: GMIN, j: 0 };
}

/* 1回の解析(LEDの状態はくり返しで決める) */
function solve(els) {
  var idx = {}, names = [];
  els.forEach(function (e) { [e.a, e.b].forEach(function (k) { if (!(k in idx)) { idx[k] = names.length; names.push(k); } }); });
  var n = names.length, ledOn = {}, it, x = [];
  els.forEach(function (e) { if (e.type === 'led') ledOn[e.id] = false; });
  for (it = 0; it < 40; it++) {
    var A = [], z = [], i;
    for (i = 0; i < n; i++) { A.push(new Array(n).fill(0)); A[i][i] = GMIN; z.push(0); }
    els.forEach(function (e) {
      var m = model(e, ledOn[e.id]), a = idx[e.a], b = idx[e.b];
      if (a === b) return;
      A[a][a] += m.g; A[b][b] += m.g; A[a][b] -= m.g; A[b][a] -= m.g;
      z[a] += m.j; z[b] -= m.j;
    });
    x = n ? gauss(A, z) : [];
    var flip = false;
    els.forEach(function (e) {
      if (e.type !== 'led' || e.broken) return;
      var vd = x[idx[e.a]] - x[idx[e.b]], d = PARTS.led;
      if (!ledOn[e.id] && vd > d.Vf + 1e-9) { ledOn[e.id] = true; flip = true; }
      else if (ledOn[e.id] && vd < d.Vf - 1e-9) { ledOn[e.id] = false; flip = true; }
    });
    if (!flip) break;
  }
  /* 基準(0V): 最初の電源の−極 */
  var ref = 0, src = els.filter(function (e) { return PARTS[e.type].kind === 'source'; })[0];
  if (src) ref = x[idx[src.b]];
  var V = {}, out = {};
  names.forEach(function (k, i) { V[k] = x[i] - ref; });
  els.forEach(function (e) {
    var m = model(e, ledOn[e.id]), vd = V[e.a] - V[e.b], I = e.a === e.b ? 0 : m.g * vd - m.j, d = PARTS[e.type], r = { V: vd, I: I };
    if (d.kind === 'source') { r.Iout = -I; r.P = vd * -I; }
    else r.P = vd * I;
    if (e.type === 'lamp') r.bright = e.broken ? 0 : r.P / (d.Vr * d.Ir);
    if (e.type === 'led') r.bright = e.broken ? 0 : Math.max(0, I) / d.Imax;
    if (e.type === 'motor') r.speed = vd / d.Vr;
    out[e.id] = r;
  });
  var info = shortLoops(els);
  return { V: V, el: out, shorts: info.map(function (x) { return x.id; }), shortInfo: info };
}

/* ショート検出 -------------------------------------------------------
   電源(乾電池・電源装置)ごとに、部品(負荷)を1つも通らずに+と−がつながる「輪」を探す。
   通ってよいのは、ほぼ0Ωの素子(lowR)と、ほかの電源だけ。
   ・kind 'wire'  : 導線など(0Ω)だけで+と−がつながっている(ふつうのショート)
   ・kind 'source': ほかの電源を通って輪になり、輪の中の電圧が打ち消し合わない
                    (電池どうしを逆向きに輪にした・直列の電池全体を導線でつないだ など)。
                    with に、輪の中にあるほかの電源の id が入る。
     正しい並列(+と+、−と−)は電圧が打ち消し合うのでショートにしない。
   shortLoops(els) → [{ id, kind, with: [id...], emf: 輪の中の電圧[V] }]
   findShorts(els) → ショートしている電源の id の配列(solve().shorts と同じ) */
function shortLoops(els) {
  var par = {}, out = [];
  function f(k) { while (par[k] !== undefined && par[k] !== k) k = par[k]; return k; }
  function u(a, b) { if (par[a] === undefined) par[a] = a; if (par[b] === undefined) par[b] = b; par[f(a)] = f(b); }
  els.forEach(function (e) { if (lowR(e)) u(e.a, e.b); });
  /* 0Ωの素子とほかの電源でできたつながり(端子aの電位 − 端子bの電位 = dv) */
  var adj = {};
  function link(k, to, dv, e) { (adj[k] = adj[k] || []).push({ to: to, dv: dv, e: e }); }
  els.forEach(function (e) {
    if (e.a === e.b) return;
    var src = PARTS[e.type].kind === 'source';
    if (!src && !lowR(e)) return;
    var dv = src ? valOf(e) : 0;
    link(e.a, e.b, -dv, e); link(e.b, e.a, dv, e);
  });
  els.forEach(function (s) {
    if (PARTS[s.type].kind !== 'source' || s.a === s.b) return;
    if (par[s.a] !== undefined && par[s.b] !== undefined && f(s.a) === f(s.b)) { out.push({ id: s.id, kind: 'wire', with: [], emf: valOf(s) }); return; }
    /* s を除いて、−極(b)から+極(a)へ行けるか。行けたら、その道の電位差を調べる */
    var pot = {}, from = {}, q = [s.b], n;
    pot[s.b] = 0;
    while (q.length && pot[s.a] === undefined) {
      n = q.shift();
      (adj[n] || []).forEach(function (l) {
        if (l.e === s || pot[l.to] !== undefined) return;
        pot[l.to] = pot[n] + l.dv; from[l.to] = { n: n, e: l.e }; q.push(l.to);
      });
    }
    if (pot[s.a] === undefined) return;
    var emf = valOf(s) - (pot[s.a] - pot[s.b]);
    if (Math.abs(emf) < 0.05) return;
    var w = [], k = s.a;
    while (from[k]) { if (PARTS[from[k].e.type].kind === 'source') w.push(from[k].e.id); k = from[k].n; }
    out.push({ id: s.id, kind: w.length ? 'source' : 'wire', with: w, emf: Math.abs(emf) });
  });
  return out;
}
function findShorts(els) { return shortLoops(els).map(function (x) { return x.id; }); }

/* 保護装置・こわれる部品まで含めて落ち着くまで解析する。
   els の broken を書きかえ、起きたこと(events)を返す */
function settle(els) {
  var events = [], sol, k;
  for (k = 0; k < 20; k++) {
    sol = solve(els);
    var ch = false;
    els.forEach(function (e) {
      if ((e.type === 'fuse' || e.type === 'breaker') && !e.broken && Math.abs(sol.el[e.id].I) > valOf(e) + 1e-9) {
        e.broken = true; ch = true; events.push({ id: e.id, type: e.type, I: Math.abs(sol.el[e.id].I) });
      }
    });
    if (ch) continue;
    els.forEach(function (e) {
      var r = sol.el[e.id];
      if (e.type === 'lamp' && !e.broken && r.P > PARTS.lamp.Vr * PARTS.lamp.Ir * PARTS.lamp.burn) { e.broken = true; ch = true; events.push({ id: e.id, type: 'lamp' }); }
      if (e.type === 'led' && !e.broken && r.I > PARTS.led.Iburn) { e.broken = true; ch = true; events.push({ id: e.id, type: 'led' }); }
    });
    if (!ch) break;
  }
  return { sol: sol, events: events };
}

/* 電池の持ち(時間): 電池ごとの電流から、いちばん早くなくなる電池 */
function batteryHours(els, sol) {
  var h = Infinity;
  els.forEach(function (e) {
    if (e.type !== 'battery') return;
    var I = Math.abs(sol.el[e.id].Iout);
    if (I > 1e-4) h = Math.min(h, PARTS.battery.cap / I);
  });
  return h;
}

NS.Circuit = { PARTS: PARTS, valOf: valOf, solve: solve, settle: settle, findShorts: findShorts, shortLoops: shortLoops, batteryHours: batteryHours, lowR: lowR, gauss: gauss };
})();
