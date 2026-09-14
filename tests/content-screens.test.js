ObjC.import('Foundation');
// Экраны контент-машины. Проверяем ровно то, что перенесено решениями с её
// стороны (ПЕРЕДАЧА-ЭКРАНОВ.md) и сломать легче всего при правке оформления.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
console.log('tests/content-screens.test.js');
var fails=0;
function ok(n,g,w){var r=JSON.stringify(g)===JSON.stringify(w);
 if(!r){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}

var src=readFile(ROOT+'/content.js');
try { new Function(src); console.log('  ok   content.js разбирается'); }
catch(e){ fails++; console.log('  FAIL content.js не разбирается: '+e.message); }

// Кнопка «Одобрить» обязана быть недоступна при блокировке: считает это
// контент-машина (can_approve), интерфейс только показывает (решение Р2).
ok('кнопка одобрения закрыта при блокировке',
   /can_approve \? '' : ' disabled'/.test(src) || /м\.can_approve \? '' : ' disabled'/.test(src), true);
// Знаменателя расхода нет и рисовать его нельзя.
// Знаменатель нельзя ни посчитать, ни нарисовать: он существует только в
// пояснении, почему его нет.
var расход=src.slice(src.indexOf('function экранРасхода'), src.indexOf('// ── Ключи'));
ok('знаменатель расхода нигде не рисуется', /quota/.test(расход), false);
ok('расход объясняет, почему нет знаменателя', /кредиты в тарифе не назначены/.test(src), true);
// Публикация вручную равноправна автомату.
ok('вручную и автоматом показываются оба', /вручную/.test(src) && /автоматом/.test(src), true);
// secret_ref не запрашивается никогда.
// В select ключей secret_ref не попадает никогда — только в пояснении рядом.
ok('secret_ref не уходит в запрос',
   /provider_keys\?select=[^']*secret_ref/.test(src), false);
// Запросы под токеном пользователя, а не сервисным ключом.
ok('ходим с токеном вошедшего', /getAccessToken\(\)/.test(src), true);

var shell=readFile(ROOT+'/shell.html');
ok('content.js подключён в оболочке', /<script src="content\.js"><\/script>/.test(shell), true);
ok('оформление экранов на месте', /\.mcard\{/.test(shell) && /\.mseg\{/.test(shell), true);

var plat=readFile(ROOT+'/platform.js');
ok('смена проекта перерисовывает экраны', /CAContent\.обновить/.test(plat), true);

var usage=readFile(ROOT+'/api/usage.js');
// Прямая запись в usage_counters затирает чужое слагаемое: строка одна на
// (клиент, период). Прибавлять надо функцией базы.
ok('расход прибавляется через add_usage', /rpc\/add_usage/.test(usage), true);


// Запасной расчёт «можно одобрить» обязан совпадать с правилом контент-машины
// СЛОВО В СЛОВО: статус «ждёт решения» И ноль блокирующих находок. Без
// проверки статуса кнопка оживала на уже одобренном и уже вышедшем — это
// вторая публикация.
ok('запасной расчёт проверяет и статус',
   /status === 'pending' && блок === 0/.test(src), true);
ok('заголовок карусели берётся из cover_headline', /cover_headline/.test(src), true);
ok('ручная публикация узнаётся по method', /=== 'manual'/.test(src), true);

console.log(fails?('ПРОВАЛЕНО: '+fails):'  всё зелёное');
