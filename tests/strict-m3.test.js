ObjC.import('Foundation');
// Строгий формат модуля «Конкуренты и гэп-анализ». Владелица 15.09: «почему
// она не может дать строго в том виде, как нам надо». Может: схему проверяет
// провайдер, разбор перестаёт гадать.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
function grab(n){var i=SRC.indexOf('function '+n+'(');if(i<0)throw new Error('нет '+n);var d=0;
 for(var k=SRC.indexOf('{',i);k<SRC.length;k++){if(SRC[k]==='{')d++;else if(SRC[k]==='}'){d--;if(!d)return SRC.slice(i,k+1);}}}
console.log('tests/strict-m3.test.js');
var fails=0;
function ok(n,g,w){var r=JSON.stringify(g)===JSON.stringify(w);
 if(!r){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}

eval(grab('escHtml')); eval(grab('plural'));
globalThis.safeJson=function(o){return JSON.stringify(o);};
globalThis.blockScriptsM3=[];
eval(grab('разметкаM3'));

var д={
 источники:[{номер:1,площадка:'Envybox',url:'https://envybox.io',что_взяли:'тарифы'},
            {номер:2,площадка:'нет сайта',url:'',что_взяли:'—'}],
 конкуренты:[
  {id:'C001',название:'Envybox',сайт:'envybox.io',ценовой_уровень:'средний',известность:'лидер',чем_известен:'попапы',оффер:'ловим лиды',сильные:['быстро'],слабые:['без ИИ'],мы:false,откуда:'замер',источники:[1]},
  {id:'C002',название:'Jivo',сайт:'jivo.ru',ценовой_уровень:'средний',известность:'заметный',чем_известен:'чат',оффер:'чат',сильные:[],слабые:[],мы:false,откуда:'замер',источники:[]},
  {id:'C003',название:'Callibri',сайт:'callibri.ru',ценовой_уровень:'масс-маркет',известность:'нишевый-малый',чем_известен:'callback',оффер:'звонок',сильные:[],слабые:[],мы:false,откуда:'вывод',источники:[]},
  {id:'C004',название:'Ловец Лидов',сайт:'lovec.ru',ценовой_уровень:'масс-маркет',известность:'не замерено',чем_известен:'мы',оффер:'ИИ-попап',сильные:[],слабые:[],мы:true,откуда:'замер',источники:[]}],
 куда_расти:[{направление:'выше по цене',что_отличает:'SLA',чем_подтверждено:'Callibri',что_нужно:'кейсы'}],
 swot:{сильные:[{что:'ИИ',чем_подтверждено:'бриф',что_делаем:'показать'}],слабые:[],возможности:[],угрозы:[]},
 гэп:[{критерий:'Цена',у_нас:'есть',лучшее_у_них:'нет',статус:'проигрываем',почему:'нет цен',пример_url:''}],
 позиционирование:[{сегмент:'магазины',категория:'виджет',выгода:'меньше потерь',доказательство:'кейс',против_кого:'Envybox',отличие:'ИИ'}],
 архетип:{основной:'Заботливый',почему:'объясняем',занят_соперниками:'Envybox — Герой',риск:'мягко',
          проявления:[{элемент:'Тон',как_проявляется:'спокойно',пример:'«мы проверили»',чего_избегаем:'превосходных'}]},
 итог:{что_узнали:['рынок узкий'],что_это_значит:['можно занять'],что_делаем:['кейсы']}};

blockScriptsM3=[];
var h=разметкаM3(д,null);
ok('сырых таблиц нет вовсе', (h.match(/<table/g)||[]).length, 0);
ok('карта рынка собрана', /renderMarketMap\(/.test(blockScriptsM3.join(' ')), true);
ok('карточки конкурентов собраны', /renderCompCards\(/.test(blockScriptsM3.join(' ')), true);
ok('SWOT сеткой', /renderSwotGrid\(/.test(blockScriptsM3.join(' ')), true);
ok('гэп карточками', /renderGapCards\(/.test(blockScriptsM3.join(' ')), true);
ok('архетип и его проявления', /renderArchetype\(/.test(blockScriptsM3.join(' ')) && /renderManifest\(/.test(blockScriptsM3.join(' ')), true);
// Источник без адреса проверить нельзя — в список он не идёт.
var ист=blockScriptsM3.filter(function(x){return x.indexOf('renderSources(')===0;})[0];
ok('источник без адреса отброшен', JSON.parse(ист.slice('renderSources('.length, ист.lastIndexOf(', 1)'))).length, 1);
// «Мы» на карте — ровно одна точка, и это заказчик.
var карта=blockScriptsM3.filter(function(x){return x.indexOf('renderMarketMap(')===0;})[0];
var точки=JSON.parse(карта.slice('renderMarketMap('.length, карта.length-2));
ok('«мы» помечены ровно один раз', точки.filter(function(т){return т[4];}).map(function(т){return т[0];}), ['Ловец Лидов']);

// Схема объявлена и подключена.
ok('схема M3 есть', /const СХЕМА_M3 = \{/.test(SRC), true);
ok('модуль подключён к строгому формату', /const СХЕМЫ = \{ M3: СХЕМА_M3 \}/.test(SRC), true);
ok('есть откат на прежний путь', /Строгий формат не вышел/.test(SRC), true);

console.log(fails?('ПРОВАЛЕНО: '+fails):'  всё зелёное');
