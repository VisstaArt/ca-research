ObjC.import('Foundation');
// Список ниш печатался дважды: карточками (04_2) и сырой таблицей (04_1).
// Проверяем обе стороны: дубль убран, но если матрицы нет — таблица остаётся,
// потому что потерять данные хуже, чем показать их дважды.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
function slice2(a,b){var i=SRC.indexOf(a), j=SRC.indexOf(b,i); return SRC.slice(i,j);}
console.log('tests/niches-dup.test.js');
var fails=0;
function check(n,g,w){var ok=JSON.stringify(g)===JSON.stringify(w);
 if(!ok){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}
eval(readFile(ROOT+'/tests/render-harness.js'));
var withMatrix = '## BLOCK 04_1 — Service Effectiveness\n| Ниша | Спрос |\n|---|---|\n| Магазины | высокий |\n\n'
  + '## BLOCK 04_2 — Приоритет ниш\n| Ниша | Спрос (1-5) | Конкуренция (1-5) | Экономика (1-5) | Соответствие бизнесу (1-5) | ИТОГО | Вердикт |\n'
  + '|---|---|---|---|---|---|---|\n| Магазины | 4 | 3 | 4 | 4 | 15 | Идём |\n';
var noMatrix = '## BLOCK 04_1 — Service Effectiveness\n| Ниша | Спрос |\n|---|---|\n| Магазины | высокий |\n';
var a = renderResearchHTML(withMatrix, {});
var b = renderResearchHTML(noMatrix, {});
check('с матрицей таблицы 04_1 нет', /<table/.test(a.html) && a.html.indexOf('высокий')>=0, false);
check('карточки ниш собираются', (a.scripts||[]).join(' ').indexOf('renderNicheBoard')>=0, true);
check('без матрицы таблица осталась', /<table/.test(b.html), true);
// Снимая таблицу-дубль, снимаем и заголовок с описанием: иначе остаётся
// пустой раздел — владелица 15.09: «блок есть, а данных никаких нет».
var сОписанием = '## BLOCK 04_1 — Service Effectiveness\nЗдесь мы определяем, в каких вертикалях продукт работает.\n\n| Ниша | Спрос |\n|---|---|\n| Магазины | высокий |\n\n'
  + '## BLOCK 04_2 — Приоритет ниш\n| Ниша | Спрос (1-5) | Конкуренция (1-5) | Экономика (1-5) | Соответствие бизнесу (1-5) | ИТОГО | Вердикт |\n'
  + '|---|---|---|---|---|---|---|\n| Магазины | 4 | 3 | 4 | 4 | 15 | Идём |\n';
var в = renderResearchHTML(сОписанием, {}).html;
check('заголовок пустого блока убран', в.indexOf('Эффективность услуг по нишам') < 0, true);
check('описание пустого блока убрано', в.indexOf('в каких вертикалях продукт работает') < 0, true);
check('карточки ниш на месте', (renderResearchHTML(сОписанием, {}).scripts||[]).join(' ').indexOf('renderNicheBoard') >= 0, true);

// Тепловая карта только для матрицы оценок. У гэп-анализа бывают текстовые
// колонки («Лучшее у конкурентов», «URL примера») — их красили как оценки, а
// текст пропадал (скрин владелицы 15.09).
(function(){
  var текстовая = '## BLOCK 06_1 — Гэп-анализ\n'
    + '| Критерий | Наше состояние | Лучшее у конкурентов | URL примера |\n|---|---|---|---|\n'
    + '| AI/ML | В брифе | Нет у Meedget | https://x.ru |\n';
  var h = renderResearchHTML(текстовая, {}).html;
  check('текстовый гэп-анализ не красится картой', h.indexOf('rpt-heat') < 0, true);
  check('текст в нём виден', h.indexOf('Нет у Meedget') >= 0, true);
  var матрица = '## BLOCK 06_1 — Гэп-анализ\n| Критерий | Envybox | Callibri |\n|---|---|---|\n'
    + '| Попапы | есть | нет |\n| ИИ | нет | частично |\n';
  check('матрица оценок рисуется картой',
    renderResearchHTML(матрица, {}).html.indexOf('rpt-heat') >= 0, true);
})();

console.log(fails? '\nПРОВАЛОВ: '+fails : '\nвсё сошлось');
