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


// 5. Имена классов у новых блоков не должны совпадать с чужими. `.ahead` уже
// был занят шапкой другой таблицы, и та в узком окне прячется совсем:
// заголовок архетипа исчезал вместе с ней (владелица 16.09 — «даже не видно,
// какой это архетип»). Правило: наш класс встречается только внутри своего
// блока.
var свои={'aph':'apick','apf':'apick','apmore':'apick','apml':'apick','apmrow':'apick',
          'gf':'gcard','gl':'gcard','gh':'gcard','gv':'gcard'};
var чужие=[];
Object.keys(свои).forEach(function(к){
  var re=new RegExp('(^|[},])\\s*([^{}@]*\\.'+к+'(?![a-z0-9-])[^{}]*)\\{','g'), м;
  while((м=re.exec(CSS))){
    // Опасно только правило, где наш класс стоит САМ — без предка слева:
    // тогда оно бьёт по нашему блоку. «.glue .gl» ограничено своим блоком и
    // до нас не достаёт.
    м[2].split(',').forEach(function(сел){
      var t=сел.trim();
      if (!new RegExp('^\\.'+к+'(?![a-z0-9-])').test(t)) return;
      if (t.indexOf('.'+свои[к])>=0) return;
      чужие.push(к+' ← '+t.slice(0,60));
    });
  }
});
check('классы блоков не пересекаются с чужими'+(чужие.length?': '+чужие.join(' | '):''),
      чужие.length===0);


// 6. Три статуса гэпа обязаны отличаться ЦВЕТОМ НА ЭКРАНЕ, а не именем
// переменной. 16.09 «проигрываем» стоял на --acc-quiet, «не определено» — на
// --ink-3, и обе оказались серыми: палитра переопределяет --acc-quiet в серый
// ниже по файлу. Владелица видела три разных вердикта и одинаковые полосы.
function значениеПеременной(имя){
  var все=CSS.match(new RegExp(имя+':\\s*([^;}]+)','g'))||[];
  if(!все.length) return null;
  return все[все.length-1].split(':').slice(1).join(':').trim().toLowerCase();
}
var полосы={};
['win','lose','parity'].forEach(function(в){
  var пр=(CSS.match(new RegExp('\\.gcard\\.g-'+в+'\\{[^}]*\\}'))||[''])[0];
  var пер=(пр.match(/var\((--[a-z0-9-]+)\)/)||[])[1];
  полосы[в]=пер?значениеПеременной(пер):null;
});
var различны = полосы.win && полосы.lose && полосы.parity
  && полосы.win!==полосы.lose && полосы.win!==полосы.parity && полосы.lose!==полосы.parity;
check('полосы трёх статусов разного цвета ('+полосы.win+' / '+полосы.lose+' / '+полосы.parity+')',
      !!различны);


// Слово-вердикт и полоса сбоку — одного цвета. Иначе карточка говорит двумя
// голосами: «проигрываем» серым словом на синей полосе (владелица 16.09).
var СЛстрока=(SRC.match(/var СЛ=\{[^}]*\}/)||[''])[0];
var словоЦвет={};
['win','parity','lose'].forEach(function(в){
  var м=СЛстрока.match(new RegExp(в+":'var\\((--[a-z0-9-]+)\\)'"));
  словоЦвет[в]=м?значениеПеременной(м[1].replace('-ink','')):null;
});
var сходится=['win','parity','lose'].every(function(в){
  return словоЦвет[в] && полосы[в] && словоЦвет[в]===полосы[в]; });
check('слово-вердикт и полоса одного цвета', сходится);


// 7. SWOT: боковая колонка с подписями убрана, подпись живёт в заголовке
// квадранта. Сетка на две колонки — текста в квадрантах много, и 74 пикселя
// под слово «наше» отъедали ширину у него (владелица 16.09).
var swotJS=(SRC.match(/"function renderSwotGrid[\s\S]*?\}",/)||[''])[0];
check('боковых подписей в SWOT нет', swotJS.indexOf('class=\\"cor\\"')<0);
check('подпись квадранта в его заголовке', /swtag/.test(swotJS));
// Подпись прижимается к правому краю — а это работает только если САМОЕ
// специфичное правило заголовка держит flex. `.swot .sw h3{display:block}`
// перебивало мой `.sw h3` и склеивало подпись с названием.
var правилаH3=CSS.match(/\.swot \.sw h3\{[^}]*\}/g)||[];
check('заголовок квадранта разводит название и подпись',
      правилаH3.length>0 && правилаH3.every(function(п){
        return /display:flex/.test(п) && /justify-content:space-between/.test(п); }));
check('сетка SWOT на две колонки',
      /\.swot\{display:grid;grid-template-columns:1fr 1fr/.test(CSS)
      && CSS.indexOf('grid-template-columns:74px 1fr 1fr')<0);


// 8. Поздние правки должны стоять в листе ПОСЛЕДНИМИ: одноимённые правила
// живут в нескольких константах, и правка в любой другой молча проигрывает
// (владелица 16.09: «стили написаны, а на экране всё по-старому»).
var меткаFIX = CSS.indexOf('Поздние правки');
var последнийNprof = CSS.lastIndexOf('.nprof{');
var последнийRkey = CSS.lastIndexOf('.rkey-side{');
check('поздние правки идут после всех прочих листов',
      меткаFIX > 0 && последнийNprof > меткаFIX && последнийRkey > меткаFIX);
// Сноска должна отличаться от данных: мельче и со звёздочкой.
check('сноска мельче основного текста и со звёздочкой',
      /\.note\{font-size:1[01](?:\.5)?px\}/.test(CSS) && /\.note[^{]*::before\{content:"\* "/.test(CSS));


// 9. Матрица не должна носить чужой класс .dtbl: у него в узком окне стоит
// grid-template-columns:1fr!important — колонки рассыпались в столбик цифр
// без подписей, а шапка съезжала (владелица 16.09).
// Матрицу убрали совсем: те же четыре оценки уже нарисованы долями в карточке
// каждой ниши, второй раз числами — дубль (владелица 16.09).
var м2разметка=(SRC.match(/function разметкаM2[\s\S]*?\n\}/)||[''])[0];
check('матрицы в разметке больше нет', м2разметка.indexOf('rpt-nmx')<0);
check('и рисовалки для неё тоже', SRC.indexOf('function renderNicheMatrix')<0);
// Полосы и карточки стоят далеко: нажатие по полосе должно подвести к карточке.
check('нажатие по полосе подводит к карточке', /scrollIntoView/.test(seg));


// 10. Карточка ниши: сверху фигура и имя с баллом, разбор — ниже во всю
// ширину. Раньше текст жался в колонку рядом с фигурой (владелица 16.09).
check('у карточки есть шапка с фигурой', /className='nhd'/.test(seg) || /className=\\?"nhd/.test(seg));
check('разбор идёт отдельным куском под шапкой',
      /card\.appendChild\(шапка\); card\.appendChild\(тело\)/.test(seg));
check('шапка карточки описана в стилях', /\.ncard2 \.nhd\{display:grid/.test(CSS));

// Значки площадок — один набор на весь отчёт (владелица 17.09: «иконки
// каждого канала, однотонные»). Раньше набор жил внутри renderChannels и
// другим рисовалкам был недоступен.
check('набор значков объявлен на верхнем уровне', /var ЗНАКИ=\{/.test(seg));
check('подбор значка по имени площадки есть', /function значок\(имя\)/.test(seg));
check('свой набор внутри renderChannels убран', seg.indexOf('const G={')<0);
['renderChannelPlan','renderChannelSkip','renderChannels'].forEach(function(имя){
  var i=seg.indexOf('function '+имя+'('), j=seg.indexOf('\nfunction ', i+10);
  var тело=seg.slice(i, j<0?seg.length:j);
  check(имя+' ставит значок площадки', тело.indexOf('значок(')>0);
});
check('значки без заливки и одним цветом', /\.pico\{[^}]*fill:none[^}]*stroke:var\(--ink-2\)/.test(CSS));

// Ячейки, в которые кладётся ФРАЗА, а не число, не должны запрещать перенос:
// 18.09 охват «400 тыс. подписчиков канала; 11 323 просмотра ролика» растянул
// колонку и наехал на соседнюю (скрин владелицы).
(function(){
  var ф=0;
  [['.reach .v', 'охват в таблице «через кого узнают»'],
   ['.fmrow .n i', 'подпись под числом в графике форматов']].forEach(function(п){
    var m=SRC.match(new RegExp(п[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{[^}]*\\}'));
    if(!m){ ф++; console.log('  FAIL нет правила для '+п[0]); return; }
    if(/white-space:nowrap/.test(m[0])){ ф++; console.log('  FAIL '+п[1]+': запрещён перенос — текст наедет на соседний столбец'); }
    else console.log('  ok   перенос разрешён: '+п[1]);
  });
  if(ф) провалов+=ф;
})();

// Кегли ужаты одной шкалой (18.09): «в сервисах шрифты мельче, больше влазит
// на экран». Ниже 11px не опускаемся — подписи станут нечитаемыми.
(function(){
  var ф=0, мелкие=[];
  var re=/font-size:\s*([\d.]+)px/g, m;
  while((m=re.exec(SRC))){ var v=parseFloat(m[1]); if(v<10) мелкие.push(v); }
  if(мелкие.length){ ф++; console.log('  FAIL есть кегли мельче 10px: '+мелкие.join(', ')); }
  else console.log('  ok   нет кеглей мельче 10px');
  if(!/font-size:13\.5px/.test(SRC)){ ф++; console.log('  FAIL базовый кегль ушёл с 13.5px'); }
  else console.log('  ok   базовый кегль 13.5px');
  if(ф) провалов+=ф;
})();

// Фон на фоне: подложка под карточками давала вторую заливку, а карточки и так
// со своим фоном (владелица 18.09 — «подложка тоже никуда не делась»).
(function(){
  var ф=0;
  var HTML = readFile(ROOT + '/index.html');
  var m = /\.worksurface \{[^}]*\}/.exec(HTML);
  if(!m){ ф++; console.log('  FAIL нет правила .worksurface'); }
  else if(!/background: transparent/.test(m[0])){ ф++;
    console.log('  FAIL подложка снова с заливкой — фон на фоне'); }
  else console.log('  ok   подложка прозрачная');
  var s2 = /\.status-bar \{[^}]*\}/.exec(HTML);
  if(s2 && /color-mix\(in srgb, var\(--mid\)/.test(s2[0])){ ф++;
    console.log('  FAIL панель хода снова залита цветом'); }
  else console.log('  ok   панель хода без цветной заливки');
  if(ф) провалов+=ф;
})();

console.log(failed===0?'\nвсё сошлось':'\nпровалов: '+failed);
