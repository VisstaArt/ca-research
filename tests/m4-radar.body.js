var fails=0;
function check(n,g,w){var ok=JSON.stringify(g)===JSON.stringify(w);
 if(!ok){fails++;console.log('  FAIL '+n+' | ждали '+JSON.stringify(w)+' | факт '+JSON.stringify(g));}
 else console.log('  ok   '+n);}
renderTopContent([
 {t:'Как выбрать попап',v:52000,raw:'52 000',p:'YouTube',resp:'1 200 · 340',meta:'ролик · 8 мин · подписка',hook:'«Вы теряете половину заявок»',url:'https://y.ru/a'},
 {t:'Разбор кейса',v:9000,raw:'9 000',p:'Telegram',resp:'',meta:'пост',hook:'',url:''}]);
var h=document.getElementById('rpt-topc').innerHTML;
check('строк', (h.match(/class="tcrow"/g)||[]).length, 2);
check('первая полоса во всю ширину', /width:100\.0%/.test(h), true);
check('вторая пропорциональна', /width:17\.3%/.test(h), true);
check('хук отдельной строкой', (h.match(/class="tch"/g)||[]).length, 1);
check('ссылка у первой', /href="https:\/\/y\.ru\/a"/.test(h), true);
renderPatterns([['Короткие вертикальные видео','досматривают до конца','снимать до 60 секунд','строки 1, 3, 7']]);
var p=document.getElementById('rpt-patterns').innerHTML;
check('карточка паттерна', (p.match(/rule-card/g)||[]).length, 1);
check('подпись внизу', /Делаем: снимать до 60 секунд · Основано на: строки 1, 3, 7/.test(p), true);
// Источники радара: колонки у него свои — «Канал | Площадка | Чей | URL |
// Что видно публично». Общая рисовалка источников раньше подставляла в имя
// строки площадку, и строка выглядела пустой.
renderSources([[1,'Envybox','просмотры, комментарии, подписчики','конкурент','https://youtube.com/@envybox']]);
var sr=document.getElementById('rpt-srcs').innerHTML||'';
check('источники радара: имя канала, а не площадка', /Envybox/.test(sr), true);
check('источники радара: что видно публично на месте', /просмотры, комментарии, подписчики/.test(sr), true);
// Отпечаток кода — из данных, а не из момента отрисовки (тот же случай, что в
// M4A: старый прогон выглядел свежим, и мы разбирали его дважды).
var ИСХ=readFile(ROOT+'/app.jsx');
check('код сбора запоминается в данных M4', /кодСбора: отпечатокСборки\(\)/.test(ИСХ), true);
check('расхождение версий видно человеку',
  /данные с прошлого прогона, правки кода в них не попали/.test(ИСХ), true);

console.log(fails? '\nПРОВАЛОВ: '+fails : '\nвсё сошлось');
