/* 提出ファイル一覧ビューア(先生用)の画面 */
(function () {
  'use strict';
  var h = G.h;
  G.initApp({ app: 'teacher-viewer', title: '提出ファイル一覧ビューア(先生用)', data: false, files: ['style.css', 'summary.js', 'app.js'] });

  var APPS = G.APPS;
  var parsed = [], students = [], curApp = APPS[0].id, curStudent = null, tabs = null;

  function appInfo(id) { return APPS.filter(function (a) { return a.id === id; })[0] || { id: id, code: '?', title: id }; }
  function artsOf(s, app) { return s.artifacts.filter(function (a) { return a.app === app && !TV.isState(a); }); }
  function when(iso) { return iso ? new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''; }

  /* ---------- 読み込み ---------- */
  function readFiles(fileList) {
    var files = Array.prototype.filter.call(fileList, function (f) { return /\.json$/i.test(f.name) || f.type === 'application/json'; });
    if (!files.length) { G.toast('JSON ファイルが見つかりませんでした'); return; }
    Promise.all(files.map(function (f) {
      return f.text().then(function (t) { return TV.parseFile(f.webkitRelativePath || f.name, t); },
        function () { return { file: f.name, error: '読めませんでした' }; });
    })).then(function (res) {
      // 同じ名前のファイルは新しいほうで置きかえる
      res.forEach(function (r) {
        parsed = parsed.filter(function (p) { return p.file !== r.file; });
        parsed.push(r);
      });
      refresh();
      G.toast(res.filter(function (r) { return !r.error; }).length + ' こ のファイルを読み込みました');
    });
  }
  G.$('#files').addEventListener('change', function (e) { readFiles(e.target.files); e.target.value = ''; });
  G.$('#folder').addEventListener('change', function (e) { readFiles(e.target.files); e.target.value = ''; });
  var drop = G.$('#drop');
  ['dragenter', 'dragover'].forEach(function (t) { document.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (t) { document.addEventListener(t, function (e) { e.preventDefault(); if (t === 'drop' || e.target === drop) drop.classList.remove('over'); }); });
  document.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) readFiles(e.dataTransfer.files); });
  G.$('#clear').onclick = function () {
    G.confirm('読み込んだ一覧を空にします(生徒のファイルそのものは消えません)。', '空にする').then(function (ok) {
      if (!ok) return;
      parsed = []; curStudent = null; refresh();
    });
  };
  G.$('#print').onclick = function () { window.print(); };
  G.$('#csv').onclick = function () { exportCSV(); };

  function refresh() {
    students = TV.group(parsed);
    var errs = parsed.filter(function (p) { return p.error; });
    var nArt = students.reduce(function (n, s) { return n + s.artifacts.length; }, 0);
    G.$('#summary').textContent = parsed.length ? ('ファイル ' + (parsed.length - errs.length) + ' こ / 生徒 ' + students.length + ' 人 / 作品・記録 ' + nArt + ' 件') : '';
    var ul = G.$('#errors'); ul.innerHTML = '';
    errs.forEach(function (e) { ul.appendChild(h('li', null, '読めなかったファイル: ' + e.file + '(' + e.error + ')')); });
    var has = students.length > 0;
    G.$('#views').hidden = !has;
    ['#csv', '#print', '#clear'].forEach(function (s) { G.$(s).disabled = !parsed.length; });
    if (curStudent && !students.some(function (s) { return s.key === curStudent; })) curStudent = null;
    if (has && !tabs) tabs = G.tabs(G.$('#views'), render);
    else if (has) render(currentTab());
  }
  function currentTab() { var t = G.$('#views [role=tab][aria-selected=true]'); return t ? t.getAttribute('data-tab') : 'students'; }
  function render(name) {
    if (name === 'students') renderStudents();
    else if (name === 'apps') renderApps();
    else renderDetail();
  }
  function openStudent(key) { curStudent = key; tabs.show('detail'); window.scrollTo(0, 0); }
  function nameCell(s) {
    return h('td', null, h('button', { class: 'btn link tv-stu', type: 'button', 'data-noruby': true, onclick: function () { openStudent(s.key); } }, s.label),
      s.fromFile ? h('div', { class: 'g-muted' }, '(ファイル名から)') : null);
  }

  /* ---------- 生徒ごと: 生徒 × アプリ の表 ---------- */
  function renderStudents() {
    var root = G.$('#p-students'); root.innerHTML = '';
    root.appendChild(h('p', null, '「件数」は保存された作品・記録の数、「✎」はふりかえり(理由・感想など)を書いていることを表します。「―」はまだ何もない、という意味です。名前を押すとくわしく見られます。'));
    var head = h('tr', null, h('th', null, '生徒'), APPS.map(function (a) { return h('th', null, a.code, h('div', { class: 'g-muted' }, a.title)); }), h('th', null, '最後の更新'));
    var tb = h('tbody', null);
    students.forEach(function (s) {
      var last = s.artifacts[0] ? s.artifacts[0].updatedAt : '';
      tb.appendChild(h('tr', null, nameCell(s), APPS.map(function (a) {
        var list = artsOf(s, a.id);
        if (!list.length) return h('td', { class: 'mark', 'aria-label': 'なし' }, '―');
        var refl = list.some(function (x) { return TV.summarize(x).reflected; });
        return h('td', { class: 'mark' }, list.length + ' 件', refl ? h('div', null, '✎ ふりかえり') : null);
      }), h('td', null, when(last))));
    });
    root.appendChild(h('div', { class: 'g-table-wrap' }, h('table', { class: 'g-table tv-table' }, h('thead', null, head), tb)));
  }

  /* ---------- アプリごと: 1つのアプリについて全員の要点 ---------- */
  function appRows(appId) {
    var rows = [], fieldNames = [], textNames = [];
    students.forEach(function (s) {
      var list = artsOf(s, appId);
      if (!list.length) { rows.push({ s: s, a: null, sum: null }); return; }
      list.forEach(function (a) {
        var sum = TV.summarize(a);
        sum.fields.forEach(function (f) { if (fieldNames.indexOf(f[0]) < 0) fieldNames.push(f[0]); });
        sum.texts.forEach(function (f) { if (textNames.indexOf(f[0]) < 0) textNames.push(f[0]); });
        rows.push({ s: s, a: a, sum: sum });
      });
    });
    return { rows: rows, fieldNames: fieldNames, textNames: textNames };
  }
  function lookup(pairs, k) { var p = (pairs || []).filter(function (x) { return x[0] === k; })[0]; return p ? p[1] : ''; }
  function renderApps() {
    var root = G.$('#p-apps'); root.innerHTML = '';
    var sel = h('select', { id: 'tv-app', 'aria-label': 'アプリ' }, APPS.map(function (a) {
      return h('option', { value: a.id, selected: a.id === curApp ? 'selected' : null }, a.code + ' ' + a.title);
    }));
    sel.addEventListener('change', function () { curApp = sel.value; renderApps(); });
    var showEmpty = h('input', { type: 'checkbox', id: 'tv-empty' });
    showEmpty.checked = !!renderApps.empty;
    showEmpty.addEventListener('change', function () { renderApps.empty = showEmpty.checked; renderApps(); });
    root.appendChild(h('div', { class: 'tv-bar' },
      h('label', { class: 'g-field' }, h('span', null, 'アプリ'), sel),
      h('label', { class: 'g-check' }, showEmpty, ' まだ出していない生徒も表示')));
    var d = appRows(curApp);
    var rows = d.rows.filter(function (r) { return r.a || renderApps.empty; });
    if (!rows.length) { root.appendChild(h('p', { class: 'g-muted' }, 'このアプリの作品・記録はまだ読み込まれていません。')); return; }
    var head = h('tr', null, h('th', null, '生徒'), h('th', null, '作品・記録'), d.fieldNames.map(function (n) { return h('th', null, n); }), d.textNames.map(function (n) { return h('th', null, n); }));
    var tb = h('tbody', null);
    rows.forEach(function (r) {
      if (!r.a) { tb.appendChild(h('tr', null, nameCell(r.s), h('td', { colspan: String(1 + d.fieldNames.length + d.textNames.length) }, '― まだありません'))); return; }
      tb.appendChild(h('tr', null, nameCell(r.s),
        h('td', null, r.a.title || '無題', h('div', { class: 'g-muted' }, when(r.a.updatedAt))),
        d.fieldNames.map(function (n) { return h('td', null, lookup(r.sum.fields, n)); }),
        d.textNames.map(function (n) { return h('td', { class: 'txt' }, lookup(r.sum.texts, n)); })));
    });
    root.appendChild(h('div', { class: 'g-table-wrap' }, h('table', { class: 'g-table tv-table', 'data-noruby': true }, h('thead', null, head), tb)));
  }

  /* ---------- くわしく見る: 1人の生徒のすべて ---------- */
  function renderDetail() {
    var root = G.$('#p-detail'); root.innerHTML = '';
    if (!students.length) return;
    if (!curStudent) curStudent = students[0].key;
    var idx = 0;
    students.forEach(function (s, i) { if (s.key === curStudent) idx = i; });
    var s = students[idx];
    var sel = h('select', { 'aria-label': '生徒' }, students.map(function (x) { return h('option', { value: x.key, selected: x.key === s.key ? 'selected' : null }, x.label); }));
    sel.addEventListener('change', function () { curStudent = sel.value; renderDetail(); });
    function step(d) { return function () { curStudent = students[(idx + d + students.length) % students.length].key; renderDetail(); }; }
    root.appendChild(h('div', { class: 'tv-bar' },
      h('button', { class: 'btn', type: 'button', onclick: step(-1) }, '◀ 前の生徒'),
      h('label', { class: 'g-field' }, h('span', null, '生徒'), sel),
      h('button', { class: 'btn', type: 'button', onclick: step(1) }, '次の生徒 ▶')));
    root.appendChild(h('p', { class: 'g-muted' }, 'ファイル: ' + s.files.join('、')));
    APPS.forEach(function (ap) {
      var list = artsOf(s, ap.id);
      var sec = h('section', { class: 'card' }, h('h3', null, ap.code + ' ' + ap.title));
      if (!list.length) sec.appendChild(h('p', { class: 'g-muted' }, 'まだありません'));
      list.forEach(function (a) {
        var sum = TV.summarize(a);
        var box = h('div', { class: 'card tv-art' }, h('h4', null, a.title || '無題', ' ', h('span', { class: 'g-muted' }, when(a.updatedAt))));
        if (sum.fields.length) box.appendChild(h('dl', { class: 'tv-kv' }, sum.fields.map(function (f) { return [h('dt', null, f[0]), h('dd', null, f[1])]; })));
        sum.texts.forEach(function (t) { box.appendChild(h('div', { class: 'tv-text', 'data-noruby': true }, h('b', null, t[0]), t[1])); });
        if (!sum.fields.length && !sum.texts.length) box.appendChild(h('p', { class: 'g-muted' }, '表示できる内容がありません'));
        sec.appendChild(box);
      });
      root.appendChild(sec);
    });
  }

  /* ---------- CSV(Excel・スプレッドシートで開ける) ---------- */
  function csvCell(v) { v = String(v === undefined || v === null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCSV() {
    var tab = currentTab(), lines = [], name;
    if (tab === 'apps') {
      var d = appRows(curApp), ai = appInfo(curApp);
      lines.push(['組', '番号', '名前', '作品・記録', '更新日時'].concat(d.fieldNames, d.textNames));
      d.rows.forEach(function (r) {
        var st = r.s.student || {};
        lines.push([st.class || '', st.no || '', st.name || r.s.label, r.a ? r.a.title : '(なし)', r.a ? when(r.a.updatedAt) : '']
          .concat(d.fieldNames.map(function (n) { return r.sum ? lookup(r.sum.fields, n) : ''; }), d.textNames.map(function (n) { return r.sum ? lookup(r.sum.texts, n) : ''; })));
      });
      name = '提出一覧_' + ai.code + '.csv';
    } else {
      lines.push(['組', '番号', '名前'].concat(APPS.map(function (a) { return a.code + ' 件数'; }), APPS.map(function (a) { return a.code + ' ふりかえり'; })));
      students.forEach(function (s) {
        var st = s.student || {};
        lines.push([st.class || '', st.no || '', st.name || s.label]
          .concat(APPS.map(function (a) { return artsOf(s, a.id).length; }),
            APPS.map(function (a) { return artsOf(s, a.id).some(function (x) { return TV.summarize(x).reflected; }) ? 'あり' : ''; })));
      });
      name = '提出一覧_生徒ごと.csv';
    }
    var text = '﻿' + lines.map(function (l) { return l.map(csvCell).join(','); }).join('\r\n');
    G.download(new Blob([text], { type: 'text/csv' }), name);
  }

  // テスト用
  window.TVApp = { readTexts: function (pairs) { pairs.forEach(function (p) { parsed.push(TV.parseFile(p[0], p[1])); }); refresh(); } };
})();
