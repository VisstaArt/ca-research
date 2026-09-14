ObjC.import('Foundation');
// Итог модуля: вырезается из текста и показывается карточкой наверху.
// Отдельно проверяем случай, когда раздела нет — тогда текст обязан остаться
// целым: молча потерять хвост модуля хуже, чем не показать карточку.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
function grab(n){
  var i=SRC.indexOf('function '+n+'('); if(i<0) throw new Error('нет '+n);
  var d=0;
  for(var k=SRC.indexOf('{',i);k<SRC.length;k++){ if(SRC[k]==='{')d++; else if(SRC[k]==='}'){d--; if(!d) return SRC.slice(i,k+1);} }
}
console.log('tests/module-summary.test.js');
eval(grab('escHtml')); eval(grab('mdInlineSafe'));
eval(grab('splitModuleSummary')); eval(grab('renderModuleSummary')); eval(grab('собратьШаги')); eval(grab('сБольшой'));
var fails=0;
function check(n,g,w){var ok=JSON.stringify(g)===JSON.stringify(w);
 if(!ok){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}

var text='# Модуль\n\n## BLOCK 24 — Каналы\n\n| A |\n|---|\n| x |\n\n'
 +'## ИТОГ МОДУЛЯ\n\n### Что узнали\n\n- Первое\n- Второе\n\n'
 +'### Что это значит\n\n- Смысл\n\n### Что делаем дальше\n\n- Действие\n';
var c=splitModuleSummary(text);
check('пункты «что узнали»', c.summary.learned, ['Первое','Второе']);
check('пункты «что это значит»', c.summary.means, ['Смысл']);
check('пункты «что делаем»', c.summary.next, ['Действие']);
check('итог убран из тела', /ИТОГ МОДУЛЯ|Первое/.test(c.body), false);
check('таблица в теле осталась', /BLOCK 24/.test(c.body), true);

var h=renderModuleSummary(c.summary);
check('три подзаголовка', (h.match(/class="smh"/g)||[]).length, 3);
check('заголовок блока на месте', /Что дал этот модуль/.test(h), true);
check('существо дела отдельно от следствий', /sm-main[\s\S]*sm-col[\s\S]*sm-side/.test(h), true);
check('пункты списком', (h.match(/<li>/g)||[]).length, 4);

var plain='# Модуль\n\n## BLOCK 24 — Каналы\n\n| A |\n|---|\n| x |\n';
var c2=splitModuleSummary(plain);
check('без итога тело не тронуто', c2.body, plain);
check('без итога карточки нет', renderModuleSummary(c2.summary), '');

// Хвост после итога не должен потеряться
var withTail=text+'\n## BLOCK 25 — Хвост\n\n| B |\n|---|\n| y |\n';
check('хвост после итога сохранён', /BLOCK 25/.test(splitModuleSummary(withTail).body), true);


// Модель ставит двоеточие ВНУТРИ звёздочек: «**Итог / Следующие шаги:**».
// Прежняя маска ждала его снаружи, раздел не находился — а почиститьХвост
// его всё равно вырезал как дубль. Шаги пропадали из отчёта совсем
// (владелица 14.09: «этот отчёт в начале всё такой же кривой»).
var сЖирным='# Модуль\n\n## BLOCK 06 — Карта\n\n| A |\n|---|\n| x |\n\n'
 +'**Итог / Следующие шаги:**\n\n- Сформировать отличие\n- Готовить кейсы\n';
check('шаги найдены при двоеточии внутри звёздочек',
      собратьШаги(сЖирным), ['Сформировать отличие','Готовить кейсы']);
var своднаяКарта=renderModuleSummary({learned:[], means:[], next:собратьШаги(сЖирным)});
check('и доехали до карточки', /Готовить кейсы/.test(своднаяКарта), true);
check('пункт сводки с заглавной',
      /<li>Публичных/.test(renderModuleSummary({learned:['публичных источников мало'],means:[],next:[]})), true);

// Разделов «Итог / Следующие шаги» в модуле пять, а не один, и первый —
// у блока источников: там шаги про наш процесс, а не про рынок заказчика.
// В живом M3 карточка состояла из них целиком (владелица 14.09).
var многоРазделов=['## BLOCK 05 — Индекс открытых источников','','| # |','|---|','| 1 |','',
'Итог / Следующие шаги:','','- Использовать подтверждённые источники','- Расширить мониторинг отзывов','',
'## BLOCK 06 — Карта рынка','','| Название |','|---|','| Envybox |','',
'Итог / Следующие шаги:','','- Сформировать уникальное отличие','- Готовить кейсы с большими магазинами','',
'## BLOCK 06_3 — Позиционирование','','| Сегмент |','|---|','| магазины |','',
'Итог / Следующие шаги:','','- Быть «русским AI» с интеграциями'].join('\n');
check('шаги собраны из ВСЕХ блоков, служебные отброшены', собратьШаги(многоРазделов),
      ['Сформировать уникальное отличие','Готовить кейсы с большими магазинами','Быть «русским AI» с интеграциями']);
check('повтор одного шага в двух блоках не дублируется',
      собратьШаги('## BLOCK 06 — Карта\n\nИтог / Следующие шаги:\n\n- Одно и то же\n\n'
                + '## BLOCK 07 — Голос\n\nИтог / Следующие шаги:\n\n- Одно и то же.\n').length, 1);
console.log(fails? '\nПРОВАЛОВ: '+fails : '\nвсё сошлось');
