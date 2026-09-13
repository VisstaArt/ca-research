// Тест сбора географии спроса (fetchGeoDemand / geoLooksWrong / geoDemandBlock).
//
// Запуск (macOS, без установки чего-либо):
//     osascript -l JavaScript tests/m7-geo.test.js
//
// Зачем существует: SEO-06 просит таблицу регионов. Если числа под неё не
// придут, модель построит правдоподобную выдумку — проверить её заказчику
// нечем. Здесь проверяется, что код собирает числа сам, считает плотность сам
// и ЧЕСТНО отказывается, когда замер не сошёлся.
ObjC.import('Foundation');
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
function grab(name){
  var i=SRC.indexOf('async function '+name+'(');
  if(i<0) i=SRC.indexOf('function '+name+'(');
  if(i<0) throw new Error('не найдено: '+name);
  var d=0,j=SRC.indexOf('{',i);
  for(var k=j;k<SRC.length;k++){ if(SRC[k]==='{')d++; else if(SRC[k]==='}'){d--; if(!d) return SRC.slice(i,k+1);} }
  throw new Error('не закрыто: '+name);
}
function grabConst(name){
  var i=SRC.indexOf('\nconst '+name);
  if(i<0) throw new Error('не найдено: '+name);
  var lines=SRC.slice(i+1).split('\n'), out=[], depth=0;
  for(var k=0;k<lines.length;k++){
    out.push(lines[k]);
    var l=lines[k].replace(/\/\/.*$/,'');
    depth+=(l.match(/[\[{]/g)||[]).length-(l.match(/[\]}]/g)||[]).length;
    if(depth<=0 && /;\s*$/.test(l)) break;
  }
  return out.join('\n');
}
['keywordSourceForMarket','fetchGeoDemand','geoLooksWrong','geoDemandBlock']
  .forEach(function(n){ eval(grab(n)); });
eval(grabConst('GEO_REGIONS').replace(/^const /,'var '));
globalThis.GEO_REGIONS=GEO_REGIONS;
globalThis.keywordSourceForMarket=keywordSourceForMarket;
globalThis.geoLooksWrong=geoLooksWrong;
// Заглушка только на сеть. Числа подобраны так, чтобы Екатеринбург
// перевешивал своё население, а Москва — нет: ровно то, ради чего таблица.
// Ключи СТРОКАМИ — так же, как их требует API (живая проверка 11.09: с числом
// приходит «invalid value 225 for type TYPE_STRING»).
var DEMAND={'225':10000,'1':1200,'10174':500,'11162':900,'11316':200,'10995':400,'11119':260};
var calls=[];
function callWordstat(phrase,opts){
  calls.push(opts.regions[0]);
  var v=DEMAND[opts.regions[0]];
  return Promise.resolve(v===undefined?null:{totalCount:v});
}
globalThis.callWordstat=callWordstat;

var failed=0;
function check(n,a,e){var A=JSON.stringify(a),E=JSON.stringify(e);
  if(A===E)console.log('  ok   '+n);else{failed++;console.log('  FAIL '+n+'\n       ждали: '+E+'\n       факт:  '+A);}}
function cell(txt,region,idx){
  var line=txt.split('\n').filter(function(l){return l.indexOf('| '+region+' |')===0;})[0]||'';
  return (line.split('|')[idx]||'').trim();
}

console.log('география спроса');
fetchGeoDemand({geoMarket:'Россия'},['попап для сайта']).then(function(geo){
  check('спросили все семь регионов', calls, ['225','1','10174','11162','11316','10995','11119']);
  check('регионы уходят СТРОКАМИ, не числами', calls.every(function(x){return typeof x==='string';}), true);
  var b=geoDemandBlock(geo);
  check('Москва: доля от России', cell(b,'Москва и область',3), '12.0%');
  check('Москва: плотность ниже единицы', cell(b,'Москва и область',5), '0.81');
  check('Екатеринбург перевешивает население', cell(b,'Свердловская область',5), '3.10');
  check('база по стране на месте', cell(b,'Россия целиком',2), '10 000');
  check('фразы замера названы', /Фразы замера: попап для сайта/.test(b), true);

  // Коды регионов не те: регион «больше страны» — блок обязан отказаться
  var broken={rows:[{name:'Россия целиком',pop:1,count:100},{name:'Москва и область',pop:.149,count:900}]};
  check('ловим неверные коды', /дал больше запросов, чем вся страна/.test(geoLooksWrong(broken.rows)), true);
  var bb=geoDemandBlock(broken);
  check('при неверных кодах таблицы нет', /\| Москва и область \| 900/.test(bb), false);
  check('при неверных кодах — прямой запрет', /использовать НЕЛЬЗЯ/.test(bb), true);

  // Вне России у Wordstat регионов нет — молча ничего не собираем
  calls=[];
  return fetchGeoDemand({geoMarket:'Турция'},['popup']);
}).then(function(g2){
  check('вне России не ходим в Wordstat', calls.length, 0);
  check('вне России данных нет', g2, null);
  check('пустой геоблок ничего не печатает', geoDemandBlock(null), '');
  console.log(failed===0?'\nвсё сошлось':'\nпровалов: '+failed);
}).catch(function(e){ console.log('ИСКЛЮЧЕНИЕ: '+e.message); });
