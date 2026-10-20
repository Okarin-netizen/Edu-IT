/*
 * 材料の基本データ materials.js(全アプリで共有する「目安値」)
 * E: ヤング率(曲げ)GPa / density: 密度 g/cm³ / strength: 強さの目安 MPa
 *   木材・木質材料は曲げ強さ、金属は降伏点(変形が戻らなくなり始める強さ)、プラスチックは曲げ強さ。
 * 値は一般的な文献値を丸めた代表値。木材は気乾状態(含水率15%前後)・繊維方向。
 * 樹種・等級・製品・含水率・温度で大きく変わるので、必ず「目安」と表示すること。
 */
(function (root) {
  var list = [
    { id: 'sugi', name: 'スギ', kind: 'wood', E: 7.5, density: 0.38, strength: 65 },
    { id: 'hinoki', name: 'ヒノキ', kind: 'wood', E: 9.0, density: 0.44, strength: 75 },
    { id: 'lauan', name: 'ラワン', kind: 'wood', E: 10.0, density: 0.55, strength: 80 },
    { id: 'glulam', name: '集成材', kind: 'wood', E: 8.0, density: 0.45, strength: 55 },
    { id: 'plywood', name: '合板', kind: 'wood', E: 7.0, density: 0.55, strength: 50 },
    { id: 'mdf', name: 'MDF', kind: 'wood', E: 3.0, density: 0.70, strength: 30 },
    { id: 'steel', name: '鉄(軟鋼)', kind: 'metal', E: 206, density: 7.87, strength: 245 },
    { id: 'aluminum', name: 'アルミニウム', kind: 'metal', E: 70, density: 2.70, strength: 110 },
    { id: 'copper', name: '銅', kind: 'metal', E: 120, density: 8.96, strength: 70 },
    { id: 'stainless', name: 'ステンレス', kind: 'metal', E: 193, density: 7.93, strength: 205 },
    { id: 'acrylic', name: 'アクリル', kind: 'plastic', E: 3.2, density: 1.19, strength: 100 },
    { id: 'pp', name: 'ポリプロピレン', kind: 'plastic', E: 1.5, density: 0.91, strength: 40 },
    { id: 'pvc', name: '塩化ビニル', kind: 'plastic', E: 3.0, density: 1.40, strength: 80 },
    { id: 'abs', name: 'ABS樹脂', kind: 'plastic', E: 2.3, density: 1.05, strength: 65 },
    { id: 'pet', name: 'PET', kind: 'plastic', E: 2.8, density: 1.38, strength: 80 }
  ];
  var api = {
    list: list,
    kinds: { wood: '木材', metal: '金属', plastic: 'プラスチック' },
    source: '一般的な文献値を丸めた目安値です。もとは木材工業の便覧、理科年表、材料メーカーの公開資料などです。',
    get: function (id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; },
    byKind: function (k) { return list.filter(function (m) { return m.kind === k; }); }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.G = root.G || {}; root.G.materials = api; }
})(typeof self !== 'undefined' ? self : this);
