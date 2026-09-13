// Тест замера спроса по нишам (processM2Demand в app.jsx).
//
//     osascript -l JavaScript tests/m12-demand.test.js
//
// Зачем существует: по сумме баллов в BLOCK 04_2 владелица выбирает нишу, в
// которую уходит весь прогон. Балл ставила модель; теперь рядом стоит замер.
// Проверяется, что замер НЕ заменяет балл, что расхождения помечаются, и что
// околонулевые зовут проверить ФРАЗУ, а не вычеркнуть нишу.
ObjC.import('Foundation');
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
function grab(n){
  var i=SRC.indexOf('async function '+n+'('); if(i<0) i=SRC.indexOf('function '+n+'(');
  if(i<0) throw new Error('не найдено: '+n);
  var d=0,j=SRC.indexOf('{',i);
  for(var k=j;k<SRC.length;k++){ if(SRC[k]==='{')d++; else if(SRC[k]==='}'){d--; if(!d) return SRC.slice(i,k+1);} }
}
function grabConst(n){
  var i=SRC.indexOf('\nconst '+n); if(i<0) throw new Error('не найдено: '+n);
  var lines=SRC.slice(i+1).split('\n'), out=[], depth=0;
  for(var k=0;k<lines.length;k++){ out.push(lines[k]);
    var l=lines[k].replace(/\/\/.*$/,'');
    depth+=(l.match(/[\[{]/g)||[]).length-(l.match(/[\]}]/g)||[]).length;
    if(depth<=0 && /;\s*$/.test(l)) break; }
  return out.join('\n');
}
eval(readFile(ROOT+'/lib/contract.js'));
var C=globalThis.CAContract;
globalThis.splitMdRow=C.splitMdRow; globalThis.isMdSeparator=C.isMdSeparator;
['extractMdTableByHeading','spliceMdTableWithHeaders','keywordSourceForMarket',
 'callBrandDemand','processM2Demand'].forEach(function(n){ eval(grab(n)); });
eval(['NICHE_DEMAND_MAX','NICHE_DEMAND_FLOOR'].map(grabConst).join('\n').replace(/^const /gm,'var '));
globalThis.extractMdTableByHeading=extractMdTableByHeading;
globalThis.spliceMdTableWithHeaders=spliceMdTableWithHeaders;
globalThis.keywordSourceForMarket=keywordSourceForMarket;
globalThis.callBrandDemand=callBrandDemand;
globalThis.NICHE_DEMAND_MAX=NICHE_DEMAND_MAX; globalThis.NICHE_DEMAND_FLOOR=NICHE_DEMAND_FLOOR;

// Заглушка только на сеть. Подобрано так, чтобы были все четыре случая:
// согласие, спор в обе стороны и подозрительно малое число.
var DEMAND={'Стоматологии':12000,'Автосервисы':9000,'Клининг офисов':40,
            'Барбершопы':7000,'Ремонт квартир':15000,'Кофейни':60};
var calls=[];
function callWordstat(p,o){ calls.push(p); return Promise.resolve(DEMAND[p]!==undefined?{totalCount:DEMAND[p]}:null); }
function callGoogleAds(){ return Promise.resolve(null); }
globalThis.callWordstat=callWordstat; globalThis.callGoogleAds=callGoogleAds;

var FULL=[
'BLOCK 04_2 — Niche Prioritization Matrix','',
'| Ниша | Спрос (1-5) | Конкуренция (1-5) | ИТОГО | Вердикт |',
'|---|---|---|---|---|',
'| Стоматологии | 5 | 3 | 12 | Идём |',
'| **Клининг офисов** | 5 | 4 | 11 | Идём |',
'| Ремонт квартир | 1 | 2 | 6 | Не идём |',
'| Автосервисы | 4 | 3 | 10 | Под вопросом |',
'| Барбершопы | 3 | 3 | 9 | Под вопросом |',
'| Кофейни | 2 | 2 | 7 | Не идём |',''
].join('\n');

var failed=0;
function check(n,a,e){var A=JSON.stringify(a),E=JSON.stringify(e);
  if(A===E)console.log('  ok   '+n);else{failed++;console.log('  FAIL '+n+'\n       ждали: '+E+'\n       факт:  '+A);}}
function row(t,name){ return (t.split('\n').filter(function(l){return l.indexOf('| '+name+' ')===0||l.indexOf('| **'+name+'**')===0;})[0]||''); }
function cell(t,name,i){ return (row(t,name).split('|')[i]||'').trim(); }

console.log('спрос по нишам');
processM2Demand(FULL,{geoMarket:'Россия'}).then(function(out){
  check('markdown-обвес снят с названия', calls.indexOf('Клининг офисов')>=0, true);
  check('спросили каждую нишу один раз', calls.length, 6);
  check('балл модели не тронут', cell(out,'Стоматологии',2), '5');
  check('замер встал новой колонкой', cell(out,'Стоматологии',6), '12 000');
  check('согласие не помечается', cell(out,'Стоматологии',7), '—');
  check('высокий балл при низком спросе — спорят',
        /спорят/.test(cell(out,'Клининг офисов',7)) || /проверьте фразу/.test(cell(out,'Клининг офисов',7)), true);
  check('околонулевое зовёт проверить ФРАЗУ', /проверьте фразу/.test(cell(out,'Клининг офисов',7)), true);
  check('низкий балл при высоком спросе — спорят', /спорят/.test(cell(out,'Ремонт квартир',7)), true);
  check('шапка получила обе колонки',
        /\| Запросов в месяц \| Сверка \|/.test(out), true);
  check('разделитель под шапкой на 7 колонок', /^\|---\|---\|---\|---\|---\|---\|---\|$/m.test(out), true);
  check('блок пояснения приклеен', /### Спрос по нишам — замер рядом с баллом/.test(out), true);
  check('вердикт не потерян', cell(out,'Стоматологии',5), 'Идём');
  // Повторный проход не должен добавить колонки второй раз
  return processM2Demand(out,{geoMarket:'Россия'});
}).then(function(out2){
  check('повторно не меряем', (out2.match(/Запросов в месяц/g)||[]).length, 2);
  // Полный отказ источника — баллы не затираем
  for (var k in DEMAND) delete DEMAND[k];
  return processM2Demand(FULL,{geoMarket:'Россия'});
}).then(function(out3){
  check('при отказе балл цел', cell(out3,'Стоматологии',2), '5');
  check('при отказе честно помечено', /не замерен в этом прогоне/.test(out3), true);
  console.log(failed===0?'\nвсё сошлось':'\nпровалов: '+failed);
}).catch(function(e){ console.log('ИСКЛЮЧЕНИЕ: '+e.message); });
