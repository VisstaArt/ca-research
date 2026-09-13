ObjC.import('Foundation');
// Порядок прогона после перенумерации 12.09.2026. Проверяем не «красиво ли
// выглядит список», а то, ради чего он существует: каждый модуль запускается
// ПОСЛЕ тех, чьи данные ему нужны, и ни один не блокируется зря.
// Живой прогон стоит денег — эта проверка ловит обрыв цепочки бесплатно.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
eval(readFile(ROOT+'/lib/contract.js'));
var C=globalThis.CAContract;

function grabConst(name){
  var i=SRC.indexOf('const '+name+' = ['); if(i<0) throw new Error('нет '+name);
  var j=SRC.indexOf('[',i), d=0;
  for(var k=j;k<SRC.length;k++){ if(SRC[k]==='[')d++; else if(SRC[k]===']'){d--; if(!d) return SRC.slice(j,k+1);} }
}
var MODULES=eval(grabConst('MODULES'));

var fails=0;
function check(n,got,want){var ok=JSON.stringify(got)===JSON.stringify(want);
  if(!ok){fails++;console.log('  FAIL '+n+'\n       ждали: '+JSON.stringify(want)+'\n       факт:  '+JSON.stringify(got));}
  else console.log('  ok   '+n);}
console.log('tests/chain.test.js');

var ids=MODULES.map(function(m){return m.id;});
check('порядок модулей', ids, ['M1','M2','M3','M4','M5','M6','M7','M8','CONTENT']);
check('ёмкость рынка выключена', MODULES.filter(function(m){return m.disabled;}).map(function(m){return m.id;}), ['M1']);
// Ни одного модуля вне автоцепочки: офферы вернули 12.09.2026.
check('вне автоцепочки никого', MODULES.filter(function(m){return m.offChain;}).map(function(m){return m.id;}), []);
check('разведка ниш — глобальная', C.isPerNiche('M2'), false);

// Каждый requires обязан ссылаться на существующий модуль, стоящий ВЫШЕ.
var bad=[];
MODULES.forEach(function(m,i){
  (m.requires||[]).forEach(function(dep){
    var j=ids.indexOf(dep);
    if(j<0) bad.push(m.id+' требует несуществующий '+dep);
    else if(j>=i) bad.push(m.id+' требует '+dep+', который идёт не раньше');
  });
});
check('зависимости смотрят назад', bad, []);

// Автоцепочка: что реально пойдёт в прогон при «выбрать всё».
var chain=MODULES.filter(function(m){return !m.disabled && !m.offChain;}).map(function(m){return m.id;});
check('автоцепочка', chain, ['M2','M3','M4','M5','M6','M7','M8','CONTENT']);

// Симуляция сортировки из run(): глобальные сначала, потом ниша за нишей.
var work=[];
chain.forEach(function(id){
  if(C.isPerNiche(id)) ['Ниша А','Ниша Б'].forEach(function(n){work.push({id:id,niche:n});});
  else work.push({id:id,niche:''});
});
var modOrder=ids;
work.sort(function(a,b){
  var ga=a.niche==='', gb=b.niche==='';
  if(ga!==gb) return ga?-1:1;
  if(a.niche!==b.niche) return a.niche<b.niche?-1:1;
  return modOrder.indexOf(a.id)-modOrder.indexOf(b.id);
});
check('первым идёт глобальный модуль', work[0], {id:'M2',niche:''});
check('ниша А целиком раньше ниши Б',
  work.filter(function(w){return w.niche==='Ниша А';}).map(function(w){return w.id;}),
  ['M3','M4','M5','M6','M7','M8','CONTENT']);

// Ни один модуль не должен оказаться заблокированным при полном прогоне.
var ready={}, blocked=[];
work.forEach(function(w){
  (MODULES.find(function(m){return m.id===w.id;}).requires||[]).forEach(function(dep){
    var key=dep+'@@'+(C.isPerNiche(dep)?w.niche:'');
    if(!ready[key]) blocked.push(w.id+'['+w.niche+'] ждёт '+dep);
  });
  ready[w.id+'@@'+w.niche]=true;
});
check('никто не заблокирован', blocked, []);

console.log(fails? '\nПРОВАЛОВ: '+fails : '\nвсё сошлось');
