ObjC.import('Foundation');
// Веер ниш: пять карт, а не одна. 15.09 перламутр на картах перебил их
// позиционирование (.nacre{position:relative} грузится после .fcard из
// tokens.css), карты упали в поток и спрятались под первой.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
console.log('tests/fan-cards.test.js');
var fails=0;
function check(n,ok){ if(ok) console.log('  ok   '+n); else {fails++; console.log('  FAIL '+n);} }

var html=readFile(ROOT+'/index.html');
check('страховка .fcard.nacre на месте', /\.fcard\.nacre\s*\{[^}]*position:\s*absolute/.test(html));

// Порядок подключения: если nacre.css вдруг окажется ПОСЛЕ страховки — она
// перестанет работать, поэтому проверяем и его.
var iNacre=html.indexOf('lib/nacre.css'), iГвард=html.search(/\.fcard\.nacre/);
check('страховка идёт после nacre.css', iNacre >= 0 && iГвард > iNacre);

// Сам веер: пять слотов при пяти и более нишах.
var SRC=readFile(ROOT+'/app.jsx');
var i=SRC.indexOf('const слоты = n >= 2');
var строка=SRC.slice(i, SRC.indexOf(';', i));
check('при n>=5 берём пять слотов', строка.indexOf('n >= 5 ? 0') >= 0 && строка.indexOf('n >= 5 ? 5') >= 0);

console.log(fails===0 ? '\nвсё сошлось' : '\nПРОВАЛОВ: '+fails);
