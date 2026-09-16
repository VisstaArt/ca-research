ObjC.import('Foundation');
// Строгий формат голоса клиента. Сухой прогон: разметка из данных, рисовалки
// в подставном браузере, сверка цитат с подменённым источником проверки.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
var стенд=readFile(ROOT+'/tests/dom-stub.js');
eval(readFile(ROOT+'/tests/render-harness.js'));
function взять(n){var i=SRC.indexOf('async function '+n+'('); if(i<0) i=SRC.indexOf('function '+n+'(');
 if(i<0) throw new Error('нет '+n);
 var d=0; for(var k=SRC.indexOf('{',i);k<SRC.length;k++){if(SRC[k]==='{')d++;else if(SRC[k]==='}'){d--;if(!d)return SRC.slice(i,k+1);}}}
console.log('tests/strict-m5.test.js');
var fails=0;
function ok(n,g,w){var r=JSON.stringify(g)===JSON.stringify(w);
 if(!r){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}

eval(взять('safeJson')); eval(взять('опознатьПлощадку'));
var iН=SRC.indexOf('const normalizeQuote');
eval(SRC.slice(iН, SRC.indexOf('\n', iН)).replace('const ','globalThis.'));
globalThis.blockScriptsM3=[];
eval(взять('разметкаM5')); eval(взять('текстИзСтрогогоM5')); eval(взять('сверкаЦитатСтрогое'));
var КОД=renderResearchHTML('', {}).js;

function собрать(д){
  blockScriptsM3=[];
  var html=разметкаM5(д,null);
  var упало=[], пустые=[];
  blockScriptsM3.forEach(function(скрипт){
    try { new Function(стенд+'\n'+КОД+'\n'+скрипт)(); }
    catch(e){ упало.push(скрипт.slice(0,26)+' → '+e.message); }
  });
  var ящики=(html.match(/id="(rpt-[^"]+)"/g)||[]).map(function(x){return x.slice(4,-1);});
  try {
    var f=new Function(стенд+'\n'+КОД+'\n'+blockScriptsM3.join('\n')
      +'\nreturn '+JSON.stringify(ящики)+'.filter(function(и){'
      +'if(и==="rpt-bias") return false;'
      +'var э=document.getElementById(и); return !э || (!String(э.innerHTML).trim() '
      +'&& !(э.children && э.children.length));});');
    пустые=f();
  } catch(e){ упало.push('проверка ящиков: '+e.message); }
  return { html: html, упало: упало, пустые: пустые };
}

var эмоции=['раздражение','страх','усталость','недоверие','надежда'];
var д={цитаты:[],банк_языка:[],хуки:[],кластеры:[],альтернативы:[],кому_не_продаём:[],
  где_сидит_аудитория:[],итог:{что_узнали:['язык боли про потерю заявок'],
  что_это_значит:['пишем их словами'],что_делаем:['серия постов']}};
for (var i=1;i<=12;i++){
  д.цитаты.push({цитата:'Теряем заявки '+i,тема_боли:'потери',сегмент:'магазины',
    площадка:'Пикабу',url:'https://pikabu.ru/'+i,дата:'12.09.2026',
    частотность:'5 раз',интенсивность:(i%3)+1,что_отвечаем:'ловим уходящих'});
  д.банк_языка.push({цитата:'Ну и зачем это всё '+i,тема:'сомнение',
    эмоция:эмоции[i%5],площадка:'VC',url:'https://vc.ru/'+i});
}
for (var j=1;j<=6;j++){
  д.хуки.push({хук:'Теряем заявки '+j,тема:'потери',площадка:'Пикабу',url:'https://pikabu.ru/'+j});
  д.кластеры.push({кластер:'Кластер '+j,примеры_запросов:'как вернуть посетителя',
    осведомлённость:['не знает о проблеме','осознаёт проблему','ищет решение','сравнивает продукты','готов купить'][j%5],
    роль_в_воронке:'лендинг',формула_заголовка:'Как вернуть N% посетителей',
    доказательство:'кейс',мера_спроса:j%2?'1 200/мес':'не замерено'});
  д.альтернативы.push({альтернатива:'Делают руками '+j,тип:'ручной труд',
    почему_выбирают:'бесплатно',чем_не_устраивает:'некогда',что_говорим:'считает само'});
  д.кому_не_продаём.push({кто:'Без сайта '+j,почему_невыгоден:'некуда ставить',
    как_узнать_заранее:'нет домена'});
  д.где_сидит_аудитория.push({площадка:'Форум '+j,тип:'форум',url:'https://f'+j+'.ru',
    что_там_делают:'жалуются',признак_живости:'темы этого месяца',
    кого_читают:'практиков',как_использовать:'отвечать в ветках'});
}

var р=собрать(д);
ok('ни одна рисовалка не падает', р.упало, []);
ok('ни один блок не остался пустым', р.пустые, []);
ok('сырых таблиц нет', (р.html.match(/<table/g)||[]).length, 0);
var с=blockScriptsM3.join(' ');
ok('голос клиента собран', /renderVoc\(/.test(с), true);
ok('банк живого языка собран', /renderLangBank\(/.test(с), true);
ok('хуки собраны', /renderHooks\(/.test(с), true);
ok('кластеры намерений собраны', /renderIntent\(/.test(с), true);
ok('альтернативы собраны', /renderAlt\(/.test(с), true);
ok('кому не продаём собрано', /renderNotSell\(/.test(с), true);
ok('где сидит аудитория собрано', /renderChannels\(/.test(с), true);

// Цитаты приходят в кавычках и с интенсивностью в допустимых пределах.
var voc=JSON.parse(с.match(/renderVoc\((\[[\s\S]*?\])\);/)[1]);
ok('цитата в кавычках', /^«/.test(voc[0].q), true);
ok('интенсивность в пределах 1-3',
   voc.every(function(ц){return ц.int>=1 && ц.int<=3;}), true);

// Сверка цитат: половина страниц «не открылась» — цитаты остаются, но помечены.
globalThis.callVerifyQuotes=function(items){
  return Promise.resolve(items.map(function(и,к){
    return { url:и.url, quote:и.quote, verified: к%2===0 }; }));
};
сверкаЦитатСтрогое(д).then(function(р2){
  var помеченных=р2.цитаты.filter(function(ц){return ц.проверка==='страница не открылась';}).length;
  ok('непрошедшие цитаты не выброшены', р2.цитаты.length, 12);
  ok('но помечены', помеченных > 0, true);
  ok('счётчик сверки записан', р2.сверкаЦитат.всего, 24);
  blockScriptsM3=[];
  var h=разметкаM5(р2,null);
  ok('в отчёте сказано, сколько сверено', /сверены со страницами/.test(h), true);
  var voc2=JSON.parse(blockScriptsM3.join(' ').match(/renderVoc\((\[[\s\S]*?\])\);/)[1]);
  ok('метка «страница не открылась» доехала до карточки',
     voc2.filter(function(ц){return ц.v==='nopage';}).length > 0, true);

  // Источник проверки не ответил — врать про сверку нельзя.
  globalThis.callVerifyQuotes=function(){ return Promise.resolve(null); };
  сверкаЦитатСтрогое(д).then(function(р3){
    blockScriptsM3=[];
    var h3=разметкаM5(р3,null);
    ok('о сбое сверки сказано прямо', /не отработала/.test(h3), true);
    var текст=текстИзСтрогогоM5(д);
    ok('в выжимке есть цитаты', /Голос клиента/.test(текст), true);
    ok('в выжимке есть итог', /ИТОГ МОДУЛЯ/.test(текст), true);
    var пусто={цитаты:[],банк_языка:[],хуки:[],кластеры:[],альтернативы:[],
      кому_не_продаём:[],где_сидит_аудитория:[],итог:{что_узнали:[],что_это_значит:[],что_делаем:[]}};
    var р4=собрать(пусто);
    ok('на пустых данных не падает', р4.упало, []);
    ok('на пустых данных разметки нет вовсе', р4.html, '');
    console.log(fails?('ПРОВАЛЕНО: '+fails):'  всё зелёное');
  });
}).catch(function(e){ console.log('  FAIL сверка упала: '+e.message); });
