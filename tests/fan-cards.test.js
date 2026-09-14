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
check('страховка .fcard.nacre на месте', /\.fcard\.nacre[^{]*\{[^}]*position:\s*absolute/.test(html));
// Стиль отчёта подключается скриптом ПОЗЖЕ и приходит как «.rview .nacre».
// При равной силе побеждает он — значит у страховки должен быть лишний класс.
check('страховка сильнее правила .rview .nacre', /\.rview\s+\.fcard\.nacre/.test(html));

// Порядок подключения: если nacre.css вдруг окажется ПОСЛЕ страховки — она
// перестанет работать, поэтому проверяем и его.
var iNacre=html.indexOf('lib/nacre.css'), iГвард=html.search(/\.fcard\.nacre/);
check('страховка идёт после nacre.css', iNacre >= 0 && iГвард > iNacre);

// Сам веер: пять слотов при пяти и более нишах.
var SRC=readFile(ROOT+'/app.jsx');
var i=SRC.indexOf('const слоты = n >= 2');
var строка=SRC.slice(i, SRC.indexOf(';', i));
check('при n>=5 берём пять слотов', строка.indexOf('n >= 5 ? 0') >= 0 && строка.indexOf('n >= 5 ? 5') >= 0);


// Итог ниши обязан сходиться с полосами под ним: на скрине 15.09 карта
// показывала 15, а оси давали 4+4+5+5=18 — модель ошиблась в своей же
// арифметике. Считаем сумму сами, когда все четыре оси известны.
var i2=SRC.indexOf('const сОценкой = н => {');
var j2=SRC.indexOf('\n    };', i2);
globalThis.eval(SRC.slice(i2, j2+7).replace(/^const /,'var '));
check('итог считается суммой осей',
  сОценкой({demand:4,competition:4,economics:5,fit:5,score:15}).score === 18);
check('без полного набора осей берём как есть',
  сОценкой({demand:4,competition:null,economics:5,fit:5,score:15}).score === 15);

console.log(fails===0 ? '\nвсё сошлось' : '\nПРОВАЛОВ: '+fails);
