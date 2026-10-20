/* A8 問題解決ノート(材料と加工)
 * 中身は4分野共通の本体 shared/mondai-note/(mondai-note.js・mondai-note-data.js・mondai-note.css)。
 * このファイルは A の「アダプタ」: 上のバー(G.initApp)・タブ(G.tabs)・保存(G.store の作品 1つ)・ファイルの書き出しと読み込み。
 * 書き出すファイル: gijutsu-artifact/1(app: 'mondai-note'、data は MondaiNote のノートの中身)。
 */
(function () {
  'use strict';
  var APP = 'mondai-note', LAST = 'mondai-note.last';
  var DOMAIN = (window.EDUIT_INFO && EDUIT_INFO.domain) || 'A';
  var art = null, note = null, tabs = null;

  G.initApp({
    app: APP, title: '問題解決ノート', help: showHelp,
    files: ['index.html', 'app.js', '../../shared/mondai-note/mondai-note.js', '../../shared/mondai-note/mondai-note-data.js', '../../shared/mondai-note/mondai-note.css']
  });

  // 保存(少し間をあけて)
  var timer = null;
  function changed() {
    clearTimeout(timer);
    G.$('#save-state').textContent = '変更があります…';
    timer = setTimeout(save, 800);
  }
  function save() {
    clearTimeout(timer);
    if (!art || !note) return Promise.resolve();
    var d = note.data;
    art.data = d;
    art.title = (d.ev.title || '').trim() || (d.task.kadai || '').trim().slice(0, 24) || '問題解決ノート';
    return G.store.put(art).then(function () {
      var t = new Date();
      G.$('#save-state').textContent = '自動保存しました ' + t.getHours() + ':' + ('0' + t.getMinutes()).slice(-2);
    }).catch(function (e) { G.$('#save-state').textContent = '保存できませんでした: ' + e.message; });
  }
  // メニューで入れた組・番号・名前を、まだ入れていなければ使う
  function fillStudent(d) {
    var pf = G.profile(), s = d.student || (d.student = {});
    if (!s.cls && !s.no && !s.name) { s.cls = pf.class; s.no = pf.no; s.name = pf.name; }
    return d;
  }
  // メニューで組・番号・名前を入れていないとき(単体で開いたとき)は、ノートに入れたものを書き出しに入れる
  function withStudent() {
    var pf = G.profile(), s = note.data.student || {};
    if (pf.class || pf.no || pf.name || !(s.cls || s.no || s.name)) return art;
    return Object.assign({}, art, { student: { class: String(s.cls || ''), no: String(s.no || ''), name: String(s.name || '') } });
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function fresh() { return G.newArtifact(APP, '問題解決ノート', fillStudent(MondaiNote.defaults(DOMAIN))); }

  function recordTools() {
    return G.h('span', { class: 'g-row' },
      G.h('button', { class: 'btn', type: 'button', onclick: function () {
        save().then(function () { G.exportJSON(withStudent(), '問題解決ノート_' + (String(note.data.student.name || '').trim() || today()) + '.json'); });
      } }, 'ファイルに書き出す'),
      G.h('button', { class: 'btn', type: 'button', onclick: importFile }, 'ファイルから読み込む'),
      G.h('button', { class: 'btn', type: 'button', onclick: function () {
        G.confirm('新しいノートを作ります。今のノートは保存されていて、ファイルに書き出しておけば、あとで読み込めます。', '新しく作る').then(function (ok) {
          if (!ok) return;
          save().then(function () { open(fresh()); tabs.show('find'); });
        });
      } }, '新しいノート'));
  }
  function importFile() {
    G.pickJSON().then(function (obj) {
      var list = G.normalizeImport(obj, APP);
      if (!list.length) { G.toast('問題解決ノートが見つかりませんでした'); return; }
      return Promise.all(list.map(function (a) { return G.store.put(a); })).then(function () {
        open(list[0]);
        G.toast(list.length > 1 ? list.length + ' 件を読み込み、1件目を開きました' : 'ノートを読み込みました');
      });
    }).catch(function (e) { G.toast(e.message); });
  }

  function open(a) {
    art = a;
    a.data = fillStudent(MondaiNote.normalize(a.data, DOMAIN));
    try { localStorage.setItem(LAST, a.id); } catch (e) {}
    if (note) note.setData(a.data);
    else {
      note = MondaiNote.mount({
        domain: DOMAIN, data: a.data,
        panels: { intro: G.$('#p-intro'), find: G.$('#p-find'), eval: G.$('#p-eval'), opt: G.$('#p-opt'), refl: G.$('#p-refl'), rec: G.$('#p-rec') },
        onChange: changed,
        go: function (id) { tabs.show(id); },
        recordTools: recordTools,
        furikaeri: function () { return !G.furikaeriOff(); }
      });
    }
    art.data = note.data;
  }

  function showHelp() {
    G.modal({ title: '使い方', body: G.h('div', null, G.h('ol', null,
      G.h('li', null, '「① 問題の発見」では、「こうだったらいいのに」「不便だな」を付箋に書いて集めます。観点(社会・安全・環境・経済)のアイコンも付けます。'),
      G.h('li', null, 'クイズで問題と課題のちがいを確かめます。★を付けた付箋から、自分の課題を1つ決めます。'),
      G.h('li', null, '製作品ができたら「② 評価、改善・修正」で、観点ごとに5段階で評価します。レーダーチャートを見て、よかった点と改善点を書きます。'),
      G.h('li', null, '「③ 技術の最適化」では、社会の製品をえらびます。観点の重みを変えて、「いちばんよい案」が入れかわるのを試します。'),
      G.h('li', null, G.furikaeriOff() ? '最後に「記録」で「ファイルに書き出す」か「印刷する」で提出します。' : '最後に「振り返り」を書きます。「記録」で「ファイルに書き出す」か「印刷する」で提出します。')),
      G.h('p', { class: 'g-note' }, 'ノートはこの端末の中に自動で保存されます。印刷すると、問題解決シートとして紙に出せます。書いていない欄は線だけになります。')) });
  }

  tabs = G.tabs(G.$('[data-g-tabs]'), function (name) {
    if (note && name === 'rec') note.render('rec');  // 記録のまとめは開くたびに新しくする
  });

  // 起動: 前に開いていたノート(なければ新しいノート)
  var lastId = null;
  try { lastId = localStorage.getItem(LAST); } catch (e) {}
  (lastId ? G.store.get(lastId) : Promise.resolve(null)).then(function (a) {
    open(a && a.app === APP ? a : fresh());
  }).catch(function () { open(fresh()); });
})();
