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

// 4. У каждого класса, который рисовалки ставят в разметку, есть правило в
// REPORT_CSS. Блок «Где выигрываем и где проигрываем» рисовался с классами
// gcard/gf/gl, которых в листе не было вовсе: подписи слипались со значениями,
// и владелица 16.09 назвала это сломанной таблицей.
var CSS=readFile(ROOT+'/lib/report.css');
var классы={};
// Классы пишутся внутри строк, где кавычки экранированы: берём начало
// значения до первого шаблонного куска.
var reC=/class=\\?"([a-z0-9 _-]+)/gi, mc;
while((mc=reC.exec(seg))){
  mc[1].split(/\s+/).forEach(function(c){ if(c && /^[a-z][a-z0-9-]*$/i.test(c)) классы[c]=1; });
}
var безПравил=Object.keys(классы).filter(function(c){ return CSS.indexOf('.'+c)<0; });
check('у всех классов рисовалок есть правила'+(безПравил.length?': '+безПравил.join(', '):''),
      безПравил.length===0);

console.log(failed===0?'\nвсё сошлось':'\nпровалов: '+failed);
