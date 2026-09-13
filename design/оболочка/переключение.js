
(function () {
  // Список под плитками показывает части ТОЛЬКО активного раздела: у
  // исследования свои, у контент-плана свои, у воронки свои. Общее — бренд,
  // голос, оформление, аккаунты — лежит в личном кабинете и видно всегда.
  var разделы = document.querySelectorAll('[data-section]');
  var списки = document.querySelectorAll('[data-list]');
  var строки = document.querySelectorAll('[data-screen]');

  function экран(ключ) {
    document.querySelectorAll('.screen').forEach(function (s) {
      s.classList.toggle('on', s.id === 's-' + ключ);
    });
    строки.forEach(function (b) {
      if (b.dataset.screen === ключ) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
  }

  function раздел(ключ, показатьПервый) {
    разделы.forEach(function (т) {
      if (т.dataset.section === ключ) т.setAttribute('aria-current', 'page');
      else т.removeAttribute('aria-current');
    });
    списки.forEach(function (н) { n = н; н.hidden = н.dataset.list !== ключ; });
    if (показатьПервый) {
      var первый = document.querySelector('[data-list="' + ключ + '"] [data-screen]');
      if (первый) экран(первый.dataset.screen);
    }
  }

  разделы.forEach(function (т) {
    т.addEventListener('click', function () { раздел(т.dataset.section, true); });
  });
  строки.forEach(function (b) {
    b.addEventListener('click', function () {
      экран(b.dataset.screen);
      // Строка из личного кабинета или справки не меняет активный раздел:
      // это общее, оно живёт вне разделов.
      var свой = b.closest('[data-list]');
      if (свой) раздел(свой.dataset.list, false);
    });
  });

  // Выпадающие списки шапки: проект, рынок, «Создать», уведомления, профиль.
  // Открыт всегда один — иначе они перекрывают друг друга; клик мимо закрывает.
  var панели = document.querySelectorAll('[data-panel]');
  function закрыть(кроме) {
    панели.forEach(function (п) { п.hidden = п !== кроме; });
  }
  document.querySelectorAll('[data-drop]').forEach(function (к) {
    к.addEventListener('click', function (соб) {
      соб.stopPropagation();
      var своя = document.querySelector('[data-panel="' + к.dataset.drop + '"]');
      закрыть(своя.hidden ? своя : null);
    });
  });
  document.addEventListener('click', function () { закрыть(null); });

  раздел('plan', false);
  экран('inbox');   // ежедневный экран, ради него сюда и заходят
})();
