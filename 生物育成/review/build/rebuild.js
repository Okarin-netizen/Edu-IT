// 使い方: node rebuild.js <srcdir>   (srcdir に B1..B4/ と dist/生物育成教材集.html がある)
// 元の b?.html を SRC 行に埋めなおし、先生用ガイド.html を再生成し、zip を作り直す。
const fs=require('fs'),path=require('path'),cp=require('child_process');
const D=process.argv[2]; const H=path.join(D,'dist/生物育成教材集.html');
let h=fs.readFileSync(H,'utf8'); const lines=h.split('\n');
const i=lines.findIndex(l=>l.startsWith('var SRC = '));
if(i<0) throw new Error('SRC line not found');
const SRC={}; for(const k of ['b1','b2','b3','b4']) SRC[k]=fs.readFileSync(path.join(D,k.toUpperCase(),k+'.html'),'utf8');
lines[i]='var SRC = '+JSON.stringify(SRC).replace(/<\//g,'<\\/').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';';
h=lines.join('\n'); fs.writeFileSync(H,h);
// check
const back=new Function(lines[i]+';return SRC')(); for(const k in SRC) if(back[k]!==SRC[k]) throw new Error('mismatch '+k);
// teacher guide standalone: head style of hub + teacher section, without bar/scripts
const style=h.slice(h.indexOf('<style>'),h.indexOf('</style>')+8);
const t0=h.indexOf('<main class="page" id="pg-teacher"'), t1=h.indexOf('</main>',t0)+7;
let sec=h.slice(h.indexOf('>',t0)+1,t1-7).replace(/^\s*<div class="gtools">[\s\S]*?<\/div>\s*/,'');
const g='<!DOCTYPE html>\n<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n<title>先生用ガイド | 生物育成の技術 教材集</title>'+style.slice(0,-8)+'\n#hub .page{padding:20px 16px 40px;}</style></head>\n<body><div id="hub"><main class="page">\n<p class="small">生物育成の技術 教材集(生物育成教材集.html)の先生用ガイドです。教材集のメニュー下「先生用」からも同じ内容を見られます。</p>\n'+sec.trim()+'\n</main></div></body></html>\n';
fs.writeFileSync(path.join(D,'dist/先生用ガイド.html'),g);
console.log('rebuilt', h.length);
