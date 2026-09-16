ObjC.import('Foundation');
// Оболочка помнит, на каком экране был человек. Обновление страницы
// выбрасывало его в бриф, и открытое приходилось искать заново (владелица
// 16.09). Проверяется сам механизм, без браузера.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var H=readFile(ROOT+'/shell.html');
console.log('tests/shell-nav.test.js');
var fails=0;
function check(n,ok){ if(ok) console.log('  ok   '+n); else { fails++; console.log('  FAIL '+n); } }

check('переход по экрану запоминается', /localStorage\.setItem\('cm-экран'/.test(H));
check('при загрузке экран восстанавливается', /localStorage\.getItem\('cm-экран'/.test(H));
// Ключ мог остаться от прежней версии оболочки, где такого экрана уже нет:
// тогда нельзя показать пустоту, надо честно открыть бриф.
check('несуществующий экран не открывается', /getElementById\('s-' \+ прошлый\)/.test(H));
check('запасной вариант — бриф', /раздел\('research', false\);[\s\S]{0,40}экран\('rbrief'\);/.test(H));
// Раздел меню должен открыться тот, в котором лежит экран, иначе строка
// подсвечена, а список слева — от другого раздела.
check('раздел меню подбирается по экрану', /closest\('\[data-list\]'\)/.test(H));

// Кнопка перезапуска разведки стоит внизу длинной страницы: после нажатия
// содержимое схлопывается, и без прокрутки наверх человек смотрит в пустоту
// (владелица 16.09, трижды подряд об одном и том же).
var A=readFile(ROOT+'/app.jsx'), P=readFile(ROOT+'/platform.js');
check('рамка просит прокрутить страницу вверх', /postMessage\(\{ ca: 'вверх' \}/.test(A));
check('оболочка эту просьбу выполняет', /d\.ca !== 'вверх'/.test(P) && /scrollTo/.test(P));

// Фон отражён по горизонтали: блики в правом верхнем углу (владелица 16.09).
check('фон вынесен отдельным слоем', /body::before\{[^}]*var\(--bgimg\)/.test(H));
check('и отражён по горизонтали', /body::before\{[^}]*scaleX\(-1\)/.test(H));
check('в самом body картинки больше нет', H.indexOf('var(--bgimg) center/cover no-repeat fixed')<0);

console.log(fails?('ПРОВАЛЕНО: '+fails):'всё сошлось');
