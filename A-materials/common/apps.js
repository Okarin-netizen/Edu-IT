/* メニューに並べるアプリの一覧(共通基盤スレッドが管理)。M1 から順に並べる */
(function (root) {
  root.G = root.G || {};
  root.G.APPS = [
    { id: 'material-navi', code: 'M1', dir: 'm1-material-navi/', title: '材料選択ナビ', desc: '使用目的・使用条件から木材・金属・プラスチックを比べて選び、理由を説明する。' },
    { id: 'wood-lab', code: 'M2', dir: 'm2-wood-lab/', title: '木材の繊維・収縮ラボ', desc: '柾目と板目、木表と木裏、乾燥による収縮や反りを操作して確かめる。' },
    { id: 'structure-lab', code: 'M3', dir: 'm3-structure-lab/', title: '構造強化ラボ', desc: '板の厚み・補強・筋かい・接合を変えて、丈夫な構造の工夫を確かめる。' },
    { id: 'drawing-trainer', code: 'M4', dir: 'm4-drawing-trainer/', title: '製図トレーナー', desc: '立体と等角図・第三角法の対応を、クイズと作図練習で身に付ける。' },
    { id: 'kidori', code: 'M5', dir: 'm5-kidori/', title: '木取り・構想シミュレータ', desc: '板から部品を無駄なく取る木取りを試し、製作図と強度の見通しを立てる。' },
    { id: 'tool-safety', code: 'M6', dir: 'm6-tool-safety/', title: '工具の使い方・安全トレーナー', desc: '工具の正しい使い方と作業前の安全確認を、手順として確かめる。' }
  ];
  // 先生用(メニューの下に別に並べる)
  root.G.TEACHER_APPS = [
    { id: 'teacher-viewer', code: '先生用', dir: 'teacher-viewer/', title: '提出ファイル一覧ビューア', desc: '生徒が書き出したファイルをまとめて読み込み、生徒ごと・アプリごとに一覧で見る。' }
  ];
})(typeof self !== 'undefined' ? self : this);
