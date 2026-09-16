ObjC.import('Foundation');
// Цены конкурентов замеряются со страниц тарифов, а не спрашиваются у модели.
// Два живых прогона 16.09 подряд сваливали ВЕСЬ рынок в «масс-маркет»: модель
// отвечала «цена не опубликована» даже там, где тарифы открыты. Здесь поиск и
// разбор подменены — проверяется само правило: замер сильнее ответа модели.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
function grab(n){var i=SRC.indexOf('async function '+n+'('); if(i<0) i=SRC.indexOf('function '+n+'(');
 if(i<0) throw new Error('нет '+n);
 var d=0; for(var k=SRC.indexOf('{',i);k<SRC.length;k++){if(SRC[k]==='{')d++;else if(SRC[k]==='}'){d--;if(!d)return SRC.slice(i,k+1);}}}
function grabConst(имя,открыть,закрыть){
  var i=SRC.indexOf('const '+имя); var j=SRC.indexOf(открыть,i),d=0;
  for(var k=j;k<SRC.length;k++){ if(SRC[k]===открыть)d++; else if(SRC[k]===закрыть){d--; if(!d) return SRC.slice(i,k+1)+';'; } }
}
console.log('tests/strict-m3-prices.test.js');
var fails=0;
function ok(n,g,w){var r=JSON.stringify(g)===JSON.stringify(w);
 if(!r){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}

eval(grabConst('ЦЕНЫ_МАКС_ИГРОКОВ','=',';').replace('const ','globalThis.').replace(/;;$/,';'));
eval(grabConst('СХЕМА_ЦЕН','{','}').replace('const ','globalThis.'));
var iК=SRC.indexOf('const КУРС =');
eval(SRC.slice(iК, SRC.indexOf('}', iК)+2).replace('const КУРС =','globalThis.КУРС ='));
eval(grab('вМесяц')); eval(grab('ценаИзБрифа')); eval(grab('ценовыеУровни'));
eval(grab('safeJson')); eval(grab('escHtml')); eval(grab('plural'));
globalThis.blockScriptsM3=[];
eval(grab('разметкаM3'));

// Поиск отвечает кусками страниц; разбор возвращает цены двух игроков из трёх.
var запросы=[];
globalThis.callSearch=function(q,opts){
  запросы.push({q:q,dom:(opts&&opts.include_domains||[])[0]});
  return Promise.resolve([{url:'https://'+(opts.include_domains[0])+'/pricing',
                           content:'Тарифы: от 1 990 ₽ в месяц'}]);
};
var спрошено=null;
globalThis.callGPTСхема=function(sys,user,схема,имя){
  спрошено={user:user,имя:имя};
  return Promise.resolve(JSON.stringify({цены:[
    {название:'Envybox',от:1990,валюта:'RUB',период:'в месяц',url:'https://envybox.io/pricing'},
    {название:'Roistat',от:9900,валюта:'RUB',период:'в месяц',url:'https://roistat.com/price'},
    {название:'Callibri',от:null,валюта:'нет данных',период:'нет данных',url:''}]}));
};
eval(grab('замерЦенСтрогое'));

var д={конкуренты:[
 {название:'Envybox',сайт:'envybox.io',мы:false,известность:'лидер',чем_известен:'попапы',
  цена:{от:null,до:null,валюта:'нет данных',период:'нет данных',как_узнали:'цен нет в открытом доступе'}},
 {название:'Roistat',сайт:'roistat.com',мы:false,известность:'заметный',чем_известен:'аналитика',
  цена:{от:null,до:null,валюта:'нет данных',период:'нет данных',как_узнали:''}},
 {название:'Callibri',сайт:'callibri.ru',мы:false,известность:'нишевый-малый',чем_известен:'callback',
  цена:{от:null,до:null,валюта:'нет данных',период:'нет данных',как_узнали:''}},
 {название:'Делают сами',сайт:'',мы:false,известность:'не замерено',чем_известен:'вручную',
  цена:{от:null,до:null,валюта:'нет данных',период:'нет данных',как_узнали:''}}],
 разбор:[],смежные:[],куда_расти:[],
 swot:{сильные:[],слабые:[],возможности:[],угрозы:[]},
 гэп:[],позиционирование:[],архетип:{варианты:[]},
 итог:{что_узнали:[],что_это_значит:[],что_делаем:[]}};

замерЦенСтрогое(д,{name:'Ловец Лидов'}).then(function(р){
  var по={}; р.конкуренты.forEach(function(к){ по[к.название]=к.цена; });
  ok('цена найдена замером', по['Envybox'].от, 1990);
  ok('и ссылка на страницу тарифов сохранена', по['Envybox'].как_узнали, 'https://envybox.io/pricing');
  ok('кому цену не нашли — остаётся пусто', по['Callibri'].от, null);
  ok('без сайта не ищем вовсе', запросы.length, 3);
  ok('ищем только на его домене', запросы[0].dom, 'envybox.io');
  ok('схема названа латиницей', /^[A-Za-z0-9_-]+$/.test(спрошено.имя), true);
  ok('сколько нашли — записано', р.замерЦен.нашли, 2);

  // Уровни считаются от медианы: 1990 и 9900 — это уже не один слой.
  blockScriptsM3=[];
  var html=разметкаM3(р,{name:'Ловец Лидов',price:'от 990 ₽ в месяц'});
  var точки=JSON.parse(blockScriptsM3.filter(function(x){return x.indexOf('renderMarketMap(')===0;})[0]
    .slice('renderMarketMap('.length,-2));
  var по2={}; точки.forEach(function(т){ по2[т[0]]=т[1]; });
  ok('дорогой выше дешёвого', по2['Roistat'] > по2['Envybox'], true);
  ok('наша цена из брифа учтена', по2['Ловец Лидов'] != null, true);
  ok('сказано, что цены со страниц тарифов', /со страниц тарифов/.test(html), true);
  console.log(fails?('ПРОВАЛЕНО: '+fails):'  всё зелёное');
}).catch(function(e){ console.log('  FAIL замер цен упал: '+e.message); });
