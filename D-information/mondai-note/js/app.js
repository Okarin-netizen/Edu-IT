// D11 問題解決ノート(情報の技術): D のアダプタ
// 中身は4分野共通の shared/mondai-note/(window.MondaiNote)。D の観点と例は mondai-note-data.js の D
// (教科書 4編2章 2・5、3章 2・5「問題の発見と課題の設定」「問題解決の評価、改善・修正」、4章 1「情報の技術の最適化」)。
// このファイルは、上のバー(文字の大きさ)・タブ(アドレスの #/find など)・保存・ファイルの書き出しと読み込みだけを受け持つ。
// 保存: localStorage 'mondainote.v1' = { v, note, student, refl, visited }
//   student・refl・visited は、教材集の「記録をまとめて書き出す」が読むための写し(中身は note と同じ)。
// 書き出し: { app: '問題解決ノート', version: 1, exportedAt, student: { cls, num, name }, note }
(function () {
  'use strict';
  var APP = '問題解決ノート';
  var KEY = 'mondainote.v1';
  var MN = window.MondaiNote;
  var DOMAIN = (window.EDUIT_INFO && EDUIT_INFO.domain) || 'D';
  var FK_OFF = !!(window.EduitFrame && EduitFrame.furikaeri === false);
  var TABS = ['intro', 'find', 'eval', 'opt', 'refl', 'rec'];
  var NAMES = { intro: 'はじめに', find: '① 問題の発見', eval: '② 評価、改善・修正', opt: '③ 技術の最適化', refl: '振り返り', rec: '記録' };
  var $ = function (s) { return document.querySelector(s); };
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  if (window.EDUIT_INFO) {
    EDUIT_INFO.app = EDUIT_INFO.app || { name: 'D11 ' + APP };
    EDUIT_INFO.app.safety = ['問題解決ノートに書いた文と組・番号・名前は、この端末のブラウザの中にだけ保存します。どこにも送りません。'];
  }

  // ---- 端末の中だけの保存(使えなくても動く) ----
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  if (!isObj(saved)) saved = {};
  var note = null, timer = null;
  function persist() {
    if (!note) return false;
    var d = note.data, st = d.student || {}, r = d.refl || {};
    saved.v = 1;
    saved.note = d;
    saved.student = { cls: String(st.cls || ''), num: String(st.no || ''), name: String(st.name || '') };
    saved.refl = { learned: String(r.learned || ''), next: String(r.next || '') };
    try { localStorage.setItem(KEY, JSON.stringify(saved)); return true; } catch (e) { return false; }
  }
  function changed() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var ok = persist(), t = new Date();
      $('#saved').textContent = ok ? '✓ 自動保存しました ' + t.getHours() + ':' + ('0' + t.getMinutes()).slice(-2) : '保存できませんでした(このひらき方では記録が残りません)';
    }, 600);
  }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  // ---- 書き出し・読み込み ----
  function exportObj() {
    var st = note.data.student || {};
    return { app: APP, version: 1, exportedAt: new Date().toISOString(),
      student: { cls: String(st.cls || ''), num: String(st.no || ''), name: String(st.name || '') }, note: note.data };
  }
  function fileName() {
    var st = note.data.student || {};
    var who = [st.cls, st.no, st.name].map(function (x) { return String(x || '').trim(); }).filter(Boolean).join('_') || '記録';
    return (APP + '_情報_' + who + '.json').replace(/[\\/:*?"<>|\s]/g, '_');
  }
  function exportFile() {
    persist();
    var name = fileName();
    try {
      var url = URL.createObjectURL(new Blob([JSON.stringify(exportObj(), null, 1)], { type: 'application/json' }));
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      toast('「' + name + '」を書き出しました');
    } catch (e) { toast('ファイルを作れませんでした'); }
  }
  $('#file').addEventListener('change', function (ev) {
    var f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var o = null;
      try { o = JSON.parse(rd.result); } catch (e) { o = null; }
      if (!isObj(o) || o.app !== APP || !isObj(o.note)) { toast('このファイルは読みこめません(問題解決ノートのファイルではありません)'); return; }
      if (!window.confirm('いまのノートを、読みこんだファイルで置きかえます。いまのノートは消えます。よろしいですか?')) return;
      note.setData(MN.normalize(o.note, DOMAIN));
      persist();
      toast('読みこみました');
      go('rec');
    };
    rd.readAsText(f);
  });
  function btn(label, fn, cls) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'mn-btn' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }
  function recordTools() {
    var w = document.createElement('span');
    w.className = 'mn-row';
    w.appendChild(btn('ファイルに書き出す(.json)', exportFile));
    w.appendChild(btn('書き出したファイルを読みこむ', function () { $('#file').click(); }));
    w.appendChild(btn('この端末のノートを消す', function () {
      if (!window.confirm('この端末の問題解決ノートをすべて消します。もとにもどせません。提出がまだなら、先に「ファイルに書き出す」でファイルにしておこう。消しますか?')) return;
      try { localStorage.removeItem(KEY); } catch (e) { /* 保存できない環境でも続ける */ }
      var keep = { largeText: saved.largeText };
      saved = keep;
      note.setData(MN.defaults(DOMAIN));
      persist();
      toast('消しました');
      go('intro');
    }));
    return w;
  }

  // ---- タブ(アドレスの #/find など。教材集の中でも、この形で中の場所を覚える) ----
  function tabOf(hash) {
    var id = String(hash || '').replace(/^#\/?/, '') || 'intro';
    if (TABS.indexOf(id) < 0) id = 'intro';
    if (id === 'refl' && FK_OFF) id = 'rec';
    return id;
  }
  function go(id) {
    var h = id === 'intro' ? '#/' : '#/' + id;
    if (location.hash === h || (id === 'intro' && !location.hash)) show(id);
    else location.hash = h;
  }
  function show(id) {
    Array.prototype.forEach.call(document.querySelectorAll('#view > section[data-sec]'), function (s) { s.hidden = s.getAttribute('data-sec') !== id; });
    Array.prototype.forEach.call(document.querySelectorAll('#tabs a'), function (a) {
      if (a.getAttribute('data-tab') === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (id === 'rec' && note) note.render('rec');
    var v = isObj(saved.visited) ? saved.visited : (saved.visited = {});
    if (id !== 'intro') v[id] = true;
    persist();
    document.title = (id === 'intro' ? '' : NAMES[id] + ' | ') + APP;
    window.scrollTo(0, 0);
    var cur = document.querySelector('#tabs a[aria-current]');
    if (cur && cur.scrollIntoView) try { cur.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* 古いブラウザ */ }
  }
  window.addEventListener('hashchange', function () { show(tabOf(location.hash)); });

  // ---- 文字の大きさ(4分野共通の「文字 中/大」ボタン。教材集の中では教材集のボタンがこれを押す) ----
  (function setupToggles() {
    var box = $('#display-toggles');
    var on = !!saved.largeText;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ef-btn ef-size';
    b.setAttribute('data-kz-label', '大きな文字');
    b.setAttribute('aria-label', '文字の大きさ(大きな文字)');
    b.appendChild(document.createTextNode('文字 '));
    var v = document.createElement('span');
    v.className = 'ef-size-v';
    b.appendChild(v);
    function apply() {
      b.setAttribute('aria-pressed', String(on));
      document.documentElement.classList.toggle('large-text', on);
    }
    b.addEventListener('click', function () { on = !on; saved.largeText = on; try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* 保存できなくても続ける */ } apply(); });
    apply();
    box.appendChild(b);
  })();
  // タブの帯を上のバーのすぐ下に止める(上のバーの高さはスマホで2行になる)
  function headH() { var hd = $('.app-header'); if (hd) document.documentElement.style.setProperty('--mnd-head', hd.offsetHeight + 'px'); }
  window.addEventListener('resize', headH);
  headH();

  // ---- ノートの本体 ----
  var panels = {};
  TABS.forEach(function (id) { panels[id] = document.querySelector('#view > section[data-sec="' + id + '"]'); });
  note = MN.mount({
    domain: DOMAIN, data: isObj(saved.note) ? saved.note : null, panels: panels,
    onChange: changed, go: go, recordTools: recordTools,
    furikaeri: function () { return !FK_OFF; }
  });
  show(tabOf(location.hash));

  // テスト用
  window.MondaiNoteD = { exportObj: exportObj, KEY: KEY, note: function () { return note; } };
})();
