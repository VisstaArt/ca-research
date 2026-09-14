ObjC.import('Foundation');
// Дымовой тест инструмента: app.js обязан ВЫПОЛНИТЬСЯ, а не только
// распарситься. 14.09 правка разорвала «async function» на голый «async;» —
// Babel собрал, тесты блоков прошли, а браузер падал на загрузке, и владелица
// видела «вообще белое поле». Этот тест выполняет собранный файл в заглушках
// браузера и ловит любую ошибку модульного уровня до того, как её увидит человек.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var g=(0,eval)('this');
g.document={createElement:function(){return {style:{},dataset:{},setAttribute:function(){},appendChild:function(){},addEventListener:function(){},remove:function(){}};},
  getElementById:function(){return null;},querySelector:function(){return null;},head:{appendChild:function(){}},body:{appendChild:function(){},classList:{add:function(){}}},
  addEventListener:function(){},documentElement:{setAttribute:function(){},getAttribute:function(){return null;}}};
g.window=g; g.localStorage={getItem:function(){return null;},setItem:function(){},removeItem:function(){}};
g.location={search:'',href:'',origin:'',reload:function(){}};
g.navigator={userAgent:'smoke',clipboard:{}};
g.fetch=function(){return Promise.resolve({ok:false,json:function(){return Promise.resolve({});},text:function(){return Promise.resolve('');}});};
g.setInterval=function(){return 0;}; g.clearInterval=function(){}; g.setTimeout=function(f){return 0;}; g.clearTimeout=function(){};
g.React={useState:function(v){return [typeof v==='function'?v():v,function(){}];},useEffect:function(){},useCallback:function(f){return f;},useRef:function(v){return {current:v};},useMemo:function(f){return f();},createElement:function(){return {};},Fragment:'f',Component:function(){}};
g.ReactDOM={createRoot:function(){return {render:function(){}};},render:function(){}};
g.Chart=function(){}; g.Chart.register=function(){};
g.CAAuth={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',authFetch:g.fetch,getAccessToken:function(){return '';},signIn:function(){},signUp:function(){},clearTokens:function(){}};
eval(readFile(ROOT+'/lib/contract.js'));
g.CAContract=g.CAContract||globalThis.CAContract;
console.log('tests/app-smoke.test.js');
try {
  (new Function(readFile(ROOT+'/app.js'))).call(g);
  console.log('  ok   app.js выполняется без ошибок');
  console.log('\nвсё сошлось');
} catch(e){
  console.log('  FAIL app.js падает на загрузке: '+e.message+' (строка '+(e.line||'?')+')');
  console.log('\nПРОВАЛОВ: 1');
}
