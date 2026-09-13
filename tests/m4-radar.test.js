ObjC.import('Foundation');
// Контент-радар (M4): рисовалки «что залетает», «что работает» и источники.
// Проверяем СОБРАННЫЙ отчёт, а не исходник — на разнице между ними мы уже
// обожглись с цветом, который переопределяла палитра.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var html=readFile(ROOT+'/design/ОБРАЗЕЦ-ОТЧЁТА.html');
var parts=html.split('<script>').slice(1).map(function(x){return x.split('<'+'/script>')[0];});
var big=parts.sort(function(a,b){return b.length-a.length;})[0];
console.log('tests/m4-radar.test.js');
eval(readFile(ROOT+'/tests/dom-stub.js') + big + readFile(ROOT+'/tests/m4-radar.body.js'));
