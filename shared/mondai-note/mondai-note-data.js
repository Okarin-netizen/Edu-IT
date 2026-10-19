/* 問題解決ノート(4分野共通)の分野ごとのデータ
 * shared/mondai-note/mondai-note.js(本体)が読む。分野は EDUIT_INFO.domain('A'|'B'|'C'|'D')で決まる。
 * 教科書(各編の 2章「問題の発見と課題の設定」「問題解決の評価、改善・修正」、3章(D は 4章)「技術の最適化」)に合わせている。
 *
 * 分野ごとに持つもの:
 *   name・work(作ったもの)・make(作る/育てる)・lets(レッツスタートの問い)
 *   samples   … ① 付箋のヒント(text と観点 vp)
 *   quiz      … ① 「問題?課題?」クイズ(t: 'mondai' | 'kadai'、why: 解説)
 *   evalCrit  … ② 評価の観点(k・label・hint)。教科書の各編の評価の観点
 *   process   … ② 過程(製作・育成・制作)の評価のチェック
 *   optCrit   … ③ 最適化の観点(製品ごとに crit で変えられる)
 *   presets   … ③ 立場ごとの重み(製品ごとに presets で変えられる)
 *   products  … ③ 社会の製品・技術(options の s は観点ごとの 1〜5 の目安の点。limits は制約条件)
 * 点は授業で考えるための目安で、製品の実際の性能を表すものではない。
 */
(function (root) {
  'use strict';
  var MN = (root.MondaiNote = root.MondaiNote || {});

  // 技術の見方・考え方の4つの観点(付箋に付けるアイコン)。教科書: 社会からの要求・安全性・環境への負荷・経済性
  MN.VP = [
    { k: 'society', label: '社会', icon: '🏘️', hint: '社会からの要求・使う人の願い' },
    { k: 'safety', label: '安全', icon: '⛑️', hint: '安全性・けがや事故を防ぐ' },
    { k: 'env', label: '環境', icon: '🌳', hint: '環境への負荷・資源やエネルギー' },
    { k: 'economy', label: '経済', icon: '💴', hint: '経済性・費用や時間' }
  ];

  MN.DOMAINS = {
    /* ================= A 材料と加工の技術 ================= */
    A: {
      name: '材料と加工の技術', short: '材料と加工', work: '製作品', make: '作る', ref: '1編2章 1・5、3章 1',
      lets: '机・いす・たななど、毎日使っている物で「ここが使いにくい」「こんな物がほしい」と感じることを書き出そう。',
      titleHint: '例: 木の本立て', kadaiHint: '例: 机の横で教科書を立てて入れられる、じょうぶな木の本立てを作る',
      samples: [
        { text: '机の上が教科書やプリントでいっぱいになる', vp: ['society'] },
        { text: '体育館シューズの置き場がなく、ろうかにちらかる', vp: ['society', 'safety'] },
        { text: '本だなの本がすぐにたおれてしまう', vp: ['society'] },
        { text: 'タブレットを立てて見たいが、すぐたおれる', vp: ['society', 'safety'] },
        { text: '使わなくなった板や木の切れはしがたくさんある', vp: ['env', 'economy'] },
        { text: '買うと高いので、安く作れる入れ物がほしい', vp: ['economy'] }
      ],
      quiz: [
        { t: 'mondai', text: '教科書やノートが机の上に広がり、作業する場所がせまい', why: '「こまっていること」なので問題です。これをどうすれば解決するかを考えて、課題にします。' },
        { t: 'kadai', text: '机の横に、教科書を立てて入れられる木の本立てを作る', why: '問題を解決するために「何を、どうするか」を決めているので課題です。' },
        { t: 'mondai', text: '雨の日、げた箱の前がかさのしずくでぬれてすべりやすい', why: '「不便・危ない」と感じていることなので問題です。' },
        { t: 'kadai', text: 'ぬれたかさを立てて、しずくを受けられるかさ立てを作る', why: '解決の方法を具体的に決めているので課題です。' },
        { t: 'mondai', text: '家の工具がばらばらにしまってあり、すぐに見つからない', why: '「こまっていること」なので問題です。' },
        { t: 'kadai', text: '工具の形に合わせた仕切りのある、木の工具箱を作る', why: '何を作って解決するかを決めているので課題です。' }
      ],
      evalCrit: [
        { k: 'func', label: '機能', hint: '目的どおりに使えるか(物が入る・立つ など)' },
        { k: 'struct', label: '構造', hint: '使っても、がたついたりこわれたりしないか' },
        { k: 'mat', label: '材料', hint: '使う目的や場所に合った材料を選べたか' },
        { k: 'craft', label: '加工', hint: '図面と照合して、寸法どおり・ていねいに仕上がったか' },
        { k: 'cost', label: '費用', hint: '材料のむだが少なく、決めた費用や時間の中で作れたか' },
        { k: 'safety', label: '安全性', hint: '角やささくれでけがをしないか、たおれにくいか' },
        { k: 'env', label: '環境への配慮', hint: '材料を大切に使い、使わなくなったときの処分も考えたか' }
      ],
      process: [
        '材料取り図どおりに材料を取れた',
        '製作工程表の順番と時間を守って作業できた',
        '工程ごとに図面と照合し、検査・修正をした',
        '工具や機器を、安全に正しく使えた'
      ],
      optCrit: [
        { k: 'func', label: '機能' }, { k: 'strong', label: '丈夫さ' }, { k: 'cost', label: '費用' },
        { k: 'safety', label: '安全性' }, { k: 'env', label: '環境' }
      ],
      presets: [
        { label: '使う人', icon: '🙋', w: { func: 3, strong: 2, cost: 1, safety: 2, env: 0 } },
        { label: '作って売る会社', icon: '🏭', w: { func: 1, strong: 1, cost: 3, safety: 1, env: 0 } },
        { label: '安全第一', icon: '⛑️', w: { func: 0, strong: 2, cost: 0, safety: 3, env: 0 } },
        { label: '地球の環境', icon: '🌏', w: { func: 0, strong: 0, cost: 0, safety: 1, env: 3 } }
      ],
      products: [
        {
          id: 'bottle', icon: '🧴', name: '飲み物の容器', q: '飲み物を入れて売る容器は、どの材料がよいだろう?',
          options: [
            { id: 'glass', name: 'ガラスびん', s: { func: 3, strong: 2, cost: 2, safety: 2, env: 5 }, note: '洗ってくり返し使える。重く、落とすと割れる' },
            { id: 'pet', name: 'ペットボトル', s: { func: 5, strong: 4, cost: 4, safety: 4, env: 2 }, note: '軽くて割れにくく、ふたができる。ごみが多くなりやすい' },
            { id: 'can', name: 'アルミ缶', s: { func: 3, strong: 3, cost: 3, safety: 4, env: 4 }, note: '割れず、リサイクルしやすい。一度開けるとふたができない' }
          ],
          limits: [
            { label: '割れてはいけない(丈夫さが3以上)', k: 'strong', min: 3 },
            { label: '材料費を安くしたい(費用が3以上)', k: 'cost', min: 3 }
          ]
        },
        {
          id: 'chair', icon: '🪑', name: '学校の椅子', q: '教室で毎日使う椅子は、どの作り方がよいだろう?',
          options: [
            { id: 'solid', name: '無垢材の椅子', s: { func: 3, strong: 4, cost: 2, safety: 4, env: 5 }, note: '1本の木から切り出した材料。手ざわりがよく長く使えるが、高い' },
            { id: 'ply', name: '合板・集成材の椅子', s: { func: 3, strong: 4, cost: 4, safety: 4, env: 4 }, note: '小さな木を貼り合わせた材料。反りにくく、材料をむだなく使える' },
            { id: 'steel', name: '鉄のパイプと樹脂の椅子', s: { func: 5, strong: 5, cost: 4, safety: 2, env: 2 }, note: '軽くて重ねられる。すき間に指をはさむおそれがある' }
          ],
          limits: [
            { label: '重ねて片付けたい(機能が4以上)', k: 'func', min: 4 },
            { label: '木の材料を使う(環境が4以上)', k: 'env', min: 4 }
          ]
        },
        {
          id: 'bag', icon: '🛍️', name: '買い物の袋', q: 'お店で買った物を入れる袋は、どれがよいだろう?',
          options: [
            { id: 'paper', name: '紙袋', s: { func: 2, strong: 2, cost: 4, safety: 5, env: 4 }, note: '燃やしても有害な物が出にくい。水にぬれると弱い' },
            { id: 'poly', name: 'レジ袋(ポリエチレン)', s: { func: 4, strong: 3, cost: 5, safety: 3, env: 1 }, note: '安くて水に強い。海に流れるとごみとして長く残る' },
            { id: 'cloth', name: '布のエコバッグ', s: { func: 4, strong: 5, cost: 2, safety: 5, env: 4 }, note: '何回も使える。作るときの材料やエネルギーは多い' }
          ],
          limits: [
            { label: '雨の日も使う(機能が3以上)', k: 'func', min: 3 }
          ]
        }
      ]
    },

    /* ================= B 生物育成の技術 ================= */
    B: {
      name: '生物育成の技術', short: '生物育成', work: '育てた生物(作物など)', make: '育てる', ref: '2編2章 1・4、3章 1',
      lets: '野菜や花を育てるとき、家や学校、地域で「こうだったらいいのに」「不便だな」と感じることを書き出そう。食べ物や環境のこれからにもつながる問題を探してみよう。',
      titleHint: '例: ミニトマト', kadaiHint: '例: 日当たりの悪いベランダでも、プランターの置き場所を工夫してミニトマトを育てる',
      samples: [
        { text: '夏休みに水やりができず、野菜がかれてしまう', vp: ['society'] },
        { text: 'ベランダがせまく、野菜を育てる場所がない', vp: ['society'] },
        { text: '地域の畑で、働く人が足りなくなっている', vp: ['society', 'economy'] },
        { text: '農薬をなるべく使わずに、害虫を防ぎたい', vp: ['safety', 'env'] },
        { text: '肥料や水を使いすぎると、環境に負荷がかかる', vp: ['env'] },
        { text: '野菜の値段が高く、毎日買うのが大変', vp: ['economy'] }
      ],
      quiz: [
        { t: 'mondai', text: 'ベランダが日かげになりやすく、ミニトマトの実が少ない', why: '「こまっていること」なので問題です。' },
        { t: 'kadai', text: '日の当たる時間を調べて、プランターの置き場所を決めて育てる', why: '問題を解決するために「何を、どうするか」を決めているので課題です。' },
        { t: 'mondai', text: '暑い日に土がすぐかわき、葉がしおれてしまう', why: '「不便だ・こまった」と感じていることなので問題です。' },
        { t: 'kadai', text: '土の表面をおおうマルチングをして、土のかわきをおさえる', why: '解決の方法を具体的に決めているので課題です。' },
        { t: 'mondai', text: 'アブラムシが増えて、葉がちぢれたり弱ったりする', why: '「こまっていること」なので問題です。' },
        { t: 'kadai', text: '防虫ネットをかけて、農薬にたよらずに害虫を防ぐ', why: '何をして解決するかを決めているので課題です。' }
      ],
      evalCrit: [
        { k: 'quality', label: '品質', hint: '味・形・大きさ・色などがよいか' },
        { k: 'yield', label: '収量', hint: '目標とくらべて、どれだけ収穫できたか' },
        { k: 'cost', label: '費用', hint: '種・苗・肥料・水などにかかった費用は適切か' },
        { k: 'safety', label: '安全性', hint: '安全・安心に食べられるか、作業は安全だったか' },
        { k: 'env', label: '環境への配慮', hint: '肥料・農薬・水を使いすぎず、環境への負荷が小さいか' }
      ],
      process: [
        '育成計画どおりに管理作業を進められた',
        '成長のようすを写真や文章で記録した',
        '成長段階に合わせて、水やり・追肥などを調節した',
        '道具や肥料・薬品を、安全に正しく使った'
      ],
      optCrit: [
        { k: 'quality', label: '品質' }, { k: 'yield', label: '収量' }, { k: 'cost', label: '費用' },
        { k: 'safety', label: '安全性' }, { k: 'env', label: '環境' }
      ],
      presets: [
        { label: '食べる人', icon: '🍽️', w: { quality: 3, yield: 0, cost: 1, safety: 3, env: 0 } },
        { label: '生産者(農家)', icon: '👩‍🌾', w: { quality: 1, yield: 3, cost: 3, safety: 0, env: 0 } },
        { label: '安全・安心', icon: '⛑️', w: { quality: 0, yield: 0, cost: 0, safety: 3, env: 1 } },
        { label: '地球の環境', icon: '🌏', w: { quality: 0, yield: 0, cost: 0, safety: 1, env: 3 } }
      ],
      products: [
        {
          id: 'lettuce', icon: '🥬', name: 'レタスの育て方', q: 'レタスを育てて売るには、どの育て方がよいだろう?',
          options: [
            { id: 'field', name: '露地栽培(畑)', s: { quality: 3, yield: 2, cost: 5, safety: 3, env: 4 }, note: '太陽と雨で育てる。天気によって収量が大きく変わる' },
            { id: 'house', name: 'ハウス栽培', s: { quality: 5, yield: 4, cost: 3, safety: 3, env: 3 }, note: 'ビニールハウスで寒さや雨を防ぐ。暖房などに費用がかかる' },
            { id: 'factory', name: '植物工場', s: { quality: 4, yield: 5, cost: 1, safety: 5, env: 2 }, note: 'LED の光と養液で、1年中同じように育てる。電気を多く使う' }
          ],
          limits: [
            { label: '1年中とどけたい(収量が4以上)', k: 'yield', min: 4 },
            { label: 'かけられるお金が少ない(費用が3以上)', k: 'cost', min: 3 }
          ]
        },
        {
          id: 'fish', icon: '🐟', name: '魚をとどける方法', q: '食卓に魚をとどけるには、どの方法がよいだろう?',
          options: [
            { id: 'catch', name: '海で魚をとる(漁業)', s: { quality: 4, yield: 2, cost: 4, safety: 4, env: 2 }, note: '育てる費用はかからない。とりすぎると魚が減ってしまう' },
            { id: 'farm', name: '養殖', s: { quality: 4, yield: 5, cost: 2, safety: 4, env: 2 }, note: 'いけすで大きくなるまで育てる。えさ代がかかり、海がよごれることもある' },
            { id: 'release', name: '栽培漁業(稚魚を放流)', s: { quality: 4, yield: 3, cost: 3, safety: 4, env: 5 }, note: '卵からかえした稚魚を海に放し、育ってからとる。資源を守れる' }
          ],
          limits: [
            { label: '魚を減らさない(環境が3以上)', k: 'env', min: 3 }
          ]
        },
        {
          id: 'pest', icon: '🐛', name: '害虫の防ぎ方', q: '野菜につく害虫は、どの方法で防ぐのがよいだろう?',
          options: [
            { id: 'chem', name: '農薬をまく', s: { quality: 4, yield: 5, cost: 4, safety: 2, env: 2 }, note: 'よく効いて手間が少ない。使う量や時期を守る必要がある' },
            { id: 'net', name: '防虫ネットをかける', s: { quality: 4, yield: 4, cost: 3, safety: 5, env: 4 }, note: '虫が入らないようにおおう。ネットを張る手間と費用がかかる' },
            { id: 'enemy', name: '天敵の虫を使う', s: { quality: 4, yield: 3, cost: 2, safety: 5, env: 5 }, note: '害虫を食べる虫(テントウムシなど)を使う。効くまで時間がかかる' }
          ],
          limits: [
            { label: '農薬を使わない(安全性が4以上)', k: 'safety', min: 4 }
          ]
        }
      ]
    },

    /* ================= C エネルギー変換の技術 ================= */
    C: {
      name: 'エネルギー変換の技術', short: 'エネルギー変換', work: '製作品(電気回路・機構モデル)', make: '作る', ref: '3編2章 1・4、3章 1',
      lets: '明かり・あたたかさ・動く力など、電気や機械が役に立つ場面に注目して、家や学校で「ここが使いにくい」「こんな物がほしい」と感じることを書き出そう。',
      titleHint: '例: 手回し発電ライト', kadaiHint: '例: 停電のときでも使える、手回し発電でつくLEDライトを作る',
      samples: [
        { text: '停電のとき、家の中が真っ暗になる', vp: ['safety', 'society'] },
        { text: '自転車のライトが暗く、夜道がこわい', vp: ['safety'] },
        { text: '祖母が夜にトイレへ行くとき、足元が見えない', vp: ['society', 'safety'] },
        { text: '教室の照明やエアコンの消し忘れが多い', vp: ['env', 'economy'] },
        { text: 'スマートフォンの充電がすぐなくなる', vp: ['society'] },
        { text: '重い荷物を運ぶのが大変', vp: ['society', 'safety'] }
      ],
      quiz: [
        { t: 'mondai', text: '災害で停電すると、スマートフォンを充電できなくなる', why: '「こまること」なので問題です。' },
        { t: 'kadai', text: '手回し発電機で、スマートフォンを充電できる装置を作る', why: '問題を解決するために「何を、どうするか」を決めているので課題です。' },
        { t: 'mondai', text: '夜、ろうかの電灯のスイッチがどこにあるか分からない', why: '「不便だ」と感じていることなので問題です。' },
        { t: 'kadai', text: '人が近づくと自動で点灯する、足元を照らす明かりを作る', why: '解決の方法を具体的に決めているので課題です。' },
        { t: 'mondai', text: 'ペットボトルのごみを、手でつぶすのに大きな力がいる', why: '「こまっていること」なので問題です。' },
        { t: 'kadai', text: 'てこやリンク機構を使い、軽い力でつぶせる道具を作る', why: '何を作って解決するかを決めているので課題です。' }
      ],
      evalCrit: [
        { k: 'func', label: '機能', hint: '目的とした動き・明るさなどが実現できたか' },
        { k: 'conv', label: '利便性', hint: '使う人にとって便利で、使いやすいか' },
        { k: 'cost', label: '費用', hint: '部品や電気代など、かかった費用は適切か' },
        { k: 'safety', label: '安全性', hint: '感電・発熱・けがのおそれはないか、保守点検しやすいか' },
        { k: 'env', label: '環境への配慮', hint: 'エネルギーのむだが少なく、廃棄まで考えたか' }
      ],
      process: [
        '回路図・製作図どおりに製作できた',
        '試作(プロトタイピング)で動きを確かめ、調整した',
        '完成後に点検をして、安全に使えることを確かめた',
        '使い方の注意や保守点検の方法を考えた'
      ],
      optCrit: [
        { k: 'func', label: '機能' }, { k: 'conv', label: '利便性' }, { k: 'cost', label: '費用' },
        { k: 'safety', label: '安全性' }, { k: 'env', label: '環境' }
      ],
      presets: [
        { label: '使う人', icon: '🙋', w: { func: 2, conv: 3, cost: 1, safety: 1, env: 0 } },
        { label: 'お金を安く', icon: '💴', w: { func: 0, conv: 0, cost: 3, safety: 0, env: 0 } },
        { label: '安全第一', icon: '⛑️', w: { func: 0, conv: 0, cost: 0, safety: 3, env: 1 } },
        { label: '地球の環境', icon: '🌏', w: { func: 0, conv: 0, cost: 0, safety: 1, env: 3 } }
      ],
      products: [
        {
          id: 'light', icon: '💡', name: '部屋の明かり', q: '部屋の電灯には、どの電球がよいだろう?',
          options: [
            { id: 'bulb', name: '白熱電球', s: { func: 3, conv: 2, cost: 4, safety: 2, env: 1 }, note: '本体が安く、あたたかい色の光。熱くなり、寿命が短い' },
            { id: 'fl', name: '電球形蛍光灯', s: { func: 5, conv: 3, cost: 3, safety: 3, env: 3 }, note: '広く明るく照らす。中に少しの水銀が入っている' },
            { id: 'led', name: 'LED電球', s: { func: 4, conv: 5, cost: 2, safety: 4, env: 5 }, note: '電気をあまり使わず、寿命が長い。本体の値段は高め' }
          ],
          limits: [
            { label: '本体を安く買いたい(費用が3以上)', k: 'cost', min: 3 }
          ]
        },
        {
          id: 'car', icon: '🚗', name: '自動車', q: '毎日の移動に使う自動車は、どれがよいだろう?',
          options: [
            { id: 'gas', name: 'ガソリン車', s: { func: 4, conv: 5, cost: 4, safety: 4, env: 1 }, note: 'すぐに給油でき、長く走れる。二酸化炭素を多く出す' },
            { id: 'hv', name: 'ハイブリッド車', s: { func: 4, conv: 5, cost: 3, safety: 4, env: 3 }, note: 'エンジンとモータを使い分け、燃料を節約する' },
            { id: 'ev', name: '電気自動車', s: { func: 3, conv: 2, cost: 2, safety: 4, env: 5 }, note: '走るときに二酸化炭素を出さない。充電に時間がかかる' }
          ],
          limits: [
            { label: '遠くまで走る(機能が4以上)', k: 'func', min: 4 },
            { label: '二酸化炭素を減らす(環境が3以上)', k: 'env', min: 3 }
          ]
        },
        {
          id: 'power', icon: '⚡', name: '発電の方法', q: '町の電気をつくるには、どの発電方法がよいだろう?',
          options: [
            { id: 'thermal', name: '火力発電', s: { func: 5, conv: 4, cost: 2, safety: 4, env: 1 }, note: '天気に関係なく安定して発電できる。燃料費がかかり、二酸化炭素を出す' },
            { id: 'solar', name: '太陽光発電', s: { func: 2, conv: 4, cost: 3, safety: 5, env: 5 }, note: '屋根にも置ける。夜や雨の日は発電できない' },
            { id: 'wind', name: '風力発電', s: { func: 3, conv: 2, cost: 5, safety: 4, env: 4 }, note: '燃料がいらない。風の強い場所にしか建てられない' }
          ],
          limits: [
            { label: 'いつでも電気がほしい(機能が3以上)', k: 'func', min: 3 }
          ]
        }
      ]
    },

    /* ================= D 情報の技術 ================= */
    D: {
      name: '情報の技術', short: '情報', work: '作品(コンテンツ・計測・制御システム)', make: '作る', ref: '4編2章 2・5、3章 2・5、4章 1',
      lets: '家や学校、地域で、自分や身近な人が「こうだったらいいのに」「ここが大変」と感じていることを書き出そう。',
      titleHint: '例: 教室の暑さお知らせシステム', kadaiHint: '例: 温度センサで教室の暑さを計測し、暑くなったら音と光で知らせるシステムを作る',
      samples: [
        { text: '部活動の連絡が、全員にとどかないことがある', vp: ['society'] },
        { text: '図書室の本が、どこにあるか分からない', vp: ['society'] },
        { text: '暑い日、教室の温度が上がっても気づかない', vp: ['safety'] },
        { text: '休みの日に、植物の水やりができない', vp: ['society', 'env'] },
        { text: 'パスワードを忘れたり、人に見られたりする', vp: ['safety'] },
        { text: 'だれもいない部屋の電気がついたままになる', vp: ['env', 'economy'] }
      ],
      quiz: [
        { t: 'mondai', text: '委員会のお知らせが、全校生徒にうまく伝わらない', why: '「こまっていること」なので問題です。' },
        { t: 'kadai', text: 'クイズに答えながらお知らせが読める、双方向性のあるコンテンツを作る', why: '問題を解決するために「何を、どうするか」を決めているので課題です。' },
        { t: 'mondai', text: '暑い日に教室の温度が上がっても、気づかず具合が悪くなる', why: '「こまっていること」なので問題です。' },
        { t: 'kadai', text: '温度センサで計測し、暑くなったら音と光で知らせるシステムを作る', why: '解決の方法を具体的に決めているので課題です。' },
        { t: 'mondai', text: '夜、玄関のかぎ穴が暗くて見えにくい', why: '「不便だ」と感じていることなので問題です。' },
        { t: 'kadai', text: '明るさセンサで暗くなったことを計測し、LEDを自動で点灯させる', why: '何を作って解決するかを決めているので課題です。' }
      ],
      evalCrit: [
        { k: 'func', label: '機能', hint: '設計した機能を、すべて実現できたか' },
        { k: 'use', label: '使いやすさ', hint: '使う人にとって分かりやすく、便利か' },
        { k: 'safety', label: '安全性', hint: '人や物を傷つけないか、情報セキュリティは守られているか' },
        { k: 'rights', label: '他者の権利', hint: '著作権や個人情報など、ほかの人の権利を守れたか' },
        { k: 'cost', label: '費用', hint: '部品・時間・手間など、かかった費用は適切か' },
        { k: 'env', label: '環境への配慮', hint: '電気やネットワークに、むだな負荷をかけないか' }
      ],
      process: [
        '設計(フローチャートなど)どおりにプログラムを作れた',
        '少しずつ動かして確かめ、デバッグできた',
        '使う人の立場で試してもらい、意見を聞いた',
        '著作物の利用や個人情報に気をつけた'
      ],
      optCrit: [
        { k: 'func', label: '機能' }, { k: 'use', label: '使いやすさ' }, { k: 'cost', label: '費用' },
        { k: 'safety', label: '安全性' }, { k: 'env', label: '環境' }
      ],
      presets: [
        { label: '使う人', icon: '🙋', w: { func: 1, use: 3, cost: 1, safety: 1, env: 0 } },
        { label: 'お金を安く', icon: '💴', w: { func: 0, use: 0, cost: 3, safety: 0, env: 0 } },
        { label: '安全第一', icon: '⛑️', w: { func: 0, use: 0, cost: 0, safety: 3, env: 0 } },
        { label: '地球の環境', icon: '🌏', w: { func: 0, use: 0, cost: 0, safety: 1, env: 3 } }
      ],
      products: [
        {
          id: 'lock', icon: '📱', name: 'スマートフォンのロック', q: 'スマートフォンのロックは、どの方法がよいだろう?',
          crit: [{ k: 'safe', label: '破られにくさ' }, { k: 'use', label: '使いやすさ' }, { k: 'cost', label: '費用' }, { k: 'sure', label: 'どんな時も使える' }, { k: 'privacy', label: '個人情報' }],
          presets: [
            { label: '使う人', icon: '🙋', w: { safe: 1, use: 3, cost: 1, sure: 1, privacy: 0 } },
            { label: 'お金を安く', icon: '💴', w: { safe: 0, use: 0, cost: 3, sure: 1, privacy: 0 } },
            { label: '安全第一', icon: '🔐', w: { safe: 3, use: 0, cost: 0, sure: 0, privacy: 1 } },
            { label: 'プライバシー', icon: '🙈', w: { safe: 1, use: 0, cost: 0, sure: 0, privacy: 3 } }
          ],
          options: [
            { id: 'pin', name: '4けたの暗証番号', s: { safe: 2, use: 4, cost: 5, sure: 5, privacy: 4 }, note: '覚えやすく、すぐ入力できる。のぞき見や推測で破られやすい' },
            { id: 'pass', name: '長いパスワード', s: { safe: 5, use: 1, cost: 5, sure: 4, privacy: 4 }, note: '破られにくい。毎回入力するのが大変で、忘れやすい' },
            { id: 'bio', name: '生体認証(指紋・顔)', s: { safe: 4, use: 5, cost: 2, sure: 3, privacy: 2 }, note: 'さわる・見るだけで開く。読み取る部品が必要で、顔や指紋のデータを使う' }
          ],
          limits: [
            { label: 'マスクや手ぶくろでも使う(どんな時も使えるが4以上)', k: 'sure', min: 4 }
          ]
        },
        {
          id: 'drive', icon: '🚙', name: '車の運転', q: 'これからの車の運転は、どれがよいだろう?',
          options: [
            { id: 'human', name: '人が運転する', s: { func: 4, use: 2, cost: 5, safety: 2, env: 3 }, note: '今ある車で走れる。疲れや見落としによる事故がおきることがある' },
            { id: 'assist', name: '運転支援(自動ブレーキなど)', s: { func: 4, use: 3, cost: 4, safety: 4, env: 3 }, note: 'センサで危険を見つけ、ブレーキなどを助ける。運転するのは人' },
            { id: 'auto', name: '自動運転', s: { func: 3, use: 5, cost: 1, safety: 4, env: 4 }, note: 'センサとコンピュータがすべて運転する。想定外の場面への対応が課題' }
          ],
          limits: [
            { label: 'どの道でも走れる(機能が4以上)', k: 'func', min: 4 }
          ]
        },
        {
          id: 'video', icon: '🎬', name: '動画の配信', q: '動画をネットワークで配信するとき、どの画質がよいだろう?',
          crit: [{ k: 'view', label: '見やすさ' }, { k: 'speed', label: 'すぐ再生' }, { k: 'cost', label: '通信料' }, { k: 'net', label: '回線の負荷' }, { k: 'env', label: '電力' }],
          presets: [
            { label: '見る人', icon: '🙋', w: { view: 3, speed: 2, cost: 0, net: 0, env: 0 } },
            { label: '通信料を安く', icon: '💴', w: { view: 0, speed: 0, cost: 3, net: 0, env: 0 } },
            { label: '回線を守る', icon: '🌐', w: { view: 0, speed: 1, cost: 0, net: 3, env: 0 } },
            { label: '地球の環境', icon: '🌏', w: { view: 0, speed: 0, cost: 0, net: 1, env: 3 } }
          ],
          options: [
            { id: 'high', name: '高画質', s: { view: 5, speed: 2, cost: 1, net: 1, env: 2 }, note: 'こまかい所まできれい。データ量が多く、回線に負荷がかかる' },
            { id: 'std', name: '標準画質', s: { view: 4, speed: 4, cost: 3, net: 3, env: 3 }, note: '多くの画面で十分きれい。データ量はほどほど' },
            { id: 'low', name: '低画質', s: { view: 2, speed: 5, cost: 5, net: 5, env: 4 }, note: 'データ量が少なく、すぐ再生できる。文字が読みにくいこともある' }
          ],
          limits: [
            { label: '黒板の文字が読める(見やすさが3以上)', k: 'view', min: 3 }
          ]
        }
      ]
    }
  };
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this);
