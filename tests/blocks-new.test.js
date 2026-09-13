ObjC.import('Foundation');
// Восемь блоков, которые до 12.09 печатались сырыми таблицами. Проверяем на
// СОБРАННОМ отчёте: сборщик опознал блок, рисовалка собрала разметку, поля не
// потерялись. Потеря поля — главный риск при переводе таблицы в карточки.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var html=readFile(ROOT+'/design/ОБРАЗЕЦ-ОТЧЁТА.html');
var parts=html.split('<script>').slice(1).map(function(x){return x.split('<'+'/script>')[0];});
var big=parts.sort(function(a,b){return b.length-a.length;})[0];
console.log('tests/blocks-new.test.js');
eval(readFile(ROOT+'/tests/dom-stub.js') + big + readFile(ROOT+'/tests/blocks-new.body.js'));
