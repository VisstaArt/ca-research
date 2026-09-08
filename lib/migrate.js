// Перенос: проекты нынешнего инструмента → клиенты и рынки оболочки.
//
// Написано 07.09.2026, когда владелица открыла оболочку и не увидела своих
// проектов: «это же один сервис». Она права — пустая оболочка рядом с полным
// инструментом это не новый экран, а потеря данных на вид.
//
// Суть переезда, ради которого всё и затевалось (ИНТЕРФЕЙС-МОДУЛЯ-СВОД.md §1):
// одна строка старого «проекта» держит В СЕБЕ и бренд, и рынок. Имя, сайт и
// суть продукта — это КЛИЕНТ, он общий для всех стран. Страна и язык — это
// РЫНОК. Один бренд на Россию и Турцию давал две строки с продублированным
// брендом. Здесь мы их расцепляем: бренды схлопываются по имени, рынки
// раскладываются под ними.
//
// Чистые функции, ни React, ни DOM, ни сети — поэтому проверяются бесплатно
// (tests/migrate.test.js) на встроенном в macOS движке JS.
(function (root) {
  // Язык в старых записях лежит по-английски ('Russian'), а человеку показываем
  // по-русски. Незнакомый язык отдаём как есть, а не подменяем на «Русский»:
  // молча соврать про язык хуже, чем показать непривычное слово.
  const LANGS = {
    russian: 'Русский', english: 'Английский', turkish: 'Турецкий',
    arabic: 'Арабский', german: 'Немецкий', kazakh: 'Казахский',
  };
  const langRu = l => LANGS[String(l || '').trim().toLowerCase()] || String(l || '').trim() || 'Русский';

  const norm = s => String(s || '').trim();
  const key = s => norm(s).toLowerCase();

  // Строка считается исследованной, если у неё есть хоть один готовый модуль.
  // Именно этим оболочка решает, отпирать ли остальные модули, поэтому здесь
  // не «проект существует», а «есть результат».
  const hasResearch = row => Array.isArray(row.results) && row.results.some(r => r && r.content);

  function buildShellData(rows) {
    const clients = [];
    const byClient = {};
    for (const row of (rows || [])) {
      const b = (row && row.brief) || {};
      const brand = norm(b.name) || 'Без названия';
      const ck = key(brand);
      if (!byClient[ck]) {
        byClient[ck] = {
          id: 'c_' + ck.replace(/[^a-zа-я0-9]+/gi, '_').slice(0, 24),
          name: brand,
          domain: norm(b.siteUrl).replace(/^https?:\/\//, '').replace(/\/$/, ''),
          what: norm(b.result) || norm(b.niche),
          markets: [],
          fromOld: true,
        };
        clients.push(byClient[ck]);
      }
      const c = byClient[ck];
      // Рынок компании берём из «география рынка», а если её не заполняли —
      // из «география компании». Так же, как это делают все промпты модулей.
      const countryName = norm(b.geoMarket) || norm(b.geoCompany) || 'Не указана';
      const lang = langRu(row.lang);
      const mk = key(countryName) + '|' + key(lang);
      let m = c.markets.find(x => x.mkey === mk);
      if (!m) {
        m = { id: 'm_' + c.markets.length + '_' + c.id, mkey: mk, country: '',
              countryName, lang, research: false, projectIds: [] };
        c.markets.push(m);
      }
      // Один рынок мог исследоваться несколькими старыми проектами (разные
      // ниши заводили отдельной строкой). Держим все id: по ним оболочка
      // открывает нужный проект в инструменте, ничего не склеивая насильно.
      if (row.id) m.projectIds.push(row.id);
      if (hasResearch(row)) m.research = true;
    }
    return { clients };
  }

  root.CAMigrate = { buildShellData: buildShellData, langRu: langRu };
})(typeof window !== 'undefined' ? window : globalThis);
