// Минимальная заглушка DOM — не рендерит, но исполняет реальный порядок кода
// скрипта и ловит ошибки времени выполнения, а не только синтаксиса.
function fakeEl(id){
  const listeners=[];
  const cls=new Set();
  return {
    id, innerHTML:'', textContent:'', className:'', style:{},
    setAttribute_(){},
    children:[], _attrs:{},
    setAttribute(k,v){ this._attrs[k]=v; },
    getAttribute(k){ return this._attrs[k]; },
    appendChild(c){ this.children.push(c); c.parentNode=this; return c; },
    // Слушатели запоминаем, чтобы тест мог их вызвать: наведение — это как раз
    // тот код, который при статической проверке остаётся неисполненным.
    addEventListener(type,fn){ listeners.push([type,fn]); },
    _fire(type,ev){ listeners.filter(l=>l[0]===type).forEach(l=>l[1](ev||{target:null})); },
    classList:{ add(c){cls.add(c);}, remove(c){cls.delete(c);},
      toggle(c,on){ on===undefined?(cls.has(c)?cls.delete(c):cls.add(c)):(on?cls.add(c):cls.delete(c)); },
      contains(c){ return cls.has(c); } },
    _cls:cls,
    // Поиск по innerHTML: заглушка не строит дерево, но для проверки подсветки
    // нужно, чтобы querySelectorAll вернул НАСТОЯЩИЕ data-i из разметки, которую
    // скрипт только что собрал. Простые селекторы вида '.dot' — этого хватает.
    querySelectorAll(sel){
      this._qs=this._qs||{};
      if(this._qs[sel]&&this._qsHtml===this.innerHTML) return this._qs[sel];
      if(this._qsHtml!==this.innerHTML){ this._qs={}; this._qsHtml=this.innerHTML; }
      const cls=String(sel).replace(/^\./,'');
      const out=[];
      const re=new RegExp('<[a-z]+[^>]*class="[^"]*\\b'+cls+'\\b[^"]*"[^>]*>','g');
      let m;
      while((m=re.exec(this.innerHTML))){
        const tag=m[0];
        const di=(tag.match(/data-i="(\d+)"/)||[])[1];
        const dc=(tag.match(/data-c="([^"]*)"/)||[])[1];
        const set=new Set((tag.match(/class="([^"]*)"/)||[,''])[1].split(/\s+/).filter(Boolean));
        out.push({
          dataset:{ i:di, c:dc },
          _cls:set,
          classList:{ add(c){set.add(c);}, remove(c){set.delete(c);},
            toggle(c,on){ on?set.add(c):set.delete(c); }, contains(c){ return set.has(c); } },
          querySelector(){ return null; },
          // Найденные сканированием узлы тоже принимают слушателей и атрибуты —
          // иначе проверка падает там, где в браузере всё работает.
          addEventListener(){}, setAttribute(){}, getAttribute(){ return null; },
          className:'',
        });
      }
      this._qs[sel]=out;
      return out;
    },
    // Обёртки/подсказки: скрипт ищет родителя, чтобы вставить всплывающий блок,
    // и меряет координаты — заглушка отдаёт нули, важно лишь что вызов не падает.
    closest(){ return null; },
    contains(){ return false; },
    getBoundingClientRect(){ return {left:0,top:0,width:0,height:0,right:0,bottom:0}; },
    dataset:{},
  };
}
const registry = {};
// У любого элемента есть родитель — иначе код, который вставляет соседний блок
// (подсказка карты рынка), падает не по своей вине, а из-за бедности заглушки.
const bodyEl = fakeEl('body');
const document = {
  getElementById(id){ if(!registry[id]){ registry[id]=fakeEl(id); registry[id].parentNode=bodyEl; } return registry[id]; },
  createElementNS(ns,tag){ return fakeEl(tag+'#'+Math.random()); },
  createElement(tag){ return fakeEl(tag+'#'+Math.random()); },
  querySelector(sel){ return fakeEl(sel); },
  querySelectorAll(sel){ return []; },
  documentElement: {
    _attrs:{},
    style:{ _props:{}, setProperty(k,v){ this._props[k]=v; } },
    setAttribute(k,v){ this._attrs[k]=v; },
    getAttribute(k){ return this._attrs[k]||null; },
    removeAttribute(k){ delete this._attrs[k]; },
  },
};
const window = {
  matchMedia(){ return {matches:false}; },
  // Отчёт вешает рисование на load — в заглушке выполняем сразу.
  addEventListener(type, fn){ if (type === 'load') fn(); },
};
const matchMedia = window.matchMedia;
function setInterval(){ return 0; }
function clearInterval(){}
