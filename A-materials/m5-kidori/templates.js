/*
 * templates.js — 製作品のひな形(本立て・箱・棚)
 * 外寸 W(幅)× D(奥行き)× H(高さ)と板の厚さ t から、部品と立体での位置を作る。
 * 立体の座標: x = 幅(右へ)、y = 奥行き(奥へ)、z = 高さ(上へ)。単位 mm。
 * 部品の l(長さ)は木目の方向にとる。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KidoriTemplates = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // box: 立体の位置 [x, y, z] と大きさ [sx, sy, sz]
  function part(key, name, l, w, t, pos, size) {
    return { key: key, name: name, l: Math.round(l * 10) / 10, w: Math.round(w * 10) / 10, t: t, box: { pos: pos, size: size } };
  }

  var list = {
    bookstand: {
      label: '本立て',
      defaults: { W: 400, D: 180, H: 220 },
      note: '側板で底板と背板をはさむ形です。背板の高さは、側板の半分ほどにしています。',
      build: function (W, D, H, t) {
        var inner = W - 2 * t, hb = Math.round((H - t) / 2);
        return [
          part('side-l', '側板(左)', H, D, t, [0, 0, 0], [t, D, H]),
          part('side-r', '側板(右)', H, D, t, [W - t, 0, 0], [t, D, H]),
          part('bottom', '底板', inner, D, t, [t, 0, 0], [inner, D, t]),
          part('back', '背板', inner, hb, t, [t, D - t, t], [inner, t, hb])
        ];
      }
    },
    box: {
      label: '箱(ふたなし)',
      defaults: { W: 300, D: 180, H: 120 },
      note: '底板の上に、前板・後ろ板と側板を立てる形です。',
      build: function (W, D, H, t) {
        var h = H - t, inD = D - 2 * t;
        return [
          part('bottom', '底板', W, D, t, [0, 0, 0], [W, D, t]),
          part('front', '前板', W, h, t, [0, 0, t], [W, t, h]),
          part('rear', '後ろ板', W, h, t, [0, D - t, t], [W, t, h]),
          part('side-l', '側板(左)', inD, h, t, [0, t, t], [t, inD, h]),
          part('side-r', '側板(右)', inD, h, t, [W - t, t, t], [t, inD, h])
        ];
      }
    },
    shelf: {
      label: '棚(2段)',
      defaults: { W: 450, D: 180, H: 400 },
      note: '側板で天板・棚板・底板をはさむ形です。背板はありません(筋かいや背板で補強を考えよう)。',
      build: function (W, D, H, t) {
        var inner = W - 2 * t, mid = Math.round((H - t) / 2);
        return [
          part('side-l', '側板(左)', H, D, t, [0, 0, 0], [t, D, H]),
          part('side-r', '側板(右)', H, D, t, [W - t, 0, 0], [t, D, H]),
          part('top', '天板', inner, D, t, [t, 0, H - t], [inner, D, t]),
          part('shelf', '棚板', inner, D, t, [t, 0, mid], [inner, D, t]),
          part('bottom', '底板', inner, D, t, [t, 0, 0], [inner, D, t])
        ];
      }
    }
  };

  // 寸法を確かめてから作る。返り値: {ok, parts?, error?}
  function build(type, W, D, H, t) {
    var tp = list[type];
    if (!tp) return { ok: false, error: 'ひな形が見つかりません' };
    if (!(t > 0)) return { ok: false, error: '板の厚さを0より大きくしてください' };
    if (!(W > 2 * t) || !(D > 2 * t) || !(H > 2 * t)) return { ok: false, error: '幅・奥行き・高さは、板の厚さの2倍より大きくしてください' };
    if (W > 3000 || D > 3000 || H > 3000) return { ok: false, error: '大きすぎます(3000 mm まで)' };
    return { ok: true, parts: tp.build(W, D, H, t) };
  }

  return { list: list, build: build };
});
