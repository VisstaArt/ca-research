// Тест границы между модулями: lib/contract.js.
//
// Запуск (macOS, без установки чего-либо — движок JS встроен в систему):
//     osascript -l JavaScript tests/contract.test.js
//
// Зачем существует: buildAgentPackage — точка стыка исследования и
// контент-машины. Пока он лежал внутри index.html, проверить его можно было
// только платным прогоном; теперь это чистые функции, и проверка бесплатна.
// Гоняйте перед тем, как отдавать контент-машине новую выгрузку.
ObjC.import('Foundation');
function readFile(p) {
  return $.NSString.stringWithContentsOfFileEncodingError($(p), $.NSUTF8StringEncoding, null).js;
}
var ROOT = $.NSFileManager.defaultManager.currentDirectoryPath.js;
eval(readFile(ROOT + '/lib/contract.js'));
var C = globalThis.CAContract;

var failed = 0;
function check(name, actual, expected) {
  var a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\n       ждали:  ' + e + '\n       факт:   ' + a); }
}

console.log('lib/contract.js');
check('экспортировано функций', Object.keys(C).length, 13);
check('M2 — по-нишевый', C.isPerNiche('M2'), true);
check('M1_2 — глобальный', C.isPerNiche('M1_2'), false);
check('ниши из брифа', C.nichesOf({ selectedNiche: 'А, Б' }), ['А', 'Б']);
check('resKey различает ниши', C.resKey({ id: 'M2', niche: 'А' }), 'M2@@А');

var t = C.parseMdTables('## BLOCK 07 — VoC\n| A | B |\n|---|---|\n| x | y |\n| z | w |\n');
check('parseMdTables: одна таблица', t.length, 1);
check('parseMdTables: заголовок блока', t[0].heading, 'BLOCK 07 — VoC');
check('parseMdTables: строки', t[0].rows, [{ A: 'x', B: 'y' }, { A: 'z', B: 'w' }]);

var res = [
  { id: 'M1_2', niche: '', content: '# карта', at: '2026-08-01' },
  { id: 'M2', niche: 'Ниша А', content: '## BLOCK 06 — Конкуренты\n| Название | Сайт/URL |\n|---|---|\n| Икс | x.ru |\n', at: '2026-08-02' },
  { id: 'M3', niche: 'Ниша А', content: 'Error: API 429', at: '2026-08-03', failed: true, error: 'Error: API 429' },
  { id: 'M2', niche: 'Ниша Б', content: '## BLOCK 06 — Конкуренты\n| Название | Сайт/URL |\n|---|---|\n| Игрек | y.ru |\n', at: '2026-08-04' },
  // «Сирота» — по-нишевый модуль без ниши, с прогонов до введения модели по нишам
  { id: 'M4', niche: '', content: 'старое', at: '2026-07-01' }
];
var pkg = C.buildAgentPackage({ name: 'Тест', selectedNiche: 'Ниша А, Ниша Б' }, 'Russian', res, 'отчёт',
  { titleOf: function (id) { return 'Название ' + id; } });

check('schema_version', pkg.schema_version, 3);
check('обе ниши на месте', Object.keys(pkg.research_by_niche).sort(), ['Ниша А', 'Ниша Б']);
check('упавший модуль в сводке', pkg.failed_modules, [{ module: 'M3', niche: 'Ниша А', error: 'Error: API 429', at: '2026-08-03' }]);
check('titleOf подставлен', pkg.research_by_niche['Ниша А'].modules.M2.title, 'Название M2');
check('status упавшего модуля', pkg.research_by_niche['Ниша А'].modules.M3.status, 'failed');
check('status нормального модуля', pkg.research_by_niche['Ниша А'].modules.M2.status, 'ok');
// Главное, ради чего schema_version подняли до 3: ниши не должны смешиваться
check('конкуренты ниши А', pkg.research_by_niche['Ниша А'].key_data.competitors, [{ 'Название': 'Икс', 'Сайт/URL': 'x.ru' }]);
check('конкуренты ниши Б', pkg.research_by_niche['Ниша Б'].key_data.competitors, [{ 'Название': 'Игрек', 'Сайт/URL': 'y.ru' }]);
check('сирота отброшена', pkg.research_by_niche['Ниша А'].modules.M4, undefined);

console.log(failed === 0 ? '\nвсё сошлось' : '\nПРОВАЛОВ: ' + failed);
