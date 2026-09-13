ObjC.import('Foundation');
// Второй лист стилей (PLATFORM_CSS) — договорённость с контент-машиной
// 12.09.2026: токены объявляются только в эталоне, платформенный лист их
// использует и не переопределяет. Если завести токен во втором листе,
// оболочка и выгруженный отчёт разъедутся по цвету МОЛЧА — ни один тест
// отрисовки этого не покажет, потому что каждая сторона по себе будет цела.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
console.log('tests/platform-css.test.js');
var fails=0;
function check(n,g,w){var ok=JSON.stringify(g)===JSON.stringify(w);
 if(!ok){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}

function grabStr(name){
  var i=SRC.indexOf('const '+name+' = "'); if(i<0) throw new Error('нет '+name);
  var j=SRC.indexOf('"', i+('const '+name+' = ').length);
  for(var k=j+1;k<SRC.length;k++){
    if(SRC[k]==='\\\\'){k++;continue;}
    if(SRC[k]==='"') return SRC.slice(i,k+1)+';';
  }
  throw new Error('литерал не закрыт: '+name);
}
eval(grabStr('PLATFORM_CSS').replace(/^const /,'var '));

check('лист не пустой', PLATFORM_CSS.length > 2000, true);
// Ни одного объявления переменной
var decls = PLATFORM_CSS.match(/--[\w-]+\s*:/g) || [];
check('токены не объявляются', decls, []);
// Кнопки и вкладки сюда не попали — они в эталоне
check('кнопок здесь нет', /\.cm-btn\s*\{/.test(PLATFORM_CSS), false);
check('вкладок здесь нет', /\.cm-tabs\s*\{/.test(PLATFORM_CSS), false);
// Всё своё — с префиксом: договорённость про имена классов после того, как
// .seg у оболочки перебил сетку в две колонки из эталона.
var sels = PLATFORM_CSS.match(/(?:^|\n)\s*\.[A-Za-z][\w-]*/g) || [];
var bad = sels.map(function(x){return x.trim();}).filter(function(x){return x.indexOf('.cm-')!==0;});
check('все селекторы с префиксом cm-', bad, []);
// Имена без префикса ВНУТРИ селектора — та же мина, что была с .cmark:
// правило выглядит своим (.cm-proj .cmark), а красит чужой элемент.
// Слитные пометки (.cm-lane.ica) безопасны: они привязаны к своему же
// элементу и в одиночку ни на что не попадают. Ловим только потомков —
// класс через пробел, то есть ОТДЕЛЬНЫЙ элемент.
var inner = (PLATFORM_CSS.match(/\s\.[A-Za-z][\w-]*/g) || [])
  .map(function(x){ return x.trim(); })
  .filter(function(x){ return x.indexOf('.cm-') !== 0; });
check('вложенные имена тоже с префиксом', inner, []);
// Кнопки и вкладки обязаны быть в эталоне под ОБОИМИ именами
var rep = SRC;
check('кнопка в эталоне под обоими именами', /\.btn-pri,\.cm-btn,\.cm-btn-pri/.test(rep), true);
check('вкладки в эталоне под обоими именами', /\.tabs,\.cm-tabs/.test(rep), true);
// Шкала кеглей выражена токенами — оболочка берёт их по имени
['--fs-label','--fs-caption','--fs-small','--fs-body','--fs-block','--fs-module','--fs-hero']
  .forEach(function(t){ check('токен '+t+' объявлен', rep.indexOf(t+':')>=0, true); });

console.log(fails? '\nПРОВАЛОВ: '+fails : '\nвсё сошлось');
