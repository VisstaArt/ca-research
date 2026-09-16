ObjC.import('Foundation');
// Строгий формат разведки ниш. Проверяется БЕЗ ДЕНЕГ: разметка собирается из
// данных схемы, все рисовалки выполняются в подставном браузере, ниши для
// выбора человеком берутся прямо из данных.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
var стенд=readFile(ROOT+'/tests/dom-stub.js');
eval(readFile(ROOT+'/tests/render-harness.js'));
function взять(n){var i=SRC.indexOf('async function '+n+'('); if(i<0) i=SRC.indexOf('function '+n+'(');
 if(i<0) throw new Error('нет '+n);
 var d=0; for(var k=SRC.indexOf('{',i);k<SRC.length;k++){if(SRC[k]==='{')d++;else if(SRC[k]==='}'){d--;if(!d)return SRC.slice(i,k+1);}}}
console.log('tests/strict-m2.test.js');
var fails=0;
function ok(n,g,w){var r=JSON.stringify(g)===JSON.stringify(w);
 if(!r){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}

eval(взять('safeJson'));
var iП=SRC.indexOf('const ПОРОГ_БЕРЁМ');
eval(SRC.slice(iП, SRC.indexOf('\n', SRC.indexOf('const ПОРОГ_ВОПРОС'))).replace(/const /g,'globalThis.'));
var iД=SRC.indexOf('const NICHE_DEMAND_MAX');
eval(SRC.slice(iД, SRC.indexOf('\n', SRC.indexOf('const NICHE_DEMAND_FLOOR'))).replace(/const /g,'globalThis.'));
eval(SRC.slice(SRC.indexOf('const cleanCompName'), SRC.indexOf(';\n', SRC.indexOf('const cleanCompName'))+1).replace('const ','globalThis.'));
globalThis.keywordSourceForMarket=function(){return 'yandex';};
globalThis.blockScriptsM3=[];
eval(взять('разметкаM2')); eval(взять('нишиИзСтрогогоM2')); eval(взять('текстИзСтрогогоM2'));
eval(взять('замерСпросаНишСтрогое'));
var КОД=renderResearchHTML('', {}).js;

function собрать(д){
  blockScriptsM3=[];
  var html=разметкаM2(д,null);
  var упало=[], пустые=[];
  blockScriptsM3.forEach(function(скрипт){
    try { new Function(стенд+'\n'+КОД+'\n'+скрипт)(); }
    catch(e){ упало.push(скрипт.slice(0,26)+' → '+e.message); }
  });
  var ящики=(html.match(/id="(rpt-[^"]+)"/g)||[]).map(function(x){return x.slice(4,-1);});
  try {
    var f=new Function(стенд+'\n'+КОД+'\n'+blockScriptsM3.join('\n')
      +'\nreturn '+JSON.stringify(ящики)+'.filter(function(и){'
      // SVG-рисовалки (кольцо, радар) кладут узлы через appendChild — у них
      // innerHTML пуст, а блок на самом деле заполнен.
      // rpt-nhint пуст до первого нажатия по полосе — это его нормальное
      // состояние, а не незаполненный блок.
      +'var э=document.getElementById(и); if(и==="rpt-nhint") return false; '
      +'return !э || (!String(э.innerHTML).trim() '
      +'&& !(э.children && э.children.length));});');
    пустые=f();
  } catch(e){ упало.push('проверка ящиков: '+e.message); }
  return { html: html, упало: упало, пустые: пустые };
}

// Ответ «как в жизни»: сегментов восемь, ниш восемнадцать, у части нет долей,
// вердикты вперемешку.
var д={источники:[1,2,3].map(function(i){return {номер:i,площадка:'Площадка '+i,
   url:'https://s'+i+'.ru/a',что_взяли:'спрос и конкуренты'};}),
 тип_бизнеса:{вывод:'функции одного продукта',почему:'список — это функции виджета'},
 квалификация:{задана:true,критерий:'бизнесы с собственным сайтом'},
 сегменты:[],ниши:[],
 итог:{что_узнали:['рынок узкий'],что_это_значит:['берём одну нишу'],что_делаем:['M3 по ней']}};
for (var i=1;i<=8;i++){
  д.сегменты.push({сегмент:'Сегмент '+i,кто_это:'кто-то',потребность:'нужно больше заявок',
    доля_процентов:i<=6?[30,20,15,15,12,8][i-1]:null,
    платёжеспособность:['высокая','средняя','низкая','нет данных'][i%4],
    уверенность:(i%5)+1,проходит_квалификацию:i%3?'да':'нет'});
}
for (var j=1;j<=18;j++){
  д.ниши.push({ниша:'Ниша '+j,спрос_сигналы:'есть запросы',конкуренция_сигналы:'двое',
    экономика:'чек × частота',риски:'сезон',
    оценки:{спрос:(j%5)+1,конкуренция:(j%4)+2,экономика:(j%3)+3,соответствие:(j%5)+1},
    вердикт:j%7===0?'не идём':(j%3===0?'под вопросом':'идём'),
    почему_не_идём:j%7===0?'нет платёжеспособного спроса':'',
    рекомендуем:j===1,источники:[1,2]});
}

var р=собрать(д);
ok('ни одна рисовалка не падает', р.упало, []);
ok('ни один блок не остался пустым', р.пустые, []);
ok('сырых таблиц нет', (р.html.match(/<table/g)||[]).length, 0);
ok('кольцо сегментов собрано', /renderDonut\(/.test(blockScriptsM3.join(' ')), true);
ok('полосы ниш собраны', /renderNicheBoard\(/.test(blockScriptsM3.join(' ')), true);
ok('квалификация названа', /бизнесы с собственным сайтом/.test(р.html), true);

// Порядок: сначала те, куда идём.
var D=JSON.parse(blockScriptsM3.filter(function(x){return x.indexOf('renderNicheBoard(')===0;})[0]
  .slice('renderNicheBoard('.length,-2));
ok('сначала рабочие ниши', D[0].vd, 'go');
ok('отброшенные в конце', D[D.length-1].vd, 'no');
ok('прямой отказ разведки сохранён',
   D.filter(function(н){return н.n==='Ниша 7';})[0].vd, 'no');

// Ниши для выбора человеком — из тех же данных, без разбора текста.
var нд=нишиИзСтрогогоM2(д);
ok('ниши для выбора собраны', нд.niches.length, 18);
ok('баллы сходятся с осями', нд.niches[0].score,
   нд.niches[0].demand+нд.niches[0].competition+нд.niches[0].economics+нд.niches[0].fit);
ok('рекомендованная ровно одна', нд.niches.filter(function(н){return н.recommended;}).length, 1);
ok('отказ переведён в No-Go',
   нд.niches.filter(function(н){return н.name==='Ниша 7';})[0].verdict, 'No-Go');

// Выжимка для следующих модулей.
var текст=текстИзСтрогогоM2(д);
ok('в выжимке есть ниши', /Ниша 1/.test(текст), true);
ok('в выжимке есть итог', /ИТОГ МОДУЛЯ/.test(текст), true);

// Пустой ответ не должен рисовать пустые заголовки.
var пусто={источники:[],тип_бизнеса:{вывод:'функции одного продукта',почему:''},
  квалификация:{задана:false,критерий:''},сегменты:[],ниши:[],
  итог:{что_узнали:[],что_это_значит:[],что_делаем:[]}};
var р2=собрать(пусто);
ok('на пустых данных не падает', р2.упало, []);
ok('на пустых данных разметки нет вовсе', р2.html, '');

// Замер спроса: источник подменён, проверяется правило «спорят».
var спрос={'Ниша 1':10,'Ниша 2':90000,'Ниша 3':5000};
globalThis.callBrandDemand=function(имя){ return Promise.resolve(спрос[имя]==null?null:спрос[имя]); };
var малые={ниши:[{ниша:'Ниша 1',оценки:{спрос:5,конкуренция:3,экономика:3,соответствие:4}},
                 {ниша:'Ниша 2',оценки:{спрос:1,конкуренция:3,экономика:3,соответствие:3}},
                 {ниша:'Ниша 3',оценки:{спрос:3,конкуренция:3,экономика:3,соответствие:3}}]};
замерСпросаНишСтрогое(малые,{geoMarket:'Россия'}).then(function(р3){
  var по={}; р3.ниши.forEach(function(н){ по[н.ниша]={з:н.запросов,с:н.сверка}; });
  ok('низкий спрос помечен как подозрение на фразу',
     /проверьте фразу/.test(по['Ниша 1'].с), true);
  ok('балл низкий, а спрос высокий — спорят', /спорят/.test(по['Ниша 2'].с), true);
  ok('замер попал в данные', /90/.test(по['Ниша 2'].з), true);
  ok('источник назван', р3.замерСпроса.источник, 'Яндекс Wordstat');
  console.log(fails?('ПРОВАЛЕНО: '+fails):'  всё зелёное');
}).catch(function(e){ console.log('  FAIL замер спроса упал: '+e.message); });
