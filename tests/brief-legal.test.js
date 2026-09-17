ObjC.import('Foundation');
// Вторая часть брифа (контент-машина, 17.09): воронка и юридическое. Два
// требования к нашей стороне — реквизиты не уходят в модель, и отсутствие
// правовой формы меняет советы: без неё нельзя собирать контакты на форме.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
function взять(n){var i=SRC.indexOf('function '+n+'('); if(i<0) throw new Error('нет '+n);
 var d=0; for(var k=SRC.indexOf('{',i);k<SRC.length;k++){if(SRC[k]==='{')d++;else if(SRC[k]==='}'){d--;if(!d)return SRC.slice(i,k+1);}}}
console.log('tests/brief-legal.test.js');
var провалов=0;
function ок(имя,усл,что){ if(усл) console.log('  ok   '+имя); else { провалов++; console.log('  FAIL '+имя+(что?': '+что:'')); } }

var i=SRC.indexOf('const БРИФ_НЕ_В_ПРОМПТ');
eval(SRC.slice(i, SRC.indexOf('\n', i)).replace('const ','var '));
eval(взять('правилоБезРеквизитов'));

// Точные имена полей, согласованные с контент-машиной.
var ВОРОНКА=['funnel_needed','funnel_target','funnel_decision_maker','funnel_price_band',
  'funnel_cycle','funnel_has_operator','funnel_ready_tools'];
var ЮР=['legal_form','legal_name','legal_inn','legal_address'];
var СВЯЗЬ=['contact_email'];
ВОРОНКА.concat(ЮР).concat(СВЯЗЬ).forEach(function(поле){
  ок('поле '+поле+' не уходит в модель', БРИФ_НЕ_В_ПРОМПТ.test(поле), 'проходит фильтр');
});
// А наши поля — уходят, иначе исследование ослепнет.
['name','niche','audience','wePublish','features','socials'].forEach(function(поле){
  ок('наше поле '+поле+' в промпт идёт', !БРИФ_НЕ_В_ПРОМПТ.test(поле), 'вырезано зря');
});

// Правило про формы сбора контактов.
ок('пустой бриф ничего не меняет', правилоБезРеквизитов({name:'Т'})==='', 'правило включилось зря');
ок('у ИП правило молчит',
   правилоБезРеквизитов({funnel_needed:'да',legal_form:'ИП'})==='', 'правило включилось у ИП');
ок('у ООО правило молчит',
   правилоБезРеквизитов({funnel_needed:'да',legal_form:'ООО'})==='', 'правило включилось у ООО');
ок('у самозанятого правило молчит',
   правилоБезРеквизитов({funnel_needed:'да',legal_form:'самозанятый'})==='', 'правило включилось');
var уФизлица=правилоБезРеквизитов({funnel_needed:'да',legal_form:'физлицо'});
ок('у физлица предупреждение появляется', /\[ПД\]/.test(уФизлица), 'молчит');
// Владелица 17.09: исследование даёт возможности, а решает человек. Запрещать
// приёмы нельзя — только предупреждать.
ок('приёмы не вычёркиваются', /ничего не вычёркивая/.test(уФизлица), 'превратилось в запрет');
ок('решение оставлено человеку', /решение принимает человек/.test(уФизлица), 'нет оговорки');
ок('вторая часть есть, а форма не указана — предупреждение тоже есть',
   /\[ПД\]/.test(правилоБезРеквизитов({funnel_needed:'да',legal_form:''})), 'молчит');

console.log(провалов ? ('ПРОВАЛОВ: '+провалов) : 'вторая часть брифа обслужена');
