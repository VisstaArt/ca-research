ObjC.import('Foundation');
// Схемы строгого формата — по правилам провайдера, ПРОВЕРЕННЫЕ БЕЗ СЕТИ.
//
// 16.09 схема M3 отвергалась провайдером из-за кириллицы в имени, мы молча
// откатывались на свободный текст, и владелица заплатила за прогон, который
// ничего не проверил. Такие вещи обязаны ловиться здесь, а не деньгами.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
console.log('tests/schema-valid.test.js');
var fails=0;
function бяда(что){ fails++; console.log('  FAIL '+что); }
function добро(что){ console.log('  ok   '+что); }

// Достаём объявленные схемы как есть.
function константа(имя){
  var i=SRC.indexOf('const '+имя+' = {'); if(i<0) return null;
  var d=0;
  for(var k=SRC.indexOf('{',i);k<SRC.length;k++){
    if(SRC[k]==='{')d++; else if(SRC[k]==='}'){ d--; if(!d) return SRC.slice(i,k+1)+';'; }
  }
  return null;
}
var исходники=['СХЕМА_M3'];
var помощники=константа('ОТКУДА');
исходники.forEach(function(имя){
  var текст=константа(имя);
  if(!текст){ бяда('не нашёл '+имя); return; }
  var схема;
  try {
    схема = new Function('var строка=function(о){return {type:"string",description:о};};'
      + (помощники||'') + текст.replace('const '+имя+' =','return ').replace(/;$/,';'))();
  } catch(e){ бяда(имя+' не собирается: '+e.message); return; }

  // Правила strict: у каждого объекта запрещены лишние поля, и КАЖДОЕ
  // свойство обязано быть в required — иначе провайдер отвергает схему.
  var беды=[];
  (function обход(узел, путь){
    if(!узел || typeof узел!=='object') return;
    if(узел.type==='object'){
      if(узел.additionalProperties!==false) беды.push(путь+': нет additionalProperties:false');
      var свои=Object.keys(узел.properties||{});
      var надо=(узел.required||[]);
      свои.forEach(function(к){
        if(надо.indexOf(к)<0) беды.push(путь+'.'+к+': не указано в required');
      });
      свои.forEach(function(к){ обход(узел.properties[к], путь+'.'+к); });
    }
    if(узел.type==='array') обход(узел.items, путь+'[]');
  })(схема, имя);
  if(беды.length){ беды.slice(0,6).forEach(бяда); }
  else добро(имя+': строгие правила соблюдены');
});

// Имя схемы уходит провайдеру как есть — только латиница, цифры, _ и -.
var вызов=SRC.match(/callGPTСхема\([^)]*'([^']+)'\s*\+\s*mod\.id/);
if(вызов){
  if(/^[A-Za-z0-9_-]+$/.test(вызов[1])) добро('имя схемы латиницей');
  else бяда('в имени схемы не латиница: '+вызов[1]);
} else бяда('не нашёл вызов callGPTСхема');

// Чистка имени на случай, если модуль назовут по-русски.
if(/replace\(\/\[\^A-Za-z0-9_-\]\/g/.test(SRC)) добро('имя чистится перед отправкой');
else бяда('имя схемы уходит без чистки');

console.log(fails?('ПРОВАЛЕНО: '+fails):'  всё зелёное');
