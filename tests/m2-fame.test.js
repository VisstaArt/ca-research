// Тест замера известности конкурентов (processM3Fame в app.jsx).
//
// Запуск (macOS, без установки чего-либо):
//     osascript -l JavaScript tests/m2-fame.test.js
//
// Зачем существует: известность в BLOCK 06 больше не оценка модели, а
// замер брендового спроса. Проверить пороги живым прогоном стоит денег —
// здесь настоящий код из app.jsx гоняется на заглушке вместо сети, бесплатно.
ObjC.import('Foundation');
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
function grab(name){
  var i=SRC.indexOf('async function '+name+'(');
  if(i<0) i=SRC.indexOf('function '+name+'(');
  if(i<0) throw new Error('не найдено: '+name);
  var d=0,j=SRC.indexOf('{',i);
  for(var k=j;k<SRC.length;k++){ if(SRC[k]==='{')d++; else if(SRC[k]==='}'){d--; if(!d) return SRC.slice(i,k+1);} }
  throw new Error('не закрыто: '+name);
}
function grabConst(name){
  var i=SRC.indexOf('\nconst '+name);
  if(i<0) throw new Error('не найдено: '+name);
  // многострочные const (цепочка .replace) — до строки, оканчивающейся ';'
  var lines=SRC.slice(i+1).split('\n'), out=[];
  for(var k=0;k<lines.length;k++){ out.push(lines[k]); if(/;\s*$/.test(lines[k].replace(/\/\/.*$/,''))) break; }
  return out.join('\n');
}
eval(readFile(ROOT+'/lib/contract.js'));
var C=globalThis.CAContract;
globalThis.splitMdRow=C.splitMdRow; globalThis.isMdSeparator=C.isMdSeparator;
['extractMdTableByHeading','spliceMdTableRows',
 'keywordSourceForMarket','callBrandDemand','processM3Fame'].forEach(function(n){ eval(grab(n)); });
// const блочно-областной: eval внутри forEach оставил бы его в колбэке — собираем
// один текст и исполняем на верхнем уровне, где его увидит остальной тест.
eval(['FAME_LEADER_SHARE','FAME_NOTABLE_SHARE','FAME_FLOOR','FAME_MAX_CALLS','cleanCompName']
  .map(grabConst).join('\n').replace(/^const /gm,'var '));
// ВСЁ, что выше, — настоящий код из app.jsx. Заглушки только на сеть:
var DEMAND={'Jivo':40000,'Envybox':11000,'Carrot quest':3000,'Ловец лидов':80,'Мелкий':0};
var calls=[];
function callWordstat(phrase,opts){ calls.push(phrase);
  return Promise.resolve(DEMAND[phrase]!==undefined?{totalCount:DEMAND[phrase]}:null); }
function callGoogleAds(){ return Promise.resolve(null); }
globalThis.callWordstat=callWordstat; globalThis.callGoogleAds=callGoogleAds;
globalThis.extractMdTableByHeading=extractMdTableByHeading;
globalThis.spliceMdTableRows=spliceMdTableRows;
globalThis.keywordSourceForMarket=keywordSourceForMarket;
globalThis.callBrandDemand=callBrandDemand; globalThis.cleanCompName=cleanCompName;
globalThis.FAME_LEADER_SHARE=FAME_LEADER_SHARE; globalThis.FAME_NOTABLE_SHARE=FAME_NOTABLE_SHARE;
globalThis.FAME_FLOOR=FAME_FLOOR; globalThis.FAME_MAX_CALLS=FAME_MAX_CALLS;

var FULL=[
'BLOCK 06 — КАРТА РЫНКА','',
'| Comp_ID | Название | Сайт/URL | Ценовой уровень | Известность и масштаб | География |',
'|---|---|---|---|---|---|',
'| C1 | **Jivo** | jivo.ru | средний | лидер | РФ |',
'| C2 | Envybox | envybox.io | средний | лидер | РФ |',
'| C3 | [Carrot quest](https://carrotquest.io) | carrotquest.io | дорогой | лидер | РФ |',
'| C4 | Ловец лидов | lovec.ru | масс-маркет | заметный | РФ |',
'| C5 | Формы CMS | — | масс-маркет | заметный | РФ |',
'| C6 | Мелкий | melky.ru | масс-маркет | лидер | РФ |','',
'BLOCK 06B — СМЕЖНЫЕ','',
'| Название | Известность и масштаб |','|---|---|','| Чужая | лидер |',''
].join('\n');

var failed=0;
function check(n,a,e){var A=JSON.stringify(a),E=JSON.stringify(e);
  if(A===E)console.log('  ok   '+n);else{failed++;console.log('  FAIL '+n+'\n       ждали: '+E+'\n       факт:  '+A);}}
function cell(text,compId){
  var line=text.split('\n').filter(function(l){return l.indexOf('| '+compId+' |')===0;})[0]||'';
  return (line.split('|')[5]||'').trim();
}

processM3Fame(FULL,{geoMarket:'Россия'}).then(function(out){
  console.log('processM3Fame');
  check('лидер рынка размечен с числом', cell(out,'C1'), 'лидер · 40 000/мес');
  check('27% от лидера — тоже лидер',     cell(out,'C2'), 'лидер · 11 000/мес');
  check('7.5% от лидера — заметный',      cell(out,'C3'), 'заметный · 3 000/мес');
  check('ниже порога 100/мес — нишевый',  cell(out,'C4'), 'нишевый-малый · 80/мес');
  check('без сайта не меряем',            cell(out,'C5'), 'не замерено');
  check('нулевой спрос — не замерено',    cell(out,'C6'), 'не замерено');
  check('соседнюю таблицу не трогаем',    /\| Чужая \| лидер \|/.test(out), true);
  check('в Wordstat ушли только с сайтом', calls, ['Jivo','Envybox','Carrot quest','Ловец лидов','Мелкий']);
  check('markdown-обвес снят с названия',  calls.indexOf('Carrot quest')>=0, true);
  check('блок «как замерена» приклеен',   /### Известность — как замерена/.test(out), true);
  check('порог показан числом',           /от 10 000/.test(out), true);
  // Доля внимания считается КОДОМ от тех же замеров — проверяем арифметику:
  // сумма долей обязана давать сто процентов, иначе блок врёт о рынке.
  var shr = out.match(/### BLOCK 06_4 — Доля внимания[\s\S]*/);
  check('блок доли внимания появился', !!shr, true);
  var nums = shr ? (shr[0].match(/\|\s*(\d+[,.]\d)%\s*\|/g) || []).map(function(x){
    return parseFloat(x.replace(/[^\d,.]/g,'').replace(',','.')); }) : [];
  check('долей столько же, сколько замеров', nums.length, 4);
  check('сумма долей — сто процентов', Math.abs(nums.reduce(function(a,b){return a+b;},0) - 100) < 0.2, true);
  // Полный отказ источника: оценки модели не затираем
  DEMAND={}; calls=[];
  return processM3Fame(FULL,{geoMarket:'Россия'});
}).then(function(out2){
  check('при отказе источника оценка цела', cell(out2,'C1'), 'лидер');
  check('при отказе честно помечено', /не замерена в этом прогоне/.test(out2), true);
  console.log(failed===0?'\nвсё сошлось':'\nпровалов: '+failed);
}).catch(function(e){ 
// Доля внимания считается кодом от тех же замеров: сумма долей должна давать
// сто процентов, иначе блок врёт о рынке, а не просто округляет.
(function(){
  var m=out.match(/### BLOCK 06_4 — Доля внимания[\s\S]*/);
  check('блок доли внимания появился', !!m, true);
  if(!m) return;
  var nums=(m[0].match(/\| (\d+[,.]\d)% \|/g)||[]).map(function(x){return parseFloat(x.replace(/[^\d,.]/g,'').replace(',','.'));});
  check('долей столько же, сколько замеров', nums.length, 3);
  var sum=nums.reduce(function(a,b){return a+b;},0);
  check('сумма долей — сто процентов', Math.abs(sum-100) < 0.2, true);
})();

console.log('ИСКЛЮЧЕНИЕ: '+e.message); });
