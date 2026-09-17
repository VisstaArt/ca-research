ObjC.import('Foundation');
// Модули, появившиеся ПОСЛЕ создания проекта, должны в нём появляться: у
// проекта свой сохранённый набор, и новинка туда сама не попадает. Владелица
// 17.09 разделила контент-радар надвое и не увидела нового модуля в старом
// проекте — он честно не был выбран.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
console.log('tests/new-modules.test.js');
var провалов=0;
function ок(имя,усл,что){ if(усл) console.log('  ok   '+имя); else { провалов++; console.log('  FAIL '+имя+(что?': '+что:'')); } }

// Достаём сам механизм и список модулей.
var i=SRC.indexOf('const НОВЫЕ_МОДУЛИ');
var j=SRC.indexOf('\n  };', SRC.indexOf('const дополнитьНовыми'))+5;
var код=SRC.slice(i, j);
function grabConst(имя){var k=SRC.indexOf('const '+имя+' = ['); var d=0;
 for(var n=SRC.indexOf('[',k);n<SRC.length;n++){if(SRC[n]==='[')d++;else if(SRC[n]===']'){d--;if(!d)return SRC.slice(k,n+1)+';';}}}
eval(grabConst('MODULES').replace('const ','var '));
eval(код.replace(/const /g,'var '));

var было=['M2','M3','M4','M5','M6','M7','M8'];
var стало=дополнитьНовыми(было);
ок('новый модуль добавлен', стало.indexOf('M4A')>=0, стало.join(','));
ок('встал на своё место в цепочке', стало.indexOf('M4A') === стало.indexOf('M4')+1, стало.join(','));
ок('порядок остальных не сбит',
   стало.filter(function(x){return x!=='M4A';}).join(',') === было.join(','), стало.join(','));
ок('повторное добавление не дублирует',
   дополнитьНовыми(стало).filter(function(x){return x==='M4A';}).length === 1, 'дубль');
// Если человек сам убрал соседа — не навязываем новинку.
ок('без соседа не добавляем', дополнитьНовыми(['M2','M3']).indexOf('M4A') === -1, 'добавили зря');
ок('пустой список не ломает', (дополнитьНовыми([])||[]).length === 0, 'что-то добавилось');
ок('и пустой вход тоже', (дополнитьНовыми(null)||[]).length === 0, 'что-то добавилось');

// Порядок в самом списке модулей — тот, что задала владелица.
var ids=MODULES.filter(function(m){return !m.hidden;}).map(function(m){return m.id;});
ок('в цепочке аудитория идёт после радара и до голоса клиента',
   ids.indexOf('M4') < ids.indexOf('M4A') && ids.indexOf('M4A') < ids.indexOf('M5'), ids.join(','));

console.log(провалов ? ('ПРОВАЛОВ: '+провалов) : 'новые модули доезжают до старых проектов');
