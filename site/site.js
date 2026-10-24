/*
 * 生徒用サイトの入り口ページ(jugyo.html 授業で使う・jishu.html 自習で使う)が使う、教材の一覧とカードの作り方。
 * href は手元(リポジトリの中)で開いたときの場所。site/build.py が公開用の名前(a.html・ws/a.html など)に書きかえる。
 * EduitSite.cards(箱の id, 記号の並び, '?jishu=on' など): 教材のカードを箱に入れる(リンクの最後に設定を付ける)
 * EduitSite.wsLinks(箱の id): 自習ワークシートのボタンを箱に入れる
 */
(function () {
  'use strict';
  var LIST = {
    T: { title: '教科書の順に進む 学習コース', desc: '教科書の節の順に、使う教材がならんでいます。上から順に進めます。', extra: 'ガイダンスから学習を終えてまで 70 の節と、付録の発展編', href: '../クラスルーム配布/生徒に配る/教科書の順に進む_学習コース.html' },
    G: { code: 'G', title: '技術分野のガイダンス', desc: '技術とは何かと、3年間で学ぶことを知ります。いちばん最初に開きます。', extra: '教科書 技術分野のガイダンス 1〜5', href: '../クラスルーム配布/生徒に配る/G_技術分野のガイダンス.html' },
    A: { code: 'A', title: '材料と加工の技術', desc: '材料の性質、構造、製図、工具の安全などを体験します。', extra: '教材 A1〜A8', href: '../クラスルーム配布/生徒に配る/A_材料と加工_統一版.html' },
    B: { code: 'B', title: '生物育成の技術', desc: '育てる環境、栽培の計画、育成の記録などを体験します。', extra: '教材 B1〜B6', href: '../クラスルーム配布/生徒に配る/B_生物育成_統一版.html' },
    C: { code: 'C', title: 'エネルギー変換の技術', desc: 'エネルギーの変換、電気回路、機構、発電などを体験します。', extra: '教材 C1〜C8', href: '../クラスルーム配布/生徒に配る/C_エネルギー変換_統一版.html' },
    D: { code: 'D', title: '情報の技術', desc: 'デジタル化、ネットワーク、セキュリティ、計測・制御などを体験します。', extra: '教材 D1〜D11', href: '../クラスルーム配布/生徒に配る/D_情報の技術_統一版.html' },
    M: { code: 'M', title: '身の回りの技術さがし', desc: '身の回りの製品から、技術の工夫を見つけます。', extra: '使うとき: 各編のはじめと1章の終わり', href: '../クラスルーム配布/生徒に配る/M_身の回りの技術さがし.html' },
    F: { code: 'F', title: 'これからの技術ラボ', desc: '新しい技術のよい点と心配な点を考えます。', extra: '使うとき: 1編〜3編の3章の終わり', href: '../クラスルーム配布/生徒に配る/F_これからの技術ラボ.html' },
    Z: { code: 'Z', title: '学習を終えて', desc: '3年間の学習をふりかえります。', extra: '使うとき: 3年生の最後', href: '../クラスルーム配布/生徒に配る/Z_学習を終えて.html' }
  };
  var WS = [
    ['G ガイダンス', '../クラスルーム配布/生徒に配る/ワークシート/G_技術分野のガイダンス_ワークシート.html'],
    ['A 材料と加工', '../クラスルーム配布/生徒に配る/ワークシート/A_材料と加工_ワークシート.html'],
    ['B 生物育成', '../クラスルーム配布/生徒に配る/ワークシート/B_生物育成_ワークシート.html'],
    ['C エネルギー変換', '../クラスルーム配布/生徒に配る/ワークシート/C_エネルギー変換_ワークシート.html'],
    ['D 情報の技術', '../クラスルーム配布/生徒に配る/ワークシート/D_情報の技術_ワークシート.html'],
    ['M 身の回りの技術さがし', '../クラスルーム配布/生徒に配る/ワークシート/M_身の回りの技術さがし_ワークシート.html'],
    ['F これからの技術ラボ', '../クラスルーム配布/生徒に配る/ワークシート/F_これからの技術ラボ_ワークシート.html'],
    ['Z 学習を終えて', '../クラスルーム配布/生徒に配る/ワークシート/Z_学習を終えて_ワークシート.html']
  ];

  function cards(id, codes, q) {
    var box = document.getElementById(id);
    codes.forEach(function (k) {
      var x = LIST[k];
      var s = document.createElement('span');
      s.textContent = x.extra;
      var c = EduitFrame.card({ code: x.code, title: x.title, desc: x.desc, extra: [s], href: x.href + (q || '') });
      c.classList.add('site-' + k);
      box.appendChild(c);
    });
  }

  function wsLinks(id) {
    var box = document.getElementById(id);
    WS.forEach(function (w) {
      var a = document.createElement('a');
      a.className = 'ef-btn';
      a.href = w[1];
      a.textContent = w[0];
      box.appendChild(a);
    });
  }

  window.EduitSite = { cards: cards, wsLinks: wsLinks };
})();
