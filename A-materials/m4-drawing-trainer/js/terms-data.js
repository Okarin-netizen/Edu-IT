/* 線の種類・寸法の記入ルールのミニテスト(文章・図はこのアプリのために作ったもの)。
 * fig は M4Terms.FIGS のキー。a は正解の選択肢の番号(0から)。 */
(function (root) {
  'use strict';
  var S = 'xmlns="http://www.w3.org/2000/svg" class="m4-fig" role="img"';
  function line(dash, width, label) {
    return '<svg ' + S + ' viewBox="0 0 240 50" aria-label="' + label + '"><line x1="15" y1="25" x2="225" y2="25" stroke="currentColor" stroke-width="' +
      width + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' stroke-linecap="butt"/></svg>';
  }
  var ARROW = function (x, y, dir) {
    return '<path d="M' + x + ' ' + y + ' l' + (dir * 10) + ' -4 v8 z" fill="currentColor"/>';
  };
  var FIGS = {
    thick: line('', 4, '太い実線の見本'),
    dashed: line('8 5', 1.6, '細い破線の見本'),
    chain: line('22 4 3 4', 1.4, '細い一点鎖線の見本'),
    chain2: line('22 4 3 4 3 4', 1.4, '細い二点鎖線の見本'),
    dim: '<svg ' + S + ' viewBox="0 0 260 150" aria-label="寸法の入れ方の図。アとイの線がある">' +
      '<rect x="50" y="70" width="160" height="60" fill="none" stroke="currentColor" stroke-width="3.5"/>' +
      '<line x1="50" y1="64" x2="50" y2="22" stroke="currentColor" stroke-width="1.2"/>' +
      '<line x1="210" y1="64" x2="210" y2="22" stroke="currentColor" stroke-width="1.2"/>' +
      '<line x1="50" y1="32" x2="210" y2="32" stroke="currentColor" stroke-width="1.2"/>' +
      ARROW(50, 32, 1) + ARROW(210, 32, -1) +
      '<text x="130" y="27" text-anchor="middle" font-size="15" fill="currentColor">160</text>' +
      '<text x="150" y="50" font-size="15" font-weight="bold" fill="currentColor">ア</text>' +
      '<line x1="146" y1="45" x2="140" y2="34" stroke="currentColor" stroke-width="0.8"/>' +
      '<text x="222" y="50" font-size="15" font-weight="bold" fill="currentColor">イ</text>' +
      '<line x1="220" y1="46" x2="212" y2="46" stroke="currentColor" stroke-width="0.8"/>' +
      '</svg>',
    hole: '<svg ' + S + ' viewBox="0 0 200 140" aria-label="円の穴に線が引かれた図">' +
      '<rect x="30" y="20" width="140" height="100" fill="none" stroke="currentColor" stroke-width="3.5"/>' +
      '<circle cx="100" cy="70" r="26" fill="none" stroke="currentColor" stroke-width="3.5"/>' +
      '<line x1="62" y1="70" x2="138" y2="70" stroke="currentColor" stroke-width="1.3" stroke-dasharray="16 3 3 3"/>' +
      '<line x1="100" y1="32" x2="100" y2="108" stroke="currentColor" stroke-width="1.3" stroke-dasharray="16 3 3 3"/>' +
      '</svg>',
    iso: '<svg ' + S + ' viewBox="0 0 200 150" aria-label="等角図の3つの軸">' +
      '<line x1="100" y1="80" x2="100" y2="15" stroke="currentColor" stroke-width="2"/>' +
      '<line x1="100" y1="80" x2="40" y2="115" stroke="currentColor" stroke-width="2"/>' +
      '<line x1="100" y1="80" x2="160" y2="115" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M100 60 A20 20 0 0 0 83 90" fill="none" stroke="currentColor" stroke-width="1"/>' +
      '<text x="70" y="72" font-size="16" fill="currentColor">?</text></svg>'
  };

  var BANK = [
    { fig: 'thick', q: 'この線(太い実線)は、何という線ですか。', c: ['外形線', 'かくれ線', '中心線', '寸法線'], a: 0,
      e: '品物の見える形(外形)は、太い実線でかきます。' },
    { fig: 'dashed', q: 'この線(細かく切れた破線)は、何という線ですか。', c: ['寸法補助線', 'かくれ線', '中心線', '外形線'], a: 1,
      e: '外から見えない部分の形は、破線(かくれ線)でかきます。' },
    { fig: 'chain', q: 'この線(長い線と点をくり返す一点鎖線)は、何という線ですか。', c: ['外形線', 'かくれ線', '中心線', '寸法線'], a: 2,
      e: '穴や円柱の中心、左右対称の中心などは、細い一点鎖線(中心線)でかきます。' },
    { fig: 'dim', q: '図のアの線(矢印が付いている線)は、何という線ですか。', c: ['寸法補助線', '寸法線', '外形線', '中心線'], a: 1,
      e: '寸法を表す細い実線が寸法線です。両はしに矢印を付けます。' },
    { fig: 'dim', q: '図のイの線(品物のはしから引き出した線)は、何という線ですか。', c: ['寸法線', 'かくれ線', '寸法補助線', '外形線'], a: 2,
      e: '寸法線を引くために、品物のはしから引き出す細い実線が寸法補助線です。' },
    { fig: 'hole', q: '図の円の中を十字に通っている細い線は、何を表していますか。', c: ['見えない部分の形', '穴の中心', '寸法', '材料の厚さ'], a: 1,
      e: '穴の中心は、細い一点鎖線(中心線)を十字に交わらせて表します。' },
    { fig: null, q: '品物の、外から見えない部分の形を表すときに使う線はどれですか。', c: ['外形線', '中心線', 'かくれ線', '寸法線'], a: 2,
      e: '見えない部分は、かくれ線(破線)で表します。' },
    { fig: null, q: '外形線とかくれ線が同じところに重なるときは、どうかきますか。', c: ['外形線をかく', 'かくれ線をかく', '両方を少しずらしてかく', 'どちらもかかない'], a: 0,
      e: '線が重なるときは、外形線を優先してかきます。' },
    { fig: null, q: '製図で長さの寸法を書くとき、単位はどうしますか。', c: ['mm で書き、単位の記号は付けない', 'cm で書き、cm を付ける', 'mm で書き、必ず mm を付ける', 'm で書く'], a: 0,
      e: '長さはミリメートルで表し、ふつうは単位記号を書きません。' },
    { fig: null, q: '「φ20」は何を表していますか。', c: ['半径が 20 mm', '直径が 20 mm', '板の厚さが 20 mm', '一辺が 20 mm の正方形'], a: 1,
      e: 'φ(まる)は直径を表す記号です。' },
    { fig: null, q: '「□30」は何を表していますか。', c: ['直径が 30 mm', '面取りが 30 mm', '一辺が 30 mm の正方形', '厚さが 30 mm'], a: 2,
      e: '□(かく)は、断面が正方形で、その一辺の長さを表す記号です。' },
    { fig: null, q: '「t12」は何を表していますか。', c: ['板の厚さが 12 mm', '直径が 12 mm', '半径が 12 mm', '長さが 12 cm'], a: 0,
      e: 't(ティー)は板の厚さを表す記号です。' },
    { fig: null, q: '「R5」は何を表していますか。', c: ['直径が 5 mm', '半径が 5 mm', '厚さが 5 mm', '穴が 5 個'], a: 1,
      e: 'R(アール)は、角の丸みなどの半径を表す記号です。' },
    { fig: null, q: '「C3」は何を表していますか。', c: ['半径 3 mm の丸み', '45°で 3 mm の面取り', '穴が 3 個', '厚さが 3 mm'], a: 1,
      e: 'C(シー)は、45°の面取りの大きさを表す記号です。' },
    { fig: null, q: '横向きの寸法線に寸法の数値を書くときは、どこに書きますか。', c: ['寸法線の上側の中ほど', '寸法線の下側のはし', '品物の中', '図の外の右下'], a: 0,
      e: '横向きの寸法線では、数値は寸法線の上側の中ほどに、下から読めるように書きます。' },
    { fig: null, q: '寸法補助線は、寸法線に対してどのように引きますか。', c: ['寸法線より少し先まで出す', '寸法線の手前で止める', '寸法線と重ならないように離す', '太い線で引く'], a: 0,
      e: '寸法補助線は、寸法線より少し(2〜3 mm ほど)先まで出して引きます。' },
    { fig: null, q: '第三角法で、平面図(上から見た図)は正面図のどこにかきますか。', c: ['正面図の上', '正面図の下', '正面図の右', '正面図の左'], a: 0,
      e: '第三角法では、上から見た図を正面図の上に、右から見た図を正面図の右に並べます。' },
    { fig: null, q: '第三角法で、右側面図(右から見た図)は正面図のどこにかきますか。', c: ['正面図の左', '正面図の右', '正面図の上', '正面図の下'], a: 1,
      e: '右から見た図は、見た側と同じ右に置きます。' },
    { fig: 'iso', q: '等角図で、3つの軸どうしがつくる角度は何度ですか。', c: ['90°', '120°', '60°', '45°'], a: 1,
      e: '等角図は、3つの軸が互いに 120° になるようにかきます(横の軸は水平から 30° かたむく)。' },
    { fig: null, q: '等角図で、品物の高さ方向の線はどの向きにかきますか。', c: ['垂直(真上)', '水平', '右上 45°', '左上 60°'], a: 0,
      e: '高さ方向は垂直に、幅と奥行きの方向は水平から 30° かたむけてかきます。' },
    { fig: null, q: '正面図には、品物をどの方向から見た図を選ぶとよいですか。', c: ['形の特徴がいちばんよく表れる方向', 'いちばん小さく見える方向', 'かくれ線がいちばん多くなる方向', 'どの方向でもよい'], a: 0,
      e: '品物の形の特徴がいちばんよくわかる方向を正面にします。' },
    { fig: 'chain2', q: 'この線(二点鎖線)は、おもに何を表すときに使いますか。', c: ['動く部分の位置や、となりの部品', '見えない部分の形', '穴の中心', '寸法'], a: 0,
      e: '細い二点鎖線は想像線といい、動いた先の位置やとなりにある部品などを表します。' }
  ];

  root.M4Terms = { FIGS: FIGS, BANK: BANK };
})(typeof self !== 'undefined' ? self : this);
