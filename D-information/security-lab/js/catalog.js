// モジュールの一覧と進み具合の計算
import { store } from "./store.js";
import { furikaeriOn } from "./ui.js";
import { passwordModule } from "../modules/password.js";
import { cryptoModule } from "../modules/crypto.js";
import { hashModule } from "../modules/hash.js";
import { phishingModule } from "../modules/phishing.js";
import { networkModule } from "../modules/network.js";
import { snsModule } from "../modules/sns.js";
import { tattooModule } from "../modules/tattoo.js";
import { copyrightModule } from "../modules/copyright.js";
import { roleplayModule } from "../modules/roleplay.js";
import { declareModule } from "../modules/declare.js";
import { digitalModule } from "../modules/digital.js";

// 学習指導要領（技術分野 D）の言葉にそったグループ。並び順もこの順
export const GROUPS = [
  { id: "digital", title: "情報のデジタル化と情報量" },
  { id: "security", title: "情報セキュリティのしくみ" },
  { id: "cyber", title: "サイバーセキュリティ" },
  { id: "moral", title: "情報モラル・知的財産・発信の責任" },
  { id: "summary", title: "まとめ" },
  { id: "advanced", title: "発展（先生に言われたら）" },
];

// easy: やさしい日本語のまとめ（「やさしい日本語」をオンにすると表示）
// 並びと番号: 基本編（①〜⑩）→ 発展編（⑪ ハッシュ体験）。label は画面に出す丸数字
export const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];
export const CATALOG = [
  { num: 1, id: "digital", group: "digital", title: "デジタル化と情報量", desc: "画像の解像度・階調、音の標本化、圧縮でデータ量がどう変わるか", module: digitalModule, easy: "コンピュータは、画像や 音を 数に して あつかいます。きれいに するほど、データの 量は 大きく なります。圧縮すると 小さく できます。" },
  { num: 2, id: "password", group: "security", title: "パスワード強度ラボ", desc: "文字の種類と長さで、解読にかかる時間がどれほど変わるかを体験", module: passwordModule, easy: "パスワードは 長い ほうが 強いです。ほかの 人に 教えません。同じ パスワードを ほかの サービスで 使いません。" },
  { num: 3, id: "crypto", group: "security", title: "暗号ラボ", desc: "昔の暗号を作って破り（1回目）、鍵の受け渡しと公開鍵暗号のしくみを知る（2回目）。RSAの計算は発展", module: cryptoModule, easy: "暗号は、ほかの 人に 読まれない ように する しかけです。むかしの 暗号は かんたんに 読まれました。いまの 暗号は 数学で 強く なって います。" },
  { num: 4, id: "phishing", group: "cyber", title: "フィッシング見分け", desc: "サイバー攻撃の代表、フィッシング。ニセのメールやログイン画面から怪しい点を見つける", module: phishingModule, easy: "ニセの メールや ページで、パスワードや お金を とろうと する 人が います。メールの リンクは 押さないで、公式の アプリで たしかめます。" },
  { num: 5, id: "network", group: "cyber", title: "ネットワーク通信の模擬", desc: "通信の暗号化で、サイバー攻撃ののぞき見から情報を守るしくみを比べる", module: networkModule, easy: "HTTP は、とちゅうで 中身を 見られる ことが あります。HTTPS は 中身が 暗号に なって います。でも https（鍵マーク）でも、ニセの サイトの ことも あります。" },
  { num: 6, id: "sns", group: "moral", title: "SNS投稿の個人情報チェック", desc: "写真や文章から場所や学校が分かる手がかりを探す", module: snsModule, easy: "写真や 文から、家や 学校が わかる ことが あります。投稿する 前に、うつって いる ものと 位置情報を たしかめます。" },
  { num: 7, id: "tattoo", group: "moral", title: "デジタルタトゥー", desc: "投稿が広がり、消せなくなる理由を体験", module: tattooModule, easy: "インターネットに 出した ものは、コピーされて 広がります。自分で 消しても、ぜんぶは 消えません。投稿する 前に よく 考えます。" },
  { num: 8, id: "copyright", group: "moral", title: "著作権・利用ルールクイズ", desc: "引用・私的利用・フリー素材を分岐クイズで", module: copyrightModule, easy: "歌や 絵や 写真には、作った 人の 権利が あります。使う ときは ルールを 守ります。わからない ときは 先生に 聞きます。" },
  { num: 9, id: "roleplay", group: "moral", title: "判断ロールプレイ", desc: "知らない人からのDMや、アプリの権限要求にどう答える？", module: roleplayModule, easy: "知らない 人からの メッセージや、アプリの おねがいに どう こたえるか 考えます。こまったら すぐ 大人に 相談します。" },
  { num: 10, id: "declare", group: "summary", title: "まとめ・行動宣言", desc: "今日から実行する3つの対策を選ぶ", module: declareModule, easy: "学んだ ことから、きょうから する ことを 3つ えらびます。" },
  { num: 11, id: "hash", group: "advanced", title: "ハッシュ体験", desc: "1文字変えるとハッシュ値がまったく変わる様子を見る", module: hashModule, easy: "ハッシュは データの 指紋の ような ものです。1文字 ちがうだけで、まったく ちがう 値に なります。書きかえに 気づく ことが できます。" },
].map((c) => ({ ...c, label: CIRCLED[c.num - 1] }));

// やさしい日本語: ステップごとの「やること」（「やさしい日本語のまとめ」をオンにすると、各ステップの見出しの下に出る）
// キーは モジュールのid → ステップのid。ないステップには何も出ない。
const REFLECT = "ふりかえりを 書きます。「なぜ 安全に なるか」を 自分の ことばで 書きます。";
export const EASY_STEPS = {
  digital: {
    resolution: "画素の 数を 変えて、絵と データの 量が どう 変わるか 見ます。",
    tone: "色の 段階の 数を 変えて、絵と データの 量を くらべます。",
    sound: "音を 数に する しかたを 変えて、音と データの 量を くらべます。",
    compress: "データを 小さく する しかけを ためします。",
    calc: "データの 量を 計算します。",
    reflect: REFLECT,
  },
  password: {
    try: "パスワードの 例を 入れて、見つけられるまでの 時間を 見ます。本物の パスワードは 入れません。",
    compare: "「長さ」と「文字の 種類」の どちらが 強く なるか くらべます。",
    passphrase: "単語を ならべた パスワード（パスフレーズ）を 作って みます。",
    quiz: "いちばん 強い パスワードを 選びます。",
    reflect: REFLECT,
  },
  crypto: {
    caesar: "文字を ずらして、暗号の 文を 作ります。",
    brute: "鍵を 知らなくても、全部 ためすと 読めるか 見ます。",
    freq: "よく 出る 文字を 手がかりに して、暗号を 読みます。",
    vigenere: "ずらし方を 変える 暗号で、強く します。",
    keyx: "鍵を 相手に どう わたすか 考えます。",
    rsa: "小さな 数で、公開鍵暗号を ためします。",
    reflect: REFLECT,
  },
  hash: {
    avalanche: "文字を 1つ 変えて、ハッシュ値が どう 変わるか 見ます。",
    fixed: "長い 文でも 短い 文でも、ハッシュ値の 長さが 同じか 見ます。",
    tamper: "ハッシュ値を くらべて、書きかえられた ものを 見つけます。",
    storage: "パスワードが どのように 保存されて いるか 知ります。",
    reflect: REFLECT,
  },
  phishing: {
    first: "あやしいと 思う ところを 押します。おわったら「答え合わせ」を 押します。",
    all: "ほかの 場面も やって みます。",
    reflect: REFLECT,
  },
  network: {
    send: "HTTP と HTTPS で 送って、とちゅうで 見える ものを くらべます。",
    visible: "HTTPS でも 見える ものと、見えない ものを 知ります。",
    lock: "鍵マークが あれば 安全か、問題に 答えます。",
    reflect: REFLECT,
  },
  sns: {
    photo: "写真と 文で、家や 学校が わかる ところを 押します。おわったら「答え合わせ」を 押します。",
    combine: "3つの 投稿を あわせると わかる ことを 選びます。",
    fix: "直し方を 選びます。「◎ 低い」に なるまで 選びます。",
    reflect: REFLECT,
  },
  tattoo: {
    spread: "「時間を 進める」を 押して、投稿が 広がる ようすを 見ます。",
    delete: "見た 人が 8人 以上に なったら、投稿を 消して みます。消しても 残るか 見ます。",
    quiz: "問題に 答えます。広がって しまった ときの 相談先も 見ます。",
    responsibility: "2つの 問題に 答えます。発信する 人の 責任を 考えます。",
    reflect: REFLECT,
  },
  copyright: {
    first: "場面を 読んで、どう するか 選びます。3つの 場面を やります。",
    all: "のこりの 場面も やります。ルールの まとめを 読みます。",
    responsibility: "2つの 問題に 答えます。",
    reflect: REFLECT,
  },
  roleplay: {
    first: "ストーリーを 選んで、自分なら どう するか 選びます。正解を 当てなくて いいです。",
    all: "4つの ストーリーを やります。もう一度 やって、ちがう 道も ためせます。",
    reflect: REFLECT,
  },
  declare: {
    choose: "今日から する ことを 3つ 選んで、「この3つで宣言する」を 押します。",
    card: "カードを 見て たしかめます。印刷も できます。",
    reflect: "3つを 選んだ わけと、つづける 方法を 書きます。",
  },
};

// やさしい日本語: モジュール以外のページのまとめ
export const EASY_PAGES = {
  home: "このラボでは、インターネットを 安全に 使う 方法を 体験します。はじめに 理解度チェックの 事前テストを します。つぎに 左の モジュールを 上から 順に やります。さいごに 事後テストを して、記録を 先生に 出します。",
  check: "はじめに 事前テスト。さいごに 事後テスト。まちがえた 問題は 復習で もう一度。",
  records: "クラスと 番号を 入れて、「JSONで書き出す」を 押します。できた ファイルを 先生に 出します。",
};

export function availableModules(config) {
  const enabled = config?.enabledModules;
  const order = (c) => GROUPS.findIndex((g) => g.id === c.group);
  return CATALOG.filter((c) => c.module && (!Array.isArray(enabled) || enabled.includes(c.id))).sort((a, b) => order(a) - order(b) || a.num - b.num);
}

export function moduleProgress(entry) {
  // 振り返りを隠す設定のときは、ふりかえりのステップを数えない
  const steps = furikaeriOn() ? entry.module.steps : entry.module.steps.filter((s) => s.id !== "reflect");
  const done = steps.filter((s) => store.isStepDone(entry.id, s.id)).length;
  return { done, total: steps.length, complete: done === steps.length };
}
