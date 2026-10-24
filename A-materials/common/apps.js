/* メニューに並べるアプリの一覧(共通基盤スレッドが管理)。A1 から順に並べる(番号の順 = おすすめの順 = カードの順)
 * code はメニューのカード・アプリの上のバー(G.initApp)・提出ファイル一覧ビューアに出す記号。
 * short はアプリの上のバーの切りかえに出す短い名前。icon はメニューのカードの絵。各アプリのページもこのファイルを読み、G.initApp が app の id から code を探す。 */
(function (root) {
  root.G = root.G || {};
  root.G.APPS = [
    { id: 'material-navi', icon: '🧱', code: 'A1', short: '材料', dir: 'a1-material-navi/', title: '材料選択ナビ', desc: '目的と条件から、木材・金属・プラスチックを選ぶ。' },
    { id: 'wood-lab', icon: '🪵', code: 'A2', short: '木材', dir: 'a2-wood-lab/', title: '木材の繊維・収縮ラボ', desc: '柾目と板目、乾燥による収縮や反りを確かめる。' },
    { id: 'structure-lab', icon: '🏗️', code: 'A3', short: '構造', dir: 'a3-structure-lab/', title: '構造強化ラボ', desc: '補強や接合を変えて、丈夫な構造の工夫を調べる。' },
    { id: 'drawing-trainer', icon: '📐', code: 'A4', short: '製図', dir: 'a4-drawing-trainer/', title: '製図トレーナー', desc: '三面図・等角図・キャビネット図を読み、かく練習。' },
    { id: 'kidori', icon: '🪚', code: 'A5', short: '木取り', dir: 'a5-kidori/', title: '木取り・構想シミュレータ', desc: '木取り・製作図・強度・工程表で、製作の計画を立てる。' },
    { id: 'tool-safety', icon: '🦺', code: 'A6', short: '工具', dir: 'a6-tool-safety/', title: '工具の使い方・安全トレーナー', desc: '工具の使い方と、作業前の安全確認を学ぶ。' },
    { id: 'solid-maker', icon: '🧊', code: 'A7', short: '立体', dir: 'a7-solid-maker/', title: '第三角法 立体メーカー', desc: '三面図から、等角図や3Dの立体を作る。' },
    { id: 'mondai-note', icon: '📝', code: 'A8', short: 'ノート', dir: 'a8-mondai-note/', title: '問題解決ノート', desc: '問題を見つけて課題を決め、作った物を評価する。' }
  ];
  // 先生用(メニューの下に別に並べる)
  root.G.TEACHER_APPS = [
    { id: 'teacher-viewer', icon: '📋', code: '先生用', dir: 'teacher-viewer/', title: '提出ファイル一覧ビューア', desc: '生徒が書き出したファイルをまとめて読み込み、生徒ごと・アプリごとに一覧で見る。' }
  ];
})(typeof self !== 'undefined' ? self : this);
