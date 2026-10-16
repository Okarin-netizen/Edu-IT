/* M7 お手本の形。行は上から。'.' 空き '#' ぬる 'a' ◣ 'b' ◢ 'c' ◥ 'd' ◤
 * front: 正面図(幅×高さ)、top: 平面図(幅×奥行き。下の行が手前)、side: 右側面図(奥行き×高さ。左の列が手前) */
(function (root) {
  'use strict';
  function fill(U, V) { var r = []; for (var i = 0; i < V; i++) r.push(new Array(U + 1).join('#')); return r; }
  var S = [
    { id: 'l', label: 'L字ブロック', W: 4, D: 3, H: 3,
      front: ['#...', '#...', '####'], top: fill(4, 3), side: fill(3, 3) },
    { id: 'step', label: '階段の形', W: 3, D: 3, H: 3,
      front: ['#..', '##.', '###'], top: fill(3, 3), side: fill(3, 3) },
    { id: 'groove', label: 'みぞのあるブロック', W: 5, D: 3, H: 3,
      front: ['##.##', '##.##', '#####'], top: fill(5, 3), side: fill(3, 3) },
    { id: 'hole', label: '四角い穴のあいた板(かくれ線)', W: 4, D: 4, H: 2,
      front: fill(4, 2), top: ['####', '#..#', '#..#', '####'], side: fill(4, 2) },
    { id: 'wedge', label: 'くさび(ななめの面)', W: 4, D: 3, H: 3,
      front: ['a...', '#a..', '##a.'], top: ['###.', '###.', '###.'], side: fill(3, 3) },
    { id: 'roof', label: '屋根の形(三角柱)', W: 4, D: 3, H: 2,
      front: ['.ba.', 'b##a'], top: fill(4, 3), side: fill(3, 2) },
    { id: 'bracket', label: 'L形ブラケット(ななめの補強)', W: 6, D: 4, H: 5,
      front: ['#.....', '#.....', '#a....', '##a...', '######'], top: fill(6, 4), side: fill(4, 5) },
    { id: 'shelf', label: '本立て(コの字)', W: 6, D: 3, H: 4,
      front: ['#....#', '#....#', '#....#', '######'], top: fill(6, 3), side: fill(3, 4) },
    { id: 'chamfer', label: '角を面取りしたブロック', W: 3, D: 3, H: 3,
      front: ['##a', '###', '###'], top: fill(3, 3), side: ['b##', '###', '###'] }
  ];
  root.SolidSamples = S;
})(typeof self !== 'undefined' ? self : this);
