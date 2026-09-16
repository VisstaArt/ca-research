// Сборка: JSX → готовый для браузера JS.
//
// Зачем: без неё браузер качает трёхмегабайтный Babel при КАЖДОМ первом
// открытии и собирает страницу у себя. Владелица 07.09.2026: «сайт
// открывается, только загружается долго». Собираем заранее — браузер получает
// готовое.
//
// Почему не npm/webpack: node на этой машине не установлен, и ставить его ради
// одного шага незачем. Babel лежит рядом файлом и запускается движком JS,
// встроенным в macOS. Никаких зависимостей, никакой установки.
//
// Запуск:  osascript -l JavaScript tools/build.js
ObjC.import('Foundation');
// В JXA есть console.log, но НЕТ console.error и console.warn. Babel зовёт
// console.error, когда исходник переваливает за 500 КБ («деоптимизация
// форматирования») — предупреждение безобидное, но сборка падала на нём
// целиком. 11.09.2026: app.jsx перешагнул порог, когда в него встали стили
// макета и библиотеки. Подставляем недостающие методы.
if (typeof console !== 'undefined') {
  if (!console.error) console.error = function(){};
  if (!console.warn) console.warn = function(){};
}
var BASE = '/Users/apr/Projects/ca-research/';

function rd(p) {
  var e = $();
  var s = $.NSString.stringWithContentsOfFileEncodingError($(p), $.NSUTF8StringEncoding, e);
  if (!s.js && s.js !== '') throw new Error('не читается: ' + p);
  return s.js;
}
function wr(p, text) {
  $(text).writeToFileAtomicallyEncodingError($(p), true, $.NSUTF8StringEncoding, $());
}
// Короткий отпечаток исходника. Лежит в шапке собранного файла, чтобы можно
// было проверить, что собранное соответствует исходному — см. tools/check.js.
function fingerprint(s) {
  var h1 = 5381, h2 = 52711;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    h1 = ((h1 * 33) ^ c) >>> 0;
    h2 = ((h2 * 31) + c) >>> 0;
  }
  return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
}

eval(rd(BASE + 'tools/babel.min.js'));

// html — страница, в которой надо проставить метку версии у <script src>.
// Без метки браузер отдаёт из кэша вчерашний файл, и человек не видит правок:
// владелица 08.09.2026 не нашла новый переключатель, хотя на сайте он уже был.
var TARGETS = [,
               { src: 'app.jsx',   out: 'app.js',   html: 'index.html' }];

var built = 0;
TARGETS.forEach(function (t) {
  var src = rd(BASE + t.src);
  var code = Babel.transform(src, { presets: ['react'] }).code;
  // Проверяем, что вышло разбираемое: молча выложить сломанный файл — худшее,
  // что может сделать сборка, человек увидит белый экран без объяснений.
  new Function(code);
  var head = '// СОБРАНО АВТОМАТИЧЕСКИ из ' + t.src + ' — не править руками.\n'
           + '// Правки вносить в ' + t.src + ', затем: osascript -l JavaScript tools/build.js\n'
           + '// отпечаток-исходника: ' + fingerprint(src) + '\n';
  wr(BASE + t.out, head + code);

  // Метка версии в адресе скрипта. Меняется вместе с кодом, поэтому браузер
  // обязан скачать новый файл, а не достать вчерашний из кэша.
  var fp = fingerprint(src).slice(0, 8);
  var page = rd(BASE + t.html);
  var re = new RegExp('src="' + t.out.replace('.', '\\.') + '(\\?v=[0-9a-f]+)?"');
  if (!re.test(page)) throw new Error('в ' + t.html + ' не найден <script src="' + t.out + '">');
  wr(BASE + t.html, page.replace(re, 'src="' + t.out + '?v=' + fp + '"'));

  console.log('  ' + t.src + ' → ' + t.out + '  (' + Math.round(code.length / 1024) + ' КБ, версия ' + fp + ')');
  built++;
});

// Эталон отдельным файлом для оболочки. До 13.09 оболочка несла СВОЮ копию
// правил: она отстала, и половина классов согласованного меню (navgrid,
// navtile, navlist, grp) в ней просто отсутствовала — меню рисовалось голыми
// кнопками. Источник теперь один, как у контент-машины.
(function () {
  var src = rd(BASE + 'app.jsx');
  var i = src.indexOf('const REPORT_CSS = "');
  if (i < 0) { console.log('  REPORT_CSS не найден — пропускаю'); return; }
  var j = src.indexOf('"', i + 'const REPORT_CSS = '.length), end = -1;
  for (var k = j + 1; k < src.length; k++) {
    if (src[k] === '\\') { k++; continue; }
    if (src[k] === '"') { end = k; break; }
  }
  if (end < 0) throw new Error('литерал REPORT_CSS не закрыт');
  var css = JSON.parse(src.slice(j, end + 1));
  // Полный стиль отчёта, а не только страничная константа. Половина вида
  // блоков (итог модуля, карточки, полосы, единая шапка таблиц) живёт
  // инлайн-строками в хвосте сборки и константами REPORT_*_CSS — без них
  // файл эталона описывал страницу, но не блоки, и инструмент рисовал
  // «половину не так» (слова владелицы, 14.09.2026).
  function grabConst(name) {
    var gi = src.indexOf('const ' + name + ' = "');
    if (gi < 0) return '';
    var gj = src.indexOf('"', gi + ('const ' + name + ' = ').length), ge = -1;
    for (var gk = gj + 1; gk < src.length; gk++) {
      if (src[gk] === '\\') { gk++; continue; }
      if (src[gk] === '"') { ge = gk; break; }
    }
    return ge < 0 ? '' : JSON.parse(src.slice(gj, ge + 1));
  }
  ['REPORT_BLOCK_CSS','REPORT_M1_CSS','REPORT_M7_CSS','REPORT_M2_CSS','REPORT_M4_CSS',
   'REPORT_LIB2_CSS','REPORT_LIB3_CSS','REPORT_COMP_CSS','REPORT_LIB4_CSS','REPORT_PERS_CSS',
   'REPORT_M5_CSS','REPORT_DEMO_CSS','REPORT_M3_CSS','REPORT_RULES_CSS'
  ].forEach(function (n2) { css += '\n' + grabConst(n2); });
  // Токены, которые выгрузка отчёта добавляет ПОСЛЕ константы (палитра,
  // шкала кеглей, --raise): без них файл эталона неполный — инструмент,
  // подключающий его, оставался без --mid и --fs-*. Достаём те же строки,
  // что вшивает generateHTMLReport, — источник один, копий нет.
  // Блоки :root разрезаны на несколько строковых кусков через «+» — по одному
  // литералу их не собрать. Декодируем ВЕСЬ хвост сборки отчёта (от <style> до
  // </style>), как для перламутра, и вынимаем цельные :root из готового CSS.
  var a1 = src.indexOf("+'<style>'+REPORT_CSS");
  var a2 = src.indexOf("+'</style>", a1);
  var сборка = '';
  if (a1 >= 0 && a2 > a1) {
    var rf = /'((?:[^'\\]|\\.)*)'/g, fq;
    var хвост = src.slice(a1, a2);
    while ((fq = rf.exec(хвост)))
      сборка += fq[1].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
  }
  // Хвост декодирован целиком — это и есть инлайн-добавки; в файл они идут
  // все, отдельным куском ниже констант. «<style>» из первого фрагмента
  // отрезаем. Токены дополнительно складываем в свой файл — инструменту
  // нужны они, а не страничная часть отчёта.
  // Теги <style> вырезаем ВСЕ, а не только первый: хвост склеен из нескольких
  // вставок, и каждая несёт свою пару тегов. Оставшийся «<style>» посреди CSS
  // прилипает к следующему селектору, браузер его не понимает и ВЫБРАСЫВАЕТ
  // правило — так молча пропадали .sech (подписи разделов) и .comp.
  сборка = сборка.replace(/<\/?style>/g, '');
  // БАЗОВЫЕ токены живут в :root самого REPORT_CSS (--ink, --card-solid,
  // --sans, --line…), а не в добавках хвоста. Прошлая версия брала только
  // хвост — инструмент оставался без шрифта и цветов вовсе: var(--sans)
  // падал в Times, var(--card-solid) в прозрачное. Владелица это и увидела
  // как «шрифты не так, кривая вёрстка». Берём оба источника, плюс тёмную
  // тему целиком.
  var токены = '';
  var rt2 = /:root[^{}]*\{[^{}]*\}/g, tq;
  // Тёмные переопределения (:root:not([data-theme="light"])) в исходнике живут
  // ВНУТРИ @media (prefers-color-scheme:dark). Регулярка выше вырывала их из
  // обёртки, и тёмная тема применялась ВСЕГДА, когда атрибут не выставлен, —
  // чёрный фон на светлой ОС. Голыми такие блоки не берём: тёмная тема
  // приходит ниже, целым @media-блоком.
  var тёмный = function (t) { return t.indexOf(':root:not(') === 0; };
  while ((tq = rt2.exec(css)))
    if (tq[0].indexOf('--') >= 0 && !тёмный(tq[0])) токены += tq[0] + '\n';
  var md = css.match(/@media \(prefers-color-scheme:dark\)\{[^@]*?\}\s*\}/);
  if (md) токены += md[0] + '\n';
  while ((tq = rt2.exec(сборка)))
    if (tq[0].indexOf('--') >= 0 && tq[0].indexOf('--nacre-img') < 0 && !тёмный(tq[0]))
      токены += tq[0] + '\n';
  wr(BASE + 'lib/tokens.css',
    '/* Токены эталона, собрано из app.jsx. Не править руками. */\n' + токены);
  console.log('  app.jsx → lib/tokens.css  (' + Math.round(токены.length / 1024) + ' КБ)');
  // Теги <style> есть и в самих константах: в ОТЧЁТЕ они нужны (стиль там
  // намеренно разбит на несколько блоков), а в CSS-файле это мусор, который
  // съедает следующее за ним правило. Чистим на выходе, не в источнике.
  // REPORT_FIX_CSS — САМЫМ ПОСЛЕДНИМ, после инлайн-добавок отчёта: одноимённые
  // правила (.nprof, .rkey-side, .sigrow) живут в нескольких местах, и правка
  // в любом другом молча проигрывает хвосту (владелица 16.09: «стили написаны,
  // а на экране всё по-старому»).
  wr(BASE + 'lib/report.css',
    '/* Полный стиль отчёта, собрано из app.jsx. Не править руками. */\n'
    + (css + '\n' + сборка + '\n' + grabConst('REPORT_FIX_CSS') + '\n')
      .replace(/<\/?style>/g, ''));
  console.log('  app.jsx → lib/report.css  (' + Math.round(css.length / 1024) + ' КБ)');
})();

// Кнопки платформы. Владелица 15.09: «кнопки мы от неё (капсулы отчёта)
// отказались, сейчас кнопка чёрная и слегка скруглённая» — это .cm-btn-pri
// из согласованного макета оболочки. Инструмент живёт в отдельной рамке и
// стилей оболочки не видит, поэтому правила кнопок вынимаем из того же
// источника, что собирает shell.html, и кладём отдельным файлом. Копии в
// коде нет: поменяется макет — поменяется и здесь.
(function () {
  var src = rd(BASE + 'design/оболочка/эталон.css');
  var правила = [];
  var re = /(^|\n)([^{}\n]*\.(?:cm-btn|btn-pri)[^{}\n]*)\{([^}]*)\}/g, m;
  while ((m = re.exec(src))) правила.push(m[2].trim() + '{' + m[3].trim() + '}');
  if (!правила.length) throw new Error('кнопки макета не нашлись в эталон.css');
  wr(BASE + 'lib/buttons.css',
    '/* Кнопки платформы, взяты из design/оболочка/эталон.css. Не править руками. */\n'
    + правила.join('\n') + '\n');
  console.log('  оболочка → lib/buttons.css  (правил: ' + правила.length + ')');
})();

// Экран ниш: вёрстка взята со страницы «Платформа — стиль ZIXO» (артефакт
// 3d2c6dbd), правила лежат в design/исследование/ниши.css и копируются в lib
// как есть — не пересказ, копия. Владелица: «вот это красиво, почему не так».
(function () {
  var css = rd(BASE + 'design/исследование/ниши.css');
  if (!css) { console.log('  ниши.css не найден — пропускаю'); return; }
  wr(BASE + 'lib/niches.css',
    '/* Копия design/исследование/ниши.css (из артефакта ZIXO). Не править руками. */\n' + css);
  console.log('  ниши.css → lib/niches.css  (' + Math.round(css.length / 1024) + ' КБ)');
})();

// Метки версий в shell.html: браузер владелицы держал старые platform.js и
// css из кэша — она обновляла страницу и видела «всё без изменений». Метка
// меняется вместе с содержимым файла, кэш обязан скачать новое.
(function () {
  ['shell.html', 'index.html'].forEach(function (страница) {
  var page = rd(BASE + страница);
  if (!page) return;
  ['platform.js', 'app.js', 'lib/auth.js', 'lib/logo.js', 'lib/platform.css',
   'lib/nacre.css', 'lib/tokens.css', 'lib/niches.css', 'lib/buttons.css', 'lib/migrate.js'].forEach(function (f) {
    var body = rd(BASE + f);
    if (!body) return;
    var fp = fingerprint(body).slice(0, 8);
    var re = new RegExp('(["\'])' + f.replace(/[.\/]/g, '\\$&') + '(\\?v=[0-9a-f]+)?(["\'])');
    page = page.replace(re, '$1' + f + '?v=' + fp + '$3');
  });
  wr(BASE + страница, page);
  console.log('  ' + страница + ': метки версий обновлены');
  });
})();

// Стили платформы отдельным файлом. Источник один — константа PLATFORM_CSS в
// app.jsx: оболочка и контент-машина берут ОДНО И ТО ЖЕ, а не две копии,
// которые разъедутся в первый же день. Отчёт этот файл не тянет — в выгрузку
// платформенные правила не попадают, они там мёртвый вес.
(function () {
  var src = rd(BASE + 'app.jsx');
  var i = src.indexOf('const PLATFORM_CSS = "');
  if (i < 0) { console.log('  PLATFORM_CSS не найден — пропускаю'); return; }
  var j = src.indexOf('"', i + 'const PLATFORM_CSS = '.length);
  var end = -1;
  for (var k = j + 1; k < src.length; k++) {
    if (src[k] === '\\') { k++; continue; }
    if (src[k] === '"') { end = k; break; }
  }
  if (end < 0) throw new Error('литерал PLATFORM_CSS не закрыт');
  var css = JSON.parse(src.slice(j, end + 1));
  var head = '/* Собрано из PLATFORM_CSS в app.jsx. Не править руками:\n'
    + '   правка здесь потеряется при следующей сборке. */\n';
  wr(BASE + 'lib/platform.css', head + css + '\n');
  console.log('  app.jsx → lib/platform.css  (' + Math.round(css.length / 1024) + ' КБ)');
})();

// Перламутр отдельным файлом для оболочки. Правила и снимок раковины живут в
// эталоне (app.jsx), и вторая копия завелась бы в первый же день: там правили
// бы одно, здесь другое. Достаём из сборки отчёта ровно правила .nacre и
// переменную со снимком — оболочка их подключает, остальное отчётное ей не нужно.
(function () {
  var src = rd(BASE + 'app.jsx');
  var i = src.indexOf("+'\\n:root{--nacre-img:url(data:image/jpeg;base64,");
  var end = src.indexOf("+'\\n.nacre > *,.side .upsell > *{position:relative;z-index:1}'");
  if (i < 0 || end < 0) { console.log('  перламутр не найден — пропускаю'); return; }
  end = src.indexOf('\n', end) + 1;
  var block = src.slice(i, end), css = '';
  // Куски склеены как строки JS: вынимаем содержимое кавычек по порядку.
  var re = /'((?:[^'\\]|\\.)*)'/g, m;
  while ((m = re.exec(block))) css += m[1].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
  // Берём ТОЛЬКО правила перламутра и переменную со снимком. В этом же куске
  // лежат отчётные правила и — опаснее — body{overflow-x:clip} и .side{sticky}:
  // в оболочке у бокового меню свои правила, и чужие молча бы их перебили.
  var только = '';
  var rr = /([^{}]+)\{([^}]*)\}/g, q;
  while ((q = rr.exec(css))) {
    var sel = q[1].trim();
    var есть = sel.indexOf('.nacre') >= 0
      || (/^:root$/.test(sel) && q[2].indexOf('--nacre-img') >= 0);
    if (есть) только += sel + '{' + q[2].trim() + '}\n';
  }
  var head = '/* Собрано из app.jsx при сборке. Не править руками.\n'
    + '   Только перламутр: правила .nacre и снимок раковины. */\n';
  wr(BASE + 'lib/nacre.css', head + только);
  console.log('  app.jsx → lib/nacre.css  (' + Math.round(только.length / 1024) + ' КБ)');
})();

// Знак платформы — из утверждённого отчёта, а не копией в оболочке. Логотип
// поменялся 12.09.2026, и в shell.jsx лежал прежний: владелица увидела чужой
// знак в собственной платформе. Источник теперь один — REPORT_SIDEBAR в
// app.jsx, ровно тот файл, который она утверждала глазами.
(function () {
  var src = rd(BASE + 'app.jsx');
  var m = src.match(/<img class=\\"logo\\" alt=\\"bulbul lab\\" src=\\"(data:image\/png;base64,[^\\\\"]+)/);
  if (!m) { console.log('  знак платформы не найден — пропускаю'); return; }
  var js = '// Собрано из REPORT_SIDEBAR в app.jsx. Не править руками.\n'
    + 'window.CALogo = ' + JSON.stringify(m[1]) + ';\n';
  wr(BASE + 'lib/logo.js', js);
  console.log('  app.jsx → lib/logo.js  (' + Math.round(js.length / 1024) + ' КБ)');
})();
console.log('собрано файлов: ' + built);
