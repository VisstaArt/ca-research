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

// Прогоны не должны «пропадать» при обновлении страницы: список из облака
// СЛИВАЕТСЯ с местным, а не затирает его. Владелица 17.09: «обновила — модуль
// пишет, будто исследовать заново; обновила ещё раз — появилось».
var исх=readFile(ROOT+'/app.jsx');
var гидр=исх.slice(исх.indexOf('const hydrateFromDb'), исх.indexOf('const hydrateFromDb')+2600);
[['местные берутся для слияния', /const местные = loadAll\(\)/],
 ['облако не затирает местное вслепую', /местнаяНовее/],
 ['то, что новее в браузере, дошлётся в облако', /догнать\.forEach/],
 ['список сортируется по времени', /sort\(\(а, б\) => времени\(б\) - времени\(а\)\)/]]
 .forEach(function(п){
   if (п[1].test(гидр)) console.log('  ok   '+п[0]);
   else { провалов++; console.log('  FAIL '+п[0]); }
 });
var синх=исх.slice(исх.indexOf('const syncToDb'), исх.indexOf('const syncToDb')+900);
if (/r && r\.ok/.test(синх)) console.log('  ok   выгрузка проверяет ответ сервера');
else { провалов++; console.log('  FAIL выгрузка молча глотает ошибку'); }
if (/report: ''/.test(синх)) console.log('  ok   при отказе пробуем без тяжёлого отчёта');
else { провалов++; console.log('  FAIL нет второй попытки без отчёта'); }
if (/ПлашкаПодгрузки/.test(исх)) console.log('  ok   о подгрузке из облака сказано на экране');
else { провалов++; console.log('  FAIL подгрузка молчит'); }
console.log(провалов===0 ? '\nвсё сошлось (хранение)' : '\nПРОВАЛОВ: '+провалов);

// Счётчик времени: замирал на 00:00 с полной полосой, пока шли замеры и
// сборка отчёта — «вот-вот», а ждать ещё пять минут (владелица 17.09).
var тм=исх.slice(исх.indexOf('function CountdownTimer'), исх.indexOf('function CountdownTimer')+2200);
[['за оценкой счёт идёт вверх', /const перебор = elapsed > totalSeconds/],
 ['сказано, что идёт дольше обычного', /Идёт дольше обычного/],
 ['полоса не доходит до края', /Math\.min\(94,/]].forEach(function(п){
   if (п[1].test(тм)) console.log('  ok   '+п[0]);
   else { провалов++; console.log('  FAIL '+п[0]); }
 });
[['таймер шагов не добегает до последнего', /mod\.steps\.length-2/],
 ['есть реальные шаги поздней фазы', /const реальныйШаг = текст =>/],
 ['замеры сообщают о себе', /реальныйШаг\('Замеряю брендовый спрос/],
 ['сборка отчёта видна', /реальныйШаг\('Собираю отчёт'\)/]].forEach(function(п){
   if (п[1].test(исх)) console.log('  ok   '+п[0]);
   else { провалов++; console.log('  FAIL '+п[0]); }
 });
// Панель хода: имя модуля и ниша идут строкой во всю ширину, а не в колонке
// рядом с таймером — там они переносились по слогам (владелица 17.09).
var пан=исх.slice(исх.indexOf('<div className="status-bar">'), исх.indexOf('<div className="status-bar">')+4200);
[['шапка панели отдельной строкой', /alignItems:'baseline',justifyContent:'space-between'/],
 ['текст шага не в узкой колонке', /gridTemplateColumns:'minmax\(0,1fr\) 168px'/],
 ['будущие шаги светлые, а не чернильные', { test: function(т){ return т.indexOf("i===curStepIdx ? 'var(--acc-ink)'") > 0; } }]]
 .forEach(function(п){
   if (п[1].test(пан)) console.log('  ok   '+п[0]);
   else { провалов++; console.log('  FAIL '+п[0]); }
 });
var инд=readFile(ROOT+'/index.html');
if (/\.status-bar > div:last-child \{ grid-template-columns: 1fr/.test(инд))
  console.log('  ok   в узком окне счётчик уходит вниз');
else { провалов++; console.log('  FAIL панель не перестраивается в узком окне'); }

console.log(провалов===0 ? '\nвсё сошлось (ход прогона)' : '\nПРОВАЛОВ: '+провалов);

// Рамка исследования обязана иметь метку версии: без неё браузер отдаёт
// index.html из кэша, внутри рамки работает старый код, и правки не видны,
// сколько ни обновляй (владелица 17.09, три прогона подряд).
var пл=readFile(ROOT+'/platform.js');
if (/index\.html\?v=' \+ ВЕРСИЯ_ИССЛЕДОВАНИЯ/.test(пл)) console.log('  ok   адрес рамки со штампом версии');
else { провалов++; console.log('  FAIL адрес рамки без штампа версии'); }
if (/var ВЕРСИЯ_ИССЛЕДОВАНИЯ = '[0-9a-f]{8}';/.test(пл)) console.log('  ok   штамп проставлен сборкой');
else { провалов++; console.log('  FAIL штамп не проставлен сборкой — проверьте tools/build.js'); }

// Площадка, которую владелец уже ведёт, не может уехать в «позже».
if (/const наша = свои\.some/.test(исх) && /вердикт: 'идём'/.test(исх))
  console.log('  ok   уже ведомые площадки код возвращает в план');
else { провалов++; console.log('  FAIL «позже» для своей площадки не перехватывается'); }

console.log(провалов===0 ? '\nвсё сошлось (рамка и площадки)' : '\nПРОВАЛОВ: '+провалов);

// Юридические поля второй части брифа не должны уезжать в модель: они не
// нужны исследованию, а в промпте это персональные данные (17.09).
if (/const БРИФ_НЕ_В_ПРОМПТ = /.test(исх) && /filter\(\(\[k\]\) => !БРИФ_НЕ_В_ПРОМПТ\.test\(k\)\)/.test(исх))
  console.log('  ok   реквизиты и данные воронки не уходят в промпт');
else { провалов++; console.log('  FAIL бриф уходит в модель целиком'); }
console.log(провалов===0 ? '\nвсё сошлось (бриф)' : '\nПРОВАЛОВ: '+провалов);

// Повторяемость выводов: у разбора конкурентов и контент-радара температура
// низкая — одни и те же страницы обязаны давать один и тот же вывод
// (владелица 17.09: «почему он всё время даёт разные рекомендации?»).
if (/mod\.id === 'M2' \|\| mod\.id === 'M3' \|\| mod\.id === 'M4'\) \? 0\.3/.test(исх))
  console.log('  ok   разбор и радар считаются с низкой температурой');
else { провалов++; console.log('  FAIL температура разбора не зафиксирована'); }
// Площадка из брифа обязана попасть в стратегию, даже если модель её забыла.
if (/добавлена по брифу, модель её не разобрала/.test(исх))
  console.log('  ok   свои площадки код дописывает в стратегию');
else { провалов++; console.log('  FAIL пропущенная площадка не дописывается'); }
console.log(провалов===0 ? '\nвсё сошлось (повторяемость)' : '\nПРОВАЛОВ: '+провалов);

// Повтор разбора на сохранённых материалах: правка промпта не должна стоить
// полного прогона (владелица 17.09 — «мы опять будем править и править и
// тратить деньги на API»).
[['материалы сохраняются рядом с результатом', /\.\.\.\(материалы \? \{ материалы \} : \{\}\)/],
 ['есть режим «только разбор»', /\(наСохранённых \|\| черновикСбора\)/],
 ['остановка сохраняет собранное', /остановлен: true,\s*\n?\s*материалы: собранное/],
 ['черновик не считается готовым модулем', /filter\(r => r && !r\.остановлен\)/],
 ['в этом режиме поиск не вызывается', /Беру сохранённые материалы прошлого прогона/],
 ['кнопка показана только при наличии материалов', /\{r\.материалы && \(/],
 ['в отчёте видно, что сбор старый', /Материалы взяты из прошлого сбора/]].forEach(function(п){
  if (п[1].test(исх)) console.log('  ok   '+п[0]);
  else { провалов++; console.log('  FAIL '+п[0]); }
});
console.log(провалов===0 ? '\nвсё сошлось (дешёвый повтор)' : '\nПРОВАЛОВ: '+провалов);

// Метка результата и текущая версия кода — разные вещи, и человек не обязан
// их различать по памяти (владелица 17.09 приняла одно за другое).
if (/const свежий = String\(r\.кодСборки\)/.test(исх) && /' · сейчас ' \+ String\(сейчас\)/.test(исх))
  console.log('  ok   при расхождении версий это видно прямо в карточке');
else { провалов++; console.log('  FAIL версия результата и текущая версия не сравниваются'); }
console.log(провалов===0 ? '\nвсё сошлось (версии)' : '\nПРОВАЛОВ: '+провалов);

// Оценка времени должна быть близка к правде: контент-радар за сутки оброс
// сбором и идёт под полчаса, а в карточке стояло «3 минуты» (владелица 17.09).
var оценки = {};
исх.split('\n').forEach(function(строка, i, все){
  var м = строка.match(/id: *'(M\d[^']*)'/);
  if (м) оценки.последний = м[1];
  var о = строка.match(/estimatedMin: (\d+),/);
  if (о && оценки.последний) { оценки[оценки.последний] = +о[1]; оценки.последний = null; }
});
// M4 после разделения стал вдвое легче: портрет аудитории и замер интересов
// уехали в отдельный модуль (17.09).
[['M4', 12], ['M4A', 10], ['M3', 10], ['M8', 10]].forEach(function(п){
  if ((оценки[п[0]] || 0) >= п[1]) console.log('  ok   оценка '+п[0]+' не занижена ('+оценки[п[0]]+' мин)');
  else { провалов++; console.log('  FAIL оценка '+п[0]+' занижена: '+оценки[п[0]]+' мин'); }
});
if (/Пока оценка приблизительная/.test(исх))
  console.log('  ok   видно, когда оценка ещё не по своим прогонам');
else { провалов++; console.log('  FAIL непонятно, откуда взята оценка'); }
console.log(провалов===0 ? '\nвсё сошлось (оценки времени)' : '\nПРОВАЛОВ: '+провалов);

// Остановка прогона. Раньше выхода не было: если модуль завис, оставалось
// закрыть вкладку, и мы же переспрашивали «точно уйти?» (владелица 17.09:
// «висит уже час, не проходит»).
[['есть флаг остановки', /const остановитьRef = React\.useRef\(false\)/],
 ['флаг сбрасывается на старте прогона', /остановитьRef\.current = false;/],
 ['между модулями прогон прерывается', /if \(остановитьRef\.current\) \{[\s\S]{0,420}return;/],
 ['внутри модуля тоже, на тяжёлых шагах', /if \(остановитьRef\.current\) throw new Error\('Остановлено вами'\)/],
 ['кнопка есть в панели хода', /Остановить\s*\n\s*<\/button>/],
 ['человеку сказано, что сделанное сохранится', /при следующем запуске эти модули не пересчитываются/]]
 .forEach(function(п){
   if (п[1].test(исх)) console.log('  ok   '+п[0]);
   else { провалов++; console.log('  FAIL '+п[0]); }
 });
console.log(провалов===0 ? '\nвсё сошлось (остановка)' : '\nПРОВАЛОВ: '+провалов);

// Шаги прогона должны быть настоящими: владелица 17.09 увидела «шаг 5 из 5»
// на первой минуте и одинаковые чёрные полоски.
[['у контент-радара девять реальных этапов', /'Собираю портрет аудитории: чем живёт и что читает',/],
 ['этап ищется в списке модуля', /const найден = список\.indexOf\(текст\)/],
 ['таймер не обгоняет реальные этапы', /const этапыРеальные = mod\.id === 'M4'/],
 ['пройденное и текущее видно разным цветом', /i<curStepIdx \? 'var\(--mid\)'/]].forEach(function(п){
  if (п[1].test(исх)) console.log('  ok   '+п[0]);
  else { провалов++; console.log('  FAIL '+п[0]); }
});
console.log(провалов===0 ? '\nвсё сошлось (шаги)' : '\nПРОВАЛОВ: '+провалов);
