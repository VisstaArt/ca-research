// Обвязка для проверок отрисовки: достаёт renderResearchHTML и его
// зависимости прямо из app.jsx — тест проверяет живой код, а не копию.
// CSS-константы отчёта сюда не тянем: разметка от них не зависит.
function grab(n){
  var i=SRC.indexOf('async function '+n+'('); if(i<0) i=SRC.indexOf('function '+n+'(');
  if(i<0) throw new Error('нет функции '+n);
  var d=0,j=SRC.indexOf('{',i);
  for(var k=j;k<SRC.length;k++){ if(SRC[k]==='{')d++; else if(SRC[k]==='}'){d--; if(!d) return SRC.slice(i,k+1);} }
}
function grabConstBlock(name, openCh, closeCh){
  var i=SRC.indexOf('const '+name); if(i<0) throw new Error('нет '+name);
  var j=SRC.indexOf(openCh,i);
  if(openCh===closeCh){ var e=SRC.indexOf(closeCh,j+1); return SRC.slice(i,e+1)+';'; }
  var d=0;
  for(var k=j;k<SRC.length;k++){ if(SRC[k]===openCh)d++; else if(SRC[k]===closeCh){d--; if(!d) return SRC.slice(i,k+1)+';'; } }
}
eval(readFile(ROOT+'/lib/contract.js'));
var C=globalThis.CAContract;
globalThis.nichesOf=C.nichesOf; globalThis.resKey=C.resKey;
eval(grabConstBlock('MODULES','[',']').replace(/^const /,'var '));
eval(grabConstBlock('LANG_SELF','{','}').replace(/^const /,'var '));
globalThis.LANG_SELF=LANG_SELF;
globalThis.langSelf=function(l){return LANG_SELF[l]||l;};
eval(grabConstBlock('GEO_REGIONS','[',']').replace(/^const /,'var '));
globalThis.GEO_REGIONS=GEO_REGIONS;
// Строковые константы: ищем конец литерала с учётом экранирования, иначе
// первая же кавычка внутри CSS обрывает захват.
function grabStringConst(name){
  var i=SRC.indexOf('const '+name+' = "'); if(i<0) throw new Error('нет '+name);
  var j=SRC.indexOf('"',i+('const '+name+' = ').length);
  for(var k=j+1;k<SRC.length;k++){
    if(SRC[k]==='\\'){k++;continue;}
    if(SRC[k]==='"') return SRC.slice(i,k+1)+';';
  }
  throw new Error('литерал не закрыт: '+name);
}
globalThis.MODULES=MODULES; globalThis.REPORT_CSS=REPORT_CSS;
globalThis.dropOrphans=C.dropOrphans;  // живёт в контракте, не в app.jsx
eval(grab('escHtml')); globalThis.escHtml=escHtml;
// Текстовые проходы над готовой разметкой (человеческие имена блоков, русские
// метки, живые ссылки, сноски к источникам) живут ВЫШЕ renderResearchHTML и в
// его кусок не попадают — подтягиваем отдельно, иначе разбор падает на них.
try { eval(grabConstBlock('BLOCK_TITLES','{','}').replace(/^const /,'var ')); globalThis.BLOCK_TITLES=BLOCK_TITLES; } catch(e){}
try { // Пороги вердикта живут выше renderResearchHTML и в его кусок не попадают,
// а renderNiches считает по ним цвет и порядок — без них блок ниш молча
// переставал собираться.
try { var iП=SRC.indexOf('const ПОРОГ_БЕРЁМ');
  globalThis.eval(SRC.slice(iП, SRC.indexOf('\n', iП)).replace(/^const /,'var ')); } catch(e){}
try { eval(grabConstBlock('ШКАЛА_УВЕРЕННОСТИ','[',']').replace(/^const /,'var ')); globalThis.ШКАЛА_УВЕРЕННОСТИ=ШКАЛА_УВЕРЕННОСТИ; } catch(e){}
try { eval(grabConstBlock('ШКАЛА_ДОСТАТКА','[',']').replace(/^const /,'var ')); globalThis.ШКАЛА_ДОСТАТКА=ШКАЛА_ДОСТАТКА; } catch(e){}
try { eval(grabConstBlock('ФРАЗЫ_РУ','{','}').replace(/^const /,'var ')); globalThis.ФРАЗЫ_РУ=ФРАЗЫ_РУ; } catch(e){}
eval(grabConstBlock('МЕТКИ_РУ','{','}').replace(/^const /,'var ')); globalThis.МЕТКИ_РУ=МЕТКИ_РУ; } catch(e){}
try{ eval(grabConstBlock('СЛОВАРЬ_БАЗА','{','}').replace(/^const /,'var ')); globalThis.СЛОВАРЬ_БАЗА=СЛОВАРЬ_БАЗА; } catch(e){ globalThis.СЛОВАРЬ_БАЗА={}; }
['поТексту','внеСсылок','поЧеловечески','поРусскиСтроку','поРусски','сноскиНаИсточники','оживитьКусок','оживитьСсылки','подсказкиТерминов','подсказкиВКуске','строкаРасшифровки','всеРасшифровки','сБольшой','plural','оформитьТекст','почиститьХвост','убратьПустыеПодписи','почиститьУзлы','ссылкиВУзлах','собратьВыводы','собратьШаги','найтиБлокАббревиатур','собратьСловарь','легендаУверенности','выделитьЧисла']
  .forEach(function(имя){
    var i=SRC.indexOf('\nfunction '+имя+'('); if(i<0) return;
    var j=SRC.indexOf('\n}\n', i);
    globalThis.eval(SRC.slice(i+1, j+3));
  });
// Счёт скобок на этой функции больше не работает: внутри неё лежат строки с
// кодом рисования, где фигурные скобки встречаются в тексте. Режем по границам
// объявлений — они однозначны.
function slice2(a,b){ var i=SRC.indexOf(a), j=SRC.indexOf(b,i); return SRC.slice(i,j); }
eval(slice2('function renderResearchHTML(','\nfunction generateHTMLReport('));
globalThis.renderResearchHTML=renderResearchHTML;

// Заглушки CSS-констант: renderResearchHTML их не использует (их вшивает
// generateHTMLReport), но замыкание ссылается на имена — без объявления
// движок падает на ReferenceError ещё до первой строки разметки.
var REPORT_CSS = REPORT_SIDEBAR = REPORT_BLOCK_CSS = REPORT_M1_CSS = REPORT_M7_CSS = REPORT_M2_CSS = REPORT_M4_CSS = REPORT_LIB2_CSS = REPORT_LIB3_CSS = REPORT_COMP_CSS = REPORT_LIB4_CSS = REPORT_PERS_CSS = REPORT_M5_CSS = REPORT_DEMO_CSS = REPORT_M3_CSS = REPORT_RULES_CSS = '';
globalThis.REPORT_CSS = '';
globalThis.REPORT_SIDEBAR = '';
globalThis.REPORT_BLOCK_CSS = '';
globalThis.REPORT_M1_CSS = '';
globalThis.REPORT_M7_CSS = '';
globalThis.REPORT_M2_CSS = '';
globalThis.REPORT_M4_CSS = '';
globalThis.REPORT_LIB2_CSS = '';
globalThis.REPORT_LIB3_CSS = '';
globalThis.REPORT_COMP_CSS = '';
globalThis.REPORT_LIB4_CSS = '';
globalThis.REPORT_PERS_CSS = '';
globalThis.REPORT_M5_CSS = '';
globalThis.REPORT_DEMO_CSS = '';
globalThis.REPORT_M3_CSS = '';
globalThis.REPORT_RULES_CSS = '';
