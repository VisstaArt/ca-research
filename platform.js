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
    if (!n) return 'нет исследования';
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
      if (em) em.textContent = 'заведите первый';
      return;
    }
    if (mark) mark.textContent = МЕТКА(текущий.name);
    if (cc) cc.textContent = (ФЛАГ(рынок && рынок.country) + ' ' + ((рынок && рынок.country) || '')).trim();
    if (b) b.textContent = текущий.domain || текущий.name;
    if (em) em.textContent = ниш(текущий);
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
    // Кредиты: показываем ПОТРАЧЕННОЕ. Знаменателя «из 1000» в базе нет —
    // тариф не назначен, и рисовать его в рабочей платформе нельзя.
    var деньгиКн = document.querySelector('.cm-money');
    if (деньгиКн) {
      var всего = клиенты.reduce(function (a, c) { return a + ((c.usage && c.usage.cost_cents) || 0); }, 0);
      var b = деньгиКн.querySelector('b'), i = деньгиКн.querySelector('i');
      if (b) b.textContent = деньги(всего);
      if (i) i.textContent = 'за месяц';
    }
  }

  function исследование() {
    var рамка = document.getElementById('research-frame');
    var строка = document.getElementById('ctx-line');
    if (!рамка) return;
    if (!текущий || !рынок) {
      рамка.removeAttribute('src');
      if (строка) строка.textContent = 'Сначала заведите проект и рынок — работать пока не с чем.';
      return;
    }
    if (строка) строка.textContent = текущий.name + ' · ' + (рынок.country_name || '');
    рамка.src = 'index.html?embed=1&client=' + encodeURIComponent(текущий.id)
      + '&market=' + encodeURIComponent(рынок.id)
      + '&country=' + encodeURIComponent(рынок.country_name || '')
      + '&lang=' + encodeURIComponent(рынок.lang || '');
  }

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
      шапкаДанные(почтаИзТокена());
      строкаПроекта(); списокПроектов(); исследование();
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
