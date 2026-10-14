/* 線の集まりを SVG にかく(三面図・1つの図・等角図)。文字列で返す。 */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  function linesSVG(M, keys, map, cls) {
    return M.mergeSegments(keys).map(function (s) {
      var a = map(s[0], s[1]), b = map(s[2], s[3]);
      return '<line class="' + cls + '" x1="' + a[0].toFixed(2) + '" y1="' + a[1].toFixed(2) +
        '" x2="' + b[0].toFixed(2) + '" y2="' + b[1].toFixed(2) + '"/>';
    }).join('');
  }

  /* 第三角法の配置: 平面図は正面図の上、右側面図は正面図の右 */
  function threeView(views, opt) {
    var M = root.M4Core;
    opt = opt || {};
    var cell = opt.cell || 26, gap = cell * 1.2, pad = cell * 0.6, lab = opt.labels === false ? 0 : 20;
    var F = views.front.dims, T = views.top.dims, R = views.right.dims;
    var W = pad * 2 + F.U * cell + gap + R.U * cell;
    var H = pad * 2 + T.V * cell + gap + F.V * cell + lab;
    var org = {
      top: [pad, pad],
      front: [pad, pad + T.V * cell + gap],
      right: [pad + F.U * cell + gap, pad + T.V * cell + gap]
    };
    var out = '<svg xmlns="' + NS + '" class="m4-views" viewBox="0 0 ' + W.toFixed(1) + ' ' + H.toFixed(1) +
      '" width="' + W.toFixed(0) + '" height="' + H.toFixed(0) + '" role="img" aria-label="' + (opt.aria || '三面図') + '">';
    if (opt.guides) {
      // 投影の対応を示す細い補助線
      var fy = org.front[1], ty = org.top[1] + T.V * cell, rx = org.right[0];
      out += '<g class="m4-guide">';
      for (var u = 0; u <= F.U; u++) out += '<line x1="' + (pad + u * cell) + '" y1="' + ty + '" x2="' + (pad + u * cell) + '" y2="' + fy + '"/>';
      for (var v = 0; v <= F.V; v++) out += '<line x1="' + (pad + F.U * cell) + '" y1="' + (fy + v * cell) + '" x2="' + rx + '" y2="' + (fy + v * cell) + '"/>';
      out += '</g>';
    }
    ['top', 'front', 'right'].forEach(function (name) {
      var o = org[name];
      var map = function (u, v) { return [o[0] + u * cell, o[1] + v * cell]; };
      out += '<g>' + linesSVG(M, views[name].hidden, map, 'm4-hid') + linesSVG(M, views[name].visible, map, 'm4-vis') + '</g>';
      if (lab) {
        var d = views[name].dims, label = { top: '平面図', front: '正面図', right: '右側面図' }[name];
        var ly = name === 'top' ? o[1] + d.V * cell + 14 : o[1] + d.V * cell + 16;
        out += '<text class="m4-lab" x="' + (o[0] + d.U * cell / 2) + '" y="' + ly + '" text-anchor="middle">' + label + '</text>';
      }
    });
    return out + '</svg>';
  }

  /* 等角図(見える線だけ) */
  function iso(lines, opt) {
    var M = root.M4Core;
    opt = opt || {};
    var cell = opt.cell || 26, pad = cell * 0.6;
    var pts = [];
    lines.visible.forEach(function (k) { var p = M.parseKey(k); pts.push([p[0], p[1]], [p[2], p[3]]); });
    var iMin = Math.min.apply(null, pts.map(function (p) { return p[0]; })), iMax = Math.max.apply(null, pts.map(function (p) { return p[0]; }));
    var jMin = Math.min.apply(null, pts.map(function (p) { return p[1]; })), jMax = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
    var map = function (i, j) { return [pad + (i - iMin) * M.C30 * cell, pad + (j - jMin) * 0.5 * cell]; };
    var W = pad * 2 + (iMax - iMin) * M.C30 * cell, H = pad * 2 + (jMax - jMin) * 0.5 * cell;
    return '<svg xmlns="' + NS + '" class="m4-views" viewBox="0 0 ' + W.toFixed(1) + ' ' + H.toFixed(1) + '" width="' + W.toFixed(0) +
      '" height="' + H.toFixed(0) + '" role="img" aria-label="' + (opt.aria || '等角図') + '">' + linesSVG(M, lines.visible, map, 'm4-vis') + '</svg>';
  }

  root.M4SVG = { threeView: threeView, iso: iso, linesSVG: linesSVG };
})(typeof self !== 'undefined' ? self : this);
