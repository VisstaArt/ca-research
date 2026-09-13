// Проверка, что скрипт собранного отчёта разбирается и все блоки заполняются.
//
//     osascript -l JavaScript tests/report-js.test.js
//
// Зачем существует: 12.09.2026 одна неверно вырезанная функция (счёт скобок
// сломался о фигурные скобки внутри строк) сделала ВЕСЬ скрипт отчёта
// неразбираемым — и пустыми стали все блоки сразу. Снаружи это выглядело как
// «ничего не работает», а проверки по одному блоку ничего не показывали.
ObjC.import('Foundation');
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');

var failed=0;
function check(n,ok){ if(ok) console.log('  ok   '+n); else { failed++; console.log('  FAIL '+n); } }

console.log('скрипт отчёта');
// 1. Каждый кусок BLOCK_JS должен разбираться как строка И собираться вместе
var a=SRC.indexOf('const BLOCK_JS = ['), b=SRC.indexOf("].join('\\n');", a);
var seg=SRC.slice(a,b);
var parts=[], re=/^    "/gm, m;
while((m=re.exec(seg))){
  var i=m.index+4, k=i+1;
  while(k<seg.length){ if(seg[k]==='\\'){k+=2;continue;} if(seg[k]==='"') break; k++; }
  parts.push(seg.slice(i,k+1));
}
check('куски BLOCK_JS найдены', parts.length>0);
var joined='', okParse=true;
parts.forEach(function(p){ try{ joined+=JSON.parse(p)+'\n'; }catch(e){ okParse=false; } });
check('каждый кусок — корректная строка', okParse);
check('скобки сходятся во всём коде рисования',
      (joined.split('{').length-1)===(joined.split('}').length-1));
// 2. Собранный код должен ПАРСИТЬСЯ движком
var parsed=true;
try { new Function(joined); } catch(e) { parsed=false; console.log('       '+e.message); }
check('код рисования разбирается движком', parsed);
console.log(failed===0?'\nвсё сошлось':'\nпровалов: '+failed);
