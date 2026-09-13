// Склонение числительных в интерфейсе (plural в app.jsx).
//
//     osascript -l JavaScript tests/plural.test.js
//
// Зачем существует: русские числительные ведут себя нелинейно, и «81 запросов»
// на экране заказчика выглядит как брак. Первая версия формулы (условие
// n<10||n>20) врала ровно на 21 и 81 — поймано этим тестом до показа.
ObjC.import('Foundation');
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
var i=SRC.indexOf('function plural(');
if(i<0) throw new Error('plural() не найдена');
var d=0,j=SRC.indexOf('{',i),end=j;
for(var k=j;k<SRC.length;k++){ if(SRC[k]==='{')d++; else if(SRC[k]==='}'){d--; if(!d){end=k;break;}} }
eval(SRC.slice(i,end+1));

var failed=0;
function check(n,e){var g=plural(n,'запрос','запроса','запросов');
  if(g===e)console.log('  ok   '+n+' '+g);
  else{failed++;console.log('  FAIL '+n+': ждали «'+e+'», получили «'+g+'»');}}
console.log('склонение');
[[0,'запросов'],[1,'запрос'],[2,'запроса'],[4,'запроса'],[5,'запросов'],
 [11,'запросов'],[12,'запросов'],[14,'запросов'],[15,'запросов'],
 [20,'запросов'],[21,'запрос'],[22,'запроса'],[25,'запросов'],
 [81,'запрос'],[82,'запроса'],[100,'запросов'],[101,'запрос'],[111,'запросов'],[112,'запросов']
].forEach(function(p){check(p[0],p[1]);});
console.log(failed===0?'\nвсё сошлось':'\nпровалов: '+failed);
