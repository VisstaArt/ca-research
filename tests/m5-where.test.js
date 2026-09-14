ObjC.import('Foundation');
// «Где сидит аудитория» (08A). Рисовалка карточек площадок общая с M4 и ждёт
// восемь полей; блок 08A отдавал пять — в отчёте печаталось «undefined», а
// адрес площадки уезжал в строку «признак живости» (скрин М5, 14.09).
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
eval(readFile(ROOT+'/tests/render-harness.js'));
console.log('tests/m5-where.test.js');
var fails=0;
function ok(n,g,w){var r=JSON.stringify(g)===JSON.stringify(w);
 if(!r){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}

var t=['## BLOCK 08A — Где сидит аудитория',
'| Площадка/канал | Тип площадки | URL | Что аудитория там делает | Признак живости | Кого там читают | Как использовать | Источники |',
'|---|---|---|---|---|---|---|---|',
'| searchengines.guru | форум | https://searchengines.guru/ru/forum/633165 | жалуется на конверсию | дискуссии 2026 | не видно из источника | участвовать в обсуждениях | [5] |',
'| Telegram-чат «Магазины» | мессенджер | | учится | 4200 участников | не видно из источника | публиковаться | [7] |'].join('\n');
var r=renderResearchHTML(t,{});
var стр=r.scripts.filter(function(x){return x.indexOf('renderChannels(')===0;})[0];
var D=JSON.parse(стр.slice('renderChannels('.length, стр.length-2));
ok('восемь полей на карточку', D[0].length, 8);
ok('нигде не undefined', /undefined/.test(JSON.stringify(D)), false);
ok('адрес отдельным полем, не в живости', D[0][7], 'https://searchengines.guru/ru/forum/633165');
ok('признак живости на своём месте', D[0][4], 'дискуссии 2026');
ok('«не видно из источника» не печатается', /не видно/.test(JSON.stringify(D)), false);
ok('значок по типу площадки', [D[0][2], D[1][2]], ['forum','tg']);
ok('номер источника вынут из скобок', D[0][6], '5');
ok('пустой адрес остаётся пустым', D[1][7], '');


// Карта рынка: «мы» должны стоять на нас, а не на последней строке таблицы.
// Раньше, не найдя себя, подсветка вешалась на последнего — и чужая компания
// была подписана «мы» (владелица 14.09: «Adpass — мы»).
var карта=['## BLOCK 06 — Карта рынка и конкурентов',
'| Название | Ценовой уровень | Известность | Сайт |','|---|---|---|---|',
'| Envybox | средний | лидер · 41 300/мес | envybox.io |',
'| Jivo | средний | заметный · 12 000/мес | jivo.ru |',
'| Adpass | низкий | нишевый · 265/мес | adpass.ru |',
'| Ловец-Лидов.рф | низкий | нишевый · 90/мес | lovec.ru |'].join('\n');
function точки(имя){
  var рр=renderResearchHTML(карта,{ourName:имя});
  var с=рр.scripts.filter(function(x){return x.indexOf('renderMarketMap(')===0;})[0];
  return с?JSON.parse(с.slice('renderMarketMap('.length,с.length-2)):[];
}
var P=точки('Ловец Лидов');
ok('«мы» узнаётся через дефис и домен', P.filter(function(x){return x[4];}).map(function(x){return x[0];}), ['Ловец-Лидов.рф']);
var P2=точки('Совсем другая компания');
ok('не нашли себя — никого не помечаем', P2.filter(function(x){return x[4];}).length, 0);

console.log(fails?('ПРОВАЛЕНО: '+fails):'  всё зелёное');
