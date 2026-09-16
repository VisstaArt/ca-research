ObjC.import('Foundation');
// Строгий формат контент-радара. Сухой прогон: разметка из данных схемы,
// рисовалки выполняются в подставном браузере. Набор — «как в жизни»: часть
// просмотров не видна (Telegram их прячет), часть каналов без подписчиков.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
var стенд=readFile(ROOT+'/tests/dom-stub.js');
eval(readFile(ROOT+'/tests/render-harness.js'));
function взять(n){var i=SRC.indexOf('async function '+n+'('); if(i<0) i=SRC.indexOf('function '+n+'(');
 if(i<0) throw new Error('нет '+n);
 var d=0; for(var k=SRC.indexOf('{',i);k<SRC.length;k++){if(SRC[k]==='{')d++;else if(SRC[k]==='}'){d--;if(!d)return SRC.slice(i,k+1);}}}
console.log('tests/strict-m4.test.js');
var fails=0;
function ok(n,g,w){var r=JSON.stringify(g)===JSON.stringify(w);
 if(!r){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}

eval(взять('safeJson'));
globalThis.blockScriptsM3=[];
eval(взять('опознатьПлощадку'));
eval(взять('разметкаM4')); eval(взять('текстИзСтрогогоM4'));
var КОД=renderResearchHTML('', {}).js;

function собрать(д){
  blockScriptsM3=[];
  var html=разметкаM4(д,null);
  var упало=[], пустые=[];
  blockScriptsM3.forEach(function(скрипт){
    try { new Function(стенд+'\n'+КОД+'\n'+скрипт)(); }
    catch(e){ упало.push(скрипт.slice(0,26)+' → '+e.message); }
  });
  var ящики=(html.match(/id="(rpt-[^"]+)"/g)||[]).map(function(x){return x.slice(4,-1);});
  try {
    var f=new Function(стенд+'\n'+КОД+'\n'+blockScriptsM3.join('\n')
      +'\nreturn '+JSON.stringify(ящики)+'.filter(function(и){'
      +'var э=document.getElementById(и); return !э || (!String(э.innerHTML).trim() '
      +'&& !(э.children && э.children.length));});');
    пустые=f();
  } catch(e){ упало.push('проверка ящиков: '+e.message); }
  return { html: html, упало: упало, пустые: пустые };
}

var д={источники_радара:[],каналы:[],залетает:[],паттерны:[],бенчмарки:[],каналы_заказчика:[],
  итог:{что_узнали:['ниша живёт в телеграме'],что_это_значит:['идём туда'],что_делаем:['серия разборов']}};
for (var i=1;i<=14;i++){
  д.источники_радара.push({номер:i,канал:'Канал '+i,площадка:i%2?'Telegram':'YouTube',
    чей:i<=2?'заказчик':'конкурент',url:'https://t.me/c'+i,что_видно:'посты и реакции'});
  д.каналы.push({канал:'Канал '+i,площадка:i%2?'Telegram':'YouTube',
    чей:i<=2?'заказчик':(i%5?'конкурент':'медиа'),
    подписчики:i%3?'12 400':'не замерено',как_часто:i%4?'2-3 в неделю':'не замерено',
    формат:i%2?'посты':'ролики',о_чём:'про захват заявок',url:'https://t.me/c'+i,источники:[i]});
}
for (var j=1;j<=16;j++){
  д.залетает.push({заголовок:'Единица '+j,площадка:j%2?'Telegram':'YouTube',
    просмотры:j%3?j*1000:null,просмотры_текст:j%3?(j*1000)+'':'не замерено',
    отклик:j*12+' реакций',тема:'конверсия',формат:j%2?'пост':'ролик',
    хук:j%4?'«Мы теряли половину заявок»':'не видно из источника',
    длительность:j%2?'':'8 минут',призыв:'подписаться',url:'https://t.me/c1/'+j});
}
for (var k=1;k<=4;k++){
  д.паттерны.push({паттерн:'Паттерн '+k,на_чём_основан:'единицы 1, 3, 7',
    почему_срабатывает:'обещание проверяемо',что_делаем:'повторяем формат'});
  д.бенчмарки.push({показатель:'Показатель '+k,медиана:'12 400',разброс:'3 000–40 000',
    на_скольких:'11 единицах',примечание:k%2?'':'Telegram просмотры прячет'});
}
д.каналы_заказчика.push({площадка:'Telegram',ссылка:'https://t.me/we',публикаций_в_месяц:6,
  ритм_словами:'1-2 в неделю',последняя:'12.09.2026',форматы:'посты',темы:'кейсы',
  что_работает:'разборы заявок',как_сделать_лучше:'добавить видео'});

var р=собрать(д);
ok('ни одна рисовалка не падает', р.упало, []);
ok('ни один блок не остался пустым', р.пустые, []);
ok('сырых таблиц нет', (р.html.match(/<table/g)||[]).length, 0);
ok('каналы собраны', /renderChannels\(/.test(blockScriptsM3.join(' ')), true);
ok('что залетает собрано', /renderTopContent\(/.test(blockScriptsM3.join(' ')), true);
ok('паттерны собраны', /renderPatterns\(/.test(blockScriptsM3.join(' ')), true);
ok('бенчмарки собраны', /renderBenchmarks\(/.test(blockScriptsM3.join(' ')), true);
ok('свои каналы собраны', /renderAudit\(/.test(blockScriptsM3.join(' ')), true);

// Единицы без просмотров не выбрасываются: Telegram их прячет, а разбор хука
// полезен и без числа.
var топ=JSON.parse(blockScriptsM3.filter(function(x){return x.indexOf('renderTopContent(')===0;})[0]
  .slice('renderTopContent('.length,-2));
ok('единицы без просмотров остались', топ.filter(function(е){return е.raw==='не замерено';}).length > 0, true);
ok('самая заметная — первой', топ[0].v >= топ[топ.length-1].v, true);
ok('«не видно из источника» не печатается как хук',
   топ.filter(function(е){return /не видно/.test(е.hook);}).length, 0);

// Источники: сквозная нумерация и переставленные ссылки каналов.
var ис=JSON.parse(blockScriptsM3.filter(function(x){return x.indexOf('renderSources(')===0;})[0]
  .slice('renderSources('.length,-5));
ok('нумерация источников сквозная', ис.map(function(с){return с[0];}).slice(0,3), [1,2,3]);

var текст=текстИзСтрогогоM4(д);
ok('в выжимке есть каналы', /Канал 1/.test(текст), true);
ok('в выжимке есть итог', /ИТОГ МОДУЛЯ/.test(текст), true);

// Пустой ответ: ничего не рисуем и не падаем.
var пусто={источники_радара:[],каналы:[],залетает:[],паттерны:[],бенчмарки:[],
  каналы_заказчика:[],итог:{что_узнали:[],что_это_значит:[],что_делаем:[]}};
var р2=собрать(пусто);
ok('на пустых данных не падает', р2.упало, []);
// Пустой блок читается как поломка: если каналов или бенчмарков не нашлось,
// отчёт обязан сказать это словами (владелица 16.09).
ok('про отсутствие каналов сказано', /не нашлось ни одного канала/.test(р2.html), true);
ok('про отсутствие бенчмарков сказано', /Бенчмарков не набралось/.test(р2.html), true);
console.log(fails?('ПРОВАЛЕНО: '+fails):'  всё зелёное');
