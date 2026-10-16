/* メニューに並べるアプリの一覧(共通基盤スレッドが管理)。A1 から順に並べる(番号の順 = おすすめの順 = カードの順)
 * code はメニューのカード・アプリの上のバー(G.initApp)・提出ファイル一覧ビューアに出す記号。
 * icon はメニューのカードの絵。各アプリのページもこのファイルを読み、G.initApp が app の id から code を探す。 */
(function (root) {
  root.G = root.G || {};
  root.G.APPS = [
    { id: 'material-navi', icon: '🧱', code: 'A1', dir: 'a1-material-navi/', title: '材料選択ナビ', desc: '使用目的・使用条件から木材・金属・プラスチックを比べて選び、理由を説明する。' },
    { id: 'wood-lab', icon: '🪵', code: 'A2', dir: 'a2-wood-lab/', title: '木材の繊維・収縮ラボ', desc: '柾目と板目、木表と木裏、乾燥による収縮や反りを操作して確かめる。' },
    { id: 'structure-lab', icon: '🏗️', code: 'A3', dir: 'a3-structure-lab/', title: '構造強化ラボ', desc: '板の厚み・補強・筋かい・接合を変えて、丈夫な構造の工夫を確かめる。' },
    { id: 'drawing-trainer', icon: '📐', code: 'A4', dir: 'a4-drawing-trainer/', title: '製図トレーナー', desc: '立体と等角図・第三角法の対応を、クイズと作図練習で身に付ける。' },
    { id: 'kidori', icon: '🪚', code: 'A5', dir: 'a5-kidori/', title: '木取り・構想シミュレータ', desc: '板から部品を無駄なく取る木取りを試し、製作図と強度の見通しを立てる。' },
    { id: 'tool-safety', icon: '🦺', code: 'A6', dir: 'a6-tool-safety/', title: '工具の使い方・安全トレーナー', desc: '工具の正しい使い方と作業前の安全確認を、手順として確かめる。' },
    { id: 'solid-maker', icon: '🧊', code: 'A7', dir: 'a7-solid-maker/', title: '第三角法 立体メーカー', desc: '第三角法で三面図をかくと、等角図・キャビネット図・3D の立体にする。図面の印刷・PDF、3Dプリンタ用の STL も作れる。' }
  ];
  // 先生用(メニューの下に別に並べる)
  root.G.TEACHER_APPS = [
    { id: 'teacher-viewer', icon: '📋', code: '先生用', dir: 'teacher-viewer/', title: '提出ファイル一覧ビューア', desc: '生徒が書き出したファイルをまとめて読み込み、生徒ごと・アプリごとに一覧で見る。' }
  ];
})(typeof self !== 'undefined' ? self : this);
