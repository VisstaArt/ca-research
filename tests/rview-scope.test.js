ObjC.import('Foundation');
// Перенос стилей эталона в инструмент (.rview). Ошибка здесь молчит: правила
// не «падают», их выбрасывает браузер, и страница просто выглядит черновиком.
// Владелица 14.09: «оформлено уродски, сплошной текст» — причиной был
// комментарий, прилипший к селектору, из-за чего пропадали .dtbl, .kbtn, .sech.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var src=readFile(ROOT+'/app.jsx');
// Счётом скобок эти две функции не вырезать: внутри них регулярка с «{» и «}»
// как обычными символами. Режем по закрывающей скобке в начале строки.
function grab(name){
  var i=src.indexOf('\nfunction '+name+'(');
  if(i<0) throw new Error('нет функции '+name);
  var j=src.indexOf('\n}\n', i);
  return src.slice(i+1, j+3);
}
globalThis.eval(grab('rviewScope'));
globalThis.eval(grab('rviewPrefix'));

var failed=0;
function check(name,actual,expected){
  if(JSON.stringify(actual)===JSON.stringify(expected)) console.log('  ok   '+name);
  else {failed++; console.log('  FAIL '+name+'\n       ждали:  '+JSON.stringify(expected)+'\n       факт:   '+JSON.stringify(actual));}
}
console.log('tests/rview-scope.test.js');

// 1. Комментарий над правилом не должен утаскивать селектор за собой.
check('комментарий не прилипает к селектору',
  rviewPrefix('/* пояснение */\n.dtbl{border:0}').indexOf('.rview .dtbl{')>=0, true);

// 2. Условие тёмной темы обязано сохраниться — иначе тёмные токены красят
//    светлую плашку и текст исчезает.
check('гард тёмной темы сохранён',
  rviewPrefix(':root:not([data-theme="light"]){--ink:#fff}').indexOf('html:not([data-theme="light"]) .rview{')>=0, true);
check('обычный :root становится .rview',
  rviewPrefix(':root{--ink:#000}').indexOf('.rview{')>=0, true);

// 3. Первое правило внутри @media тоже ограничивается областью.
check('первое правило в @media ограничено',
  rviewPrefix('@media (max-width:900px){.card{padding:0}}').indexOf('.rview .card{')>=0, true);

// 4. Главное: на НАСТОЯЩЕМ эталоне все ключевые классы доезжают, и ни одно
//    правило не остаётся без области (утечка на всю страницу платформы).
var css=readFile(ROOT+'/lib/report.css');
var out=rviewPrefix(css);
['.rview .dtbl{','.rview .kbtn{','.rview .sech{','.rview .kchip{','.rview .cover .covername{','.rview .coverdl{','.rview .kcard{','.rview .note{']
  .forEach(function(нужен){ check('эталон отдаёт '+нужен.replace('.rview ',''), out.indexOf(нужен)>=0, true); });
check('в перенесённом стиле не осталось комментариев', out.indexOf('/*')<0, true);
var утекло=out.split('\n').filter(function(l){
  var head=l.split('{')[0];
  if(!l || l.indexOf('{')<0) return false;
  var h=head.trim();
  return h && h.indexOf('.rview')<0 && h.charAt(0)!=='@' && h.charAt(0)!=='}' && h.indexOf('%')<0
    && h!=='from' && h!=='to' && h.indexOf('html')!==0;
});
check('правил без области', утекло.length, 0);

console.log(failed===0 ? '\nвсё сошлось' : '\nПРОВАЛОВ: '+failed);
