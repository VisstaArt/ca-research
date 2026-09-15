ObjC.import('Foundation');
// Поиск конкурентов. Владелица 15.09: «vc.ru проходит, а конкурентов два»,
// «нераскрученные живут на десятых страницах», «нужна не статья, а ссылки
// из неё». Все три — про сбор материала, а не про модель.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
console.log('tests/competitor-search.test.js');
var fails=0;
function ok(n,g,w){var r=JSON.stringify(g)===JSON.stringify(w);
 if(!r){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}

var кусок=SRC.slice(SRC.indexOf('async function gatherCompetitorEvidence'),
                    SRC.indexOf('// M9 (контент-радар)'));

ok('каталоги отсекаются на поиске', /exclude_domains: каталоги/.test(кусок), true);
ok('vc.ru в списке каталогов', /'vc\.ru'/.test(кусок), true);
ok('берём глубину выдачи, а не верхушку', /gatherEvidence\(queries, \d+, 20,/.test(кусок), true);
// Глубина — это ссылки на запрос, а не число запросов: каждый запрос платный,
// и бесплатная тысяча поиска кончается за день (владелица 16.09).
var вызовы=(кусок.match(/gatherEvidence\([^,]+,\s*(\d+),/g)||[])
  .map(function(x){return Number(x.match(/,\s*(\d+),/)[1]);});
ok('поисковых вызовов на модуль не больше 16', вызовы.reduce(function(a,b){return a+b;},0)<=16, true);
ok('подборки читаются ради ссылок', /include_domains: каталоги/.test(кусок), true);
ok('из подборки достаются адреса', /https\?:\\\/\\\/\[\^/.test(кусок) || /match\(\/https/.test(кусок), true);
ok('по найденным сайтам идёт отдельный заход', /изПодборок/.test(кусок), true);
ok('свои площадки из ссылок отброшены', /своиДомены\.has/.test(кусок), true);

// Потолок выдержек поднят: из 44 нельзя выписать два десятка игроков.
var m=кусок.match(/maxItems:(\d+)/);
ok('потолок выдержек не меньше 90', m && Number(m[1])>=90, true);

console.log(fails?('ПРОВАЛЕНО: '+fails):'  всё зелёное');
