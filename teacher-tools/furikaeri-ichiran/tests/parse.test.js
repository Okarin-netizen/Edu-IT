// 実行: node --test teacher-tools/furikaeri-ichiran/tests/parse.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const FKR = require('../parse.js');

const dir = path.join(__dirname, 'samples');
function load(name) {
  const t = fs.readFileSync(path.join(dir, name), 'utf8');
  return FKR.parse(JSON.parse(t), name);
}
const find = (r, app) => r.entries.find((e) => e.app === app);
const val = (e, label) => (e.rows.find((x) => x.label === label) || {}).value;

test('サンプルはすべて読める(こわれたもの以外)', () => {
  for (const name of fs.readdirSync(dir)) {
    if (/こわれた|壊れた/.test(name)) continue;
    const r = load(name);
    assert.ok(r.ok, name + ': ' + r.error);
  }
});

test('A: まとめて書き出し(組・番号は全角でも半角にそろう、途中の記録は入れない)', () => {
  const r = load('技術_材料と加工_2組15番山田花子_20261015.json');
  assert.deepStrictEqual(r.entries.map((e) => e.app), ['A1 材料選択ナビ', 'A4 製図トレーナー', 'A6 工具の使い方・安全トレーナー']);
  assert.deepStrictEqual(r.entries[0].student, { cls: '2', num: '15', name: '山田花子' });
  assert.strictEqual(val(r.entries[0], '選んだ理由'), '軽くて加工しやすいから');
  assert.strictEqual(val(r.entries[1], '三面図を見て、立体の形を思いうかべることができた'), 'できた');
  assert.strictEqual(val(r.entries[2], '姿勢・安全・精度'), '姿勢 A / 安全 B / 精度 B');
});

test('A: A4 だけの書き出しは中の名前を使う', () => {
  const r = load('drawing-trainer-佐藤-2026-10-15.json');
  assert.strictEqual(r.entries[0].student.name, '佐藤');
  assert.strictEqual(val(r.entries[0], '線の種類(外形線・かくれ線・中心線など)を使い分けられた'), 'もう少し');
});

test('A: 名前のない書き出しは「名前なし」になる', () => {
  const r = load('wood-lab-2026-10-15.json');
  assert.ok(!r.entries[0].fromFile);
  assert.deepStrictEqual(r.entries[0].student, { cls: '', num: '', name: '' });
  assert.strictEqual(val(r.entries[0], '反りの予測'), '1 / 2 回 正解');
});

test('A: 1つずつ書き出したファイルの組・番号・名前(メニューで入れたもの)を使う', () => {
  const a = { schema: 'gijutsu-artifact/1', app: 'kidori', kind: 'work', title: '本立て', data: { review: { good: '強い' } }, student: { class: '1', no: '３', name: '北' } };
  assert.deepStrictEqual(FKR.parse(a, 'x.json').entries[0].student, { cls: '1', num: '3', name: '北' });
});

test('B: 自己評価の数値・記号を言葉にする', () => {
  const b4 = load('B4_育成日誌_1班_20261015-1405.json').entries[0];
  assert.deepStrictEqual(b4.student, { cls: '2', num: '3', name: '鈴木一郎' });
  assert.strictEqual(val(b4, '毎日の観察・記録を続けられた'), '◎');
  assert.strictEqual(b4.rows.find((x) => x.part === '評価: ミニトマト').value, '毎日水やり');
  const b2 = load('B2_データ_2026-10-15.json').entries[0];
  assert.deepStrictEqual(b2.student, { cls: '2', num: '3', name: '鈴木一郎' });
  assert.strictEqual(val(b2, '動物・水産生物に合った環境の条件が分かった'), '◎ よくできた');  // 0 が ◎
  assert.strictEqual(val(b2, '命を大切にし、実際の飼育や社会に生かそうと考えた'), '△ もう少し');
  const b3 = load('B3_バックアップ_20261015.json').entries[0];
  assert.strictEqual(b3.student.cls, '2年2');
  assert.strictEqual(val(b3, '作物の性質をもとに、作業日を逆算して計画を立てられた'), '◎ よくできた');  // 3 が ◎
  assert.strictEqual(b3.rows.filter((x) => x.type === '自己評価').length, 2);  // 0 は未記入
});

test('B5: 振り返り・自己評価・レーダーチャート・成績', () => {
  const r = load('B5_データ_2-15_山田花子_2026-10-18.json');
  assert.strictEqual(r.format, 'B5 植物工場の自動化');
  const b5 = r.entries[0];
  assert.strictEqual(b5.app, 'B5 植物工場の自動化');
  assert.deepStrictEqual(b5.student, { cls: '2', num: '15', name: '山田花子' });
  assert.strictEqual(val(b5, 'センサとプログラムで育成環境を自動で調節するしくみが分かった'), '◎ よくできた');
  assert.strictEqual(val(b5, '品質・収量・費用・安全性・環境への配慮(1〜5)'), '品質 5 / 収量 4 / 費用 3 / 安全性 5 / 環境への配慮 3');
  assert.strictEqual(b5.rows.filter((x) => x.type === 'ふりかえり').length, 3);  // 空の問いは入れない(q1・q3・えらんだ理由)
  assert.strictEqual(val(b5, '最高点(試した回数)'), '88 点(2 回)');
  assert.strictEqual(val(b5, '仕分けクイズ'), '7 / 8 問');
});

test('C: C5 は「組・番号」1つの欄を分ける、C3 は振り返りなし', () => {
  const e5 = load('C5-sekkei-flash-20261015-1405.json').entries[0];
  assert.deepStrictEqual(e5.student, { cls: '2', num: '15', name: '山田花子' });
  assert.strictEqual(val(e5, '改善案'), '抵抗を大きく');
  const e3 = load('C3-kikou-20261015-1405.json');
  assert.ok(e3.ok);
  assert.strictEqual(e3.entries[0].rows.length, 0);
});

test('C: C6・C7 は振り返り3つ・やったこと・最高点', () => {
  const e6 = load('C6-fuuryoku-20261018-1405.json').entries[0];
  assert.strictEqual(e6.app, 'C6 風力発電の羽根ラボ');
  assert.deepStrictEqual(e6.student, { cls: '2', num: '15', name: '山田花子' });
  assert.strictEqual(val(e6, 'やったこと'), '8 / 8');
  assert.strictEqual(e6.rows.filter((x) => x.type === 'ふりかえり').length, 2);  // 空の振り返りは入れない
  assert.ok(/W\)$/.test(val(e6, 'ランキング1位の羽根')));
  const e7 = load('C7-souden-20261018-1410.json').entries[0];
  assert.strictEqual(e7.app, 'C7 直流・交流と送電ラボ');
  assert.strictEqual(val(e7, '高い電圧で電気を送るわけ'), '電流が小さくなって損失が減るから');
  assert.strictEqual(val(e7, '計算ドリル(最高)'), '5 / 5');
});

test('D: 各教材の振り返りと成績', () => {
  assert.strictEqual(val(load('仮想CPU_2-15-山田花子.json').entries[0], 'クリアした課題'), '1 / 2');
  assert.strictEqual(load('デジタル化ラボ_2_15_山田花子.json').entries[0].rows.length, 2);
  const net = load('ネットワーク_2-15-山田花子.json').entries[0];
  assert.strictEqual(net.rows.filter((x) => x.type === 'ふりかえり').length, 1);  // 空の振り返りは入れない
  assert.strictEqual(net.rows.find((x) => x.type === 'ふりかえり').part, '④ のぞき見と暗号化');
  const sec = load('seclab-2年3組-12-2026-10-13.json').entries[0];
  assert.deepStrictEqual(sec.student, { cls: '2年3', num: '12', name: '' });
  assert.strictEqual(val(sec, '事前テスト'), '7/11');
  assert.strictEqual(val(load('計測制御_記録_215.json').entries[0], 'テスト(いちばんよい結果)'), '4 / 4');
  assert.strictEqual(val(load('制作スタジオ_2-15-山田花子.json').entries[0], 'ふりかえり'), '使う人を考えた');
  assert.strictEqual(val(load('生成AIのしくみラボ_2_15_山田花子.json').entries[0], '正解'), '4 / 5');
  const scam = load('ネット詐欺_追体験ラボ_2_15_山田花子.json').entries[0];
  assert.deepStrictEqual(scam.student, { cls: '2', num: '15', name: '山田花子' });
  assert.strictEqual(val(scam, 'クリアした場面'), '2 / 5');
  assert.strictEqual(scam.rows.find((x) => x.part === '① ワンクリック詐欺').value, 'クリア(だまされた 1 回・ヒント 0 回)');
  assert.strictEqual(scam.rows.find((x) => x.part === '③ ウイルス付きメール').value, 'まだ(だまされた 2 回・ヒント 1 回)');
  assert.strictEqual(scam.rows.filter((x) => x.type === 'ふりかえり').length, 2);
  const hash = load('ハッシュ化体験ラボ_2_15_山田花子.json').entries[0];
  assert.strictEqual(hash.app, 'D9 ハッシュ化体験ラボ');
  assert.deepStrictEqual(hash.student, { cls: '2', num: '15', name: '山田花子' });
  assert.strictEqual(val(hash, 'チャレンジ達成'), '4 / 6');
  assert.strictEqual(val(hash, '正解'), '6 / 8');
  assert.strictEqual(val(hash, 'パスワードを守るために、サービスを作る側と自分ができること'), 'サービスごとにちがう長いパスワードにする');
});

test('D: 教材集の記録まとめは、記録のある教材だけ', () => {
  const r = load('情報の技術_記録まとめ_2組15番_2026-10-15.json');
  assert.deepStrictEqual(r.entries.map((e) => e.app), ['D2 仮想CPUラボ']);
});

test('D: 統一版(第1.6版)の記録まとめのラボは、問いの名前で読み、1つずつの書き出しと同じ行になる', () => {
  const r = load('情報の技術_記録まとめ_統一版_2組15番_2026-10-16.json');
  assert.deepStrictEqual(r.entries.map((e) => e.app), ['D9 ハッシュ化体験ラボ']);
  const e = r.entries[0];
  assert.strictEqual(val(e, 'ハッシュ関数の性質'), '同じ文なら同じ値、1文字変えると全部変わる');
  // 振り返り一覧は「生徒・分野・教材・場面・種類・内容」が同じ行を1つにする
  const key = (x) => [x.part, x.type, x.value].join('|');
  const one = load('ハッシュ化体験ラボ_2_15_山田花子.json').entries[0].rows.filter((x) => x.type === 'ふりかえり').map(key);
  for (const row of e.rows) assert.ok(one.includes(key(row)), key(row));
});

test('読めないファイルは理由を返す', () => {
  assert.strictEqual(load('こわれた.json').ok, false);
  assert.strictEqual(FKR.parse('x', 'a.json').ok, false);
});

test('ファイル名から組・番号を拾う', () => {
  const r = FKR.parse({ app: 'seclab', student: {}, reflections: [{ title: 'x', text: 'y' }] }, '情報_2組7番_山田.json');
  assert.deepStrictEqual(r.entries[0].student, { cls: '2', num: '7', name: '山田' });
});

test('CSV は数式にならず、改行やカンマを囲む', () => {
  const s = FKR.csv([['=1+1', 'a,b', 'x\ny']]);
  assert.strictEqual(s, '﻿\'=1+1,"a,b","x\ny"\r\n');
});

test('組・番号の順に並ぶ(10番は2番のあと、組なしは最後)', () => {
  const list = [FKR.student('', '', 'z'), FKR.student('2', '10', ''), FKR.student('2', '2', ''), FKR.student('1', '30', '')];
  list.sort(FKR.compareStudent);
  assert.deepStrictEqual(list.map((s) => s.cls + '-' + s.num + s.name), ['1-30', '2-2', '2-10', '-z']);
});

test('A: A7 第三角法 立体メーカーの書き出し(組・番号・名前・自己評価・ふりかえり)', () => {
  const r = load('立体メーカー_L形ブラケット.json');
  const e = find(r, 'A7 第三角法 立体メーカー');
  assert.deepStrictEqual(e.student, { cls: '2', num: '15', name: '山田花子' });
  assert.strictEqual(val(e, '三面図で、幅・高さ・奥行きがそろう位置がわかった'), 'できた');
  assert.strictEqual(val(e, 'わかったこと・できるようになったこと'), '正面図と平面図の幅がそろうことがわかった');
  assert.strictEqual(val(e, 'むずかしかったこと・次にがんばりたいこと'), '斜めのマスの向きをそろえるのがむずかしかった');
  assert.strictEqual(e.rows[0].part, 'L形ブラケット');
});

test('A: A8 問題解決ノート(課題・評価・最適化・振り返り)', () => {
  const r = load('問題解決ノート_2組15番.json');
  const e = find(r, 'A8 問題解決ノート');
  assert.deepStrictEqual(e.student, { cls: '2', num: '15', name: '山田花子' });
  assert.strictEqual(val(e, '課題'), '机の横に、教科書を立てて入れられる木の本立てを作る');
  assert.strictEqual(val(e, '問題?課題? クイズ'), '5 / 6');
  assert.strictEqual(val(e, '観点ごとの評価(5段階)の平均'), '3.5(4 観点)');
  assert.strictEqual(val(e, '改善・修正の方法'), '加工: 角をやすりで丸くする');
  assert.strictEqual(val(e, '身の回りから問題を見つけ、問題と課題を分けて書けた'), 'できた');
  assert.strictEqual(val(e, 'これからの問題解決に生かしたいこと'), '観点を先に決めてから構想する');
});
