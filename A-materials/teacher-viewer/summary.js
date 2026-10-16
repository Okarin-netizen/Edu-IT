/*
 * 提出ファイル一覧ビューア: ファイルの読み取りと、アプリごとの要約(画面に依存しない部分)
 * window.TV.parseFile(name, text) → { student, artifacts, error }
 * window.TV.group(parsed[]) → 生徒の配列
 * window.TV.summarize(artifact) → { fields:[[見出し, 値]], texts:[[見出し, 文章]], reflected:bool }
 */
(function (root) {
  'use strict';
  var TV = (root.TV = root.TV || {});

  function str(v) { return v === undefined || v === null ? '' : String(v); }
  function trim(v) { return str(v).replace(/^\s+|\s+$/g, ''); }
  function stem(name) { return str(name).replace(/^.*[\\/]/, '').replace(/\.json$/i, ''); }
  // 全角数字を半角に(組・番号の並べかえ用)
  function half(s) { return str(s).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }); }

  TV.studentLabel = function (s) {
    if (!s) return '';
    var c = trim(s.class), n = trim(s.no), nm = trim(s.name);
    var head = (c ? c + '組' : '') + (n ? n + '番' : '');
    return (head + (head && nm ? ' ' : '') + nm) || '';
  };

  function isArtifact(a) { return a && typeof a === 'object' && a.app && a.data && typeof a.data === 'object'; }

  TV.parseFile = function (name, text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { return { file: name, error: 'JSON として読めませんでした' }; }
    var list = [], student = null;
    if (obj && obj.schema === 'gijutsu-bundle/1' && Array.isArray(obj.artifacts)) { list = obj.artifacts; student = obj.student || null; }
    else if (Array.isArray(obj)) list = obj;
    else if (obj && Array.isArray(obj.artifacts)) { list = obj.artifacts; student = obj.student || null; }
    else { list = [obj]; student = (obj && obj.student) || null; }  // 1つずつ書き出したファイルにも組・番号・名前が入る
    list = list.filter(isArtifact);
    if (!list.length) return { file: name, error: 'この教材アプリの作品・記録が入っていませんでした' };
    var label = TV.studentLabel(student);
    if (!label) {
      // 製図トレーナーの記録には名前が入る
      list.some(function (a) { if (a.app === 'drawing-trainer' && trim(a.data.name)) { label = trim(a.data.name); return true; } return false; });
    }
    var fromFile = !label;
    if (!label) label = stem(name);
    return { file: name, student: student || {}, label: label, fromFile: fromFile, artifacts: list, exportedAt: obj && obj.exportedAt };
  };

  TV.group = function (parsed) {
    var map = {}, order = [];
    parsed.forEach(function (p) {
      if (p.error) return;
      var key = p.label;
      if (!map[key]) { map[key] = { key: key, label: p.label, student: p.student, fromFile: p.fromFile, files: [], arts: {} }; order.push(key); }
      var s = map[key];
      s.files.push(p.file);
      if (!s.fromFile && p.fromFile) { /* 名前ありを優先 */ } else if (s.fromFile && !p.fromFile) { s.fromFile = false; s.student = p.student; }
      p.artifacts.forEach(function (a) {
        var id = a.id || (a.app + ':' + a.title + ':' + a.updatedAt);
        var old = s.arts[id];
        if (!old || str(a.updatedAt) > str(old.updatedAt)) s.arts[id] = a;
      });
    });
    return order.map(function (k) {
      var s = map[k];
      s.artifacts = Object.keys(s.arts).map(function (id) { return s.arts[id]; })
        .sort(function (a, b) { return str(a.updatedAt) < str(b.updatedAt) ? 1 : -1; });
      delete s.arts;
      return s;
    }).sort(function (a, b) {
      var ca = parseInt(half(a.student.class), 10), cb = parseInt(half(b.student.class), 10);
      var na = parseInt(half(a.student.no), 10), nb = parseInt(half(b.student.no), 10);
      if (!isNaN(ca) && !isNaN(cb) && ca !== cb) return ca - cb;
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
      return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
    });
  };

  /* ---------- アプリごとの要約 ---------- */
  var LEVEL = { 3: 'できた', 2: 'だいたい', 1: 'もう少し', A: 'A', B: 'B', C: 'C' };
  function countTrue(o) { return Object.keys(o || {}).filter(function (k) { return !!o[k]; }).length; }
  function texts(pairs) { return pairs.filter(function (p) { return trim(p[1]); }).map(function (p) { return [p[0], trim(p[1])]; }); }
  function vpText(vp) {
    var names = { society: '社会', environment: '環境', economy: '経済', safety: '安全', usability: '使いやすさ', function: '機能・性能' };
    var keys = Object.keys(vp || {}).filter(function (k) { return vp[k] !== undefined && vp[k] !== null && vp[k] !== ''; });
    return keys.map(function (k) { return (names[k] || k) + ' ' + vp[k]; }).join('、');
  }

  var S = {};
  S['material-navi'] = function (d) {
    var t = texts([['選んだ理由', d.chosenReason], ['選ばなかった理由', d.rejectedReason], ['重みを変えて気づいたこと', d.notice]]);
    return {
      fields: [['作るもの', trim(d.product)], ['選んだ材料', trim(d.chosenName)], ['選ばなかった材料', trim(d.rejectedName)],
        ['上位の材料', (d.ranking || []).map(function (r) { return r.name; }).join('、')]],
      texts: t, reflected: !!trim(d.chosenReason)
    };
  };
  S['wood-lab'] = function (d) {
    var n = d.notes || {}, log = Array.isArray(d.quizLog) ? d.quizLog : [];
    var ok = log.filter(function (q) { return q.correct; }).length;
    return {
      fields: [['反りの予測', log.length ? ok + ' / ' + log.length + ' 回 正解' : 'まだ']],
      texts: texts([['柾目と板目のちがい', n.nt1], ['反りや割れを防ぐ工夫', n.nt2], ['実物を観察して分かったこと', n.nt3]]),
      reflected: !!(trim(n.nt1) || trim(n.nt2) || trim(n.nt3))
    };
  };
  S['structure-lab'] = function (d) {
    var c = d.challenge || {}, lv = { lv1: 'レベル1', lv2: 'レベル2', lv3: 'レベル3' };
    var b = d.beam || {};
    return {
      fields: [['設計課題', (lv[c.level] || c.level || '') + '(設計 ' + Object.keys(c.designs || {}).length + ' こ)'],
        ['試した記録', (c.log || []).length + ' 回'], ['梁の設定', [b.t ? '厚さ ' + b.t + 'mm' : '', b.span ? 'スパン ' + b.span + 'mm' : '', b.loadKg ? '荷重 ' + b.loadKg + 'kg' : ''].filter(Boolean).join('・')],
        ['実験で測ったたわみ', trim(d.measured) ? trim(d.measured) + ' mm' : '']],
      texts: texts([['いちばんよいと思った設計と理由', c.reflect], ['ほかに考えること', c.reflect2], ['実験で気づいたこと', d.measuredNote],
        ['三角形の構造が使われているもの', d.frame && d.frame.note]]),
      reflected: !!(trim(c.reflect) || trim(c.reflect2))
    };
  };
  S['drawing-trainer'] = function (d) {
    var r = d.reflect || {}, self = r.self || {};
    var qf = Object.keys(d.quiz || {}).filter(function (k) { return d.quiz[k] && d.quiz[k].first; }).length;
    var names = { read: '三面図を読む', draw: '三面図をかく', iso: '等角図をかく', line: '線の使い分け' };
    return {
      fields: [['名前(記録に入力)', trim(d.name)], ['三面図クイズ', qf + ' 問(1回目で正解)'],
        ['立体づくり', countTrueBy(d.build, 'ok') + ' 問'], ['三面図をかく', Object.keys(d.draw || {}).filter(function (k) { var x = d.draw[k]; return x && x.front && x.top && x.right; }).length + ' 問'],
        ['等角図をかく', countTrueBy(d.iso, 'ok') + ' 問'], ['線と記号のテスト', d.terms && d.terms.best !== null && d.terms.best !== undefined ? '最高 ' + d.terms.best + ' / 10' : 'まだ'],
        ['自己評価', Object.keys(names).filter(function (k) { return self[k]; }).map(function (k) { return names[k] + ' ' + (LEVEL[self[k]] || self[k]); }).join('、')]],
      texts: texts([['わかったこと・できるようになったこと', r.learned], ['むずかしかったこと・次にがんばりたいこと', r.hard], ['製作図にどう生かすか', r.use]]),
      reflected: !!(trim(r.learned) || trim(r.hard) || trim(r.use))
    };
  };
  S['solid-maker'] = function (d) {
    var r = d.reflect || {}, self = r.self || {}, sz = d.size || {}, dn = d.done || {};
    var names = { match: '位置のそろい方', image: '立体を思いうかべる', pict: '等角図とキャビネット図', sheet: '図面にまとめる' };
    return {
      fields: [['三面図の大きさ', sz.W ? sz.W + '×' + sz.D + '×' + sz.H + ' マス(1マス ' + (sz.cell || 10) + 'mm)' : ''],
        ['図面', [dn.print ? '印刷 ' + dn.print + ' 回' : '', dn.pdf ? 'PDF ' + dn.pdf + ' 回' : ''].filter(Boolean).join('・')],
        ['STL', dn.stl ? dn.stl + ' 回' : ''],
        ['自己評価', Object.keys(names).filter(function (k) { return self[k]; }).map(function (k) { return names[k] + ' ' + (LEVEL[self[k]] || self[k]); }).join('、')]],
      texts: texts([['わかったこと・できるようになったこと', r.learned], ['むずかしかったこと・次にがんばりたいこと', r.hard], ['構想や製作にどう生かすか', r.use]]),
      reflected: !!(trim(r.learned) || trim(r.hard) || trim(r.use))
    };
  };
  function countTrueBy(o, k) { return Object.keys(o || {}).filter(function (x) { return o[x] && o[x][k]; }).length; }
  S.kidori = function (d) {
    var st = d.stock || {}, rv = d.review || {};
    var parts = Array.isArray(d.parts) ? d.parts : [];
    return {
      fields: [['板', st.l ? st.l + '×' + st.w + '×' + st.t + 'mm を ' + (st.count || 1) + ' 枚' : ''], ['部品', parts.length + ' 種類'],
        ['検査・点検', countTrue(rv.inspect) + ' こ確認'], ['自己評価', countTrue(rv.self) + ' こ回答'], ['見方・考え方', vpText(rv.viewpoints)],
        ['ヒントを使った回数', d.hints ? str(d.hints.used || 0) : '']],
      texts: texts([['よくできたところ', rv.good], ['直したいところ・次に生かすこと', rv.improve], ['実物を作って気づいたこと', rv.real]]),
      reflected: !!(trim(rv.good) || trim(rv.improve) || trim(rv.real))
    };
  };
  S['tool-safety'] = function (d, a) {
    var crit = { posture: '姿勢', safety: '安全', accuracy: '精度' };
    if (a.kind === 'rubric') {
      return {
        fields: [['種類', d.type === 'peer' ? '相互評価' : '自己評価'], ['工具', trim(d.toolName)], ['作業', trim(d.task)],
          ['評価', Object.keys(crit).map(function (k) { return crit[k] + ' ' + ((d.scores || {})[k] || '-'); }).join('  ')],
          ['評価した人 / された人', [trim(d.rater), trim(d.ratee)].filter(Boolean).join(' / ')]],
        texts: texts([['よかったところ・次に気をつけること', d.comment]]), reflected: !!trim(d.comment)
      };
    }
    if (a.kind === 'checklist') return { fields: [['作業前チェック', (d.items ? d.items.length : 0) + ' こ すべて確認']], texts: [], reflected: false };
    if (a.kind === 'kyt') return { fields: [['危険を見つける', d.found ? d.found.length + ' / ' + d.total + ' こ発見' : '']], texts: [], reflected: false };
    if (a.kind === 'quiz') return { fields: [['手順ならべかえ', d.correctCount + ' / ' + d.total + ' こ正しい位置']], texts: [], reflected: false };
    return generic(d);
  };
  function generic(d) {
    var out = [];
    (function walk(o, path) {
      if (out.length > 12 || o === null || o === undefined) return;
      if (typeof o === 'string') { if (o.length >= 4 && /[ぁ-んァ-ン一-龥]/.test(o)) out.push([path || '文章', o]); return; }
      if (typeof o === 'object') Object.keys(o).forEach(function (k) { walk(o[k], path ? path + '.' + k : k); });
    })(d, '');
    return { fields: [], texts: out, reflected: false };
  }
  TV.summarize = function (a) {
    var f = S[a.app], d = a.data || {};
    var r = f ? f(d, a) : generic(d);
    r.fields = r.fields.filter(function (p) { return trim(p[1]); });
    return r;
  };
  TV.isState = function (a) { return a.kind === 'state'; }; // 作業前チェックの途中状態などは一覧に出さない
})(typeof self !== 'undefined' ? self : globalThis);
