ObjC.import('Foundation');
// Строгий формат SEO-стратегии. Главное правило модуля: кластер без ЧИСЛА
// частотности в ядро не попадает — он уходит в «замерить вручную».
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
var стенд=readFile(ROOT+'/tests/dom-stub.js');
eval(readFile(ROOT+'/tests/render-harness.js'));
function взять(n){var i=SRC.indexOf('async function '+n+'('); if(i<0) i=SRC.indexOf('function '+n+'(');
 if(i<0) throw new Error('нет '+n);
 var d=0; for(var k=SRC.indexOf('{',i);k<SRC.length;k++){if(SRC[k]==='{')d++;else if(SRC[k]==='}'){d--;if(!d)return SRC.slice(i,k+1);}}}
console.log('tests/strict-m8.test.js');
var fails=0;
function ok(n,g,w){var r=JSON.stringify(g)===JSON.stringify(w);
 if(!r){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}

eval(взять('safeJson')); eval(взять('escHtml')); eval(взять('plural'));
globalThis.blockScriptsM3=[];
eval(взять('разметкаM8')); eval(взять('текстИзСтрогогоM8'));
var КОД=renderResearchHTML('', {}).js;

function собрать(д){
  blockScriptsM3=[];
  var html=разметкаM8(д,null);
  var упало=[], пустые=[];
  blockScriptsM3.forEach(function(скрипт){
    try { new Function(стенд+'\n'+КОД+'\n'+скрипт)(); }
    catch(e){ упало.push(скрипт.slice(0,26)+' → '+e.message); }
  });
  var ящики=(html.match(/id="(rpt-[^"]+)"/g)||[]).map(function(x){return x.slice(4,-1);});
  try {
    var f=new Function(стенд+'\n'+КОД+'\n'+blockScriptsM3.join('\n')
      +'\nreturn '+JSON.stringify(ящики)+'.filter(function(и){'
      // Панель сезонности заполняется при наведении на кластер — пустая до
      // первого касания, это её обычное состояние.
      +'if(и==="rpt-semwho"||и==="rpt-semnote") return false;'
      +'var э=document.getElementById(и); return !э || (!String(э.innerHTML).trim() '
      +'&& !(э.children && э.children.length));});');
    пустые=f();
  } catch(e){ упало.push('проверка ящиков: '+e.message); }
  return { html: html, упало: упало, пустые: пустые };
}

var д={источники:[],конкуренты_в_выдаче:[],семантика:[],аудит_контента:[],
  география:[],замерить_вручную:[],
  итог:{что_узнали:['ядро из 12 кластеров'],что_это_значит:['есть о чём писать'],что_делаем:['план статей']}};
for (var i=1;i<=10;i++){
  д.источники.push({номер:i,площадка:'Площадка '+i,url:'https://s'+i+'.ru',что_взяли:'частотности'});
  д.конкуренты_в_выдаче.push({url:'https://c'+i+'.ru/page',заголовок:'Страница '+i,
    найдено_по_запросу:'захват заявок',тип_страницы:'статья',о_чём:'про попапы',
    чем_сильна:'подробный разбор'});
  д.семантика.push({кластер:'Кластер '+i,тип:['информационный','коммерческий','навигационный'][i%3],
    примеры_запросов:'как вернуть посетителя',частотность:i*500,
    группа:i<3?'ВЧ':(i<7?'СЧ':'НЧ'),сезонность:'ровно круглый год',
    конкуренция:'средняя, по выдаче',приоритет:i,тип_страницы:'статья',
    откуда_число:'Яндекс Wordstat'});
}
for (var j=1;j<=4;j++){
  д.аудит_контента.push({конкурент:'Конкурент '+j,тип_контента:'статьи',темы:'кейсы',
    публикаций_в_месяц:j*2,частота_словами:j+' в неделю',что_работает:'разборы',
    как_сделать_лучше:'добавить цифры'});
  д.замерить_вручную.push({кластер:'Без числа '+j,почему_важен:'встречается в отзывах',
    где_замерить:'Wordstat'});
}
['Москва','Петербург','Казань'].forEach(function(р,i){
  д.география.push({регион:р,запросов_в_месяц:[12000,5000,900][i],
    доля_процентов:[45,19,3][i],плотность:[1.4,1.1,0.8][i],
    что_следует:'здесь спрос плотнее среднего'});
});

var р=собрать(д);
ok('ни одна рисовалка не падает', р.упало, []);
ok('ни один блок не остался пустым', р.пустые, []);
ok('сырых таблиц нет', (р.html.match(/<table/g)||[]).length, 0);
var с=blockScriptsM3.join(' ');
ok('семантика собрана', /renderSemantics\(/.test(с), true);
ok('выдача собрана', /renderSerp\(/.test(с), true);
ok('аудит собран', /renderAudit\(/.test(с), true);
ok('география собрана', /renderGeoRows\(/.test(с), true);
ok('«замерить вручную» отдельным блоком', /rpt-tocheck/.test(р.html), true);

// Кластер без числа в ядро не попадает.
var сНулём=JSON.parse(JSON.stringify(д));
сНулём.семантика.push({кластер:'Пустой',тип:'информационный',примеры_запросов:'',
  частотность:0,группа:'НЧ',сезонность:'',конкуренция:'',приоритет:99,
  тип_страницы:'',откуда_число:''});
var р2=собрать(сНулём);
var сем=JSON.parse(blockScriptsM3.filter(function(x){return x.indexOf('renderSemantics(')===0;})[0]
  .slice('renderSemantics('.length,-2));
ok('кластер без числа в ядро не попал',
   сем.filter(function(к){return к.n==='Пустой';}).length, 0);
ok('ядро отсортировано по приоритету', сем[0].n, 'Кластер 1');

// Географии нет — врать нельзя.
var безГео=JSON.parse(JSON.stringify(д));
безГео.география=[];
var р3=собрать(безГео);
ok('без замера география не рисуется', /renderGeoRows\(/.test(blockScriptsM3.join(' ')), false);
ok('и сказано, что не замерена', /не замерена/.test(р3.html), true);

var текст=текстИзСтрогогоM8(д);
ok('в выжимке есть ядро', /Кластер 1/.test(текст), true);
ok('в выжимке есть итог', /ИТОГ МОДУЛЯ/.test(текст), true);
console.log(fails?('ПРОВАЛЕНО: '+fails):'  всё зелёное');
