ObjC.import('Foundation');
// Вердикт ниши считается по баллам, а не берётся у модели: владелица 15.09
// показала нишу 18 из 20 с пометкой «под вопросом». И порядок на экране:
// сначала берём, потом спорные, в конце отброшенные.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
function grab(name){var i=SRC.indexOf('\nfunction '+name+'('); var j=SRC.indexOf('\n}\n', i); return SRC.slice(i+1,j+3);}
var i=SRC.indexOf('const ПОРОГ_БЕРЁМ');
globalThis.eval(SRC.slice(i, SRC.indexOf('\n', i)).replace(/^const /,'var '));
globalThis.eval(grab('вердиктПоБаллам'));
globalThis.eval(grab('весВердикта'));
globalThis.eval(grab('цветВердикта'));
console.log('tests/niche-verdict.test.js');
var fails=0;
function check(n,g,w){ if(JSON.stringify(g)===JSON.stringify(w)) console.log('  ok   '+n);
  else {fails++; console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));} }

check('18 из 20 — берём', вердиктПоБаллам(18), 'идём');
check('15 — граница, берём', вердиктПоБаллам(15), 'идём');
check('14 — под вопросом', вердиктПоБаллам(14), 'под вопросом');
check('10 — граница вопроса', вердиктПоБаллам(10), 'под вопросом');
check('9 — не идём', вердиктПоБаллам(9), 'не идём');
check('без балла — под вопросом', вердиктПоБаллам(null), 'под вопросом');

var ниши=[{n:'A',s:8},{n:'B',s:18},{n:'C',s:12},{n:'D',s:16}]
  .map(function(x){return {name:x.n, score:x.s, verdict:вердиктПоБаллам(x.s)};})
  .sort(function(a,b){return (весВердикта(a.verdict)-весВердикта(b.verdict))||(b.score-a.score);});
check('порядок: берём → вопрос → не идём', ниши.map(function(x){return x.name;}), ['B','D','C','A']);

check('цвет «берём»', цветВердикта('идём'), 'var(--acc-strong)');
check('цвет «под вопросом»', цветВердикта('под вопросом'), 'var(--acc-mid)');
check('цвет «не идём»', цветВердикта('не идём'), 'var(--acc-quiet)');

console.log(fails===0 ? '\nвсё сошлось' : '\nПРОВАЛОВ: '+fails);
