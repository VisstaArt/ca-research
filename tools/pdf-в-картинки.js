// Страницы PDF → PNG, чтобы прочитать сканы глазами.
//
// Зачем: материалы по копирайтингу пришли сканами — текста внутри нет, а
// встроенный распознаватель macOS русского не знает (проверено 16.09.2026:
// поддерживаются только латинские языки). Зато картинку прочитать можно
// напрямую, без установки чего-либо на машину.
//
//   osascript -l JavaScript tools/pdf-в-картинки.js <файл.pdf> <папка> <с> <по>
//
// Страницы считаются с нуля, «по» не включается. Масштаб 2× — мелкий шрифт
// скана иначе не читается.

ObjC.import('Foundation'); ObjC.import('Quartz'); ObjC.import('AppKit');
function run(argv){
  var путь=argv[0], папка=argv[1], с=parseInt(argv[2],10), по=parseInt(argv[3],10), масштаб=2.0;
  var док=$.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath($(путь)));
  if(!док||док.isNil()) return 'НЕ ОТКРЫЛСЯ';
  var всего=док.pageCount, сделано=[];
  for(var i=с;i<Math.min(по,всего);i++){
    var стр=док.pageAtIndex(i);
    var рамка=стр.boundsForBox($.kPDFDisplayBoxMediaBox);
    var ш=Math.round(рамка.size.width*масштаб), в=Math.round(рамка.size.height*масштаб);
    var изо=$.NSImage.alloc.initWithSize({width:ш,height:в});
    изо.lockFocus;
    var ctx=$.NSGraphicsContext.currentContext.CGContext;
    $.CGContextSetRGBFillColor(ctx,1,1,1,1);
    $.CGContextFillRect(ctx,{origin:{x:0,y:0},size:{width:ш,height:в}});
    $.CGContextScaleCTM(ctx,масштаб,масштаб);
    стр.drawWithBoxToContext($.kPDFDisplayBoxMediaBox, ctx);
    изо.unlockFocus;
    var rep=$.NSBitmapImageRep.imageRepWithData(изо.TIFFRepresentation);
    var png=rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $());
    var файл=папка+'/стр'+(i+1)+'.png';
    png.writeToFileAtomically($(файл), true);
    сделано.push(файл);
  }
  return 'страниц всего '+всего+'; сохранено: '+сделано.length+'\n'+сделано.join('\n');
}
