// Живая часть платформы. Оформление и разметка взяты со страницы, собранной с
// владелицей, и здесь НЕ трогаются: этот файл только подставляет настоящие
// данные вместо показательных и оживляет то, что в макете нарисовано.
//
// Правило простое: если что-то выглядит не так — правится страница у источника
// и переносится сюда целиком, а не подкручивается здесь на глаз. Три попытки
// собрать вид заново кончились кривым результатом.
(function () {
  var A = window.CAAuth;
  var вход = document.getElementById('login');
  var прил = document.getElementById('app');

  function показать(что) {
    вход.hidden = что !== 'login';
    прил.hidden = что !== 'app';
  }

  // ── ВХОД ─────────────────────────────────────────────────────────────────
  var режим = 'in';
  var логотип = document.getElementById('login-logo');
  if (логотип && window.CALogo) логотип.src = window.CALogo;
  document.getElementById('login-switch').addEventListener('click', function () {
    режим = режим === 'in' ? 'up' : 'in';
    document.getElementById('login-title').textContent = режим === 'up' ? 'Регистрация' : 'Вход';
    document.getElementById('login-sub').textContent = режим === 'up'
      ? 'Новый аккаунт. Всё, что в нём появится, будет видно только вам.'
      : 'Тот же аккаунт, что и в инструменте исследования.';
    document.getElementById('login-go').textContent = режим === 'up' ? 'Завести аккаунт' : 'Войти';
    this.textContent = режим === 'up' ? 'У меня уже есть аккаунт' : 'Завести новый аккаунт';
    ошибка('');
  });
  function ошибка(t) {
    var e = document.getElementById('login-err');
    e.textContent = t; e.hidden = !t;
  }
  document.getElementById('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var m = document.getElementById('login-mail').value.trim();
    var p = document.getElementById('login-pw').value;
    ошибка('');
    if (режим === 'up') {
      A.signUp(m, p).then(function (r) {
        if (!r.ok) return ошибка(r.error);
        if (r.signedIn) старт();
        else ошибка('Отправила письмо на ' + m + '. Подтвердите почту и войдите.');
      });
      return;
    }
    A.signIn(m, p).then(function (ok) { ok ? старт() : ошибка('Не подошли почта или пароль.'); });
  });

  // ── ДАННЫЕ ───────────────────────────────────────────────────────────────
  var клиенты = [], текущий = null, рынок = null;

  var МЕТКА = function (n) {
    return (n || '').split(/\s+/).filter(Boolean).slice(0, 2)
      .map(function (w) { return w[0]; }).join('').toUpperCase();
  };
  var ФЛАГ = function (c) {
    return ({ RU:'🇷🇺', TR:'🇹🇷', KZ:'🇰🇿', AE:'🇦🇪', US:'🇺🇸', GB:'🇬🇧' })[c] || '';
  };
  function ниш(c) {
    var n = c && c.usage && c.usage.niches;
    // Ноль ниш и «мы не умеем их считать» — разные вещи, а выглядели
    // одинаково: под проектом с готовым исследованием стояло «нет
    // исследования» (владелица 14.09). Число ниш берётся из представления
    // audience_research, которого пока нет (работа переезда), поэтому здесь
    // всегда ноль. Пока не знаем — не пишем ничего.
    if (!n) return '';
    var h = Math.abs(n) % 100, t = h % 10;
    return n + ' ' + ((h > 10 && h < 20) || t === 0 || t >= 5 ? 'ниш' : t === 1 ? 'ниша' : 'ниши');
  }
  function деньги(ц) { return ц ? (ц / 100).toFixed(2).replace('.', ',') + ' $' : '0 $'; }

  function строкаПроекта() {
    var кн = document.querySelector('.cm-side-proj .cm-proj');
    if (!кн) return;
    var знач = кн.querySelectorAll('b, em, .cm-mark, .cm-cc');
    var mark = кн.querySelector('.cm-mark'), cc = кн.querySelector('.cm-cc'),
        b = кн.querySelector('b'), em = кн.querySelector('em');
    if (!текущий) {
      if (mark) mark.textContent = '+';
      if (cc) cc.textContent = '';
      if (b) b.textContent = 'Нет проектов';
      if (em) { em.textContent = 'заведите первый'; em.hidden = false; }
      return;
    }
    if (mark) mark.textContent = МЕТКА(текущий.name);
    if (cc) cc.textContent = (ФЛАГ(рынок && рынок.country) + ' ' + ((рынок && рынок.country) || '')).trim();
    if (b) b.textContent = текущий.domain || текущий.name;
    if (em) { var п = ниш(текущий); em.textContent = п; em.hidden = !п; }
  }

  function списокПроектов() {
    var меню = document.querySelector('.cm-side-proj .cm-menu');
    if (!меню) return;
    var строки = клиенты.reduce(function (acc, c) {
      return acc.concat((c.markets || []).map(function (m) {
        var on = текущий && рынок && c.id === текущий.id && m.id === рынок.id;
        return '<a' + (on ? ' class="on"' : '') + ' data-client="' + c.id + '" data-market="' + m.id + '">'
          + '<span class="cm-mark">' + МЕТКА(c.name) + '</span>'
          + '<u class="cm-cc">' + ФЛАГ(m.country) + ' ' + (m.country || '') + '</u>'
          + '<b>' + (c.domain || c.name) + '</b><em>' + (m.country_name || '') + '</em>'
          + '<span>' + деньги((c.usage && c.usage.cost_cents) || 0) + '</span></a>';
      }));
    }, []);
    меню.innerHTML = (строки.join('') || '<a><span>Пока ни одного проекта</span></a>')
      + '<div class="cm-sep"></div><a class="cm-add" id="new-project">+ Создать проект</a>';
    меню.querySelectorAll('[data-client]').forEach(function (a) {
      a.addEventListener('click', function (соб) {
        соб.stopPropagation();
        текущий = клиенты.filter(function (c) { return c.id === a.dataset.client; })[0] || null;
        // Экраны контент-машины читают базу по текущему клиенту — сообщаем им
        // о переключении, иначе на новом проекте остались бы чужие материалы.
        window.CAContentClient = текущий ? текущий.id : '';
        if (window.CAContent && window.CAContent.обновить) window.CAContent.обновить();
        рынок = текущий && (текущий.markets || []).filter(function (m) { return m.id === a.dataset.market; })[0] || null;
        строкаПроекта(); списокПроектов(); исследование();
        // Список закрываем сами: он наш, и переключение.js о наших строках
        // не знает — иначе выбранный проект остаётся под открытой панелью.
        var п = document.querySelector('.cm-side-proj [data-panel]');
        if (п) п.hidden = true;
      });
    });
  }

  function шапкаДанные(почта) {
    var привет = document.querySelector('.cm-hello b');
    var дата = document.querySelector('.cm-hello i');
    var час = new Date().getHours();
    var слово = час < 5 ? 'Доброй ночи' : час < 12 ? 'Доброе утро' : час < 18 ? 'Добрый день' : 'Добрый вечер';
    var имя = (почта || '').split('@')[0];
    if (привет) привет.textContent = слово + (имя ? ', ' + имя : '');
    if (дата) дата.textContent = new Date().toLocaleDateString('ru-RU',
      { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    var лого = document.querySelector('.cm-logo');
    if (лого && window.CALogo) лого.src = window.CALogo;
    var ава = document.querySelector('.cm-ava');
    if (ава) ава.textContent = МЕТКА(имя || 'Вы');
    // Расход. В макете тут «412 / 1000» и три проекта — это показательные
    // числа, их надо заменить настоящими, иначе владелица считает по ним.
    // Знаменателя нет: сколько кредитов в тарифе, ещё не решено. У проекта на
    // своих ключах кредиты вообще не тратятся — там расход и есть ответ.
    var всего = клиенты.reduce(function (a, c) { return a + ((c.usage && c.usage.cost_cents) || 0); }, 0);
    var деньгиКн = document.querySelector('.cm-money');
    if (деньгиКн) {
      var b = деньгиКн.querySelector('b'), i = деньгиКн.querySelector('i');
      if (b) b.textContent = деньги(всего);
      if (i) i.textContent = 'за месяц';
    }
    var панель = document.querySelector('[data-panel="money"]');
    if (панель) {
      var строки = клиенты.map(function (c) {
        return '<a><span class="cm-mark">' + МЕТКА(c.name) + '</span>'
          + '<b>' + (c.domain || c.name) + '</b>'
          + '<i>' + ((c.markets || []).map(function (m) { return m.country_name || ''; })
              .filter(Boolean).join(', ') || '—') + '</i>'
          + '<span>' + деньги((c.usage && c.usage.cost_cents) || 0) + '</span></a>';
      });
      панель.innerHTML =
        '<div class="cm-user"><b>Расход за месяц</b>'
        + '<span>по настоящим вызовам моделей и поиска</span></div>'
        + (строки.join('') || '<a><span>Пока ни одного проекта</span></a>')
        + '<div class="cm-sep"></div>'
        + '<a><b>Всего</b><span>' + деньги(всего) + '</span></a>';
    }
  }

  function разработчик() {
    return !!(текущий && текущий.billing_mode === 'own_keys');
  }

  // Что видно на каком тарифе. На подписке вопросов про ключи нет вовсе — не
  // спрятаны мелким шрифтом, а отсутствуют: человек на подписке не должен
  // догадываться, что где-то есть «настоящие» ключи, которых ему не дали.
  function тариф() {
    var стр = document.querySelector('[data-screen="keys"]');
    if (стр) стр.hidden = !разработчик();
    var экр = document.getElementById('s-keys');
    if (экр && !разработчик()) экр.classList.remove('on');
    var рамка = document.getElementById('research-frame');
    if (рамка && рамка.src) исследование();   // инструменту тоже нужен тариф
  }

  function уведомления() {
    var п = document.querySelector('[data-panel="bell"]');
    if (!п) return;
    // В макете здесь три события из демонстрации. Настоящих пока неоткуда
    // взять — очередь заданий на стороне контент-машины. Пустое состояние
    // честнее выдуманных «карусель готова».
    п.innerHTML = '<div class="cm-user"><b>Уведомления</b>'
      + '<span>события прогонов и генерации</span></div>'
      + '<a><span>Пока ничего не происходило</span></a>';
    var значок = document.querySelector('[data-drop="bell"] b');
    if (значок) значок.remove();
  }

  function кабинет(почта) {
    var п = document.querySelector('[data-panel="me"]');
    if (!п) return;
    var всего = клиенты.reduce(function (a, c) { return a + ((c.usage && c.usage.cost_cents) || 0); }, 0);
    var имя = (почта || '').split('@')[0];
    // Тариф не назначен, и писать «разработчик · 1000 в месяц» нельзя: это
    // число из макета, в базе его нет. Режим берём из проекта — он настоящий.
    // ТАРИФ, а не «режим оплаты». У платформы два вида работы: «Разработчик» —
    // ключи провайдеров видны и вносятся руками, вызовы идут за счёт клиента;
    // «Подписка» — работаем на ключах платформы, и вопросов про ключи человек
    // не видит вовсе. От тарифа зависит, что вообще показывать.
    п.innerHTML =
      '<div class="cm-user"><b>' + (имя || 'Вы') + '</b><span>' + (почта || '') + '</span></div>'
      + '<a>Все проекты<span>' + клиенты.length + '</span></a>'
      + '<a>Расход<span>' + деньги(всего) + ' за месяц</span></a>'
      + '<a id="tariff-row">Тариф<span>' + (разработчик() ? 'Разработчик' : 'Подписка') + '</span></a>'
      + '<a id="tariff-switch"><span>' + (разработчик()
          ? 'Перейти на подписку' : 'Включить тариф «Разработчик»') + '</span></a>'
      + '<a>Доступы<span>1 человек</span></a>'
      + '<a>Язык интерфейса<span>Русский</span></a>'
      + '<a>Поддержка</a>'
      + '<div class="cm-sep"></div>'
      + '<a id="logout">Выйти</a>';
    var пер = document.getElementById('tariff-switch');
    if (пер) пер.addEventListener('click', function (соб) {
      соб.stopPropagation();
      if (!текущий) return;
      var новый = разработчик() ? 'subscription' : 'own_keys';
      A.authFetch('/api/clients', { method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: текущий.id, billing_mode: новый }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || !d.client) return;
          текущий.billing_mode = d.client.billing_mode;
          кабинет(почта); тариф();
        });
    });
    var в = document.getElementById('logout');
    if (в) в.addEventListener('click', function () { A.clearTokens(); location.reload(); });
  }

  // Этапы исследования — экраны в боковом меню, у каждого своя рамка.
  // Инструмент грузится ЛЕНИВО: src ставится при первом открытии экрана,
  // четыре копии приложения разом никому не нужны. Смена проекта сбрасывает
  // src у всех — рамки перегрузятся под нового клиента при открытии.
  // Метка версии в адресе РАМКИ. Без неё браузер отдавал index.html из кэша,
  // и внутри рамки работал старый код: владелица обновляла страницу, запускала
  // модуль заново и не видела ни одной правки (17.09, три прогона подряд).
  // Значение подставляет сборка — оно меняется вместе с app.js.
  var ВЕРСИЯ_ИССЛЕДОВАНИЯ = '49169594';
  function адресШага(шаг) {
    var база = 'index.html?v=' + ВЕРСИЯ_ИССЛЕДОВАНИЯ
      + '&embed=1&client=' + encodeURIComponent(текущий.id)
      + '&market=' + encodeURIComponent(рынок.id)
      + '&country=' + encodeURIComponent(рынок.country_name || '')
      + '&lang=' + encodeURIComponent(рынок.lang || '')
      + '&tariff=' + (разработчик() ? 'dev' : 'sub');
    return шаг === 'report' ? база + '&view=report' : база + '&step=' + шаг;
  }
  function исследование() {
    document.querySelectorAll('iframe[data-step]').forEach(function (р) {
      р.removeAttribute('src');
    });
    показатьШаг();
  }
  // Высота рамки = высоте содержимого: прокрутка одна, у страницы. Следим
  // недорого — раз в полсекунды по открытой рамке; смена шага и данных внутри
  // подхватывается сама.
  function подогнать() {
    var р = document.querySelector('.screen.on iframe[data-step][src]');
    if (!р) return;
    try {
      var d = р.contentDocument;
      if (!d || !d.body) return;
      var h = Math.max(d.documentElement.scrollHeight, d.body.scrollHeight);
      if (h > 60 && Math.abs(р.offsetHeight - h) > 6) р.style.height = (h + 4) + 'px';
    } catch (e) {}
  }
  setInterval(подогнать, 500);

  // Переход между этапами по просьбе самой рамки. Нужен ровно в одном месте:
  // человек выбирает ниши на вкладке «Ниши», прогон продолжается — и смотреть
  // его надо на «Прогоне». Оставлять его на экране ниш значит показывать
  // пустую карту, пока где-то рядом идёт работа.
  // Переключаем не своей копией логики, а нажатием на тот же пункт меню,
  // которым пользуется человек, — тогда подсветка и прокрутка отработают сами.
  window.addEventListener('message', function (e) {
    var d = e && e.data;
    if (!d || d.ca !== 'шаг' || typeof d.шаг !== 'string') return;
    var ключи = { brief: 'rbrief', niches: 'rniches', run: 'rrun', report: 'rreport' };
    var ключ = ключи[d.шаг];
    if (!ключ) return;
    var пункт = document.querySelector('[data-screen="' + ключ + '"]');
    if (пункт) пункт.click();
  });

  // Прогон закончился в рамке «Ниши». Результаты лежат в проекте, но рамка
  // «Прогон» своя и всё ещё показывает состояние до запуска — перезагружаем
  // её и переходим туда. Без этого человек открывает пустую вкладку и думает,
  // что прогон не сработал.
  // Рамка просит прокрутить страницу вверх: она сама этого сделать не может,
  // прокрутка принадлежит странице оболочки. Нужно после запуска прогона —
  // кнопка стоит внизу, а ход работы показывается наверху.
  window.addEventListener('message', function (e) {
    var d = e && e.data;
    if (!d || d.ca !== 'вверх') return;
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { window.scrollTo(0, 0); }
  });

  window.addEventListener('message', function (e) {
    var d = e && e.data;
    if (!d || d.ca !== 'прогон-готов') return;
    var рамка = document.querySelector('iframe[data-step="run"]');
    if (рамка) рамка.src = адресШага('run');
    var пункт = document.querySelector('[data-screen="rrun"]');
    if (пункт) пункт.click();
  });

  function показатьШаг() {
    var экран = document.querySelector('.screen.on iframe[data-step]');
    if (!экран || экран.getAttribute('src')) return;
    if (!текущий || !рынок) return;
    экран.src = адресШага(экран.dataset.step);
  }
  // Клик по строке меню переключает экран (это делает переключение.js) —
  // после него грузим рамку открытого шага, если ещё не грузили.
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-screen]')) setTimeout(показатьШаг, 0);
  });

  function загрузить() {
    return A.authFetch('/api/clients', { headers: { 'Content-Type': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : { clients: [] }; })
      .then(function (d) {
        клиенты = Array.isArray(d.clients) ? d.clients : [];
        текущий = клиенты[0] || null;
        рынок = текущий && (текущий.markets || [])[0] || null;
      })
      .catch(function () { клиенты = []; });
  }

  function почтаИзТокена() {
    try {
      var t = A.getAccessToken();
      if (!t) return '';
      return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email || '';
    } catch (e) { return ''; }
  }

  function старт() {
    показать('app');
    загрузить().then(function () {
      var почта = почтаИзТокена();
      шапкаДанные(почта); кабинет(почта); уведомления();
      // Первый выбранный проект — тоже событие для экранов контент-машины.
      window.CAContentClient = текущий ? текущий.id : '';
      if (window.CAContent && window.CAContent.обновить) window.CAContent.обновить();
      строкаПроекта(); списокПроектов(); тариф(); исследование();
    });
  }

  // Выпадающими списками занимается переключение.js со страницы — свой
  // обработчик здесь спорил бы с ним: два слушателя на один клик открывают и
  // тут же закрывают панель. Единственное, что нужно здесь, — перерисовать
  // список проектов заново, потому что строки в нём мои.

  if (A.getRefreshToken()) {
    A.refreshTokens().then(function (ok) { ok ? старт() : показать('login'); })
      .catch(function () { показать('login'); });
  } else показать('login');
})();
