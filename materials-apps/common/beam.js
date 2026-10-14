/*
 * beam.js — 梁(はり)の計算エンジン(構造強化ラボ M3 と 木取り・構想シミュレータ M5 で共有)
 *
 * 外部ライブラリなし。<script src="beam.js"> で読むと window.Beam、
 * Node では require('./beam.js') で同じオブジェクトが得られる。
 *
 * 単位: 長さ mm、力 N、応力・ヤング率 N/mm²(= MPa)、質量 kg、密度 g/cm³。
 * 数値はすべて「目安」。実際の木材は節・木目・含水率で大きくばらつく。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Beam = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var G = 9.80665; // 重力加速度 m/s²

  // 材料の目安値。E: ヤング率 N/mm²、strength: 曲げ強さ(木材・樹脂)または降伏点(金属)N/mm²。
  // common/materials.js(全アプリ共通の目安値、E は GPa)があればそちらを使い、数値を全アプリでそろえる。
  // ない場合(Node のテストや単体利用)は、同じ値を写した下の表を使う。
  var SOURCE = '一般的な文献値(木材工業の便覧、理科年表、材料メーカーの公開資料など)を丸めた目安値です。';
  var BUILTIN = [
    ['sugi', 'スギ', 'wood', 7.5, 0.38, 65], ['hinoki', 'ヒノキ', 'wood', 9.0, 0.44, 75],
    ['lauan', 'ラワン', 'wood', 10.0, 0.55, 80], ['glulam', '集成材', 'wood', 8.0, 0.45, 55],
    ['plywood', '合板', 'wood', 7.0, 0.55, 50], ['mdf', 'MDF', 'wood', 3.0, 0.70, 30],
    ['steel', '鉄(軟鋼)', 'metal', 206, 7.87, 245], ['aluminum', 'アルミニウム', 'metal', 70, 2.70, 110],
    ['acrylic', 'アクリル', 'plastic', 3.2, 1.19, 100]
  ];
  var MATERIALS = {};
  (function () {
    var common = typeof self !== 'undefined' && self.G && self.G.materials;
    var list = common ? common.list : BUILTIN.map(function (a) {
      return { id: a[0], name: a[1], kind: a[2], E: a[3], density: a[4], strength: a[5] };
    });
    list.forEach(function (m) {
      MATERIALS[m.id] = { name: m.name, kind: m.kind, E: m.E * 1000, strength: m.strength, density: m.density };
    });
    if (common && common.source) SOURCE = common.source;
  })();

  function num(v) { return typeof v === 'number' && isFinite(v); }
  function pos(v) { return num(v) && v > 0; }

  /* ---------- 断面 ---------- */
  // 断面は長方形の集まり [{y, w, h}] で表す。y は長方形の下端の高さ(断面の最下端が 0)。
  function composite(rects) {
    var A = 0, Ay = 0, top = 0;
    rects.forEach(function (r) { A += r.w * r.h; Ay += r.w * r.h * (r.y + r.h / 2); top = Math.max(top, r.y + r.h); });
    if (!(A > 0)) return { A: 0, I: 0, yc: 0, c: 0, height: top, rects: rects };
    var yc = Ay / A, I = 0;
    rects.forEach(function (r) { var d = r.y + r.h / 2 - yc; I += r.w * Math.pow(r.h, 3) / 12 + r.w * r.h * d * d; });
    return { A: A, I: I, yc: yc, c: Math.max(yc, top - yc), height: top, rects: rects };
  }

  var SHAPES = ['rect', 'ribbed', 'L', 'channel', 'box'];

  /*
   * section(spec)
   *  rect:    { shape:'rect', b, t }                  板(幅 b × 厚み t)
   *  ribbed:  { shape:'ribbed', b, t, ribs, ribW, ribH } 板の下にリブ(補強材)を ribs 本
   *  L:       { shape:'L', b, h, t }                  L形(上の板 b、たて h、板厚 t)
   *  channel: { shape:'channel', b, h, t }            コの字(下向きに開く)
   *  box:     { shape:'box', b, h, t }                箱形(中空の長方形)
   * 不正な寸法は { ok:false, error } を返す(例外は投げない)。
   */
  function section(spec) {
    spec = spec || {};
    var s = spec.shape || 'rect', b = spec.b, t = spec.t, h = spec.h, rects;
    if (SHAPES.indexOf(s) < 0) return fail('断面の形が不明です');
    if (!pos(b)) return fail('幅は0より大きくしてください');
    if (!pos(t)) return fail('厚みは0より大きくしてください');
    if (s === 'rect') {
      rects = [{ y: 0, w: b, h: t }];
    } else if (s === 'ribbed') {
      var n = Math.max(0, Math.floor(spec.ribs || 0)), rw = spec.ribW, rh = spec.ribH;
      if (n > 0 && (!pos(rw) || !pos(rh))) return fail('リブの幅と高さは0より大きくしてください');
      if (n * (rw || 0) > b) return fail('リブが板の幅に入りきりません');
      rects = n > 0 ? [{ y: rh, w: b, h: t }] : [{ y: 0, w: b, h: t }];
      for (var i = 0; i < n; i++) rects.push({ y: 0, w: rw, h: rh });
    } else {
      if (!pos(h)) return fail('高さは0より大きくしてください');
      if (h <= t) return fail('高さは板厚より大きくしてください');
      if (s === 'L') {
        if (b <= t) return fail('幅は板厚より大きくしてください');
        rects = [{ y: h - t, w: b, h: t }, { y: 0, w: t, h: h - t }];
      } else if (s === 'channel') {
        if (b <= 2 * t) return fail('幅は板厚の2倍より大きくしてください');
        rects = [{ y: h - t, w: b, h: t }, { y: 0, w: t, h: h - t }, { y: 0, w: t, h: h - t }];
      } else { // box
        if (b <= 2 * t || h <= 2 * t) return fail('幅と高さは板厚の2倍より大きくしてください');
        rects = [{ y: h - t, w: b, h: t }, { y: 0, w: b, h: t }, { y: t, w: t, h: h - 2 * t }, { y: t, w: t, h: h - 2 * t }];
      }
    }
    var r = composite(rects);
    r.ok = true; r.shape = s;
    return r;
  }
  function fail(msg) { return { ok: false, error: msg, A: 0, I: 0, c: 0 }; }

  /* ---------- 梁の公式 ---------- */
  // support: 'simple'(両端支持)| 'cantilever'(片持ち)
  // loadType: 'point'(中央 or 先端に集中荷重 P[N])| 'uniform'(全長に等分布、合計 P[N])
  var CASES = {
    simple:     { point:   { d: function (P, L, EI) { return P * L * L * L / (48 * EI); }, M: function (P, L) { return P * L / 4; } },
                  uniform: { d: function (P, L, EI) { return 5 * P * L * L * L / (384 * EI); }, M: function (P, L) { return P * L / 8; } } },
    cantilever: { point:   { d: function (P, L, EI) { return P * L * L * L / (3 * EI); }, M: function (P, L) { return P * L; } },
                  uniform: { d: function (P, L, EI) { return P * L * L * L / (8 * EI); }, M: function (P, L) { return P * L / 2; } } }
  };

  function deflection(P, L, E, I, support, loadType) {
    var c = (CASES[support || 'simple'] || {})[loadType || 'point'];
    if (!c || !num(P) || !pos(L) || !pos(E) || !pos(I)) return NaN;
    return c.d(P, L, E * I);
  }
  function maxMoment(P, L, support, loadType) {
    var c = (CASES[support || 'simple'] || {})[loadType || 'point'];
    if (!c || !num(P) || !pos(L)) return NaN;
    return c.M(P, L);
  }

  /*
   * たわみ曲線 y(x)/δmax(0〜1)を返す。x は 0〜L(片持ちは x=0 が固定端)。
   * 描画用。
   */
  function shape(x, L, support, loadType) {
    var u = Math.min(1, Math.max(0, x / L));
    if (support === 'cantilever') {
      if (loadType === 'uniform') return (u * u * (6 - 4 * u + u * u)) / 3;
      return u * u * (3 - u) / 2;
    }
    if (loadType === 'uniform') return (16 / 5) * (u - 2 * u * u * u + u * u * u * u);
    var v = u <= 0.5 ? u : 1 - u;
    return v * (3 - 4 * v * v); // 中央で 1
  }

  /*
   * analyze(opts) — まとめて計算する
   *  opts: { material:'sugi' | {E,strength,density}, section:{...}, span:L[mm],
   *          load:P[N] または loadKg:[kg], support, loadType }
   *  戻り値: { ok, error?, I, A, c, deflection[mm], moment[N·mm], stress[MPa],
   *           safety(強さ ÷ 応力), mass[kg], ratio(L/δ), level, warnings[] }
   */
  function analyze(opts) {
    opts = opts || {};
    var mat = typeof opts.material === 'string' ? MATERIALS[opts.material] : opts.material;
    if (!mat || !pos(mat.E)) return { ok: false, error: '材料を選んでください' };
    var sec = section(opts.section);
    if (!sec.ok) return { ok: false, error: sec.error };
    var L = opts.span;
    if (!pos(L)) return { ok: false, error: '支点間距離は0より大きくしてください' };
    var P = num(opts.load) ? opts.load : num(opts.loadKg) ? opts.loadKg * G : NaN;
    if (!num(P) || P < 0) return { ok: false, error: '荷重は0以上にしてください' };
    var support = opts.support === 'cantilever' ? 'cantilever' : 'simple';
    var loadType = opts.loadType === 'uniform' ? 'uniform' : 'point';

    var d = deflection(P, L, mat.E, sec.I, support, loadType);
    var M = maxMoment(P, L, support, loadType);
    var stress = M * sec.c / sec.I;
    var safety = stress > 0 && pos(mat.strength) ? mat.strength / stress : Infinity;
    var mass = pos(mat.density) ? sec.A * L * mat.density / 1e6 : NaN; // mm³ × g/cm³ → kg
    var warnings = [];
    if (d > L / 10) warnings.push('たわみが大きすぎて、この公式で正しく計算できる範囲をこえています');
    if (safety < 1) warnings.push('計算上、こわれる大きさの力です');
    return {
      ok: true, support: support, loadType: loadType, P: P, L: L, E: mat.E,
      I: sec.I, A: sec.A, c: sec.c, section: sec,
      deflection: d, moment: M, stress: stress, safety: safety, mass: mass,
      ratio: d > 0 ? L / d : Infinity,
      level: safetyLevel(safety), warnings: warnings
    };
  }

  // 安全率の段階(色に頼らない表示のため文字も返す)
  function safetyLevel(sf) {
    if (!(sf >= 1)) return { id: 'break', label: 'こわれる', mark: '✕' };
    if (sf < 1.5) return { id: 'danger', label: 'こわれるおそれ', mark: '!' };
    if (sf < 3) return { id: 'caution', label: '注意', mark: '△' };
    return { id: 'ok', label: '余裕あり', mark: '○' };
  }

  function kgToN(kg) { return kg * G; }
  function nToKg(n) { return n / G; }

  return {
    G: G, MATERIALS: MATERIALS, SOURCE: SOURCE, SHAPES: SHAPES,
    section: section, composite: composite,
    deflection: deflection, maxMoment: maxMoment, shape: shape,
    analyze: analyze, safetyLevel: safetyLevel, kgToN: kgToN, nToKg: nToKg
  };
});
