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
  // Очередь замера: сначала то, что отдаёт числа. Раньше лимит съедали блоги
  // на сайтах, и до телеграм-каналов конкурентов очередь не доходила — вся
  // таблица была «не замерено» (владелица 17.09).
  ok('счётчик замеров записан', р.замерКаналов.всего, 1);
  // Свои каналы берутся ИЗ БРИФА: у заказчика был ВК, а в отчёт он не попал,
  // потому что модель его в поиске не встретила (владелица 16.09).
    eval(взять('clientSocials'));
  eval(взять('замерСвоихКаналов'));
  страницы['https://vk.com/we']='<div>0 подписчиков</div>';
  замерСвоихКаналов({каналы_заказчика:[]},{socials:'https://vk.com/we https://t.me/good https://max.ru/my'})
    .then(function(р2){
      ok('все каналы из брифа на месте', р2.каналы_заказчика.length, 3);
      // Подпись «Telegram» ничего не говорит, когда каналов несколько.
      ok('видно, какой именно канал', /we/.test(р2.каналы_заказчика[0].площадка), true);
      // Площадка не отдала страницу — это НЕ «постов нет» (владелица 17.09:
      // канал в MAX живой, с просмотрами, а отчёт написал «публичных постов нет»).
      var макс=р2.каналы_заказчика.find(function(к){return /max\.ru/.test(к.ссылка||'');})||{};
      ok('закрытая площадка помечена причиной, а не «постов нет»',
         /не отдаёт страницу/.test(String(макс.почему_не_замерено||'')), true);
      ok('у прочитанных каналов пометки нет',
         String(р2.каналы_заказчика[0].почему_не_замерено||''), '');
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

// Каналы конкурентов берём С ИХ САЙТОВ, а не из веб-поиска: ссылки на
// соцсети лежат в подвале их страниц (владелица 17.09).
(function(){
  var fails2=0;
  function ок(имя,усл,что){ if(усл) console.log('  ok   '+имя); else { fails2++; console.log('  FAIL '+имя+(что?': '+что:'')); } }
  var страницы2={
    'https://envybox.io':'<footer><a href="https://t.me/envybox">tg</a>'
      +'<a href="https://vk.com/envybox?from=footer">vk</a>'
      +'<a href="https://vk.com/share.php?url=x">поделиться</a>'
      +'<a href="https://youtube.com/@envybox">yt</a></footer>',
    'https://tihiy.ru':'<footer>нет соцсетей</footer>',
    'https://tihiy.ru/contacts':'<a href="https://t.me/tihiy_channel">канал</a>',
  };
  // Подменяем сеть СЛОЕМ: чужие адреса отдаём прежней заглушке, иначе рвём
  // цепочку замеров, которая ещё идёт выше.
  var прежний=globalThis.fetch;
  globalThis.fetch=function(u){
    var адрес=decodeURIComponent(String(u).split('url=')[1]||'');
    if (!(адрес in страницы2)) return прежний(u);
    var html=страницы2[адрес];
    return Promise.resolve({ ok: true, text:function(){ return Promise.resolve(html); } });
  };
  eval(взять('соцсетиИзHTML')); eval(взять('площадкаПоАдресу'));
  eval(взять('конкурентыССайтамиИзM3')); eval(взять('каналыКонкурентовССайтов'));
  var список=конкурентыССайтамиИзM3({ строгое:{ конкуренты:[
    {название:'Envybox',сайт:'envybox.io'},
    {название:'Тихий',сайт:'tihiy.ru'},
    {название:'Без сайта',сайт:''}]}});
  ок('конкуренты с сайтами отобраны', список.length===2, JSON.stringify(список));
  каналыКонкурентовССайтов(список).then(function(р){
    var адреса=р.каналы.map(function(к){return к.url;});
    ок('телеграм конкурента найден', адреса.indexOf('https://t.me/envybox')>=0, адреса.join(' '));
    ок('вк с хвостом запроса найден', adresOk(адреса,'vk.com/envybox'), адреса.join(' '));
    ок('кнопка «поделиться» отброшена', адреса.join(' ').indexOf('share.php')<0, адреса.join(' '));
    ок('площадка распознана', р.каналы[0].площадка==='Telegram', р.каналы[0].площадка);
    ок('у кого на главной пусто — смотрим контакты',
       адреса.indexOf('https://t.me/tihiy_channel')>=0, адреса.join(' '));
    ок('имя конкурента сохранено',
       р.каналы.some(function(к){return к.конкурент==='Envybox';}), JSON.stringify(р.каналы[0]));
    console.log(fails2?('ПРОВАЛЕНО(каналы с сайтов): '+fails2):'  каналы сняты с сайтов конкурентов');
  });
  function adresOk(a,ч){ return a.some(function(x){ return x.indexOf(ч)>=0; }); }
})();

// Контент собираем С САМИХ КАНАЛОВ конкурентов: витрина Telegram отдаёт текст
// поста, просмотры, реакции и дату (владелица 17.09: «и контент тогда с них
// собирай, а то получается какая-то фигня неподходящая»).
(function(){
  var f3=0;
  function ок(имя,усл,что){ if(усл) console.log('  ok   '+имя); else { f3++; console.log('  FAIL '+имя+(что?': '+что:'')); } }
  eval(взять('постыКанала')); eval(взять('материалыКаналовКонкурентов'));
  var пост=function(н,текст,просм,реакц,дата){
    return '<div class="tgme_widget_message" data-post="envybox/'+н+'">'
      +'<time datetime="'+дата+'T10:00:00+00:00"></time>'
      +'<div class="tgme_widget_message_text">'+текст+'</div>'
      +'<div class="tgme_widget_message_reactions"><span class="tgme_reaction"><i class="emoji"><b>d</b></i>'+реакц+'</span></div>'
      +'<span class="tgme_widget_message_views">'+просм+'</span></div>';
  };
  var витрина=пост(1,'Как вернуть уходящего посетителя <b>попапом</b>',1000,10,'2026-09-01')
            +пост(2,'Дайджест новостей рынка',5000,5,'2026-09-05');
  var прежний2=globalThis.fetch;
  globalThis.fetch=function(u){
    var адрес=decodeURIComponent(String(u).split('url=')[1]||'');
    if (адрес!=='https://t.me/s/envybox') return прежний2(u);
    return Promise.resolve({ok:true,text:function(){return Promise.resolve(витрина);}});
  };
  постыКанала('https://t.me/envybox','Envybox').then(function(п){
    ок('посты сняты с витрины', п.length===2, JSON.stringify(п).slice(0,120));
    ок('разметка вычищена из текста', п[0].текст.indexOf('<')<0, п[0].текст);
    ок('первым идёт пост с большей долей отклика', п[0].доля===1, JSON.stringify(п[0]));
    ок('просмотры сняты', п[0].просмотры===1000, String(п[0].просмотры));
    ок('реакции сняты', п[0].реакции===10, String(п[0].реакции));
    ок('адрес поста собран', п[0].url==='https://t.me/envybox/1', п[0].url);
    ок('имя конкурента при посте', п[0].чей==='Envybox', п[0].чей);
    ок('дата сохранена', п[0].дата==='2026-09-01', п[0].дата);
    return материалыКаналовКонкурентов([{url:'https://t.me/envybox',конкурент:'Envybox'}]);
  }).then(function(в){
    ок('сборка по всем каналам работает', в.посты.length===2, String(в.посты.length));
    // Дзен: страница канала закрыта входом, но служебная выгрузка ленты
    // открыта — оттуда темы и даты, просмотров там нет (проверено 17.09).
    eval(взять('постыДзен'));
    var дзенОтвет={items:[
      {title:'Пять ошибок в попапах',text:'Разбираем на примерах',link:'https://dzen.ru/a/abc?from=channel',
       publication_date:'1789601708',timeToReadSeconds:'180',socialInfo:{commentCount:4}},
      {title:'',text:'пусто'}]};
    var прежний4=globalThis.fetch;
    globalThis.fetch=function(u){
      var адрес=decodeURIComponent(String(u).split('url=')[1]||'');
      if (адрес.indexOf('dzen.ru/api/v3/launcher/export')<0) return прежний4(u);
      return Promise.resolve({ok:true,json:function(){return Promise.resolve(дзенОтвет);}});
    };
    постыДзен('https://dzen.ru/envybox','Envybox').then(function(д){
      ок('публикации Дзена сняты', д.length===1, String(д.length));
      ок('пустые заголовки отброшены', д[0].заголовок==='Пять ошибок в попапах', д[0].заголовок);
      ок('просмотров у Дзена нет — и мы их не выдумываем', д[0].просмотры===null, String(д[0].просмотры));
      ок('комментарии сняты', д[0].комментарии===4, String(д[0].комментарии));
      ок('время чтения в минутах', д[0].минут_чтения===3, String(д[0].минут_чтения));
      ок('хвост ссылки отрезан', д[0].url==='https://dzen.ru/a/abc', д[0].url);
      console.log(f3?('ПРОВАЛЕНО(посты с каналов): '+f3):'  контент снят с каналов конкурентов');
    });
  });
})();

// Статьи на vc.ru: числа снимаются через открытый API площадки, и видно,
// какие материалы написаны самими конкурентами (владелица 17.09 — «будем
// попадать на их SEO-статьи и видеть просмотры и лайки»).
(function(){
  var f4=0;
  function ок(имя,усл,что){ if(усл) console.log('  ok   '+имя); else { f4++; console.log('  FAIL '+имя+(что?': '+что:'')); } }
  eval(взять('метрикиVC')); eval(взять('статьиКонкурентовVC'));
  var ответы={
    'https://api.vc.ru/v2.5/content?id=3141688':{result:{id:3141688,title:'Как вернуть уходящего посетителя',
      url:'https://vc.ru/marketing/3141688-popap',date:1789556558,
      author:{name:'Envybox'},subsite:{name:'Маркетинг'},
      counters:{views:11102,reactions:21,favorites:14,comments:36}}},
    'https://api.vc.ru/v2.5/content?id=999111':{result:{id:999111,title:'Чужой обзор сервисов',
      url:'https://vc.ru/services/999111-obzor',date:1789000000,
      author:{name:'Иван Петров'},subsite:{name:'Сервисы'},
      counters:{views:500,reactions:2,favorites:1,comments:0}}},
  };
  var прежний3=globalThis.fetch;
  globalThis.fetch=function(u){
    var адрес=decodeURIComponent(String(u).split('url=')[1]||'');
    if (!(адрес in ответы)) return прежний3(u);
    var д=ответы[адрес];
    return Promise.resolve({ ok:true, json:function(){ return Promise.resolve(д); } });
  };
  статьиКонкурентовVC([
    'https://vc.ru/marketing/3141688-popap',
    'https://vc.ru/services/999111-obzor',
    'https://t.me/other/1'], ['Envybox','Callibri']).then(function(а){
    ок('статьи vc.ru разобраны', а.length===2, String(а.length));
    ок('чужие площадки пропущены', а.every(function(x){return x.площадка==='vc.ru';}), JSON.stringify(а[0]));
    ок('первой идёт статья конкурента', а[0].чей==='Envybox', JSON.stringify(а[0].чей));
    ок('просмотры сняты', а[0].просмотры===11102, String(а[0].просмотры));
    ок('реакции = лайки + избранное', а[0].реакции===35, String(а[0].реакции));
    ок('комментарии сняты', а[0].комментарии===36, String(а[0].комментарии));
    ок('дата человеческая', а[0].дата==='2026-09-17'||/^\d{4}-\d{2}-\d{2}$/.test(а[0].дата), а[0].дата);
    ок('чужая статья не помечена как наша', а[1].чей==='', JSON.stringify(а[1].чей));
    console.log(f4?('ПРОВАЛЕНО(vc.ru): '+f4):'  статьи vc.ru замерены');
  });
})();

// Дзен как канал: замер идёт через выгрузку ленты, потому что обычная
// страница закрыта входом (проверено 17.09 на dzen.ru/aikrolik).
(function(){
  var f5=0;
  function ок(имя,усл,что){ if(усл) console.log('  ok   '+имя); else { f5++; console.log('  FAIL '+имя+(что?': '+что:'')); } }
  var лента={channel:{source:{title:'Ai Кролик',subscribers:120}},items:[
    {title:'Попапы бесят',text:'разбор',link:'https://dzen.ru/a/a1?from=channel',
     publication_date:'1787000000',timeToReadSeconds:'60',views:300,socialInfo:{likesCount:10,commentCount:1}},
    {title:'Воронка готова',text:'разбор',link:'https://dzen.ru/a/a2',
     publication_date:'1787600000',timeToReadSeconds:'120',socialInfo:{likesCount:20,commentCount:0}},
  ]};
  // Функции берём заново: замерКанала зовёт постыДзен, а она объявлена в
  // другом блоке теста и глобально не видна.
  eval(взять('постыДзен')); globalThis.постыДзен=постыДзен;
  eval(взять('замерКанала')); globalThis.замерКанала=замерКанала;
  var прежний5=globalThis.fetch;
  globalThis.fetch=function(u){
    var адрес=decodeURIComponent(String(u).split('url=')[1]||'');
    if (адрес.indexOf('dzen.ru/api/v3/launcher/export')<0) return прежний5(u);
    return Promise.resolve({ok:true,json:function(){return Promise.resolve(лента);}});
  };
  замерКанала('https://dzen.ru/aikrolik').then(function(з){
    ок('канал Дзена замерен', !!з, 'null');
    if (з) {
      ок('подписчики сняты', з.подписчики===120, String(з.подписчики));
      ок('просмотры — только те, что площадка отдала', з.просмотры===300, String(з.просмотры));
      ок('лайки как реакции', з.реакции===15, String(з.реакции));
      ок('публикаций посчитано', з.постов===2, String(з.постов));
      ок('частота посчитана по датам', з.в_неделю>0, String(з.в_неделю));
      ок('видно, откуда данные', з.откуда==='лента Дзена', з.откуда);
    }
    console.log(f5?('ПРОВАЛЕНО(Дзен): '+f5):'  канал Дзена замерен лентой');
  });
})();

// Свои статьи на vc.ru: аккаунт общий, автор пишет и для других клиентов —
// нашей считается статья, где в тексте есть наш сайт или имя (владелица 17.09:
// «у нас там указана ссылка на ловец-лидов.рф прямо в тексте»).
(function(){
  var f6=0;
  function ок(имя,усл,что){ if(усл) console.log('  ok   '+имя); else { f6++; console.log('  FAIL '+имя+(что?': '+что:'')); } }
  // В JXA нет конструктора URL, в браузере есть — и именно он переводит
  // кириллический домен в punycode. Заглушка повторяет это поведение.
  globalThis.URL=function(адрес){
    var host=String(адрес).replace(/^https?:\/\//,'').replace(/\/.*$/,'');
    this.hostname = host==='ловец-лидов.рф' ? 'xn----ctbbhdtrdxg7f.xn--p1ai' : host;
  };
  eval(взять('признакиКлиента')); eval(взять('упоминаетКлиента'));
  eval(взять('метрикиVC')); eval(взять('моиСтатьиVC'));
  var статья={result:{id:3104744,title:'Три ловушки в данных',url:'https://vc.ru/services/3104744-lovushki',
    date:1788043751,author:{id:705136,name:'Михаил Мятов'},subsite:{name:'Сервисы'},
    counters:{views:461,reactions:0,favorites:1,comments:0}}};
  var лента={result:{lastId:null,items:[
    {data:{id:3104744,title:'Три ловушки в данных',url:'https://vc.ru/services/3104744-lovushki',
      date:1788043751,author:{id:705136,name:'Михаил Мятов'},counters:{views:461,reactions:0,favorites:1,comments:0},
      blocks:[{data:{text:'подробнее на ловец-лидов.рф'}}]}},
    {data:{id:3104999,title:'Попап для SaaS',url:'https://vc.ru/services/3104999-popap',
      date:1788143751,author:{id:705136,name:'Михаил Мятов'},counters:{views:406,reactions:2,favorites:0,comments:1},
      blocks:[{data:{text:'ставим виджет xn----ctbbhdtrdxg7f.xn--p1ai'}}]}},
    {data:{id:3105111,title:'Психолог: какой диплом нужен',url:'https://vc.ru/services/3105111-psiholog',
      date:1788243751,author:{id:705136,name:'Михаил Мятов'},counters:{views:264,reactions:0,favorites:0,comments:0},
      blocks:[{data:{text:'про переподготовку психологов'}}]}},
  ]}};
  var прежний6=globalThis.fetch;
  globalThis.fetch=function(u){
    var адрес=decodeURIComponent(String(u).split('url=')[1]||'');
    if (адрес.indexOf('api.vc.ru/v2.5/content?id=3104744')>=0)
      return Promise.resolve({ok:true,json:function(){return Promise.resolve(статья);}});
    if (адрес.indexOf('api.vc.ru/v2.5/timeline?subsitesIds=705136')>=0)
      return Promise.resolve({ok:true,json:function(){return Promise.resolve(лента);}});
    return прежний6(u);
  };
  var бриф={siteUrl:'https://ловец-лидов.рф', name:'Ловец-Лидов.рф'};
  var пр=признакиКлиента(бриф);
  ок('домен в признаках', пр.indexOf('ловец-лидов.рф')>=0, пр.join(','));
  ок('punycode-вариант домена тоже', пр.some(function(x){return x.indexOf('xn--')>=0;}), пр.join(','));
  моиСтатьиVC('https://vc.ru/services/3104744-lovushki', бриф).then(function(р){
    var имена=р.статьи.map(function(а){return а.заголовок;});
    ок('наши статьи отобраны', р.статьи.length===2, имена.join(' | '));
    ок('чужая тема того же автора отсеяна', имена.indexOf('Психолог: какой диплом нужен')<0, имена.join(' | '));
    ок('сильные сверху', р.статьи[0].просмотры===461, String(р.статьи[0].просмотры));
    ок('реакции = лайки + избранное', р.статьи[0].реакции===1, String(р.статьи[0].реакции));
    ок('автор запомнен', (р.авторы||[]).indexOf('Михаил Мятов')>=0, (р.авторы||[]).join(','));
    console.log(f6?('ПРОВАЛЕНО(свои vc.ru): '+f6):'  свои статьи на vc.ru отобраны по упоминанию');
  });
})();

// Очередь замера каналов: блоги на сайтах чисел не отдают, и попытки на них
// не тратятся — иначе до телеграм-каналов конкурентов дело не доходит
// (владелица 17.09: «даже телеграм нигде не замерен»).
(function(){
  var f7=0;
  function ок(имя,усл,что){ if(усл) console.log('  ok   '+имя); else { f7++; console.log('  FAIL '+имя+(что?': '+что:'')); } }
  var спрошено=[];
  var прежний7=globalThis.fetch;
  globalThis.fetch=function(u){
    var адрес=decodeURIComponent(String(u).split('url=')[1]||'');
    спрошено.push(адрес);
    if (адрес.indexOf('t.me/s/callibri')>=0)
      return Promise.resolve({ok:true,text:function(){return Promise.resolve(
        '<span class="counter_value">3.96K</span> <span class="counter_type">subscribers</span>'
        +'<span class="tgme_widget_message_views">645</span>'
        +'<span class="tgme_widget_message_views">442</span>');}});
    return прежний7(u);
  };
  var д={каналы:[]};
  for (var i=0;i<20;i++) д.каналы.push({канал:'Блог '+i,площадка:'блог на сайте',url:'https://site'+i+'.ru/blog'});
  д.каналы.push({канал:'Callibri',площадка:'Telegram',url:'https://t.me/callibri'});
  замерКаналовСтрогое(д,{}).then(function(р){
    var телеграмСпрошен=спрошено.some(function(а){return а.indexOf('t.me/s/callibri')>=0;});
    ок('телеграм замерен, несмотря на два десятка блогов перед ним', телеграмСпрошен, спрошено.slice(0,3).join(' '));
    ок('на блоги попытки не тратились',
       !спрошено.some(function(а){return а.indexOf('site0.ru')>=0;}), спрошено.slice(0,3).join(' '));
    var к=р.каналы.find(function(x){return /callibri/.test(x.url||'');})||{};
    ок('подписчики попали в строку', /3\s?960 \(замер\)/.test(String(к.подписчики||'')), String(к.подписчики));
    console.log(f7?('ПРОВАЛЕНО(очередь замера): '+f7):'  очередь замера каналов верна');
  });
})();
