/* A2 木材の繊維・収縮ラボ — 起動・タブ・記録 */
(function () {
  'use strict';
  var FILES = ['style.css', 'js/core.js', 'js/wood.js', 'js/lab-section.js', 'js/lab-shrink.js',
    'js/lab-quiz.js', 'js/lab-strength.js', 'js/lab-panel.js', 'js/main.js'];
  var hasG = !!(window.G && G.initApp);
  var current = null;

  /* ---------- ⑥ まとめ・記録 ---------- */
  var record = null;
  var NOTE_IDS = ['nt1', 'nt2', 'nt3'];
  function fillNotes() {
    NOTE_IDS.forEach(function (id) { document.getElementById(id).value = record.data.notes[id] || ''; });
    refreshLog();
  }
  function refreshLog() {
    var log = record ? record.data.quizLog : [];
    var el = document.getElementById('quizLog');
    if (!log.length) { A2.setR(el, 'まだ{記録|きろく}はありません。'); return; }
    var ok = log.filter(function (x) { return x.correct; }).length;
    var by = {};
    log.forEach(function (x) { var k = x.board + '・' + x.faceUp + 'が上'; by[k] = by[k] || [0, 0]; by[k][0]++; if (x.correct) by[k][1]++; });
    var rows = Object.keys(by).map(function (k) { return '<li>' + A2.esc(k) + ':' + by[k][0] + '{問|もん}{中|ちゅう} ' + by[k][1] + '{問|もん}{正解|せいかい}</li>'; }).join('');
    A2.setR(el, '<p>{合計|ごうけい} ' + log.length + '{問|もん}{中|ちゅう} ' + ok + '{問|もん}{正解|せいかい}</p><ul>' + rows + '</ul>');
  }
  function reloadRecord() {
    return A2.loadRecords().then(function (r) { record = r; fillNotes(); });
  }
  function saveNotes() {
    return A2.loadRecords().then(function (r) {
      record = r;
      NOTE_IDS.forEach(function (id) { record.data.notes[id] = document.getElementById(id).value; });
      return A2.saveRecords(record);
    }).then(function () {
      A2.setR('saveMsg', '{保存|ほぞん}しました(' + new Date().toLocaleTimeString('ja-JP') + ')');
    });
  }
  function toast(msg) { if (hasG) G.toast(msg); else alert(msg); }
  function exportRecord() {
    saveNotes().then(function () {
      var name = 'wood-lab-' + new Date().toISOString().slice(0, 10) + '.json';
      if (hasG) G.exportJSON(record, name);
      else {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
        a.download = name; document.body.appendChild(a); a.click(); a.remove();
      }
    });
  }
  function importRecord() {
    if (!hasG) { toast('読み込みには共通基盤(common)が必要です'); return; }
    G.pickJSON().then(function (obj) {
      var list = G.normalizeImport(obj, A2.APP);
      if (!list.length) { toast('木材ラボの記録が見つかりませんでした'); return; }
      return A2.loadRecords().then(function (r) {
        // 読み込んだ記録を今の記録にまとめる(メモは空でない方を優先、クイズの記録は重ならないように足す)
        list.forEach(function (a) {
          var d = a.data || {};
          Object.keys(d.notes || {}).forEach(function (k) { if (d.notes[k]) r.data.notes[k] = String(d.notes[k]); });
          var seen = {};
          r.data.quizLog.forEach(function (x) { seen[x.at] = 1; });
          (Array.isArray(d.quizLog) ? d.quizLog : []).forEach(function (x) { if (x && x.at && !seen[x.at]) r.data.quizLog.push(x); });
        });
        r.data.quizLog.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
        return A2.saveRecords(r).then(function () { record = r; fillNotes(); toast('読み込みました'); });
      });
    }).catch(function (e) { if (e && e.message !== 'ファイルが選ばれていません') toast(e.message || '読み込めませんでした'); });
  }
  A2.labs.notes = {
    init: function () {
      document.getElementById('btnSaveNotes').addEventListener('click', saveNotes);
      document.getElementById('btnExport').addEventListener('click', exportRecord);
      document.getElementById('btnImport').addEventListener('click', importRecord);
      NOTE_IDS.forEach(function (id) {
        var t = null;
        document.getElementById(id).addEventListener('input', function () { clearTimeout(t); t = setTimeout(saveNotes, 1500); });
      });
      reloadRecord();
    },
    show: function () { reloadRecord(); },
    refreshLog: function () { reloadRecord(); }
  };

  /* ---------- タブ切りかえ ---------- */
  function onTab(name) {
    if (current && current !== name && A2.labs[current] && A2.labs[current].hide) A2.labs[current].hide();
    current = name;
    if (A2.labs[name] && A2.labs[name].show) A2.labs[name].show();
  }
  function fallbackTabs(root) {
    var tabs = [].slice.call(root.querySelectorAll('[role=tab]'));
    function show(name) {
      tabs.forEach(function (t) { var on = t.getAttribute('data-tab') === name; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      root.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== name; });
      onTab(name);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { show(t.getAttribute('data-tab')); });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        var n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); show(n.getAttribute('data-tab'));
      });
    });
    show(tabs[0].getAttribute('data-tab'));
  }

  /* ---------- 表示設定が変わったら描き直す ---------- */
  function refreshAll() {
    A2.resetColors();
    A2.applyRuby(document.body);
    Object.keys(A2.labs).forEach(function (k) { if (A2.labs[k].refresh) A2.labs[k].refresh(); });
  }

  function start() {
    if (hasG) {
      G.initApp({ app: A2.APP, title: '木材の繊維・収縮ラボ', files: FILES });
      if (G.ruby && G.ruby.add) G.ruby.add({ '柾目': 'まさめ', '板目': 'いため', '追柾目': 'おいまさめ', '木表': 'きおもて', '木裏': 'きうら', '心材': 'しんざい', '辺材': 'へんざい', '早材': 'そうざい', '晩材': 'ばんざい', '木口': 'こぐち', '背割り': 'せわり', '干割れ': 'ひわれ', '単板': 'たんばん', '集成材': 'しゅうせいざい', '合板': 'ごうはん', '含水率': 'がんすいりつ', '心持ち材': 'しんもちざい', '接線': 'せっせん', '半径': 'はんけい' });
    } else {
      // 共通基盤がないときの最小限のヘッダー
      var h = document.getElementById('g-header');
      h.innerHTML = '<div style="padding:.5rem .75rem;font-weight:bold">木材の繊維・収縮ラボ</div>';
    }
    A2.applyRuby(document.body);
    Object.keys(A2.labs).forEach(function (k) { if (A2.labs[k].init) A2.labs[k].init(); });
    var root = document.querySelector('[data-g-tabs]');
    if (hasG && G.tabs) G.tabs(root, onTab); else fallbackTabs(root);

    // ふりがな・くっきり・文字サイズの切りかえ(html の class / 属性)を見て描き直す
    var lastKey = '';
    new MutationObserver(function () {
      var r = document.documentElement;
      var key = r.className + '|' + r.getAttribute('data-size');
      if (key !== lastKey) { lastKey = key; refreshAll(); }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-size'] });
    lastKey = document.documentElement.className + '|' + document.documentElement.getAttribute('data-size');

    var rs = null;
    window.addEventListener('resize', function () { clearTimeout(rs); rs = setTimeout(function () { if (current && A2.labs[current].refresh) A2.labs[current].refresh(); }, 150); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
