ObjC.import('Foundation');
// Чистка отчёта целиком, тем же путём, что и в живом прогоне: разбор итога
// наверх → почиститьХвост → отрисовка. Владелица 15.09 прошлась по модулям
// построчно, и каждая строка здесь — её замечание.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
eval(readFile(ROOT+'/tests/render-harness.js'));
function тело(n){var i=SRC.indexOf('function '+n+'(');if(i<0)throw new Error('нет '+n);var d=0;
 for(var k=SRC.indexOf('{',i);k<SRC.length;k++){if(SRC[k]==='{')d++;else if(SRC[k]==='}'){d--;if(!d)return SRC.slice(i,k+1);}}}
['почиститьХвост','убратьПустыеПодписи','собратьВыводы','собратьШаги','найтиБлокАббревиатур',
 'splitModuleSummary','собратьСловарь','mdInlineSafe','renderModuleSummary'].forEach(function(n){ globalThis.eval(тело(n)); });
(function(){var i=SRC.indexOf('const СЛОВАРЬ_БАЗА'),d=0;
 for(var k=SRC.indexOf('{',i);k<SRC.length;k++){if(SRC[k]==='{')d++;else if(SRC[k]==='}'){d--;if(!d){
   globalThis.eval(SRC.slice(i,k+1).replace(/^const /,'var ')+';');return;}}}})();
console.log('tests/report-clean.test.js');
var fails=0;
function нет(имя, что){ if(h.indexOf(что)<0) console.log('  ok   '+имя);
  else {fails++; console.log('  FAIL осталось: '+имя);} }
function есть(имя, что){ if(h.indexOf(что)>=0) console.log('  ok   '+имя);
  else {fails++; console.log('  FAIL пропало: '+имя);} }

var t=[
'## BLOCK 24A — Что залетает',
'| Единица | Площадка | Просмотры |','|---|---|---|',
'| Как поднять конверсию | Telegram | не замерено |','',
'**Итог / Следующие шаги:**','',
'- Наибольший отклик у тем с немедленной пользой.','',
'## BLOCK 06_2 — SWOT',
'### Strengths','','| Фактор | Оценка |','|---|---|','| Скорость | сильная |','',
'**Легенда:** С — сильные стороны.','',
'**Комментарий:** конкуренты не отвечают на отзывы.','',
'Вывод: начинать с интернет-магазинов.','',
'---','',
'**Аббревиатуры:**','- JTBD — работа клиента','',
'## BLOCK 07 — Голос клиента',
'| Тема | Цитата |','|---|---|','| | |','',
'## ИТОГ МОДУЛЯ','','### Что узнали','','- Спрос растёт, JTBD у СМБ один.','',
'### Что делаем дальше','','- Собрать цитаты.'].join('\n');

var cut=splitModuleSummary(t);
var h=renderResearchHTML(почиститьХвост(cut.body, !!cut.summary),
                         {словарь:собратьСловарь(cut.body)}).html;
нет('«Итог / Следующие шаги»','Итог / Следующие шаги');
нет('подпись «Легенда:»','Легенда');
нет('подпись «Комментарий:»','Комментарий');
нет('«Вывод:» (уехал в сводку наверху)','Вывод:');
нет('английский заголовок SWOT','Strengths');
нет('список аббревиатур','JTBD — работа');
нет('горизонтальная черта','<hr');
нет('пустая таблица вместе со своим заголовком','Голос клиента');
есть('блок с данными на месте','Что залетает');
есть('текст под снятой подписью сохранён','конкуренты не отвечают на отзывы');
var итог=renderModuleSummary(cut.summary);
if(/Спрос растёт/.test(итог)) console.log('  ok   сводка наверху собрана');
else {fails++; console.log('  FAIL сводка наверху пустая');}

console.log(fails?('ПРОВАЛЕНО: '+fails):'  всё зелёное');
