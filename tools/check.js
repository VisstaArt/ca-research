// Проверка, что собранное соответствует исходному.
//
// Единственная плата за сборку — можно забыть её запустить, и тогда человек
// увидит вчерашнюю версию, не понимая почему. Эта проверка ловит ровно это:
// сравнивает отпечаток исходника с тем, что записан в шапке собранного файла.
//
// Запуск:  osascript -l JavaScript tools/check.js
ObjC.import('Foundation');
var BASE = '/Users/apr/Projects/ca-research/';
function rd(p) { return $.NSString.stringWithContentsOfFileEncodingError($(p), $.NSUTF8StringEncoding, $()).js; }
function fingerprint(s) {
  var h1 = 5381, h2 = 52711;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    h1 = ((h1 * 33) ^ c) >>> 0;
    h2 = ((h2 * 31) + c) >>> 0;
  }
  return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
}
var TARGETS = [{ src: 'shell.jsx', out: 'shell.js' },
               { src: 'app.jsx',   out: 'app.js'   }];
var stale = 0;
TARGETS.forEach(function (t) {
  var src = rd(BASE + t.src), out = rd(BASE + t.out) || '';
  var want = fingerprint(src);
  var m = out.match(/отпечаток-исходника: ([0-9a-f]+)/);
  if (!m) { stale++; console.log('  УСТАРЕЛО ' + t.out + ' — нет отпечатка, пересоберите'); }
  else if (m[1] !== want) { stale++; console.log('  УСТАРЕЛО ' + t.out + ' — ' + t.src + ' менялся после сборки'); }
  else console.log('  ok   ' + t.out + ' соответствует ' + t.src);
});
console.log(stale === 0 ? '\nсобранное свежее' : '\nнужна пересборка: osascript -l JavaScript tools/build.js');
