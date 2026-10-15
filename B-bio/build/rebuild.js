// 使い方(リポジトリのいちばん上で): node B-bio/build/rebuild.js
//   (フォルダを省くと、このファイルの1つ上 = B-bio を使う。B1..B4/、eduit-info.js、docs/、build/ がある。共通の枠は ../shared/)
// 元のファイル: build/menu.html(メニュー)・docs/先生用ガイド.html(先生用ガイド)・B?/b?.html(教材)
// できるファイル(dist/ は作ったものだけ。手で直さない):
// 1. dist/生物育成教材集.html … menu.html に、共通の枠(shared/eduit-frame.css・eduit-frame.js と B-bio/eduit-info.js)・
//    先生用ガイド・B1〜B4(共通の枠の読み込みを中身に置きかえたもの)を SRC 行に入れて、1ファイルで動くようにする
// 2. dist/先生用ガイド.html … 印刷しやすい先生用ガイド
// 3. dist/生物育成教材集.zip … 生物育成教材集.html・先生用ガイド.html・はじめにお読みください.txt
// 何回作りなおしても同じ中身になる(zip の日時は eduit-info.js の updated にそろえる)
const fs=require('fs'),path=require('path'),cp=require('child_process'),os=require('os');
const D=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const SHARED=path.join(D,'..','shared');
const MENU=path.join(D,'build/menu.html');
const GUIDE_SRC=path.join(D,'docs/先生用ガイド.html');
const OUT=path.join(D,'dist'); fs.mkdirSync(OUT,{recursive:true});
const H=path.join(OUT,'生物育成教材集.html');
const read=f=>fs.readFileSync(f,'utf8');

// ---- 共通の枠 ----
const EF_CSS=read(path.join(SHARED,'eduit-frame.css')).trim();
// <script> の中に入れるので、コメントの中の </script も <\/script にする
const EF_JS=read(path.join(SHARED,'eduit-frame.js')).trim().replace(/<\/(script)/gi,'<\\/$1');
const EF_INFO=read(path.join(D,'eduit-info.js')).trim().replace(/<\/(script)/gi,'<\\/$1');
for(const [n,s] of [['css',EF_CSS],['js',EF_JS],['info',EF_INFO]]) if(/<\/(style|script)/i.test(s)) throw new Error('closing tag inside '+n);
const INFO=new Function('window',EF_INFO+';return window.EDUIT_INFO;')({});
const tagCss='<style data-ef-css>\n'+EF_CSS+'\n</style>';
const tagInfo='<script data-ef-info>\n'+EF_INFO+'\n</script>';
const tagJs='<script data-ef-js>\n'+EF_JS+'\n</script>';
function once(s,find,repl,where){
  const n=s.split(find).length-1;
  if(n!==1) throw new Error(where+': expected 1 of '+find+', found '+n);
  return s.replace(find,()=>repl);
}
function onceRe(s,re,repl,where){
  const m=s.match(new RegExp(re.source,'g'))||[];
  if(m.length!==1) throw new Error(where+': expected 1 of '+re+', found '+m.length);
  return s.replace(re,()=>repl);
}
// 元の教材: 相対パスの読み込みを中身に置きかえる
function inlineEf(html,where){
  html=once(html,'<link rel="stylesheet" href="../../shared/eduit-frame.css">',tagCss,where);
  html=once(html,'<script src="../eduit-info.js"></script>',tagInfo,where);
  html=once(html,'<script src="../../shared/eduit-frame.js"></script>',tagJs,where);
  return html;
}
// メニュー: 前に入れた中身を新しい中身に置きかえる
function refreshEf(html,where){
  html=onceRe(html,/<style data-ef-css>[\s\S]*?<\/style>/,tagCss,where);
  html=onceRe(html,/<script data-ef-info>[\s\S]*?<\/script>/,tagInfo,where);
  html=onceRe(html,/<script data-ef-js>[\s\S]*?<\/script>/,tagJs,where);
  return html;
}

// ---- 1. 本体 ----
let h=read(MENU);
h=onceRe(h,/<!-- メニューの元ファイル。[^\n]*-->/,'<!-- このファイルは B-bio/build/rebuild.js が作ったもの。直すときは build/menu.html・docs/先生用ガイド.html・B?/b?.html を直して作りなおす -->','hub');
h=inlineEf(h,'hub');
// 先生用ガイド: docs/先生用ガイド.html の guide:start〜guide:end のあいだ
const gsrc=read(GUIDE_SRC);
const ga=gsrc.indexOf('<!-- guide:start -->'), gb=gsrc.indexOf('<!-- guide:end -->');
if(ga<0||gb<ga) throw new Error('guide markers not found in docs/先生用ガイド.html');
const sec=gsrc.slice(ga+'<!-- guide:start -->'.length,gb).trim();
h=once(h,'<!-- 先生用ガイド: docs/先生用ガイド.html の中身を rebuild.js が入れる -->',sec,'hub guide');
const lines=h.split('\n');
const i=lines.findIndex(l=>l.startsWith('var SRC = '));
const SRC={}; for(const k of ['b1','b2','b3','b4']) SRC[k]=inlineEf(read(path.join(D,k.toUpperCase(),k+'.html')),k);
lines[i]='var SRC = '+JSON.stringify(SRC).replace(/<\//g,'<\\/').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';';
h=lines.join('\n'); fs.writeFileSync(H,h);
// check
const back=new Function(lines[i]+';return SRC')(); for(const k in SRC) if(back[k]!==SRC[k]) throw new Error('mismatch '+k);
if(/\.\.\/(\.\.\/)?(shared\/|eduit-info)/.test(h.replace(lines[i],''))||/(href|src)=\\"\.\.\/(\.\.\/shared|eduit-info)/.test(lines[i])) throw new Error('external ref left in dist');

// ---- 2. 先生用ガイド(メニューの style と先生用の部分。上のバーとスクリプトはなし) ----
const s0=h.indexOf('<style>');
const style=h.slice(s0,h.indexOf('</style>',s0)+8);
const g='<!DOCTYPE html>\n<html lang="ja" data-ef-domain="B"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n<title>先生用ガイド | 生物育成の技術 教材集</title>\n'
  +tagCss+'\n'+tagInfo+"\n<script>EDUIT_INFO.app = { name: '先生用ガイド(生物育成の技術 教材集)' };</script>\n"+tagJs+'\n'
  +style.slice(0,-8)+'\n#hub .page{padding:20px 16px 40px;}</style></head>\n<body><div id="hub"><main class="page">\n<p class="small">生物育成の技術 教材集(生物育成教材集.html)の先生用ガイドです。教材集のメニュー下「先生用」からも同じ内容を見られます。</p>\n'+sec+'\n</main><div data-ef-footer></div></div></body></html>\n';
const G=path.join(OUT,'先生用ガイド.html');
fs.writeFileSync(G,g);

// ---- 3. zip ----
const txt=read(path.join(__dirname,'はじめにお読みください.txt')).replace(/\{version\}/g,INFO.version).replace(/\{updated\}/g,INFO.updated);
const Z=path.join(OUT,'生物育成教材集.zip');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bio-zip-'));
const zd=path.join(tmp,'生物育成教材集'); fs.mkdirSync(zd);
fs.copyFileSync(H,path.join(zd,'生物育成教材集.html'));
fs.copyFileSync(G,path.join(zd,'先生用ガイド.html'));
fs.writeFileSync(path.join(zd,'はじめにお読みください.txt'),txt);
const T=new Date(INFO.updated+'T12:00:00');
for(const f of fs.readdirSync(zd)) fs.utimesSync(path.join(zd,f),T,T);
fs.utimesSync(zd,T,T);
if(fs.existsSync(Z)) fs.unlinkSync(Z);
cp.execFileSync('zip',['-q','-X','-r',Z,'生物育成教材集'],{cwd:tmp});
fs.rmSync(tmp,{recursive:true,force:true});
console.log('rebuilt', h.length, 'guide', g.length, 'zip', fs.statSync(Z).size, 'version', INFO.version);
