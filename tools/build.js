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

var TARGETS = [{ src: 'shell.jsx', out: 'shell.js' },
               { src: 'app.jsx',   out: 'app.js'   }];

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
  console.log('  ' + t.src + ' → ' + t.out + '  (' + Math.round(code.length / 1024) + ' КБ)');
  built++;
});
console.log('собрано файлов: ' + built);
