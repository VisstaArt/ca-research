ObjC.import('Foundation');
// Разбор сайта: логотип и соцсети. Владелица дважды сообщала об одном и том
// же — «бриф не берёт логотип», «ВК не берёт, хотя он там». Причина была не в
// поиске, а в записи: поля заполнялись только когда были пустыми, и однажды
// записанное значение больше не менялось. Тест сторожит обе половины —
// и сбор со страницы, и правило записи в бриф.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var g=(0,eval)('this');
g.document={createElement:function(){return {style:{},dataset:{},setAttribute:function(){},appendChild:function(){},addEventListener:function(){},remove:function(){}};},
  getElementById:function(){return null;},querySelector:function(){return null;},head:{appendChild:function(){}},body:{appendChild:function(){},classList:{add:function(){}}},
  addEventListener:function(){},documentElement:{setAttribute:function(){},getAttribute:function(){return null;}}};
g.window=g; g.localStorage={getItem:function(){return null;},setItem:function(){},removeItem:function(){}};
g.location={search:'',href:'',origin:'',reload:function(){}};
g.navigator={userAgent:'smoke',clipboard:{}};
g.setInterval=function(){return 0;}; g.clearInterval=function(){}; g.setTimeout=function(f){return 0;}; g.clearTimeout=function(){};
g.React={useState:function(v){return [typeof v==='function'?v():v,function(){}];},useEffect:function(){},useCallback:function(f){return f;},useRef:function(v){return {current:v};},useMemo:function(f){return f();},createElement:function(){return {};},Fragment:'f',Component:function(){}};
g.ReactDOM={createRoot:function(){return {render:function(){}};},render:function(){}};
g.Chart=function(){}; g.Chart.register=function(){};
// В JXA нет конструктора URL — в браузере он есть. Заглушка ровно на тот
// случай, который нужен разбору: приклеить относительный путь к адресу страницы.
g.URL=function(путь, база){
  if (/^https?:\/\//i.test(путь)) { this.href=путь; return; }
  var корень=String(база||'').replace(/^(https?:\/\/[^/]+).*$/, '$1');
  this.href = корень + (путь.charAt(0)==='/' ? '' : '/') + путь;
};
g.CAAuth={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',authFetch:function(){},getAccessToken:function(){return '';},signIn:function(){},signUp:function(){},clearTokens:function(){}};
eval(readFile(ROOT+'/lib/contract.js'));

console.log('tests/site-brief.test.js');
var провалов=0;
function ок(имя,усл,что){ if(усл) console.log('  ok   '+имя); else { провалов++; console.log('  FAIL '+имя+(что?': '+что:'')); } }

// Страница «как в жизни»: знак в разметке организации, ВК с хвостом запроса,
// телеграм, кнопка «поделиться» во ВКонтакте и превью-картинка страницы.
var HTML = '<html><head>'
 + '<script type="application/ld+json">{"@type":"Organization","logo":"/static/logo.svg"}</script>'
 + '<link rel="apple-touch-icon" href="/static/apple-touch-icon.png">'
 + '<meta property="og:image" content="https://site.ru/static/og-cover.jpg">'
 + '</head><body>'
 + '<a href="https://vk.com/club12345?from=header">ВК</a>'
 + '<a href="https://t.me/kanal">Телеграм</a>'
 + '<a href="https://vk.com/share.php?url=https://site.ru">Поделиться</a>'
 + '<a href="https://vk.com/">Просто ВК</a>'
 + '<div style="color:#1fb6a8">…</div></body></html>';

g.fetch=function(u){
  var первая = String(u).indexOf(encodeURIComponent('https://site.ru')) >= 0
            && String(u).indexOf('%2F', String(u).indexOf(encodeURIComponent('https://site.ru'))+20) < 0;
  return Promise.resolve({ok:true, text:function(){return Promise.resolve(HTML);}});
};

(new Function(readFile(ROOT+'/app.js')+';globalThis.fetchSite=fetchSite;')).call(g);

// Проверка исходника — синхронная часть.
// Правило записи в бриф: разбор сайта не должен молчать, если поля уже
// заполнены — иначе однажды записанный логотип остаётся навсегда.
var src=readFile(ROOT+'/app.jsx');
var блок=src.slice(src.indexOf('if (дизайн) setBrief'), src.indexOf('if (дизайн) setBrief')+900);
ок('логотип перезаписывается при новом разборе', /\.\.\.\(дизайн\.logo \? \{ brandLogo/.test(блок), блок.slice(0,200));
ок('логотип не прячется за «поле пустое»', !/дизайн\.logo && !p\.brandLogo/.test(блок));
ок('соцсети дополняются, а не заменяются', /new Set\([\s\S]{0,200}p\.socials/.test(блок));

g.fetchSite('site.ru').then(function(r){
  var д = r.дизайн;
  ок('логотип берётся из разметки организации, а не превью-картинка',
     /logo\.svg$/.test(д.logo), 'взято: '+д.logo);
  ок('логотипом не становится og:image', !/og-cover/.test(д.logo||''), д.logo);
  var соц = (д.socials||[]);
  var строка = соц.join(' ');
  ок('ВК попал в соцсети, несмотря на хвост запроса', /vk\.com\/club12345/.test(строка), строка);
  ок('хвост «?from=…» отрезан', строка.indexOf('?') < 0, строка);
  ок('телеграм попал', /t\.me\/kanal/.test(строка), строка);
  ок('кнопка «поделиться» отброшена', строка.indexOf('share.php') < 0, строка);
  ок('голый домен без имени профиля отброшен',
     !соц.some(function(x){ return /^https?:\/\/(?:www\.)?vk\.com\/?$/.test(x); }), строка);
  console.log(провалов ? ('ПРОВАЛОВ: '+провалов) : 'всё сошлось');
}, function(e){
  console.log('  FAIL разбор сайта упал: '+e.message);
  console.log('ПРОВАЛОВ: '+(провалов+1));
});
