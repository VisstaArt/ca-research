ObjC.import('Foundation');
// Дымовой тест инструмента: app.js обязан ВЫПОЛНИТЬСЯ, а не только
// распарситься. 14.09 правка разорвала «async function» на голый «async;» —
// Babel собрал, тесты блоков прошли, а браузер падал на загрузке, и владелица
// видела «вообще белое поле». Этот тест выполняет собранный файл в заглушках
// браузера и ловит любую ошибку модульного уровня до того, как её увидит человек.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var g=(0,eval)('this');
g.document={createElement:function(){return {style:{},dataset:{},setAttribute:function(){},appendChild:function(){},addEventListener:function(){},remove:function(){}};},
  getElementById:function(){return null;},querySelector:function(){return null;},head:{appendChild:function(){}},body:{appendChild:function(){},classList:{add:function(){}}},
  addEventListener:function(){},documentElement:{setAttribute:function(){},getAttribute:function(){return null;}}};
g.window=g; g.localStorage={getItem:function(){return null;},setItem:function(){},removeItem:function(){}};
g.location={search:'',href:'',origin:'',reload:function(){}};
g.navigator={userAgent:'smoke',clipboard:{}};
g.fetch=function(){return Promise.resolve({ok:false,json:function(){return Promise.resolve({});},text:function(){return Promise.resolve('');}});};
g.setInterval=function(){return 0;}; g.clearInterval=function(){}; g.setTimeout=function(f){return 0;}; g.clearTimeout=function(){};
g.React={useState:function(v){return [typeof v==='function'?v():v,function(){}];},useEffect:function(){},useCallback:function(f){return f;},useRef:function(v){return {current:v};},useMemo:function(f){return f();},createElement:function(){return {};},Fragment:'f',Component:function(){}};
g.ReactDOM={createRoot:function(){return {render:function(){}};},render:function(){}};
g.Chart=function(){}; g.Chart.register=function(){};
g.CAAuth={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',authFetch:g.fetch,getAccessToken:function(){return '';},signIn:function(){},signUp:function(){},clearTokens:function(){}};
eval(readFile(ROOT+'/lib/contract.js'));
g.CAContract=g.CAContract||globalThis.CAContract;
console.log('tests/app-smoke.test.js');
// Модульный уровень выполняем и СРАЗУ ЖЕ дёргаем разбор текста: 15.09
// владелица поймала «BLOCK_TITLES is not defined» — объявление лежало внутри
// чужой функции, а новый код звал его снаружи. Загрузка при этом проходила
// чисто, ошибка вылезала только на живом отчёте. Теперь тест рисует модуль.
var провалов = 0;
try {
  (new Function(readFile(ROOT+'/app.js') + ';globalThis.renderResearchHTML=renderResearchHTML;globalThis.App=App;')).call(g);
  console.log('  ok   app.js выполняется без ошибок');
} catch(e){
  провалов++;
  console.log('  FAIL app.js падает на загрузке: '+e.message+' (строка '+(e.line||'?')+')');
}
// Сам компонент App тоже вызываем: 15.09 эффект обратился к isRun выше его
// объявления — файл выполнялся чисто, а интерфейс падал при первой отрисовке
// («Cannot access 'isRun' before initialization»). Хуки заглушены так, чтобы
// выполнить тело функции целиком, а не только её начало.
if (!провалов) {
  try {
    g.React.useMemo = function(f){ return f(); };
    g.React.useCallback = function(f){ return f; };
    g.React.useEffect = function(f){ try { f(); } catch(e) {} };
    g.App();
    console.log('  ok   App отрисовывается без ошибок');
  } catch(e) {
    провалов++;
    console.log('  FAIL App падает при отрисовке: '+e.message);
  }
}
if (!провалов) {
  try {
    var проба = g.renderResearchHTML(
      '## BLOCK 04_0 — Источники разведки\n| URL |\n|---|\n| https://vc.ru/x |\n\n'
      + 'Вывод: магазины платят [9], см. BLOCK 04_2. Confidence scale — 4.\n', {});
    if (проба.html.indexOf('class="ref"') < 0) { провалов++; console.log('  FAIL сноска [9] не стала ссылкой'); }
    else console.log('  ok   разбор текста модуля отрабатывает');
    if (проба.html.indexOf('BLOCK') >= 0) { провалов++; console.log('  FAIL служебное имя блока осталось'); }
    else console.log('  ok   служебные имена блоков заменены');
  } catch(e){
    провалов++;
    console.log('  FAIL разбор модуля падает: '+e.message);
  }
}

// Хуки после раннего возврата. React считает число хуков за отрисовку, и если
// часть из них стоит ниже «return», на другой ветке их будет меньше —
// интерфейс падает с ошибкой 310. Одного вызова App это не ловит: нужна
// проверка порядка в исходнике. 15.09 так сломался экран дважды подряд.
(function () {
  var SRC = readFile(ROOT + '/app.jsx');
  var нач = SRC.indexOf('\nfunction App() {');
  var кон = SRC.indexOf('\nfunction ', нач + 10);
  var тело = SRC.slice(нач, кон > 0 ? кон : SRC.length);
  // Первый возврат верхнего уровня: строка, начинающаяся ровно с двух пробелов.
  var m = /\n  (?:return |if \([^\n]*\) return )/.exec(тело);
  if (!m) { console.log('  ok   ранних возвратов в App нет'); return; }
  var хвост = тело.slice(m.index);
  var поздние = хвост.match(/React\.use(State|Ref|Effect|Memo|Callback|Reducer)\s*\(/g) || [];
  if (поздние.length) {
    провалов++;
    console.log('  FAIL хуки стоят после раннего возврата: ' + поздние.length
      + ' шт. — React уронит интерфейс (ошибка 310)');
  } else {
    console.log('  ok   все хуки объявлены до первого возврата');
  }
})();


// Лист стилей отчёта грузится fetch-ем, а не тегом: без штампа версии браузер
// отдаёт кэш, и правки оформления не доезжают до человека вовсе (16.09 —
// «гэп всё так же серый», хотя цвета были исправлены и выложены).
if (/fetch\('lib\/report\.css'\s*\+\s*\(верси/.test(readFile(ROOT + '/app.jsx'))) console.log('  ok   лист отчёта грузится со штампом версии');
else { fails++; console.log('  FAIL lib/report.css грузится без штампа версии'); }


// Ход прогона должен быть виден в СОСЕДНЕЙ вкладке платформы: это отдельная
// рамка со своим состоянием, и она показывала пустой экран, пока шла работа
// (владелица 16.09). Общее хранилище — единственный мост между рамками.
(function(){
  var исх = readFile(ROOT + '/app.jsx');
  var память = {};
  var прежний = globalThis.localStorage;
  globalThis.localStorage = { getItem:function(k){ return память[k]===undefined?null:память[k]; },
    setItem:function(k,v){ память[k]=String(v); }, removeItem:function(k){ delete память[k]; } };
  function взять(имя){ var i=исх.indexOf('function '+имя+'('), d=0;
    for(var k=исх.indexOf('{',i);k<исх.length;k++){ if(исх[k]==='{')d++;
      else if(исх[k]==='}'){ d--; if(!d) return исх.slice(i,k+1); } } }
  var i=исх.indexOf('const КЛЮЧ_ПРОГОНА');
  globalThis.eval(исх.slice(i, исх.indexOf('\n', i)).replace('const ','var '));
  globalThis.eval(взять('записатьХод')); globalThis.eval(взять('прочитатьХод'));
  записатьХод({ мод:'M2', имя:'Разведка ниш', шаг:'Ищу сигналы…', шагИдx:0, всего:5 });
  var ч = прочитатьХод();
  if (ч && ч.мод === 'M2' && ч.шаг === 'Ищу сигналы…') console.log('  ok   соседняя вкладка видит ход прогона');
  else { fails++; console.log('  FAIL ход прогона не доезжает до соседней вкладки'); }
  память[КЛЮЧ_ПРОГОНА] = JSON.stringify({ мод:'M2', at: Date.now() - 120000 });
  if (прочитатьХод() === null) console.log('  ok   протухшая запись не показывается');
  else { fails++; console.log('  FAIL старая запись выдаётся за идущий прогон'); }
  записатьХод(null);
  if (прочитатьХод() === null) console.log('  ok   после прогона запись снимается');
  else { fails++; console.log('  FAIL запись о прогоне осталась висеть'); }
  globalThis.localStorage = прежний;
})();


// Возможности продукта переносятся с сайта в бриф: на них стоит сравнение с
// конкурентами и выбор тем для контента (владелица 17.09 — «бриф не забирает
// себе все возможности сервиса»).
(function(){
  var исх = readFile(ROOT + '/app.jsx');
  var естьПоле = /features:''/.test(исх);
  var естьВРазборе = /"features":\[/.test(исх);
  var естьВПромпте = /k==='features'/.test(исх);
  var естьВФорме = /Что умеет продукт — полный список/.test(исх);
  if (естьПоле && естьВРазборе && естьВПромпте && естьВФорме)
    console.log('  ok   возможности продукта едут с сайта в бриф и в промпты');
  else { fails++; console.log('  FAIL возможности продукта теряются: поле '+естьПоле
    +', разбор '+естьВРазборе+', промпт '+естьВПромпте+', форма '+естьВФорме); }
})();

console.log(провалов===0 ? '\nвсё сошлось' : '\nПРОВАЛОВ: '+провалов);
