ObjC.import('Foundation');
// Три рынка — три набора площадок. Владелица 17.09: «мы делаем на Россию,
// Турцию и Эмираты, там свои площадки, и сервис должен уметь обрабатывать все
// варианты». Раньше список был жёстко российским: для Стамбула радар искал
// каналы в Дзене и MAX, а Ekşi Sözlük не спрашивал вовсе.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
function взять(n){var i=SRC.indexOf('function '+n+'('); if(i<0) throw new Error('нет '+n);
 var d=0; for(var k=SRC.indexOf('{',i);k<SRC.length;k++){if(SRC[k]==='{')d++;else if(SRC[k]==='}'){d--;if(!d)return SRC.slice(i,k+1);}}}
console.log('tests/markets.test.js');
var провалов=0;
function ок(имя,усл,что){ if(усл) console.log('  ok   '+имя); else { провалов++; console.log('  FAIL '+имя+(что?': '+что:'')); } }
eval(взять('площадкиРынка'));
function домены(р){ return площадкиРынка(р).map(function(п){return п[0];}); }

var ру=домены('Россия');
ок('Россия: телеграм', ру.indexOf('t.me')>=0, ру.join(','));
ок('Россия: ВКонтакте', ру.indexOf('vk.com')>=0, ру.join(','));
ок('Россия: Дзен', ру.indexOf('dzen.ru')>=0, ру.join(','));
ок('Россия: MAX', ру.indexOf('max.ru')>=0, ру.join(','));

var тр=домены('Турция');
ок('Турция: Ekşi Sözlük', тр.indexOf('eksisozluk.com')>=0, тр.join(','));
ок('Турция: Twitch', тр.indexOf('twitch.tv')>=0, тр.join(','));
ок('Турция: без Дзена', тр.indexOf('dzen.ru')<0, тр.join(','));
ок('Турция: без MAX', тр.indexOf('max.ru')<0, тр.join(','));
ок('Турция: запросы на турецком', /kanalı|hesabı/.test(JSON.stringify(площадкиРынка('Турция'))), 'нет');

var оаэ=домены('ОАЭ, Дубай');
ок('Эмираты: Snapchat', оаэ.indexOf('snapchat.com')>=0, оаэ.join(','));
ок('Эмираты: каналы WhatsApp', оаэ.indexOf('whatsapp.com')>=0, оаэ.join(','));
ок('Эмираты: местные медиа', оаэ.indexOf('gulfnews.com')>=0, оаэ.join(','));
ок('Эмираты: без ВКонтакте', оаэ.indexOf('vk.com')<0, оаэ.join(','));
// По Заливу пока только английский: арабскую выдачу нам нечем проверить
// (решение владелицы 17.09).
ок('Эмираты: арабского в запросах нет',
   !/[\u0600-\u06FF]/.test(JSON.stringify(площадкиРынка('ОАЭ'))), JSON.stringify(площадкиРынка('ОАЭ')));
ок('Эмираты: запросы на английском',
   /account|channel|community/.test(JSON.stringify(площадкиРынка('ОАЭ'))), 'нет');
ок('Саудовская Аравия — тот же набор',
   домены('Саудовская Аравия').indexOf('snapchat.com')>=0, домены('Саудовская Аравия').join(','));
ок('в промпте сказано про английский по Заливу',
   /РАБОТАЕМ ТОЛЬКО С АНГЛОЯЗЫЧНЫМ СЕГМЕНТОМ/.test(SRC), 'нет');

var мир=домены('Германия');
ок('незнакомый рынок — мировой набор', мир.indexOf('youtube.com')>=0 && мир.indexOf('dzen.ru')<0, мир.join(','));
ок('в мировом наборе есть Reddit', мир.indexOf('reddit.com')>=0, мир.join(','));

ок('в промпт список идёт от рынка',
   /площадкиРынка\(brief\.geoMarket \|\| brief\.geoCompany/.test(SRC), 'нет');
ок('модель предупреждена про местные площадки',
   /Рынок здесь главнее привычки/.test(SRC), 'нет');

console.log(провалов ? ('ПРОВАЛОВ: '+провалов) : 'площадки подбираются под рынок');
