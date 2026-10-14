/*
 * frame.js — 枠組みの変形モデル(簡易)
 * 四角形の枠は節点がまわるので形が変わる。三角形(筋かい・面材)は形が変わらないものとして扱う(拘束法)。
 * <script src> なら window.Frame、Node なら require で使える。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Frame = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // flex: 押した量に対して実際に動く割合(1 = 押しただけ動く、0 = 動かない)
  var MODES = {
    none:   { label: '補強なし',               flex: 1,    triangles: 0 },
    corner: { label: '角に三角の板(すみ板)',  flex: 0.18, triangles: 2 },
    brace:  { label: '筋かい(斜めの材)',      flex: 0,    triangles: 2 },
    cross:  { label: 'たすき掛け(筋かい2本)', flex: 0,    triangles: 4 },
    panel:  { label: '板を全面に張る(面材)',  flex: 0,    triangles: 0 }
  };

  /*
   * deform(mode, push, W, H)
   *  push: 上の横材を横に押した量(右が +)。W, H: 枠の幅と高さ。
   *  戻り値: { nodes:{bl,br,tl,tr}, shift, angleDeg, brace: 'tension'|'compression'|null }
   *  下の2点は固定。柱の長さ H は変わらず、柱がかたむく。
   */
  function deform(mode, push, W, H) {
    var m = MODES[mode] || MODES.none;
    var p = isFinite(push) ? push : 0;
    var shift = p * m.flex;
    var maxShift = H * 0.7;                       // たおれきらないように
    shift = Math.max(-maxShift, Math.min(maxShift, shift));
    var y = Math.sqrt(H * H - shift * shift);     // 柱の長さを保つ
    var nodes = { bl: [0, 0], br: [W, 0], tl: [shift, y], tr: [W + shift, y] };
    var brace = null;
    if ((mode === 'brace' || mode === 'cross') && p !== 0) {
      // 左下→右上の筋かい: 右に押すと引っ張られ、左に押すと押される
      brace = p > 0 ? 'tension' : 'compression';
    }
    return { nodes: nodes, shift: shift, angleDeg: Math.asin(shift / H) * 180 / Math.PI, brace: brace };
  }

  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

  return { MODES: MODES, deform: deform, dist: dist };
});
