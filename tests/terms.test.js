ObjC.import('Foundation');
// Термины и умные сокращения. Владелица 14.09: «не все маркетологи понимают,
// что такое jobs to be done, VoC, СМБ» — пояснение должно всплывать у самого
// слова, а не лежать списком в хвосте модуля. Здесь же — разбор хук-кандидатов
// из «Мастерской офферов»: они приходят скобкой с кавычками, и прежний разбор
// делал из обёртки отдельные пункты («(» и ««текст» (»).
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
function grab(n){var i=SRC.indexOf('function '+n+'(');if(i<0)throw new Error('нет '+n);var d=0;
 for(var k=SRC.indexOf('{',i);k<SRC.length;k++){if(SRC[k]==='{')d++;else if(SRC[k]==='}'){d--;if(!d)return SRC.slice(i,k+1);}}}
function grabConst(n){var i=SRC.indexOf('const '+n+' = {');if(i<0)throw new Error('нет '+n);var d=0;
 for(var k=SRC.indexOf('{',i);k<SRC.length;k++){if(SRC[k]==='{')d++;else if(SRC[k]==='}'){d--;
   return SRC.slice(i,k+1).replace(/^const /,'var ')+';';}}}
console.log('tests/terms.test.js');
eval(grabConst('СЛОВАРЬ_БАЗА'));
eval(grab('escHtml')); eval(grab('найтиБлокАббревиатур')); eval(grab('собратьСловарь'));
eval(grab('внеСсылок')); eval(grab('поТексту')); eval(grab('подсказкиТерминов'));
var fails=0;
function ok(n,g,w){var r=JSON.stringify(g)===JSON.stringify(w);
 if(!r){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}

// Ровно то, что модель напечатала в живом M5 (скрин владелицы 14.09).
var текст=['## Банк хуков','','| # | Цитата |','|---|---|','',
'**Легенда терминов:**','',
'- **TAM/SAM/SOM**: общий рынок / доступный рынок / обслуживаемый рынок.',
'- **JTBD**: работа, которую клиент хочет «нанять продукт на».',
'- **VoC**: язык и реальные боли аудитории по открытым каналам.','',
'**Итог / Следующие шаги:**','','- 1. Проверить, хватит ли болей'].join('\n');
var строки=текст.split('\n');
var блок=найтиБлокАббревиатур(строки);
ok('блок «Легенда терминов» найден', !!блок, true);
ok('в блок не утащило «Итог»', /Итог/.test(строки.slice(блок.начало,блок.конец).join('')), false);
ok('заголовок «Аббревиатуры» тоже ловится',
   !!найтиБлокАббревиатур(['## Аббревиатуры','- CJM — путь клиента']), true);
var сл=собратьСловарь(текст);
ok('толк модели главнее базового', сл['JTBD'], 'работа, которую клиент хочет «нанять продукт на».');
ok('составной термин разобран', !!сл['TAM/SAM/SOM'], true);
ok('базовые термины есть и без блока', собратьСловарь('пусто')['СМБ'], 'малый и средний бизнес');
var h=подсказкиТерминов('<p>Владельцы СМБ и JTBD: смотри VoC и ещё раз VoC.</p>', сл);
ok('СМБ получил подсказку', /<abbr class="term" title="малый и средний бизнес">СМБ<\/abbr>/.test(h), true);
ok('подсказка вешается на первое вхождение', (h.match(/<abbr/g)||[]).length, 3);

// Хук-кандидаты: обёртка не должна становиться пунктом списка.
eval(readFile(ROOT+'/tests/render-harness.js'));
var t=['## BLOCK 17B — Мастерская офферов',
'| Offer_ID | Hook | Боль | Результат |','|---|---|---|---|',
'| O-1 | («Мгновенно получайте контакты», «Перестаньте терять заявки», «Окно для роста») | Перегруз | Контроль |'].join('\n');
var r=renderResearchHTML(t,{});
var стр=r.scripts.filter(function(x){return x.indexOf('renderWorkbench(')===0;})[0];
var D=JSON.parse(стр.slice('renderWorkbench('.length, стр.length-2));
ok('хуков ровно три', D[0][1].length, 3);
ok('скобки и кавычки сняты', D[0][1][0], 'Мгновенно получайте контакты');
ok('пустых пунктов нет', D[0][1].filter(function(x){return !/[А-Яа-я]/.test(x);}).length, 0);

console.log(fails?('ПРОВАЛЕНО: '+fails):'  всё зелёное');
