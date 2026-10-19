// node build-dict.js : dict-src.txt → kz-ruby-dict.json
const fs=require('fs');
const out=[]; const seen=new Set();
for (const line of fs.readFileSync(__dirname+'/dict-src.txt','utf8').split('\n')) {
  const l=line.trim(); if(!l||l[0]==='#') continue;
  const [w,r]=l.split(/\s+/);
  if(!r) throw new Error('no reading: '+l);
  if(seen.has(w)) throw new Error('dup '+w); seen.add(w);
  if(r[0]==='=') out.push([w, r.slice(1).split('|').map(s=>s.includes(':')?s.split(':'):s)]);
  else out.push([w,r]);
}
fs.writeFileSync(__dirname+'/kz-ruby-dict.json', '[\n'+out.map(e=>JSON.stringify(e)).join(',\n')+'\n]\n');
console.log(out.length);
// kz-ruby.html の DICT 行を差しかえる
const H=__dirname+'/kz-ruby.html'; let h=fs.readFileSync(H,'utf8');
// 置きかえの文字列に $ があっても特別な意味にならないよう、関数で返す
const re=/^  var DICT = .*;$/m;
if(!re.test(h)) throw new Error('kz-ruby.html: var DICT の行が見つからない');
h=h.replace(re, ()=>'  var DICT = '+JSON.stringify(out)+';');
fs.writeFileSync(H,h);
