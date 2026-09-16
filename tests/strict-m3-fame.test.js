ObjC.import('Foundation');
// Известность и доля внимания в СТРОГОМ пути. 16.09 первый живой прогон M3
// пришёл без замера вовсе: processM3Fame правит markdown-таблицу, которой в
// строгом формате нет. Здесь замер проверяется без единого платного вызова —
// источник частотности подменён.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
function grab(n){var i=SRC.indexOf('async function '+n+'('); if(i<0) i=SRC.indexOf('function '+n+'(');
 if(i<0) throw new Error('нет '+n);
 var d=0; for(var k=SRC.indexOf('{',i);k<SRC.length;k++){if(SRC[k]==='{')d++;else if(SRC[k]==='}'){d--;if(!d)return SRC.slice(i,k+1);}}}
console.log('tests/strict-m3-fame.test.js');
var fails=0;
function ok(n,g,w){var r=JSON.stringify(g)===JSON.stringify(w);
 if(!r){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}

eval(SRC.slice(SRC.indexOf('const FAME_LEADER_SHARE'),
     SRC.indexOf('\n', SRC.indexOf('const FAME_MAX_CALLS'))).replace(/const /g,'globalThis.'));
eval(SRC.slice(SRC.indexOf('const cleanCompName'),
     SRC.indexOf(';\n', SRC.indexOf('const cleanCompName'))+1).replace('const ','globalThis.'));
globalThis.keywordSourceForMarket=function(){return 'yandex';};
var спрос={'Envybox':12000,'Jivo':40000,'Callibri':800};
var вызовов=0;
globalThis.callBrandDemand=function(имя){ вызовов++;
  return Promise.resolve(спрос[имя]==null?null:спрос[имя]); };
eval(grab('замерИзвестностиСтрогое'));
eval(grab('safeJson')); eval(grab('escHtml')); eval(grab('plural'));
var iК=SRC.indexOf('const КУРС =');
eval(SRC.slice(iК, SRC.indexOf('}', iК)+2).replace('const КУРС =','globalThis.КУРС ='));
eval(grab('вМесяц')); eval(grab('ценовыеУровни'));
globalThis.blockScriptsM3=[];
eval(grab('разметкаM3'));
eval(grab('текстИзСтрогогоM3'));

var д={конкуренты:[
 {название:'Envybox',сайт:'envybox.io',известность:'нишевый-малый',чем_известен:'попапы',
  цена:{от:1400,до:null,валюта:'RUB',период:'в месяц',как_узнали:'тарифы'}},
 {название:'Jivo',сайт:'jivo.ru',известность:'нишевый-малый',чем_известен:'чат',
  цена:{от:1980,до:null,валюта:'RUB',период:'в месяц',как_узнали:'тарифы'}},
 {название:'Callibri',сайт:'callibri.ru',известность:'лидер',чем_известен:'callback',
  цена:{от:600,до:null,валюта:'RUB',период:'в месяц',как_узнали:'тарифы'}},
 {название:'Делают сами',сайт:'',известность:'не замерено',чем_известен:'вручную',
  цена:{от:null,до:null,валюта:'нет данных',период:'нет данных',как_узнали:''}}],
 разбор:[],смежные:[],куда_расти:[],
 swot:{сильные:[],слабые:[],возможности:[],угрозы:[]},
 гэп:[],позиционирование:[],архетип:{варианты:[]},
 итог:{что_узнали:['узко'],что_это_значит:[],что_делаем:['кейсы']}};

замерИзвестностиСтрогое(д,{geoMarket:'Россия'}).then(function(р){
  var по={}; р.конкуренты.forEach(function(к){ по[к.название]=к.известность; });
  ok('лидер спроса стал лидером', по['Jivo'], 'лидер');
  ok('оценка модели перебита замером', по['Callibri'], 'нишевый-малый');
  ok('без сайта не замеряем', по['Делают сами'], 'не замерено');
  ok('лишних обращений нет', вызовов, 3);
  ok('доли посчитаны по всем замеренным', р.замерИзвестности.доли.length, 3);
  ok('доли складываются в сто',
     Math.round(р.замерИзвестности.доли.reduce(function(a,b){return a+b[1];},0)), 100);
  ok('лидер назван', р.замерИзвестности.лидер.имя, 'Jivo');

  // Кольцо доли внимания рисуется, и подпись говорит, что это замер.
  blockScriptsM3=[];
  var html=разметкаM3(р,{name:'Мы'});
  ok('кольцо доли внимания собрано',
     /renderShareRing\(/.test(blockScriptsM3.join(' ')), true);
  ok('сказано, что это замер, а не оценка', /не оценка модели, а замер/.test(html), true);
  ok('источник частотности назван', /Яндекс Wordstat/.test(html), true);

  // Источник молчал — врать про замер нельзя.
  globalThis.callBrandDemand=function(){ return Promise.resolve(null); };
  замерИзвестностиСтрогое(д,{geoMarket:'Россия'}).then(function(р2){
    blockScriptsM3=[];
    var h2=разметкаM3(р2,{name:'Мы'});
    ok('без замера кольца нет', /renderShareRing\(/.test(blockScriptsM3.join(' ')), false);
    ok('и об этом сказано прямо', /не замерена/.test(h2), true);

    // Выжимка для следующих модулей: M4 читает предыдущий модуль текстом.
    var текст=текстИзСтрогогоM3(р);
    ok('в выжимке есть конкуренты', /Envybox/.test(текст), true);
    ok('в выжимке есть итог модуля', /ИТОГ МОДУЛЯ/.test(текст), true);
    ok('выжимка не пустая', текст.length > 80, true);
    console.log(fails?('ПРОВАЛЕНО: '+fails):'  всё зелёное');
  });
}).catch(function(e){ console.log('  FAIL замер упал: '+e.message); });
