// Проверка переноса проектов в клиентов и рынки.
// Запуск:  osascript -l JavaScript tests/migrate.test.js
ObjC.import('Foundation');
function rd(p){ return $.NSString.stringWithContentsOfFileEncodingError($(p), $.NSUTF8StringEncoding, null).js; }
var base = '/Users/apr/Projects/ca-research/';
eval(rd(base + 'lib/migrate.js'));
var M = globalThis.CAMigrate;

var failed = 0;
function check(name, got, want) {
  var a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { console.log('  ok   ' + name); }
  else { failed++; console.log('  ПРОВАЛ ' + name + '\n    ждали: ' + b + '\n    вышло: ' + a); }
}

var rows = [
  { id:'p1', lang:'Russian', brief:{ name:'Ловец Лидов', siteUrl:'https://lovec.ru/',
      geoMarket:'Россия', result:'Больше заявок' }, results:[{content:'текст'}] },
  // тот же бренд, другая страна — обязан схлопнуться в ОДНОГО клиента
  { id:'p2', lang:'Turkish', brief:{ name:'Ловец Лидов', siteUrl:'https://lovec.ru/',
      geoMarket:'Турция' }, results:[] },
  // тот же бренд и та же страна, но вторая ниша отдельной строкой — ОДИН рынок
  { id:'p3', lang:'Russian', brief:{ name:'ловец лидов ', geoMarket:'Россия' }, results:[] },
  { id:'p4', lang:'English', brief:{ name:'Другой бренд', geoCompany:'ОАЭ' }, results:[] },
];
var d = M.buildShellData(rows);

check('брендов стало два, а не четыре', d.clients.length, 2);
check('имя бренда взято как записано', d.clients[0].name, 'Ловец Лидов');
check('регистр и пробелы не плодят двойника', d.clients[0].markets.length, 2);
check('сайт без протокола и хвоста', d.clients[0].domain, 'lovec.ru');
check('две ниши одной страны — один рынок',
  d.clients[0].markets[0].projectIds, ['p1','p3']);
check('язык показан по-русски', d.clients[0].markets[1].lang, 'Турецкий');
check('рынок с готовым модулем помечен', d.clients[0].markets[0].research, true);
check('рынок без результатов не помечен', d.clients[0].markets[1].research, false);
check('пустой geoMarket подменяется географией компании',
  d.clients[1].markets[0].countryName, 'ОАЭ');
check('незнакомый язык не подменяется молча', M.langRu('Suomi'), 'Suomi');
check('пустой язык — русский по умолчанию', M.langRu(''), 'Русский');
check('пустой вход не падает', M.buildShellData(null), { clients: [] });
check('проект без имени не теряется', M.buildShellData([{id:'x',brief:{}}]).clients[0].name, 'Без названия');
check('модуль-заглушка без содержимого не считается исследованием',
  M.buildShellData([{id:'y',brief:{name:'Б'},results:[{content:''}]}]).clients[0].markets[0].research, false);

console.log(failed === 0 ? '\nвсё сошлось' : '\nпровалов: ' + failed);
