ObjC.import('Foundation');
// Лимит провайдера на строгую схему: не больше 100 свойств, глубина до 5, и
// каждое свойство обязано быть в required при additionalProperties:false.
// 17.09 схема M4 доросла до 103 полей — провайдер такую отклоняет, модуль
// молча откатывается на свободный текст, и человек видит отчёт без новых
// блоков. Этот сторож ловит переполнение ДО прогона, а не после траты денег.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
function взятьКонст(n){var i=SRC.indexOf('const '+n+' = {'); if(i<0) return null; var d=0;
 for(var k=SRC.indexOf('{',i);k<SRC.length;k++){if(SRC[k]==='{')d++;else if(SRC[k]==='}'){d--;if(!d)return SRC.slice(i,k+1)+';';}}}
console.log('tests/schema-limits.test.js');
var провалов=0;
function ок(имя,усл,что){ if(усл) console.log('  ok   '+имя); else { провалов++; console.log('  FAIL '+имя+(что?': '+что:'')); } }

eval("var строка=function(о){return {type:'string',description:о};};");
// Часть схем опирается на вспомогательные константы — подтягиваем их.
['ОТКУДА_ЗНАЕМ','УВЕРЕННОСТЬ'].forEach(function(имя){
  var i=SRC.indexOf('const '+имя+' =');
  if(i>=0) eval(SRC.slice(i, SRC.indexOf('\n', i)).replace('const ','var '));
});
function счёт(о,гл){ var n=0,max=гл;
  if(о&&typeof о==='object'){
    if(о.properties) for(var k in о.properties){ n++; var r=счёт(о.properties[k],гл+1); n+=r.n; if(r.max>max)max=r.max; }
    if(о.items){ var r2=счёт(о.items,гл+1); n+=r2.n; if(r2.max>max)max=r2.max; }
  }
  return {n:n,max:max};
}
['СХЕМА_M2','СХЕМА_M4','СХЕМА_M4A','СХЕМА_M5','СХЕМА_M6','СХЕМА_M7','СХЕМА_M8','СХЕМА_ПРОФИЛЯ'].forEach(function(имя){
  var код=взятьКонст(имя);
  if(!код){ провалов++; console.log('  FAIL схема '+имя+' не найдена'); return; }
  var схема;
  try { схема=eval('('+код.replace('const '+имя+' = ','').replace(/;$/,'')+')'); }
  catch(e){ провалов++; console.log('  FAIL '+имя+' не разбирается: '+e.message); return; }
  var r=счёт(схема,0);
  ок(имя+': свойств '+r.n+' (предел 100)', r.n<=100, 'переполнение');
  ок(имя+': глубина '+r.max+' (предел 5)', r.max<=5, 'слишком глубоко');
  var беды=[];
  (function обход(о,путь){
    if(!о||typeof о!=='object') return;
    if(о.type==='object'&&о.properties){
      var ключи=Object.keys(о.properties), req=о.required||[];
      ключи.forEach(function(k){ if(req.indexOf(k)<0) беды.push(путь+'.'+k); });
      if(о.additionalProperties!==false) беды.push(путь+' (нет additionalProperties:false)');
      ключи.forEach(function(k){ обход(о.properties[k],путь+'.'+k); });
    }
    if(о.items) обход(о.items,путь+'[]');
  })(схема,имя);
  ок(имя+': все поля в required', беды.length===0, беды.slice(0,3).join(', '));
});
console.log(провалов ? ('ПРОВАЛОВ: '+провалов) : 'схемы влезают в лимиты провайдера');
