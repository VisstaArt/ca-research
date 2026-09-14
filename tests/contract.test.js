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
check('M3 — по-нишевый', C.isPerNiche('M3'), true);
check('M2 (разведка ниш) — глобальный', C.isPerNiche('M2'), false);
check('ниши из брифа', C.nichesOf({ selectedNiche: 'А, Б' }), ['А', 'Б']);
check('resKey различает ниши', C.resKey({ id: 'M3', niche: 'А' }), 'M3@@А');

var t = C.parseMdTables('## BLOCK 07 — VoC\n| A | B |\n|---|---|\n| x | y |\n| z | w |\n');
check('parseMdTables: одна таблица', t.length, 1);
check('parseMdTables: заголовок блока', t[0].heading, 'BLOCK 07 — VoC');
check('parseMdTables: строки', t[0].rows, [{ A: 'x', B: 'y' }, { A: 'z', B: 'w' }]);

var res = [
  { id: 'M2', niche: '', content: '# карта', at: '2026-08-01' },
  { id: 'M3', niche: 'Ниша А', content: '## BLOCK 06 — Конкуренты\n| Название | Сайт/URL |\n|---|---|\n| Икс | x.ru |\n', at: '2026-08-02' },
  { id: 'M5', niche: 'Ниша А', content: 'Error: API 429', at: '2026-08-03', failed: true, error: 'Error: API 429' },
  { id: 'M3', niche: 'Ниша Б', content: '## BLOCK 06 — Конкуренты\n| Название | Сайт/URL |\n|---|---|\n| Игрек | y.ru |\n', at: '2026-08-04' },
  // «Сирота» — по-нишевый модуль без ниши, с прогонов до введения модели по нишам
  { id: 'M6', niche: '', content: 'старое', at: '2026-07-01' }
];
var pkg = C.buildAgentPackage({ name: 'Тест', selectedNiche: 'Ниша А, Ниша Б' }, 'Russian', res, 'отчёт',
  { titleOf: function (id) { return 'Название ' + id; } });

check('schema_version', pkg.schema_version, 3);
check('brand_assets собирается из брифа',
  C.buildAgentPackage({ name: 'Т', selectedNiche: 'Н',
    brandLogo: 'https://x.ru/l.svg', brandColors: '#0ABAB5, inherit, #171512,rgba(0',
    brandFonts: 'Montserrat, Source Serif 4, Montserrat',
    socials: 'https://t.me/x\nне ссылка\nhttps://vk.com/x' }, 'Russian', [], '').brand_assets,
  { logo: 'https://x.ru/l.svg', colors: ['#0ABAB5', '#171512'],
    fonts: ['Montserrat', 'Source Serif 4'],
    socials: ['https://t.me/x', 'https://vk.com/x'] });
check('обе ниши на месте', Object.keys(pkg.research_by_niche).sort(), ['Ниша А', 'Ниша Б']);
check('упавший модуль в сводке', pkg.failed_modules, [{ module: 'M5', niche: 'Ниша А', error: 'Error: API 429', at: '2026-08-03' }]);
check('titleOf подставлен', pkg.research_by_niche['Ниша А'].modules.M3.title, 'Название M3');
check('status упавшего модуля', pkg.research_by_niche['Ниша А'].modules.M5.status, 'failed');
check('status нормального модуля', pkg.research_by_niche['Ниша А'].modules.M3.status, 'ok');
// Главное, ради чего schema_version подняли до 3: ниши не должны смешиваться
check('конкуренты ниши А', pkg.research_by_niche['Ниша А'].key_data.competitors, [{ 'Название': 'Икс', 'Сайт/URL': 'x.ru' }]);
check('конкуренты ниши Б', pkg.research_by_niche['Ниша Б'].key_data.competitors, [{ 'Название': 'Игрек', 'Сайт/URL': 'y.ru' }]);
check('сирота отброшена', pkg.research_by_niche['Ниша А'].modules.M9, undefined);

// Ловушка номеров блоков: «BLOCK 04» не должен цепляться за «BLOCK 04_0».
// Именно на ней контент-машина полгода получала в AUDIENCE_SEGMENTS список
// источников вместо сегментов — таблица источников в «Разведке ниш» стоит ПЕРВОЙ.
var mods = { M2: { tables: {
  'BLOCK 04_0 — Источники разведки': [{ 'URL': 'https://x.ru' }],
  'BLOCK 04 — Target Audience Segments': [{ 'Сегмент': 'Владельцы магазинов' }],
  'BLOCK 04_1 — Service Effectiveness': [{ 'Ниша': 'A' }]
} } };
check('BLOCK 04 берёт сегменты, а не источники', C.pickTable(mods, 'M2', 'BLOCK 04'),
  [{ 'Сегмент': 'Владельцы магазинов' }]);
check('BLOCK 04_0 берётся отдельно', C.pickTable(mods, 'M2', 'BLOCK 04_0'),
  [{ 'URL': 'https://x.ru' }]);
check('BLOCK 04_1 берётся отдельно', C.pickTable(mods, 'M2', 'BLOCK 04_1'),
  [{ 'Ниша': 'A' }]);
// Та же ловушка у буквенных подблоков
var m2 = { M5: { tables: {
  'BLOCK 07 — Voice of Customer': [{ 'Цитата': 'раз' }],
  'BLOCK 07A — Raw language': [{ 'Цитата': 'два' }],
  'BLOCK 07C — Альтернативы': [{ 'Альтернатива': 'ничего не делать' }]
} } };
check('BLOCK 07 не цепляет 07A и 07C', C.pickTable(m2, 'M5', 'BLOCK 07'),
  [{ 'Цитата': 'раз' }]);
check('BLOCK 07C берётся отдельно', C.pickTable(m2, 'M5', 'BLOCK 07C'),
  [{ 'Альтернатива': 'ничего не делать' }]);


// ── Фильтр сопоставимости конкурентов (решение владелицы 10.09.2026) ────────
// Проверяем ровно то, ради чего фильтр заведён: несопоставимые игроки не
// должны попадать в список, по которому M3 ищет отзывы об их клиентах.
// И отдельно — что старые прогоны без колонки работают как раньше.
(function () {
  var src = readFile(ROOT + '/app.jsx');
  function grab(name) {
    var i = src.indexOf('function ' + name + '(');
    if (i < 0) throw new Error('нет функции ' + name);
    var d = 0;
    for (var k = src.indexOf('{', i); k < src.length; k++) {
      if (src[k] === '{') d++;
      else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
    }
  }
  // eval внутри функции в этом движке не отдаёт локальные имена созданной
  // функции — кладём в глобальную область явно.
  globalThis.parseMdTables = C.parseMdTables;
  eval(grab('competitorsFromM2'));

  var head = '#### BLOCK 06 — Competitor Map\n';
  var withCol = head +
    '| Comp_ID | Название | Сопоставимость | Сайт/URL |\n|---|---|---|---|\n' +
    '| C001 | Малый Игрок | нишевый · средний · регион · зрелая → сравнимы | a.ru |\n' +
    '| C002 | Титан | крупный · премиум · федеральный · зрелая → ориентир, не эталон | b.ru |\n' +
    '| C003 | Сосед | средний · средний · регион · молодая → сравнимы | c.ru |\n';
  check('несопоставимые конкуренты отсеиваются',
        competitorsFromM2({ content: withCol }, { name: 'Мы' }), ['Малый Игрок', 'Сосед']);

  var noCol = head + '| Comp_ID | Название | Сайт/URL |\n|---|---|---|\n' +
    '| C001 | Малый Игрок | a.ru |\n| C002 | Титан | b.ru |\n';
  check('без колонки поведение прежнее',
        competitorsFromM2({ content: noCol }, { name: 'Мы' }), ['Малый Игрок', 'Титан']);
})();


// Офферы вернулись в цепочку 12.09.2026 — проверяем, что их блоки доезжают до
// контракта под своими именами, а не теряются между M7 и CONTENT.
(function(){
  var res2=[{ id:'M7', niche:'Ниша А', at:'2026-09-12', content:
    '## BLOCK 17 FINAL — Финальные офферы\n| Offer_ID | Заголовок |\n|---|---|\n| F1 | Верните ушедших |\n\n'+
    '## BLOCK 17B — Мастерская офферов\n| Offer_ID | Hook |\n|---|---|\n| O-1 | Не теряйте тех, кто пришёл |\n\n'+
    '## BLOCK 23 — Главная ставка\n| Элемент | Формулировка |\n|---|---|\n| Ставка одной фразой | Возврат важнее привлечения |\n' }];
  var p2=C.buildAgentPackage({name:'Т',selectedNiche:'Ниша А'},'Russian',res2,'');
  var kd=p2.research_by_niche['Ниша А'].key_data;
  check('финальные офферы в контракте', kd.OFFERS_FINAL, [{'Offer_ID':'F1','Заголовок':'Верните ушедших'}]);
  check('мастерская офферов в контракте', kd.OFFER_WORKBENCH, [{'Offer_ID':'O-1','Hook':'Не теряйте тех, кто пришёл'}]);
  check('главная ставка в контракте', kd.MAIN_BET, [{'Элемент':'Ставка одной фразой','Формулировка':'Возврат важнее привлечения'}]);
})();


// Каналы заказчика (BLOCK 24D) — машинный признак для контент-машины,
// вместо сопоставления по URL. Строка обязана доехать до CLIENT_CHANNELS.
(function(){
  var res5=[{ id:'M4', niche:'Н', at:'2026-09-14', content:
    '## BLOCK 24D — Каналы заказчика\n| Площадка | Ссылка | Постов за период | Период |\n|---|---|---|---|\n| Telegram | https://t.me/x | 14 | 30 дней |\n' }];
  var p5=C.buildAgentPackage({name:'Т',selectedNiche:'Н'},'Russian',res5,'');
  check('каналы заказчика в контракте', p5.research_by_niche['Н'].key_data.CLIENT_CHANNELS,
    [{'Площадка':'Telegram','Ссылка':'https://t.me/x','Постов за период':'14','Период':'30 дней'}]);
})();


// Блокирующие поля не должны зависеть от того, положила ли модель их в
// CHART_DATA. Ограничения и хуки есть в таблицах блоков ВСЕГДА; пустое
// GUARDRAILS помечает нишу «писать нельзя» без единой ошибки в логах —
// молчаливый отказ, который ищут полдня.
(function () {
  var res3 = [
    { id:'M6', niche:'Н', at:'2026-09-13', content:
      '## BLOCK 12B — Ограничения для контента\n| # | Правило | На основе |\n|---|---|---|\n'
      + '| 1 | Не обещать гарантированный рост | страх 3 |\n' },
    { id:'M5', niche:'Н', at:'2026-09-13', content:
      '## BLOCK 07B — Банк хуков\n| Цитата-хук | Тема |\n|---|---|\n| Люди заходят и уходят | потеря |\n' },
  ];
  var p3 = C.buildAgentPackage({ name:'Т', selectedNiche:'Н' }, 'Russian', res3, '');
  var kd = p3.research_by_niche['Н'].key_data;
  check('ограничения взяты из таблицы, когда CHART_DATA пуст',
    kd.GUARDRAILS, ['Не обещать гарантированный рост']);
  check('хуки взяты из таблицы, когда CHART_DATA пуст',
    kd.HOOK_BANK, ['Люди заходят и уходят']);
  // А когда CHART_DATA есть — берём его: там уже отобранное, а не вся таблица.
  var res4 = [{ id:'M6', niche:'Н', at:'2026-09-13',
    chartData:{ guardrails:['из chart'] },
    content:'## BLOCK 12B — Ограничения\n| # | Правило |\n|---|---|\n| 1 | из таблицы |\n' }];
  var p4 = C.buildAgentPackage({ name:'Т', selectedNiche:'Н' }, 'Russian', res4, '');
  check('CHART_DATA главнее таблицы', p4.research_by_niche['Н'].key_data.GUARDRAILS, ['из chart']);
})();

console.log(failed === 0 ? '\nвсё сошлось' : '\nПРОВАЛОВ: ' + failed);
