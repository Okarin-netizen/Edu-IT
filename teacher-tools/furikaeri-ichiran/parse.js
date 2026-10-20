/* 振り返り一覧(先生用): 各教材が書き出した JSON を、同じ形の「行」にそろえる。
 * ブラウザでは window.FKR、node では require('./parse.js') で使う(classic script)。
 *
 *   FKR.parse(obj, fileName) → { ok, format, entries: [{ domain, app, student, rows }], error }
 *     student: { cls, num, name }   組・番号・名前(全角→半角、末尾の「組」「番」は取る)
 *     rows:    [{ part, type, label, value, at }]
 *       part  … 教材の中の場面(モジュール・課題・作品名など。なければ '')
 *       type  … 'ふりかえり' | '自己評価' | '成績'
 *       label … 問い・項目
 *       value … 書いた文・評価・点数(空のものは入れない)
 *       at    … 日時(ISO か、教材が書いたままの文字)
 *
 * 新しい教材を足すときは ADAPTERS に1つ足す(test で読めるか確かめる)。
 */
(function (root) {
  'use strict';

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function nfkc(v) { var s = str(v); return s.normalize ? s.normalize('NFKC') : s; }

  /* 組・番号・名前をそろえる。「2組15番」のように1つの欄に書いたものも分ける */
  function student(cls, num, name) {
    var c = nfkc(cls).replace(/\s+/g, ''), n = nfkc(num).replace(/\s+/g, '');
    if (c && !n) {
      var m = c.match(/^(.*?)組[-・,、]?(\d+)番?$/);
      if (m) { c = m[1]; n = m[2]; }
    }
    return { cls: c.replace(/組$/, ''), num: n.replace(/番$/, ''), name: nfkc(name) };
  }
  var NOBODY = { cls: '', num: '', name: '' };

  /* 行を集める道具 */
  function Rows(defaultAt) {
    var rows = [];
    return {
      rows: rows,
      add: function (type, part, label, value, at) {
        var v = typeof value === 'number' ? String(value) : str(value);
        if (!v) return;
        rows.push({ part: str(part), type: type, label: str(label), value: v, at: str(at) || str(defaultAt) });
      }
    };
  }
  function pick(list, key) {
    for (var i = 0; i < list.length; i++) if (list[i][0] === key) return list[i][1];
    return key;
  }

  /* ================= A 材料と加工(gijutsu-artifact/1) ================= */
  var A_APPS = {
    'material-navi': 'A1 材料選択ナビ', 'wood-lab': 'A2 木材の繊維・収縮ラボ', 'structure-lab': 'A3 構造強化ラボ',
    'drawing-trainer': 'A4 製図トレーナー', 'kidori': 'A5 木取り・構想シミュレータ', 'tool-safety': 'A6 工具の使い方・安全トレーナー',
    'solid-maker': 'A7 第三角法 立体メーカー', 'mondai-note': 'A8 問題解決ノート'
  };
  /* 問題解決ノート(4分野共通 shared/mondai-note/)の中身 → 行。B・C・D に入れるときも、ノートの中身(data)をこれに渡す */
  var MN_SELF = [['find', '身の回りから問題を見つけ、問題と課題を分けて書けた'], ['eval', '観点を決めて評価し、改善・修正の方法を考えられた'],
    ['opt', '技術は、いろいろな条件の折り合いをつけて最適化されていると分かった']];
  var MN_LV = { '3': 'できた', '2': 'だいたいできた', '1': 'もう少し' };
  function mondaiRows(R, d) {
    var t = isObj(d.task) ? d.task : {}, ev = isObj(d.ev) ? d.ev : {}, op = isObj(d.opt) ? d.opt : {}, rf = isObj(d.refl) ? d.refl : {}, sf = isObj(rf.self) ? rf.self : {};
    R.add('ふりかえり', '① 問題の発見', '問題', t.problem);
    R.add('ふりかえり', '① 問題の発見', '課題', t.kadai);
    var q = isObj(d.quiz) ? d.quiz.last : null;
    if (isObj(q) && q.total) R.add('成績', '① 問題の発見', '問題?課題? クイズ', q.score + ' / ' + q.total);
    var res = isObj(ev.res) ? ev.res : {}, keys = Object.keys(res).filter(function (k) { return res[k]; });
    if (keys.length) R.add('自己評価', '② 評価', '観点ごとの評価(5段階)の平均', String(Math.round(keys.reduce(function (s, k) { return s + (+res[k] || 0); }, 0) / keys.length * 10) / 10) + '(' + keys.length + ' 観点)');
    R.add('ふりかえり', '② 評価', 'よかった点', ev.good);
    R.add('ふりかえり', '② 評価', '改善・修正の方法', ev.improve);
    R.add('ふりかえり', '② 評価', '新たに見つけた問題', ev.newProblem);
    R.add('ふりかえり', '③ 技術の最適化', '重みや制約条件を変えて気づいたこと', op.notice);
    R.add('ふりかえり', '③ 技術の最適化', '自分の問題解決と社会の問題解決', op.compare);
    MN_SELF.forEach(function (s) { R.add('自己評価', '振り返り', s[1], MN_LV[sf[s[0]]]); });
    R.add('ふりかえり', '振り返り', '分かったこと・できるようになったこと', rf.learned);
    R.add('ふりかえり', '振り返り', 'これからの問題解決に生かしたいこと', rf.next);
  }
  var A4_SELF = [['read', '三面図を見て、立体の形を思いうかべることができた'], ['draw', '第三角法で、正面図・平面図・右側面図を正しい位置にかけた'],
    ['iso', '等角図を、たて・横・おくの3つの向きの線でかけた'], ['line', '線の種類(外形線・かくれ線・中心線など)を使い分けられた']];
  var A4_LV = { '3': 'できた', '2': 'だいたいできた', '1': 'もう少し' };
  var A7_SELF = [['match', '三面図で、幅・高さ・奥行きがそろう位置がわかった'], ['image', '三面図から、立体の形を思いうかべることができた'],
    ['pict', '等角図とキャビネット図のちがいを説明できる'], ['sheet', '寸法や表題欄の入った図面にまとめることができた']];
  var A5_VIEW = [['society', '社会'], ['environment', '環境'], ['economy', '経済'], ['safety', '安全'], ['usability', '使いやすさ'], ['function', '機能']];
  var A6_SCORE = [['posture', '姿勢'], ['safety', '安全'], ['accuracy', '精度']];

  function aRows(a) {
    var d = a.data || {}, at = a.updatedAt || a.createdAt, R = Rows(at), title = str(a.title);
    switch (a.app) {
      case 'material-navi':
        R.add('ふりかえり', title, '選んだ理由', d.chosenReason);
        R.add('ふりかえり', title, '選ばなかった理由', d.rejectedReason);
        R.add('ふりかえり', title, '重みを変えて気づいたこと', d.notice);
        break;
      case 'wood-lab': {
        var n = d.notes || {};
        R.add('ふりかえり', '', '柾目と板目のちがい', n.nt1);
        R.add('ふりかえり', '', '反りや割れを防ぐ木取り・使い方の工夫', n.nt2);
        R.add('ふりかえり', '', '実物の板を観察して分かったこと', n.nt3);
        var log = Array.isArray(d.quizLog) ? d.quizLog : [];
        if (log.length) R.add('成績', '', '反りの予測', log.filter(function (x) { return x && x.correct; }).length + ' / ' + log.length + ' 回 正解');
        break;
      }
      case 'structure-lab': {
        var ch = d.challenge || {};
        R.add('ふりかえり', title, 'いちばんよいと思った設計と、その理由', ch.reflect);
        R.add('ふりかえり', title, '実際に作るとき、ほかに考えること', ch.reflect2);
        R.add('ふりかえり', title, '測定して気づいたこと', d.measuredNote);
        R.add('ふりかえり', title, '三角形の構造が使われているもの', (d.frame || {}).note);
        break;
      }
      case 'drawing-trainer': {
        var r = d.reflect || {}, self = r.self || {};
        A4_SELF.forEach(function (s) { R.add('自己評価', '', s[1], A4_LV[self[s[0]]]); });
        R.add('ふりかえり', '', 'わかったこと・できるようになったこと', r.learned);
        R.add('ふりかえり', '', 'むずかしかったこと・次にがんばりたいこと', r.hard);
        R.add('ふりかえり', '', '製作図をかくときにどう生かしたいか', r.use);
        var t = d.terms || {};
        if (t.best != null) R.add('成績', '', '用語クイズ(最高)', t.best);
        break;
      }
      case 'kidori': {
        var rv = d.review || {}, vp = rv.viewpoints || {};
        var vps = A5_VIEW.filter(function (v) { return vp[v[0]] != null && vp[v[0]] !== ''; })
          .map(function (v) { return v[1] + ' ' + vp[v[0]]; });
        if (vps.length) R.add('自己評価', title, '観点ごとの評価(0〜5)', vps.join(' / '));
        R.add('ふりかえり', title, '工夫したところ・よかったところ', rv.good);
        R.add('ふりかえり', title, '直したいところ(改善の案)', rv.improve);
        R.add('ふりかえり', title, '実物を作って気付いたこと', rv.real);
        break;
      }
      case 'solid-maker': {
        var rf = d.reflect || {}, sf = rf.self || {};
        A7_SELF.forEach(function (s) { R.add('自己評価', title, s[1], A4_LV[sf[s[0]]]); });
        R.add('ふりかえり', title, 'わかったこと・できるようになったこと', rf.learned);
        R.add('ふりかえり', title, 'むずかしかったこと・次にがんばりたいこと', rf.hard);
        R.add('ふりかえり', title, '自分の作品の構想や製作に、どう生かしたいか', rf.use);
        break;
      }
      case 'mondai-note':
        mondaiRows(R, d);
        break;
      case 'tool-safety':
        if (a.kind === 'rubric') {
          var sc = d.scores || {};
          var part = [d.type === 'peer' ? '相互評価' : '自己評価', d.toolName, d.task].filter(Boolean).join(' ');
          var s = A6_SCORE.filter(function (x) { return sc[x[0]]; }).map(function (x) { return x[1] + ' ' + sc[x[0]]; }).join(' / ');
          if (d.type === 'peer' && s) s += '(' + [str(d.rater) && '評価した人: ' + str(d.rater), str(d.ratee) && '評価された人: ' + str(d.ratee)].filter(Boolean).join('、') + ')';
          R.add('自己評価', part, '姿勢・安全・精度', s);
          R.add('ふりかえり', part, 'よかったところ・次に気をつけること', d.comment);
        } else if (a.kind === 'read') {
          R.add('成績', '① 工具の手順', '最後まで読んだ工具', d.toolName);
        } else if (a.kind === 'kyt' && d.total) {
          R.add('成績', title, '危険を見つけた数', (d.found || []).length + ' / ' + d.total);
        } else if (a.kind === 'quiz' && d.total) {
          R.add('成績', title, '正しい順番', d.correctCount + ' / ' + d.total);
        }
        break;
    }
    return R.rows;
  }
  function isArtifact(a) { return isObj(a) && typeof a.app === 'string' && isObj(a.data); }
  function parseA(obj) {
    var list = Array.isArray(obj) ? obj : Array.isArray(obj.artifacts) ? obj.artifacts : [obj];
    list = list.filter(function (a) { return isArtifact(a) && A_APPS[a.app] && a.kind !== 'state'; });
    var base = isObj(obj.student) ? student(obj.student.class, obj.student.no, obj.student.name) : null;
    var by = {};
    list.forEach(function (a) {
      var st = base || (a.app === 'drawing-trainer' && str(a.data.name) ? student('', '', a.data.name) : NOBODY);
      var e = by[a.app] || (by[a.app] = { domain: 'A', app: A_APPS[a.app], student: st, rows: [] });
      e.rows = e.rows.concat(aRows(a));
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  }

  /* ================= B 生物育成 ================= */
  var B4_Q = [['q1', '育てた生物と、自分が工夫した育成環境の調節方法'], ['q2', '記録(グラフ・写真)からわかったこと'], ['q3', '予測と実際をくらべて気づいたこと'],
    ['q4', 'うまくいかなかったことと、その原因'], ['q5', '次に育てるとき、どう改善するか'], ['q6', '生物育成の技術は社会や生活でどう役立っているか・これからどう使いたいか']];
  var B4_S = [['s1', '毎日の観察・記録を続けられた'], ['s2', '記録やグラフから成長の変化を読み取れた'], ['s3', '記録をもとに改善の方法を考えられた'], ['s4', '安全や環境に気をつけて育てられた']];
  var B4_EV = [['good', 'よかったこと'], ['bad', 'うまくいかなかったこと'], ['next', '次にどうするか'], ['society', '社会とのつながり']];
  function parseB4(obj) {
    var p = obj.profile || {}, r = p.refl || {}, R = Rows(r.savedTs || obj.exportedAt);
    B4_S.forEach(function (s) { R.add('自己評価', '', s[1], r[s[0]]); });
    B4_Q.forEach(function (q) { R.add('ふりかえり', '', q[1], r[q[0]]); });
    var plans = {};
    (p.plans || []).forEach(function (pl) { if (isObj(pl)) plans[pl.id] = pl; });
    Object.keys(p.evals || {}).forEach(function (id) {
      var ev = p.evals[id] || {}, pl = plans[id] || {};
      if (pl.demo) return;
      var part = '評価: ' + (str(pl.name) || '計画');
      B4_EV.forEach(function (x) { R.add('ふりかえり', part, x[1], ev[x[0]]); });
    });
    return [{ domain: 'B', app: 'B4 育成日誌', student: student(r.cls, r.no, r.fullname), rows: R.rows }];
  }
  var B2_Q = [['q1', '生き物を健康に育てるために大切な条件'], ['q2', 'うまくいかなかったことと、その原因・改善した方法'], ['q3', '生き物の様子から状態を読み取るとき大切だと思ったこと'],
    ['q4', '実際の飼育や観察で生かしたいこと'], ['q6', '世話の回数や量とコスト(健康とのバランス)'], ['q5', '生き物の命や生態系、水産業・畜産業について考えたこと']];
  var B2_EV = [['e1', '動物・水産生物に合った環境の条件が分かった'], ['e2', '様子やデータから原因を考え、世話の方法を改善できた'], ['e3', '命を大切にし、実際の飼育や社会に生かそうと考えた']];
  var B2_LV = ['◎ よくできた', '○ できた', '△ もう少し'];
  var B2_QUIZ = [['water', '水の生き物の診断'], ['land', '陸の動物の診断'], ['eco', '生態系と産業への配慮']];
  function parseB2(obj) {
    var d = obj.data || {}, r = d.refl || {}, ev = r.ev || {}, R = Rows(r.saved || obj.exported);
    B2_EV.forEach(function (e) { R.add('自己評価', '', e[1], B2_LV[ev[e[0]]]); });
    B2_Q.forEach(function (q) { R.add('ふりかえり', '', q[1], r[q[0]]); });
    var qz = d.quiz || {};
    B2_QUIZ.forEach(function (q) { var x = qz[q[0]]; if (isObj(x) && x.best != null) R.add('成績', '', q[1] + '(最高)', x.best, x.date); });
    return [{ domain: 'B', app: 'B2 動物飼育・水産', student: student(r.cls, r.no, r.name), rows: R.rows }];
  }
  var B3_Q = [['q1', '収穫日から逆算して計画を立てて気づいたこと'], ['q2', '地域や休業日を入れると計画はどう変わったか・なぜ考えるとよいか'],
    ['q3', '計画と実際のずれとその原因、次の改善案'], ['q4', '育成計画を立てる技術は社会や生活でどう役立つか']];
  var B3_S = [['a', '作物の性質をもとに、作業日を逆算して計画を立てられた'], ['b', '地域・休業日・連作などの条件を考えて計画を直せた'], ['c', '計画と実際をくらべて、原因と改善案を考えられた']];
  var B3_LV = { 3: '◎ よくできた', 2: '○ できた', 1: '△ もう少し' };
  function parseB3(obj) {
    var r = obj.reflection || {}, self = r.self || {}, R = Rows(r.saved);
    B3_S.forEach(function (s) { R.add('自己評価', '', s[1], B3_LV[self[s[0]]]); });
    B3_Q.forEach(function (q) { R.add('ふりかえり', '', q[1], r[q[0]]); });
    return [{ domain: 'B', app: 'B3 栽培暦ビルダー', student: student(r.kumi, r.ban, r.name), rows: R.rows }];
  }

  var B5_Q = [['q1', '露地栽培と植物工場のよいところと課題'], ['q2', 'センサとプログラムで照明や水やりを自動にして分かったこと'], ['q3', '収量・品質と電気代・水の量の折り合いのつけ方'],
    ['q4', '評価して見つかった新しい問題と改善のアイデア'], ['q5', 'これからの生物育成の技術でできるとよいこと']];
  var B5_EV = [['e1', 'センサとプログラムで育成環境を自動で調節するしくみが分かった'], ['e2', 'データをもとにプログラムを改善できた'], ['e3', '社会や環境への影響を考えて生物育成の技術を評価できた']];
  var B5_RADAR = [['quality', '品質'], ['yield', '収量'], ['cost', '費用'], ['safety', '安全性'], ['env', '環境への配慮']];
  function parseB5(obj) {
    var d = obj.data || {}, r = isObj(d.refl) ? d.refl : {}, st = isObj(d.state) ? d.state : {}, ev = r.ev || {}, R = Rows(r.saved || obj.exported);
    B5_EV.forEach(function (e) { R.add('自己評価', '', e[1], B2_LV[ev[e[0]]]); });
    if (isObj(r.radar)) R.add('自己評価', '評価のレーダーチャート', '品質・収量・費用・安全性・環境への配慮(1〜5)',
      B5_RADAR.map(function (x) { return x[1] + ' ' + (r.radar[x[0]] != null ? r.radar[x[0]] : '-'); }).join(' / '));
    B5_Q.forEach(function (q) { R.add('ふりかえり', '', q[1], r[q[0]]); });
    if (st.pickReason) R.add('ふりかえり', '⑤ スマート農業', 'えらんだ設定と理由', (st.pick ? '第' + st.pick + '回: ' : '') + st.pickReason);
    if (isObj(st.sort) && st.sort.checked) R.add('成績', '① くらべる', '仕分けクイズ', st.sort.score + ' / 8 問', st.sort.at);
    if (st.best2) R.add('成績', '② 照明を自動に', 'ミッション', '★' + st.best2);
    if (st.best3) R.add('成績', '③ 水やりを自動に', 'ミッション', '★' + st.best3);
    var tr = Array.isArray(st.trials) ? st.trials.filter(isObj) : [];
    if (tr.length) {
      var b = tr.reduce(function (m, t) { return !m || t.score > m.score ? t : m; }, null);
      R.add('成績', '④ 全部を自動に', '最高点(試した回数)', b.score + ' 点(' + tr.length + ' 回)', b.at);
    }
    if (isObj(st.smartBest)) R.add('成績', '⑤ スマート農業', '遠隔監視のチャレンジ(最高)', st.smartBest.score + ' / 6 点', st.smartBest.at);
    return [{ domain: 'B', app: 'B5 植物工場の自動化', student: student(r.cls, r.no, r.name), rows: R.rows }];
  }

  /* B6 問題解決ノート: { app: 'B6', version, exported, data: { note } }(ノートの中身は shared/mondai-note) */
  function parseB6(obj) {
    var n = obj.data.note, st = isObj(n.student) ? n.student : {}, R = Rows(obj.exported);
    mondaiRows(R, n);
    return [{ domain: 'B', app: 'B6 問題解決ノート', student: student(st.cls, st.no, st.name), rows: R.rows }];
  }

  /* ================= C エネルギー変換(energyApps.artifact) ================= */
  var C_APPS = { C1: 'C1 エネルギー変換ゲーム', C2: 'C2 電気回路ラボ', C3: 'C3 機構ラボ', C4: 'C4 保守点検ラボ', C5: 'C5 回路設計シート', C6: 'C6 風力発電の羽根ラボ', C7: 'C7 直流・交流と送電ラボ', C8: 'C8 問題解決ノート' };
  var C_REFL = {
    C1: [['q1', 'エネルギーの変換と、目的に使われなかったエネルギー'], ['q2', '総合効率を高くする工夫'], ['q3', '2つの発電方法のよいところと課題']],
    C2: [['q1', '回路と電流の流れ'], ['q2', '直列回路と並列回路のちがい'], ['q3', 'ヒューズ・ブレーカーの役目と安全に使うための注意']],
    C3: [['q1', '速度伝達比を大きくしたときの回転速度と回す力'], ['q2', '回転運動をほかの動きに変えるしくみが使われている機械'], ['q3', '機構を設計するときの工夫']],
    C4: [['q1', '機械に共通する部品の役割'], ['q2', '定期的に保守点検をするわけ'], ['q3', 'いちばん大切な点検項目とその理由']],
    C6: [['q1', '風が吹くと、どのようにして電気ができるか'], ['q2', 'いちばん効率がよかった羽根とその理由'], ['q3', '風力発電のよいところと課題、組み合わせるわけ']],
    C7: [['q1', '直流と交流のちがい'], ['q2', '高い電圧で電気を送るわけ'], ['q3', '電気を安全で安定して届けるための工夫']]
  };
  function parseC(obj) {
    var R = Rows(obj.savedAt), d = obj.data || {}, who = obj.who || {};
    if (obj.app === 'C5') {
      var n = d.notes || {}, part = str(obj.name) || str(d.task);
      R.add('ふりかえり', part, '目的', n.goal);
      R.add('ふりかえり', part, '条件', n.cond);
      R.add('ふりかえり', part, '構想・設計の理由', n.idea);
      R.add('ふりかえり', part, 'うまくいったこと', n.good);
      R.add('ふりかえり', part, '改善案', n.improve);
    }
    if (obj.app === 'C6' || obj.app === 'C7') {
      var steps = Array.isArray(d.steps) ? d.steps.filter(isObj) : [];
      if (steps.length) R.add('成績', '', 'やったこと', steps.filter(function (s) { return s.done; }).length + ' / ' + steps.length);
      var rk = Array.isArray(d.rank) && isObj(d.rank[0]) ? d.rank[0] : null;
      if (obj.app === 'C6' && rk && rk.watt > 0) R.add('成績', '③ 効率チャレンジ', 'ランキング1位の羽根', str(rk.blade) + '(4 m/s で ' + (rk.watt < 1 ? Math.round(rk.watt * 1000) + ' mW' : (+rk.watt).toFixed(2) + ' W') + ')');
      if (obj.app === 'C6' && +d.featBest > 0) R.add('成績', '④ 発電方法くらべ', '特徴クイズ(最高)', (+d.featBest) + ' / 10');
      if (obj.app === 'C7' && +d.calcBest > 0) R.add('成績', '④ 損失の計算', '計算ドリル(最高)', (+d.calcBest) + ' / 5');
      var rf = isObj(d.reflection) ? d.reflection : {};
      C_REFL[obj.app].forEach(function (q) { R.add('ふりかえり', '振り返り', q[1], rf[q[0]]); });
    }
    if (obj.app === 'C1' || obj.app === 'C2') {
      var q = isObj(d.quiz) ? d.quiz : {};
      if (obj.app === 'C1' && Array.isArray(d.stages)) R.add('成績', '', 'クリアしたステージ', (+d.cleared || 0) + ' / ' + d.stages.length + (d.maxStars ? '(★ ' + (+d.stars || 0) + ' / ' + d.maxStars + ')' : ''));
      if (obj.app === 'C2' && Array.isArray(d.tasks)) R.add('成績', '', 'クリアした課題', (+d.cleared || 0) + ' / ' + d.tasks.length);
      if (+q.total > 0) R.add('成績', '', 'ふりかえりクイズの正解', (+q.ok || 0) + ' / ' + q.total);
    }
    if ((obj.app === 'C1' || obj.app === 'C2' || obj.app === 'C3' || obj.app === 'C4') && isObj(d.reflection)) {
      C_REFL[obj.app].forEach(function (q) { R.add('ふりかえり', '振り返り', q[1], d.reflection[q[0]]); });
    }
    if (obj.app === 'C8' && isObj(d.note)) {
      /* C8 問題解決ノート: data.note がノートの中身(shared/mondai-note)。組・番号・名前はノートの中にもある */
      var ns = isObj(d.note.student) ? d.note.student : {};
      mondaiRows(R, d.note);
      return [{ domain: 'C', app: C_APPS.C8, student: student(ns.cls || who.cls, ns.no, ns.name || who.name), rows: R.rows }];
    }
    return [{ domain: 'C', app: C_APPS[obj.app] || str(obj.app), student: student(who.cls, '', who.name), rows: R.rows }];
  }

  /* ================= D 情報 ================= */
  var D_NAMES = {
    'デジタル化ラボ': { image: '① 画像のデジタル化', sound: '② 音のデジタル化', binary: '③ 2進数と文字コード', drill: '④ データ量の計算ドリル', compress: '⑤ 圧縮のしくみ' },
    '仮想CPUラボ': { diagram: '① 図解: 5つの装置', auto: '② 手計算くらべ', sim: '③ 仮想CPUを動かす', tasks: '④ 課題' },
    'ネットワーク通信シミュレータ': { build: '① ネットワークを組み立てる', flow: '② Webページが届くまで', fault: '③ 回線が切れたら？', spy: '④ のぞき見と暗号化', drill: '⑤ IPアドレス・ドリル' },
    '計測・制御シミュレータ': { streetlight: '① 街灯', door: '② 自動ドア', traffic: '③ 信号機（時間で切りかえ）', 'traffic-button': '④ 押しボタン式信号機', sandbox: '⑤ 自由に作る（仮想マイコン）' },
    '火星探査ロボット・シミュレータ': { straight: '① まっすぐ走って止まる', rock: '② 岩の前で止まる・よける', maze: '③ 迷路のような谷を探査する', line: '④ 色センサで線をたどる', free: '⑤ 自由なコースで記録に挑戦' }
  };
  var VCPU_Q = {
    diagram: 'コンピュータの5つの装置の役割と、データが流れる順', sim: '命令を「取り出し → 解読 → 実行」するようすを見て気づいたこと',
    tasks: 'プログラムが思ったとおりに動かなかったとき、どこを見てどう直したか', auto: '処理を自動化するよさと注意すること'
  };
  function stD(s) { s = s || {}; return student(s.cls, s.num, s.name); }
  function reflObj(R, app, refl, labels) {
    Object.keys(refl || {}).forEach(function (k) {
      var r = refl[k];
      var text = isObj(r) ? r.text : r, at = isObj(r) ? r.at : '';
      R.add('ふりかえり', (D_NAMES[app] || {})[k] || k, (labels || {})[k] || 'ふりかえり', text, at);
    });
  }
  function parseVcpu(obj) {
    var app = '仮想CPUラボ', R = Rows(obj.exportedAt);
    var tasks = Array.isArray(obj.tasks) ? obj.tasks : [];
    if (tasks.length) R.add('成績', D_NAMES[app].tasks, 'クリアした課題', tasks.filter(function (t) { return t && t.cleared; }).length + ' / ' + tasks.length);
    var dg = (obj.done || {}).diagram;
    if (isObj(dg) && dg.total) R.add('成績', D_NAMES[app].diagram, 'クイズ', dg.score + ' / ' + dg.total, dg.at);
    reflObj(R, app, obj.reflections, VCPU_Q);
    return [{ domain: 'D', app: app, student: stD(obj.student), rows: R.rows }];
  }
  function parseDigi(obj) {
    var app = 'デジタル化ラボ', R = Rows(obj.exportedAt);
    (obj.modules || []).forEach(function (m) {
      if (!isObj(m)) return;
      var part = D_NAMES[app][m.id] || str(m.title);
      var best = ((m.score || {}).best) || null;
      if (isObj(best) && best.total) R.add('成績', part, 'ドリル(最高)', best.correct + ' / ' + best.total, best.at);
      R.add('ふりかえり', part, 'ふりかえり', m.reflection);
    });
    return [{ domain: 'D', app: app, student: stD(obj.student), rows: R.rows }];
  }
  function parseNet(obj) {
    var app = 'ネットワーク通信シミュレータ', R = Rows(obj.exportedAt);
    var dr = ((obj.modules || {}).drill || {}).score || {};
    if (dr.best != null) R.add('成績', D_NAMES[app].drill, 'ドリル(最高)', dr.best + ' / 10');
    reflObj(R, app, obj.reflections);
    return [{ domain: 'D', app: app, student: stD(obj.student), rows: R.rows }];
  }
  function parseSec(obj) {
    var R = Rows(obj.exportedAt), ck = obj.checks || {};
    R.add('成績', '理解度チェック', '事前テスト', ck.pre);
    R.add('成績', '理解度チェック', '事後テスト', ck.post);
    (obj.reflections || []).forEach(function (r) { if (isObj(r)) R.add('ふりかえり', str(r.title) || str(r.module), 'ふりかえり', r.text, r.at); });
    return [{ domain: 'D', app: 'D4 情報セキュリティ体験ラボ', student: stD(obj.student), rows: R.rows }];
  }
  function parseMc(obj) {
    var app = '計測・制御シミュレータ', R = Rows(obj.exportedAt), best = {};
    (obj.records || []).forEach(function (r) {
      if (!isObj(r) || !r.total) return;
      var b = best[r.sid];
      if (!b || r.passed > b.passed || (r.passed === b.passed && str(r.at) > str(b.at))) best[r.sid] = r;
    });
    Object.keys(best).forEach(function (sid) {
      var r = best[sid];
      R.add('成績', D_NAMES[app][sid] || str(r.title) || sid, 'テスト(いちばんよい結果)', r.passed + ' / ' + r.total, r.at);
    });
    reflObj(R, app, obj.reflections);
    return [{ domain: 'D', app: app, student: stD(obj.student), rows: R.rows }];
  }
  // D10 火星探査ロボット・シミュレータ: テストの結果(①〜④)・記録に挑戦の点数(⑤)・課題・評価(レーダーチャート)・振り返り(4つの問い)
  var ROVER_Q = { design: '解決策の構想(センサ・モーターの選び方と理由)', debug: '動作確認・デバッグ(動かなかったところと直し方)', improve: '評価して改善・修正したいこと', society: '社会や生活の問題の解決に生かせそうなこと' };
  var ROVER_AXES = ['機能', '利便性', '費用', '安全性', '環境への配慮'];
  function parseRover(obj) {
    var app = '火星探査ロボット・シミュレータ', R = Rows(obj.exportedAt), best = {};
    (obj.records || []).forEach(function (r) {
      if (!isObj(r)) return;
      var key = r.sid === 'free' ? 'free:' + str(r.course) : r.sid;
      var b = best[key], v = r.score != null ? r.score : r.passed;
      var bv = b ? (b.score != null ? b.score : b.passed) : -1;
      if (!b || v > bv || (v === bv && str(r.at) > str(b.at))) best[key] = r;
    });
    Object.keys(best).forEach(function (k) {
      var r = best[k], part = D_NAMES[app][r.sid] || str(r.title) || r.sid;
      if (r.sid === 'free') R.add('成績', part, '記録に挑戦(' + str(r.courseName || r.course) + ')', r.score + '点(サンプル ' + r.passed + '/' + r.total + '・' + r.time + '秒・電池の残り ' + r.battery + '%)', r.at);
      else R.add('成績', part, 'テスト(いちばんよい結果)', r.passed + ' / ' + r.total, r.at);
    });
    R.add('ふりかえり', '', '課題の設定', obj.kadai);
    var ev = obj.evaluation || {};
    [['before', '改善の前'], ['after', '改善のあと']].forEach(function (w) {
      ROVER_AXES.forEach(function (a) { var v = (ev[w[0]] || {})[a]; if (v) R.add('自己評価', '評価', a + '(' + w[1] + ')', v + ' / 5'); });
    });
    var refl = obj.reflections || {};
    Object.keys(ROVER_Q).forEach(function (k) {
      var r = refl[k];
      R.add('ふりかえり', '評価・振り返り', ROVER_Q[k], isObj(r) ? r.text : r, isObj(r) ? r.at : '');
    });
    return [{ domain: 'D', app: app, student: stD(obj.student), rows: R.rows }];
  }
  function studioRows(R, w, at) {
    var part = str(w.title) || '作品';
    R.add('ふりかえり', part, 'テストして直したこと(改善)', w.improve, at);
    R.add('ふりかえり', part, 'ふりかえり', w.reflect, at);
  }
  function parseStudio(obj) {
    var R = Rows(obj.exportedAt);
    (obj.works || []).forEach(function (w) { if (isObj(w)) studioRows(R, w, w.updatedAt); });
    return [{ domain: 'D', app: 'D6 双方向コンテンツ制作スタジオ', student: stD(obj.student), rows: R.rows }];
  }
  function parseStudioWork(obj) {
    var w = obj.work || {}, R = Rows(w.updatedAt);
    studioRows(R, w.plan || {}, w.updatedAt);
    R.rows.forEach(function (r) { r.part = str(w.title) || '作品'; });
    return [{ domain: 'D', app: 'D6 双方向コンテンツ制作スタジオ', student: NOBODY, rows: R.rows }];
  }
  var GENAI_Q = [['r1', '文章をつくるAIと画像をつくるAIは、それぞれどうやって作っていたか'], ['r2', 'ハルシネーションや個人情報について、気をつけたいこと'], ['r3', '生成AIを、どんな場面で、どのように使ってみたいか']];
  function parseGenai(obj) {
    var R = Rows(obj.exportedAt), q = obj.quiz || {}, r = obj.reflection || {};
    if (q.total) R.add('成績', 'クイズ', '正解', q.correct + ' / ' + q.total);
    GENAI_Q.forEach(function (x) { R.add('ふりかえり', '', x[1], r[x[0]]); });
    return [{ domain: 'D', app: 'D8 生成AIのしくみラボ', student: stD(obj.student), rows: R.rows }];
  }
  var SCAM_Q = [['r1', '体験した詐欺で、だます人はどんな手口を使っていたか'], ['r2', 'あやしいと思ったとき、自分はどんな手順で行動するか'], ['r3', '家族や友達に伝えたいこと']];
  function parseScam(obj) {
    var R = Rows(obj.exportedAt), r = obj.reflection || {}, list = Array.isArray(obj.scenarios) ? obj.scenarios.filter(isObj) : [];
    if (list.length) R.add('成績', '', 'クリアした場面', list.filter(function (x) { return x.cleared; }).length + ' / ' + list.length);
    list.forEach(function (x) {
      var part = [str(x.no), str(x.title)].filter(Boolean).join(' ');
      if (x.cleared) R.add('成績', part, 'クリア', 'クリア(だまされた ' + (x.misses || 0) + ' 回・ヒント ' + (x.hints || 0) + ' 回)', x.clearedAt);
      else if (x.misses || x.hints) R.add('成績', part, 'クリア', 'まだ(だまされた ' + (x.misses || 0) + ' 回・ヒント ' + (x.hints || 0) + ' 回)');
    });
    SCAM_Q.forEach(function (x) { R.add('ふりかえり', '', x[1], r[x[0]]); });
    return [{ domain: 'D', app: 'D5 ネット詐欺 追体験ラボ', student: stD(obj.student), rows: R.rows }];
  }
  var HASH_Q = [['r1', 'ハッシュ関数の性質'], ['r2', 'パスワードを守るために、サービスを作る側と自分ができること'], ['r3', 'ハッシュ値が役に立っているところ']];
  function parseHash(obj) {
    var R = Rows(obj.exportedAt), q = obj.quiz || {}, r = obj.reflection || {};
    var ch = Array.isArray(obj.challenges) ? obj.challenges.filter(isObj) : [];
    if (ch.length) R.add('成績', '', 'チャレンジ達成', ch.filter(function (x) { return x.cleared; }).length + ' / ' + ch.length);
    ch.forEach(function (x) { if (x.cleared) R.add('成績', 'ステップ' + str(x.no), 'チャレンジ', '達成: ' + str(x.title), x.at); });
    if (q.total) R.add('成績', 'クイズ', '正解', q.correct + ' / ' + q.total);
    HASH_Q.forEach(function (x) { R.add('ふりかえり', '', x[1], r[x[0]]); });
    return [{ domain: 'D', app: 'D9 ハッシュ化体験ラボ', student: stD(obj.student), rows: R.rows }];
  }
  // D11 問題解決ノート: { app: '問題解決ノート', student: { cls, num, name }, note }(ノートの中身は shared/mondai-note)
  function parseMondaiD(obj) {
    var R = Rows(obj.exportedAt), n = obj.note, ns = isObj(n.student) ? n.student : {}, st = isObj(obj.student) ? obj.student : {};
    mondaiRows(R, n);
    return [{ domain: 'D', app: 'D11 問題解決ノート', student: student(st.cls || ns.cls, st.num || ns.no, st.name || ns.name), rows: R.rows }];
  }
  // 教材の名前に記号(D1〜D11。教材集のおすすめの順 = materials.json の code)を付ける
  var D_CODE = { 'デジタル化ラボ': 'D1', '仮想CPUラボ': 'D2', 'ネットワーク通信シミュレータ': 'D3', '情報セキュリティ体験ラボ': 'D4', 'ネット詐欺 追体験ラボ': 'D5', '双方向コンテンツ制作スタジオ': 'D6', '計測・制御シミュレータ': 'D7', '生成AIのしくみラボ': 'D8', 'ハッシュ化体験ラボ': 'D9', '火星探査ロボット・シミュレータ': 'D10', '問題解決ノート': 'D11' };
  function dName(t) { return D_CODE[t] ? D_CODE[t] + ' ' + t : t; }
  function parseKyozai(obj) {
    var st = stD(obj.student);
    return (obj.materials || []).filter(function (m) { return isObj(m) && m.hasRecord; }).map(function (m) {
      var R = Rows(obj.exportedAt);
      // 生成AI・ネット詐欺・ハッシュ化のラボ(第1.6版から教材集に入った)は、ページの代わりに問い(question)が入る
      (m.reflections || []).forEach(function (r) { if (isObj(r)) R.add('ふりかえり', str(r.page), str(r.question) || 'ふりかえり', r.text, r.at); });
      return { domain: 'D', app: str(m.title), student: st, rows: R.rows };
    });
  }

  /* ================= G 技術分野のガイダンス(G-guidance/index.html) =================
   * { schema: 'eduit-guidance/1', app: 'G', exported, student: { cls, no, name }, score: { t1…t5 }, data: { first, t1…t5, refl } } */
  var G_SELF = [['idea', '身の回りの製品に、問題を解決するための工夫があることが分かった'], ['view', '技術の見方・考え方(4つの視点)で、製品を見ることができた'],
    ['flow', '問題と課題のちがいと、問題解決の流れが分かった'], ['plan', '4つの分野で何を学ぶかが分かり、3年間の目標を持てた']];
  var G_LV = { '3': 'できた', '2': 'だいたいできた', '1': 'もう少し' };
  var G_BIKE = { student: '通学する中学生', elder: '坂の多い町のお年寄り', racer: '自転車レースの選手', eco: '町のシェアサイクル',
    iron: '鉄', alumi: 'アルミニウム', carbon: '炭素繊維', human: '人の力だけ', assist: '電動アシスト', battery: '電池のライト', dynamo: '自動でつくライト' };
  function parseG(obj) {
    var d = isObj(obj.data) ? obj.data : {}, sc = isObj(obj.score) ? obj.score : {}, st = isObj(obj.student) ? obj.student : {}, R = Rows(obj.exported);
    var g = function (k) { return isObj(d[k]) ? d[k] : {}; };
    var t1 = g('t1'), t2 = g('t2'), t3 = g('t3'), t4 = g('t4'), t5 = g('t5'), rf = g('refl'), sf = isObj(rf.self) ? rf.self : {};
    if (Array.isArray(d.first)) R.add('ふりかえり', 'はじめに', '身の回りの技術', d.first.map(str).filter(Boolean).join('・'));
    R.add('成績', '① 工夫・創造', '発想のしかたクイズ', sc.t1);
    R.add('ふりかえり', '① 工夫・創造', '製品の工夫', [str(t1.product), str(t1.problem), str(t1.idea)].filter(Boolean).join(' / '));
    R.add('成績', '② 歩みと未来', '古い順にならべる', sc.t2);
    R.add('ふりかえり', '② 歩みと未来', '技術でかなえたい夢', t2.dream);
    R.add('成績', '③ 見方・考え方', '4つの視点の仕分け', sc.t3);
    if (t3.user) R.add('ふりかえり', '③ 見方・考え方', '自転車の設計', [t3.user, t3.frame, t3.power, t3.light].map(function (k) { return G_BIKE[k] || str(k); }).filter(Boolean).join(' / ') + (str(t3.why) ? ': ' + str(t3.why) : ''));
    R.add('成績', '④ 問題解決', '問題?課題?・流れ・ニーズ?シーズ?', sc.t4);
    R.add('ふりかえり', '④ 問題解決', '問題', t4.problem);
    R.add('ふりかえり', '④ 問題解決', '課題', t4.kadai);
    R.add('成績', '⑤ 4つの分野', 'どの分野の技術?', sc.t5);
    R.add('ふりかえり', '⑤ 4つの分野', '楽しみな分野と目標', [str(t5.fav), str(t5.goal)].filter(Boolean).join(': '));
    G_SELF.forEach(function (s) { R.add('自己評価', '振り返り', s[1], G_LV[sf[s[0]]]); });
    R.add('ふりかえり', '振り返り', '技術とは何か', rf.learned);
    R.add('ふりかえり', '振り返り', 'これからがんばりたいこと', rf.next);
    return [{ domain: 'G', app: 'G 技術分野のガイダンス', student: student(st.cls, st.no, st.name), rows: R.rows }];
  }

  /* ================= M・F・Z 教科書順コースの教材(T-textbook/) =================
   * { schema: 'eduit-textbook/1', app: 'M'|'F'|'Z', exported, student: { cls, no, name }, score: {…}, data: {…, refl: { self, learned, next } } } */
  var T_LV = { '3': 'できた', '2': 'だいたいできた', '1': 'もう少し' };
  var T_VIEWS = ['社会からの要求', '安全性', '環境への負荷', '経済性'];
  var M_AREAS = [['a', '① 材料と加工'], ['b', '② 生物育成'], ['c', '③ エネルギー変換'], ['d', '④ 情報']];
  var T_SELF = {
    M: [['find', '身の回りの製品やしくみから、4つの分野の技術を見つけられた'], ['why', '製品の工夫が、どんな問題を解決しているかを考えられた'],
      ['view', '工夫を4つの視点で分けて、折り合いのつけ方を考えられた']],
    F: [['know', 'これからの技術のしくみと、めざす社会とのつながりが分かった'], ['eval', '技術のよいところと心配なところを、4つの視点で評価できた'],
      ['plan', '技術を組み合わせて、社会の問題を解決する案を考えられた']],
    Z: [['look', '3年間の学習をふりかえり、できるようになったことを確かめられた'], ['link', '4つの分野の技術が組み合わさって使われていることが分かった'],
      ['role', 'これからの社会で、技術とどうかかわるかを自分の言葉で書けた']]
  };
  var T_REFL = { M: ['技術を見る目が変わったところ', 'もっと調べてみたい製品やしくみ'], F: ['これからの技術とのかかわり方', 'いちばん気になった技術'],
    Z: ['後輩へのひとこと', 'いちばん心に残っていること'] };
  var T_NAMES = {
    clt: 'CLT(直交集成板)', bio: 'バイオマスプラスチック', print3d: '3Dプリンタ', cfrp: '炭素繊維強化プラスチック', recycle: '金属・プラスチックのリサイクル',
    smart: 'スマート農業', factory: '植物工場', land: '陸上養殖', breed: '新しい品種づくり', enemy: '天敵を利用した害虫対策',
    renew: '再生可能エネルギーの発電', battery: '蓄電池', fuelcell: '燃料電池(水素)', ev: '電気自動車', grid: 'スマートグリッド',
    ai: '人工知能(AI)', iot: 'センサとネットワーク(IoT)', robot: 'ロボット', drone: 'ドローン', app: 'スマートフォンのアプリ',
    aging: '高齢化と人手不足', food: '食料を安定してつくる', energy: '地球温暖化とエネルギー', disaster: '自然災害にそなえる', waste: 'ごみと資源',
    user: '使う人', maker: '作る・運営する人', near: '近くに住む人', future: '未来の人'
  };
  var Z_CHECK = ['身の回りの製品やしくみを見て、どんな技術の工夫があるかに気づける', '材料の性質を生かして、じょうぶな製品を設計し、安全に製作できる',
    '作物や生き物の育ち方に合わせて、育てる環境を整え、管理できる', 'エネルギーを変換するしくみと、電気機器を安全に使う方法が分かる',
    'コンピュータやネットワークのしくみと、情報を安全に使う方法が分かる', 'プログラムで、計測・制御や、やりとりのできるコンテンツをつくれる',
    '問題を見つけて課題を決め、計画・製作(育成・制作)・評価・改善を進められる', '社会からの要求・安全性・環境への負荷・経済性の折り合いを考えられる',
    '新しい技術のよいところと心配なところの両方を考えて、使い方を判断できる', '技術を使って、よりよい生活や持続可能な社会をつくろうと考えられる'];
  var T_TITLE = { M: 'M 身の回りの技術さがし', F: 'F これからの技術ラボ', Z: 'Z 学習を終えて' };
  function parseT(obj) {
    var d = isObj(obj.data) ? obj.data : {}, sc = isObj(obj.score) ? obj.score : {}, st = isObj(obj.student) ? obj.student : {}, R = Rows(obj.exported);
    var g = function (o, k) { return isObj(o) && isObj(o[k]) ? o[k] : {}; };
    var nm = function (k) { return T_NAMES[k] || str(k); };
    var app = obj.app;
    if (app === 'M') {
      var it = g(d, 'intro');
      R.add('成績', 'はじめに', 'どの技術の工夫?', sc.intro);
      R.add('ふりかえり', 'はじめに', '見つけた技術', ['a', 'b', 'c', 'd'].map(function (k) { return str(it[k]) ? k.toUpperCase() + ': ' + str(it[k]) : ''; }).filter(Boolean).join(' / '));
      M_AREAS.forEach(function (A) {
        var a = g(d, A[0]);
        R.add('成績', A[1], 'どんな工夫?・問題解決の工夫', sc[A[0]]);
        R.add('ふりかえり', A[1], '見つけた製品の工夫', [str(a.product), str(a.problem), str(a.idea)].filter(Boolean).join(' / ') + (str(a.view) ? '(大事な視点: ' + str(a.view) + ')' : ''));
      });
    } else if (app === 'F') {
      [['a', '① 材料と加工'], ['b', '② 生物育成'], ['c', '③ エネルギー変換']].forEach(function (A) {
        var a = g(d, A[0]), r = isObj(a.r) ? a.r[a.pick] : null;
        R.add('成績', A[1], 'どの技術?', sc[A[0]]);
        if (a.pick) R.add('ふりかえり', A[1], '評価した技術', nm(a.pick) + (Array.isArray(r) ? '(' + T_VIEWS.map(function (v, i) { return v + ' ' + (r[i] || '-'); }).join('・') + ')' : ''));
        R.add('ふりかえり', A[1], 'よいところ', a.good);
        R.add('ふりかえり', A[1], '心配なところ', a.bad);
        R.add('ふりかえり', A[1], 'これからの使い方', a.plan);
      });
      var e = g(d, 'e');
      if (e.prob) R.add('ふりかえり', '④ 未来を提案', '社会の問題', nm(e.prob));
      if (Array.isArray(e.use) && e.use.length) R.add('ふりかえり', '④ 未来を提案', '使う技術', e.use.map(nm).join('・'));
      R.add('ふりかえり', '④ 未来を提案', 'だれの何がよくなる', e.better);
      R.add('ふりかえり', '④ 未来を提案', '技術の組み合わせ方', e.how);
      R.add('ふりかえり', '④ 未来を提案', '心配なことと対策', e.worry);
      R.add('ふりかえり', '④ 未来を提案', '立場を変えた見直し' + (e.who ? '(' + nm(e.who) + ')' : ''), e.review);
    } else if (app === 'Z') {
      var t1 = g(d, 't1'), ck = isObj(t1.check) ? t1.check : {};
      Z_CHECK.forEach(function (c, i) { R.add('自己評価', '① ふりかえりチェック', c, T_LV[ck['c' + (i + 1)]]); });
      R.add('ふりかえり', '① ふりかえりチェック', 'いちばん成長したこと', t1.grow);
      R.add('ふりかえり', '① ふりかえりチェック', 'のばしたいこと', t1.more);
      R.add('成績', '② 技術のつながり', 'どの分野の技術?', sc.t2);
      R.add('ふりかえり', '② 技術のつながり', '自分で見つけた例', g(d, 't2').own);
      var t3 = g(d, 't3');
      R.add('成績', '③ 技術とわたしたち', 'こんなとき、どうする?', sc.t3);
      R.add('ふりかえり', '③ 技術とわたしたち', '技術とのかかわり方' + (str(t3.role) ? '(' + str(t3.role) + ')' : ''), t3.how);
      var t4 = g(d, 't4');
      R.add('ふりかえり', '④ これからのわたし', 'ガイダンスの目標はどうだった', t4.goal);
      R.add('ふりかえり', '④ これからのわたし', '生活に生かしたいこと', t4.life);
      R.add('ふりかえり', '④ これからのわたし', '技術でかなえたい夢', t4.dream);
    }
    var rf = g(d, 'refl'), sf = isObj(rf.self) ? rf.self : {};
    T_SELF[app].forEach(function (s) { R.add('自己評価', '振り返り', s[1], T_LV[sf[s[0]]]); });
    R.add('ふりかえり', '振り返り', T_REFL[app][0], rf.learned);
    R.add('ふりかえり', '振り返り', T_REFL[app][1], rf.next);
    return [{ domain: app, app: T_TITLE[app], student: student(st.cls, st.no, st.name), rows: R.rows }];
  }

  /* ================= 形の見分け(上から順に試す) ================= */
  var ADAPTERS = [
    ['G 技術分野のガイダンス', function (o) { return o.schema === 'eduit-guidance/1' && o.app === 'G'; }, parseG],
    ['M・F・Z 教科書順コースの教材', function (o) { return o.schema === 'eduit-textbook/1' && T_SELF.hasOwnProperty(o.app); }, parseT],
    ['情報の技術 体験教材集(記録まとめ)', function (o) { return o.kind === '記録まとめ' && Array.isArray(o.materials); }, parseKyozai],
    ['材料と加工', function (o) {
      return o.schema === 'gijutsu-bundle/1' || o.schema === 'gijutsu-artifact/1' ||
        (Array.isArray(o.artifacts) && o.artifacts.some(isArtifact)) || (isArtifact(o) && A_APPS[o.app]);
    }, parseA],
    ['B4 育成日誌', function (o) { return o.app === 'B4' && isObj(o.profile); }, parseB4],
    ['B2 動物飼育・水産', function (o) { return o.app === 'B2' && isObj(o.data); }, parseB2],
    ['B3 栽培暦ビルダー', function (o) { return o.app === 'B3' && (isObj(o.reflection) || isObj(o.state)); }, parseB3],
    ['B5 植物工場の自動化', function (o) { return o.app === 'B5' && isObj(o.data); }, parseB5],
    ['B6 問題解決ノート', function (o) { return o.app === 'B6' && isObj(o.data) && isObj(o.data.note); }, parseB6],
    ['エネルギー変換', function (o) { return o.schema === 'energyApps.artifact'; }, parseC],
    ['D2 仮想CPUラボ', function (o) { return o.app === 'virtual-cpu'; }, parseVcpu],
    ['D1 デジタル化ラボ', function (o) { return o.app === 'デジタル化ラボ'; }, parseDigi],
    ['D3 ネットワーク通信シミュレータ', function (o) { return o.app === 'network-sim'; }, parseNet],
    ['D4 情報セキュリティ体験ラボ', function (o) { return o.app === 'seclab' && o.student !== undefined; }, parseSec],
    ['D7 計測・制御シミュレータ', function (o) { return o.app === '計測・制御シミュレータ'; }, parseMc],
    ['D6 双方向コンテンツ制作スタジオ', function (o) { return o.app === 'interactive-studio' && Array.isArray(o.works); }, parseStudio],
    ['双方向コンテンツ制作スタジオ(作品ファイル)', function (o) { return o.format === 'interactive-studio-work' && isObj(o.work); }, parseStudioWork],
    ['D8 生成AIのしくみラボ', function (o) { return o.app === '生成AIのしくみラボ'; }, parseGenai],
    ['D5 ネット詐欺 追体験ラボ', function (o) { return o.app === 'ネット詐欺 追体験ラボ'; }, parseScam],
    ['D9 ハッシュ化体験ラボ', function (o) { return o.app === 'ハッシュ化体験ラボ'; }, parseHash],
    ['D10 火星探査ロボット・シミュレータ', function (o) { return o.app === '火星探査ロボット・シミュレータ'; }, parseRover],
    ['D11 問題解決ノート', function (o) { return o.app === '問題解決ノート' && isObj(o.note); }, parseMondaiD]
  ];

  /* ファイル名から組・番号・名前を拾う(JSON の中に名前がないとき用) */
  function studentFromFile(fileName) {
    var stem = nfkc(fileName).replace(/\.json$/i, '');
    var m = stem.match(/(\d+)組[-_]?(\d+)番[-_]?([^_\-\d][^_]*)?/);
    if (m) return student(m[1], m[2], m[3] && !/^\d/.test(m[3]) ? m[3] : '');
    return null;
  }

  function parse(obj, fileName) {
    if (!isObj(obj) && !Array.isArray(obj)) return { ok: false, error: 'JSON の形が教材の記録ではありません' };
    for (var i = 0; i < ADAPTERS.length; i++) {
      var a = ADAPTERS[i];
      if (!Array.isArray(obj) && !a[1](obj)) continue;
      if (Array.isArray(obj) && a[2] !== parseA) continue;
      var entries;
      // 形は合っていても、中の値が思っていた形でない(手で直したファイルなど)ときは、止めずに「読めなかった」にする
      try { entries = a[2](obj); } catch (e) { return { ok: false, format: a[0], error: '記録の中に読めないところがありました' }; }
      if (!entries.length) return { ok: false, format: a[0], error: '記録が入っていませんでした' };
      var fromFile = studentFromFile(fileName || '');
      entries.forEach(function (e) {
        if (e.domain === 'D') e.app = dName(e.app);
        var s = e.student;
        if (!s.cls && !s.num && !s.name && fromFile) {
          e.student = fromFile;
          e.fromFile = true;
        }
      });
      return { ok: true, format: a[0], entries: entries };
    }
    return { ok: false, error: 'どの教材の記録か分かりませんでした' };
  }

  /* 並べかえ用: 組 → 番号 → 名前(数字は数として比べる) */
  function natural(a, b) {
    var x = String(a), y = String(b);
    var nx = parseFloat(x.replace(/[^\d.]/g, '')), ny = parseFloat(y.replace(/[^\d.]/g, ''));
    if (x !== y && !isNaN(nx) && !isNaN(ny) && nx !== ny) return nx - ny;
    return x < y ? -1 : x > y ? 1 : 0;
  }
  function studentKey(s) { return [s.cls, s.num, s.name].join('\u0001'); }
  function compareStudent(a, b) {
    var pa = !a.cls && !a.num, pb = !b.cls && !b.num;
    if (pa !== pb) return pa ? 1 : -1;
    return natural(a.cls, b.cls) || natural(a.num, b.num) || natural(a.name, b.name);
  }

  /* CSV(Excel・スプレッドシートで文字化けしないように BOM と CRLF) */
  function csv(rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (c) {
        var s = c == null ? '' : String(c);
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;  // 数式として動かないように
        return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n') + '\r\n';
  }

  var api = { parse: parse, student: student, studentKey: studentKey, compareStudent: compareStudent, natural: natural, csv: csv, formats: ADAPTERS.map(function (a) { return a[0]; }) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FKR = api;
})(this);
