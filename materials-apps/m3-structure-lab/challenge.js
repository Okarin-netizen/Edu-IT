/*
 * challenge.js — 設計課題「荷重に耐える棚板を最小の材料で」
 * Beam(beam.js)が先に読み込まれている必要がある。
 */
(function (root, factory) {
  var Beam = root.Beam || (typeof require === 'function' ? require('../common/beam.js') : null);
  var api = factory(Beam);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Challenge = api;
})(typeof self !== 'undefined' ? self : this, function (Beam) {
  'use strict';

  var THICKNESS = [6, 9, 12, 15, 18, 21, 24, 30];   // 市販の板厚の例(mm)
  var RIB = { w: 15, h: 20 };                        // 補強リブ(角材)の断面
  var MATERIALS = ['sugi', 'hinoki', 'lauan', 'plywood'];

  var LEVELS = [
    { id: 'lv1', title: '本棚の棚板', story: '両はしを支えた棚板の真ん中に、10kgの物をのせる。',
      support: 'simple', loadType: 'point', span: 600, width: 200, loadKg: 10, maxDeflection: 3, minSafety: 3 },
    { id: 'lv2', title: '壁から出た棚', story: '片方だけを壁に固定した棚の先に、5kgの物をのせる。',
      support: 'cantilever', loadType: 'point', span: 300, width: 150, loadKg: 5, maxDeflection: 3, minSafety: 3 },
    { id: 'lv3', title: '長い本棚', story: '両はしを支えた長い棚板に、本を合計20kg、全体にならべる。',
      support: 'simple', loadType: 'uniform', span: 900, width: 250, loadKg: 20, maxDeflection: 4.5, minSafety: 3 }
  ];

  function level(id) { for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return LEVELS[i]; return LEVELS[0]; }

  function sectionOf(lv, design) {
    var ribs = Math.max(0, Math.min(3, Math.floor(design.ribs || 0)));
    return ribs ? { shape: 'ribbed', b: lv.width, t: design.t, ribs: ribs, ribW: RIB.w, ribH: RIB.h }
                : { shape: 'rect', b: lv.width, t: design.t };
  }

  // design: { material, t, ribs }
  function evaluate(lv, design) {
    var r = Beam.analyze({ material: design.material, section: sectionOf(lv, design), span: lv.span,
      loadKg: lv.loadKg, support: lv.support, loadType: lv.loadType });
    if (!r.ok) return { ok: false, error: r.error, pass: false };
    var okD = r.deflection <= lv.maxDeflection, okS = r.safety >= lv.minSafety;
    return { ok: true, result: r, okDeflection: okD, okSafety: okS, pass: okD && okS, massG: r.mass * 1000 };
  }

  // 条件を満たす中でいちばん軽い組み合わせ(星の基準に使う。生徒には答えとして見せない)
  function best(lv) {
    var b = null;
    MATERIALS.forEach(function (m) {
      THICKNESS.forEach(function (t) {
        for (var ribs = 0; ribs <= 3; ribs++) {
          var e = evaluate(lv, { material: m, t: t, ribs: ribs });
          if (e.pass && (!b || e.massG < b.massG)) b = { material: m, t: t, ribs: ribs, massG: e.massG };
        }
      });
    });
    return b;
  }

  // 星: 1 = 条件クリア、2 = 最軽量の 1.3 倍以内、3 = 1.05 倍以内
  function stars(lv, ev) {
    if (!ev || !ev.pass) return 0;
    var b = best(lv);
    if (!b) return 1;
    if (ev.massG <= b.massG * 1.05) return 3;
    if (ev.massG <= b.massG * 1.3) return 2;
    return 1;
  }

  return { LEVELS: LEVELS, THICKNESS: THICKNESS, RIB: RIB, MATERIALS: MATERIALS,
    level: level, sectionOf: sectionOf, evaluate: evaluate, best: best, stars: stars };
});
