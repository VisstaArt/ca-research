ObjC.import('Foundation');
// Замер каналов: подписчики и охват снимаются с публичных страниц, а не
// берутся со слов модели (владелица 16.09: «на каком основании ты говоришь,
// что это залетело, если замеров нет»). Сеть подменена — проверяется разбор.
function readFile(p){return $.NSString.stringWithContentsOfFileEncodingError($(p),$.NSUTF8StringEncoding,null).js;}
var ROOT=$.NSFileManager.defaultManager.currentDirectoryPath.js;
var SRC=readFile(ROOT+'/app.jsx');
function взять(n){var i=SRC.indexOf('async function '+n+'('); if(i<0) i=SRC.indexOf('function '+n+'(');
 if(i<0) throw new Error('нет '+n);
 var d=0; for(var k=SRC.indexOf('{',i);k<SRC.length;k++){if(SRC[k]==='{')d++;else if(SRC[k]==='}'){d--;if(!d)return SRC.slice(i,k+1);}}}
console.log('tests/channels-measure.test.js');
var fails=0;
function ok(n,g,w){var r=JSON.stringify(g)===JSON.stringify(w);
 if(!r){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}

globalThis.PROXY='https://proxy.test';
var iМ=SRC.indexOf('const КАНАЛОВ_ЗАМЕР_МАКС');
eval(SRC.slice(iМ, SRC.indexOf('\n', iМ)).replace('const ','globalThis.'));
eval(взять('числоИзТекста')); eval(взять('медиана')); eval(взять('замерКанала')); eval(взять('замерКаналовСтрогое'));

// Разбор чисел: «12,3K», «1,2 тыс.», «12 345».
ok('тысячи латиницей', числоИзТекста('12,3K'), 12300);
ok('тысячи по-русски', числоИзТекста('1,2 тыс.'), 1200);
ok('число с пробелами', числоИзТекста('12 345'), 12345);
ok('миллионы', числоИзТекста('1,5M'), 1500000);

// Страница Telegram: подписчики в шапке, просмотры у каждого поста.
var страницы={
  'https://t.me/s/good':'<div class="tgme_page_extra">12 345 subscribers</div>'
    +'<span class="tgme_widget_message_views">1,2K</span>'
    +'<span class="tgme_widget_message_views">800</span>'
    +'<span class="tgme_widget_message_views">3,4K</span>',
  'https://youtube.com/@chan':'"viewCount":"5000" "viewCount":"9000" 273 тыс. подписчиков',
  'https://closed.example/x':'',
};
globalThis.fetch=function(u){
  var адрес=decodeURIComponent(String(u).split('url=')[1]||'');
  var html=страницы[адрес];
  return Promise.resolve({ ok: html!==undefined, text:function(){ return Promise.resolve(html||''); } });
};

замерКанала('https://t.me/good').then(function(з){
  ok('подписчики сняты со страницы', з.подписчики, 12345);
  ok('охват — медиана, а не среднее', з.просмотры, 1200);
  ok('видно, по скольким постам', з.постов, 3);
  return замерКанала('https://youtube.com/@chan');
}).then(function(з2){
  ok('ютуб: просмотры сняты (медиана двух)', з2.просмотры, 7000);
  return замерКанала('https://closed.example/x');
}).then(function(з3){
  ok('закрытая страница — не выдумываем', з3, null);
  var д={каналы:[
    {канал:'Хороший',url:'https://t.me/good',подписчики:'не замерено',чей:'конкурент'},
    {канал:'Закрытый',url:'https://closed.example/x',подписчики:'12 000 (со слов)',чей:'конкурент'}]};
  return замерКаналовСтрогое(д);
}).then(function(р){
  ok('замер перебил «не замерено»', /12 345 \(замер\)/.test(р.каналы[0].подписчики), true);
  ok('охват записан', /1 200 просмотров/.test(р.каналы[0].охват), true);
  ok('где не открылось — прежнее значение', р.каналы[1].подписчики, '12 000 (со слов)');
  ok('счётчик замеров записан', р.замерКаналов.всего, 1);
  // Свои каналы берутся ИЗ БРИФА: у заказчика был ВК, а в отчёт он не попал,
  // потому что модель его в поиске не встретила (владелица 16.09).
    eval(взять('clientSocials'));
  eval(взять('замерСвоихКаналов'));
  страницы['https://vk.com/we']='<div>0 подписчиков</div>';
  замерСвоихКаналов({каналы_заказчика:[]},{socials:'https://vk.com/we https://t.me/good'})
    .then(function(р2){
      ok('оба канала из брифа на месте', р2.каналы_заказчика.length, 2);
      // Подпись «Telegram» ничего не говорит, когда каналов несколько.
      ok('видно, какой именно канал', /we/.test(р2.каналы_заказчика[0].площадка), true);
      ok('ноль подписчиков — это замер, а не пустота',
         /0 \(замер\)/.test(р2.каналы_заказчика[0].подписчики), true);
      ok('у второго снят охват',
         /просмотров, медиана по 3 постам/.test(р2.каналы_заказчика[1].охват), true);
      console.log(fails?('ПРОВАЛЕНО: '+fails):'всё сошлось');
    });
  }).catch(function(e){ console.log('  FAIL замер упал: '+e.message); });

// Метрики из списка владелицы 16.09: вовлечённость (ER), частота и время
// публикаций, форматы. Всё снимается с той же публичной витрины.
(function(){
  var полная='<div class="tgme_page_extra">10 000 subscribers</div>'
    +'<time datetime="2026-09-01T10:00:00+00:00"></time>'
    +'<span class="tgme_widget_message_views">1000</span>'
    +'<div class="tgme_widget_message_reactions"><span class="tgme_reaction"><i class="emoji"><b>d</b></i>60</span><span class="tgme_reaction"><i class="emoji"><b>d</b></i>40</span></div>'
    +'<div class="tgme_widget_message_photo"></div>'
    +'<time datetime="2026-09-08T10:00:00+00:00"></time>'
    +'<span class="tgme_widget_message_views">2000</span>'
    +'<div class="tgme_widget_message_reactions"><span class="tgme_reaction"><i class="emoji"><b>d</b></i>300</span></div>'
    +'<div class="tgme_widget_message_video"></div>';
  страницы['https://t.me/s/full']=полная;
  замерКанала('https://t.me/full').then(function(з){
    ok('вовлечённость посчитана от подписчиков', з.er, 2);
    ok('реакции — медиана', з.реакции, 200);
    ok('частота публикаций в неделю', з.в_неделю, 2);
    ok('время публикаций определено', /:00/.test(з.часы), true);
    ok('форматы посчитаны долями', /%/.test(з.форматы), true);
    console.log(fails?('ПРОВАЛЕНО(метрики): '+fails):'  метрики каналов сняты');
  });
})();
