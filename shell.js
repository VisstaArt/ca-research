// СОБРАНО АВТОМАТИЧЕСКИ из shell.jsx — не править руками.
// Правки вносить в shell.jsx, затем: osascript -l JavaScript tools/build.js
// отпечаток-исходника: d0f330b70842b271
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState,
  useEffect,
  useCallback
} = React;
const {
  signIn,
  signUp,
  refreshTokens,
  getRefreshToken,
  clearTokens,
  authFetch
} = window.CAAuth;
const {
  buildShellData
} = window.CAMigrate;

// Знак платформы берём из утверждённого отчёта — lib/logo.js собирается из
// app.jsx при каждой сборке. Копия в этом файле устарела и показывала прежний
// знак: платформа и отчёт расходились ровно в том месте, где человек первым
// делом смотрит, туда ли он попал.
const LOGO = typeof window !== 'undefined' && window.CALogo || '';

// ─────────────────────────────────────────────────────────────────────────────
// ХРАНИЛИЩЕ
//
// Пока localStorage. Таблиц clients/markets в базе ещё нет — их создание это
// SQL, который запускает владелица, и отдельный шаг. Здесь нарочно ОДИН слой
// со своими именами: когда таблицы появятся, меняется только он, а экраны
// ниже не трогаются вообще.
// ─────────────────────────────────────────────────────────────────────────────
const KEY = 'ca_shell_v1';
const OLD_KEY = 'ca_v6'; // проекты нынешнего инструмента, ТОЛЬКО ЧИТАЕМ
const store = {
  read() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{"clients":[]}');
    } catch {
      return {
        clients: []
      };
    }
  },
  write(d) {
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {}
  }
};

// Проекты инструмента берём ИЗ ДВУХ мест и объединяем по id.
//
// В браузере (ca_v6) они появляются мгновенно и работают без сети. В базе они
// полные и не привязаны к одной машине: если владелица откроет оболочку с
// другого компьютера, localStorage там пуст, и без базы она снова увидела бы
// пустоту. Старый ключ только читаем и никогда не переписываем — инструмент
// работает и должен продолжать работать, что бы ни делала оболочка.
const readLocalProjects = () => {
  try {
    const l = JSON.parse(localStorage.getItem(OLD_KEY) || '[]');
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
};
const readDbProjects = async () => {
  try {
    const r = await authFetch('/api/projects', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (!r.ok) return [];
    const d = await r.json();
    if (!Array.isArray(d.projects)) return [];
    return d.projects.map(row => ({
      id: row.id,
      brief: row.brief || {},
      lang: row.lang || 'Russian',
      results: row.results || []
    }));
  } catch {
    return [];
  }
};
// Клиенты и рынки ИЗ БАЗЫ — общие таблицы с контент-машиной. Это главный
// источник: то, что видит здесь владелица, и то, с чем работает контент-машина,
// обязано быть одним и тем же. Сборка клиентов из прогонов инструмента ниже
// остаётся запасным путём — для аккаунта, где таблицы ещё пусты.
const readDbClients = async () => {
  try {
    const r = await authFetch('/api/clients', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (!r.ok) return [];
    const d = await r.json();
    if (!Array.isArray(d.clients)) return [];
    return d.clients.map(c => ({
      id: c.id,
      name: c.name || 'Без названия',
      domain: (c.domain || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
      what: c.one_liner || '',
      fromDb: true,
      // Расход настоящий, из общей таблицы. Знаменателя нет нарочно: сколько
      // кредитов в тарифе — нерешённое место алгоритма, и «412 из 1000» было
      // бы выдуманным числом, которое в рабочей платформе примут за настоящее.
      usage: c.usage || null,
      markets: (c.markets || []).map(m => ({
        id: m.id,
        // Имя страны показываем человеку, код оставляем машине: в старых
        // брифах страна приходит текстом вроде «Не указана», и кода у неё нет.
        countryName: m.country_name || m.country || 'Не указана',
        country: m.country || '',
        lang: m.lang || '',
        projects: []
      }))
    }));
  } catch {
    return [];
  }
};
const mergeById = (a, b) => {
  const out = [],
    seen = {};
  for (const r of [...a, ...b]) {
    if (!r || !r.id || seen[r.id]) continue;
    seen[r.id] = 1;
    out.push(r);
  }
  return out;
};
const uid = () => Math.random().toString(36).slice(2, 10);

// Список стран и языков — короткий и честный: то, с чем реально работаем.
// Расширяется по мере надобности, а не «на всякий случай».
const COUNTRIES = [{
  code: 'RU',
  name: 'Россия',
  langs: ['Русский']
}, {
  code: 'TR',
  name: 'Турция',
  langs: ['Турецкий', 'Русский', 'Английский']
}, {
  code: 'AE',
  name: 'ОАЭ',
  langs: ['Английский', 'Арабский', 'Русский']
}, {
  code: 'KZ',
  name: 'Казахстан',
  langs: ['Русский', 'Казахский']
}, {
  code: 'US',
  name: 'США',
  langs: ['Английский']
}, {
  code: 'DE',
  name: 'Германия',
  langs: ['Немецкий', 'Английский']
}];

// Оболочка знает СПИСОК МОДУЛЕЙ, но не знает, что у исследования внутри M1…M7.
// Это требование свода: внутренняя структура меняется (M5 уже выведен из
// автоцепочки), и если состав M-модулей протечёт сюда, каждое такое изменение
// станет правкой общего кода.
// MODULES/GROUPS убраны 13.09.2026: у платформы теперь разделы и части
// (SECTIONS ниже), собранные вместе с контент-машиной. Два списка
// одного и того же — источник расхождений, а не запас.

// ─────────────────────────────────────────────────────────────────────────────
// Вход и регистрация на одном экране. Регистрация нужна не «для полноты»:
// пройти путь с чистого листа — и есть проверка платформы. Без неё первый
// экран невозможно увидеть глазами нового человека, а мы именно это и проверяем.
function Login({
  onIn
}) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState('in'); // 'in' — вход, 'up' — регистрация
  const go = async e => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setNote('');
    if (mode === 'up') {
      const r = await signUp(email.trim(), pw).catch(() => ({
        ok: false,
        error: 'Сеть недоступна'
      }));
      setBusy(false);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      // Подтверждение почты включено — входа ещё нет, и делать вид, что есть,
      // нельзя: человек нажмёт «дальше» и упрётся в пустоту без объяснения.
      if (r.signedIn) onIn();else setNote('Отправила письмо на ' + email.trim() + '. Подтвердите почту и войдите.');
      return;
    }
    const ok = await signIn(email.trim(), pw).catch(() => false);
    setBusy(false);
    if (ok) onIn();else setErr('Не подошли почта или пароль.');
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "login"
  }, /*#__PURE__*/React.createElement("form", {
    className: "card",
    onSubmit: go
  }, /*#__PURE__*/React.createElement("img", {
    src: LOGO,
    alt: "bulbullab"
  }), /*#__PURE__*/React.createElement("h2", null, mode === 'up' ? 'Регистрация' : 'Вход'), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, mode === 'up' ? 'Новый аккаунт. Всё, что в нём появится, будет видно только вам.' : 'Тот же аккаунт, что и в инструменте исследования.'), /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "\u041F\u043E\u0447\u0442\u0430"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    value: email,
    onChange: e => setEmail(e.target.value),
    autoComplete: "username",
    required: true
  })), /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "\u041F\u0430\u0440\u043E\u043B\u044C"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: pw,
    onChange: e => setPw(e.target.value),
    autoComplete: "current-password",
    required: true
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    style: {
      width: '100%'
    },
    disabled: busy
  }, busy ? mode === 'up' ? 'Завожу…' : 'Проверяю…' : mode === 'up' ? 'Завести аккаунт' : 'Войти'), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    style: {
      width: '100%',
      marginTop: 8
    },
    onClick: () => {
      setMode(mode === 'up' ? 'in' : 'up');
      setErr('');
      setNote('');
    }
  }, mode === 'up' ? 'У меня уже есть аккаунт' : 'Завести новый аккаунт'), err && /*#__PURE__*/React.createElement("p", {
    className: "err"
  }, err), note && /*#__PURE__*/React.createElement("p", {
    className: "lede",
    style: {
      marginTop: 10
    }
  }, note)));
}

// ── Экран 1: клиенты ────────────────────────────────────────────────────────
function Clients({
  data,
  onOpen,
  onAdd,
  importing
}) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({
    name: '',
    domain: '',
    what: ''
  });
  const save = e => {
    e.preventDefault();
    onAdd({
      id: uid(),
      ...f,
      markets: []
    });
    setF({
      name: '',
      domain: '',
      what: ''
    });
    setAdding(false);
  };
  if (adding) return /*#__PURE__*/React.createElement("div", {
    className: "wrap",
    style: {
      maxWidth: 620
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "hdr"
  }, /*#__PURE__*/React.createElement("h1", null, "\u041D\u043E\u0432\u044B\u0439 \u043A\u043B\u0438\u0435\u043D\u0442"), /*#__PURE__*/React.createElement("p", null, "\u0411\u0440\u0435\u043D\u0434 \u0446\u0435\u043B\u0438\u043A\u043E\u043C: \u043E\u043D \u043E\u0431\u0449\u0438\u0439 \u0434\u043B\u044F \u0432\u0441\u0435\u0445 \u0441\u0442\u0440\u0430\u043D, \u0432 \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0432\u044B \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442\u0435.")), /*#__PURE__*/React.createElement("form", {
    className: "card",
    onSubmit: save
  }, /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0431\u0440\u0435\u043D\u0434\u0430"), /*#__PURE__*/React.createElement("input", {
    value: f.name,
    onChange: e => setF({
      ...f,
      name: e.target.value
    }),
    required: true,
    autoFocus: true
  })), /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "\u0421\u0430\u0439\u0442"), /*#__PURE__*/React.createElement("input", {
    value: f.domain,
    onChange: e => setF({
      ...f,
      domain: e.target.value
    }),
    placeholder: "example.com"
  })), /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "\u0421\u0443\u0442\u044C \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0430"), /*#__PURE__*/React.createElement("input", {
    value: f.what,
    onChange: e => setF({
      ...f,
      what: e.target.value
    }),
    placeholder: "\u0427\u0442\u043E \u0432\u044B \u043F\u0440\u043E\u0434\u0430\u0451\u0442\u0435 \u0438 \u043A\u043E\u043C\u0443"
  }), /*#__PURE__*/React.createElement("span", {
    className: "hint"
  }, "\u041E\u0434\u043D\u043E\u0439 \u0441\u0442\u0440\u043E\u043A\u043E\u0439. \u041F\u043E\u0434\u0440\u043E\u0431\u043D\u043E\u0441\u0442\u0438 \u0441\u043F\u0440\u043E\u0441\u0438\u0442 \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435.")), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    disabled: !f.name.trim()
  }, "\u0421\u043E\u0437\u0434\u0430\u0442\u044C"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: () => setAdding(false)
  }, "\u041E\u0442\u043C\u0435\u043D\u0430"))));
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hdr"
  }, /*#__PURE__*/React.createElement("h1", null, "\u041A\u043B\u0438\u0435\u043D\u0442\u044B"), /*#__PURE__*/React.createElement("p", null, "\u0411\u0440\u0435\u043D\u0434 \u2014 \u0432\u0435\u0440\u0445\u043D\u0438\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C. \u0412\u043D\u0443\u0442\u0440\u0438 \u043D\u0435\u0433\u043E \u0441\u0442\u0440\u0430\u043D\u044B, \u0432 \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0432\u044B \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442\u0435.")), data.clients.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card empty"
  }, importing ? /*#__PURE__*/React.createElement("p", null, "\u0418\u0449\u0443 \u0432\u0430\u0448\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u044B \u0432 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0435 \u0438 \u0432 \u0431\u0430\u0437\u0435\u2026") : /*#__PURE__*/React.createElement("p", null, "\u0417\u0434\u0435\u0441\u044C \u043F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442\u043E. \u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0441 \u0431\u0440\u0435\u043D\u0434\u0430 \u2014 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F, \u0441\u0430\u0439\u0442\u0430 \u0438 \u043E\u0434\u043D\u043E\u0439 \u0441\u0442\u0440\u043E\u043A\u0438 \u043E \u0442\u043E\u043C, \u0447\u0442\u043E \u043E\u043D \u043F\u0440\u043E\u0434\u0430\u0451\u0442."), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => setAdding(true)
  }, "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u043B\u0438\u0435\u043D\u0442\u0430")) : /*#__PURE__*/React.createElement("div", {
    className: "tiles"
  }, data.clients.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    className: "tile",
    onClick: () => onOpen(c.id)
  }, /*#__PURE__*/React.createElement("b", null, c.name), /*#__PURE__*/React.createElement("span", null, c.fromOld ? 'из инструмента · ' : '', c.domain || 'без сайта', " \xB7 ", c.markets.length ? c.markets.length + ' ' + plural(c.markets.length, 'рынок', 'рынка', 'рынков') : 'рынков нет'))), /*#__PURE__*/React.createElement("button", {
    className: "tile add",
    onClick: () => setAdding(true)
  }, "+ \u0415\u0449\u0451 \u043A\u043B\u0438\u0435\u043D\u0442")));
}
const plural = (n, a, b, c) => {
  const d = n % 100,
    e = n % 10;
  if (d > 10 && d < 20) return c;
  if (e === 1) return a;
  if (e >= 2 && e <= 4) return b;
  return c;
};

// ── Экран 2: рынки клиента ──────────────────────────────────────────────────
function Markets({
  client,
  onOpen,
  onAdd,
  onBack
}) {
  const [adding, setAdding] = useState(false);
  const [country, setCountry] = useState('RU');
  const [lang, setLang] = useState('Русский');
  const c = COUNTRIES.find(x => x.code === country);
  const pickCountry = code => {
    setCountry(code);
    setLang(COUNTRIES.find(x => x.code === code).langs[0]);
  };
  const save = e => {
    e.preventDefault();
    onAdd({
      id: uid(),
      country,
      countryName: c.name,
      lang,
      research: null
    });
    setAdding(false);
  };
  if (adding) return /*#__PURE__*/React.createElement("div", {
    className: "wrap",
    style: {
      maxWidth: 620
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "hdr"
  }, /*#__PURE__*/React.createElement("h1", null, "\u041D\u043E\u0432\u044B\u0439 \u0440\u044B\u043D\u043E\u043A"), /*#__PURE__*/React.createElement("p", null, "\u0420\u044B\u043D\u043E\u043A \u2014 \u044D\u0442\u043E \u0441\u0442\u0440\u0430\u043D\u0430 \u0438 \u044F\u0437\u044B\u043A \u0432\u043C\u0435\u0441\u0442\u0435. \u0418\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0434\u0435\u043B\u0430\u0435\u0442\u0441\u044F \u0434\u043B\u044F \u043D\u0435\u0433\u043E.")), /*#__PURE__*/React.createElement("form", {
    className: "card",
    onSubmit: save
  }, /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "\u0421\u0442\u0440\u0430\u043D\u0430"), /*#__PURE__*/React.createElement("select", {
    value: country,
    onChange: e => pickCountry(e.target.value)
  }, COUNTRIES.map(x => /*#__PURE__*/React.createElement("option", {
    key: x.code,
    value: x.code
  }, x.name)))), /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "\u042F\u0437\u044B\u043A \u0430\u0443\u0434\u0438\u0442\u043E\u0440\u0438\u0438"), /*#__PURE__*/React.createElement("select", {
    value: lang,
    onChange: e => setLang(e.target.value)
  }, c.langs.map(l => /*#__PURE__*/React.createElement("option", {
    key: l,
    value: l
  }, l))), /*#__PURE__*/React.createElement("span", {
    className: "hint"
  }, "\u0421\u0442\u0440\u0430\u043D\u0430 \u043D\u0435 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442 \u043D\u0430 \u044D\u0442\u043E\u0442 \u0432\u043E\u043F\u0440\u043E\u0441 \u0437\u0430 \u0432\u0430\u0441: \u0432 \u041E\u0410\u042D \u043F\u043E\u043A\u0443\u043F\u0430\u044E\u0442 \u0438 \u043F\u043E-\u0430\u043D\u0433\u043B\u0438\u0439\u0441\u043A\u0438, \u0438 \u043F\u043E-\u0430\u0440\u0430\u0431\u0441\u043A\u0438, \u0430 \u0432 \u0422\u0443\u0440\u0446\u0438\u0438 \u0435\u0441\u0442\u044C \u0440\u0443\u0441\u0441\u043A\u043E\u044F\u0437\u044B\u0447\u043D\u0430\u044F \u0430\u0443\u0434\u0438\u0442\u043E\u0440\u0438\u044F.")), /*#__PURE__*/React.createElement("div", {
    className: "warn"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rule"
  }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "\u042F\u0437\u044B\u043A \u043C\u0435\u043D\u044F\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F"), "\u041E\u0442\u0437\u044B\u0432\u044B, \u0446\u0438\u0442\u0430\u0442\u044B \u0438 \u0444\u043E\u0440\u043C\u0443\u043B\u0438\u0440\u043E\u0432\u043A\u0438 \u0441\u043E\u0431\u0438\u0440\u0430\u044E\u0442\u0441\u044F \u043D\u0430 \u044F\u0437\u044B\u043A\u0435 \u0430\u0443\u0434\u0438\u0442\u043E\u0440\u0438\u0438. \u0414\u0440\u0443\u0433\u043E\u0439 \u044F\u0437\u044B\u043A \u2014 \u044D\u0442\u043E \u0434\u0440\u0443\u0433\u043E\u0439 \u0440\u044B\u043D\u043E\u043A \u0438 \u0434\u0440\u0443\u0433\u043E\u0435 \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435, \u0437\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u0434\u0435\u043D\u044C\u0433\u0438. \u0421\u0442\u0440\u0430\u043D\u0443 \u0438 \u044F\u0437\u044B\u043A \u043F\u043E\u0441\u043B\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u0440\u044B\u043D\u043A\u0430 \u043D\u0435 \u043F\u043E\u043C\u0435\u043D\u044F\u0442\u044C.")), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary"
  }, "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0440\u044B\u043D\u043E\u043A"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn",
    onClick: () => setAdding(false)
  }, "\u041E\u0442\u043C\u0435\u043D\u0430"))));
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hdr"
  }, /*#__PURE__*/React.createElement("h1", null, client.name), /*#__PURE__*/React.createElement("p", null, client.what || 'Суть продукта не заполнена')), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    style: {
      marginBottom: 20
    },
    onClick: onBack
  }, "\u2190 \u0412\u0441\u0435 \u043A\u043B\u0438\u0435\u043D\u0442\u044B"), client.markets.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card empty"
  }, /*#__PURE__*/React.createElement("p", null, "\u0423 \u0431\u0440\u0435\u043D\u0434\u0430 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u043D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u0440\u044B\u043D\u043A\u0430. \u0420\u044B\u043D\u043E\u043A \u2014 \u044D\u0442\u043E \u0441\u0442\u0440\u0430\u043D\u0430 \u0438 \u044F\u0437\u044B\u043A: \u0441 \u043D\u0435\u0433\u043E \u043D\u0430\u0447\u0438\u043D\u0430\u0435\u0442\u0441\u044F \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435."), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => setAdding(true)
  }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0440\u044B\u043D\u043E\u043A")) : /*#__PURE__*/React.createElement("div", {
    className: "tiles"
  }, client.markets.map(m => /*#__PURE__*/React.createElement("button", {
    key: m.id,
    className: "tile",
    onClick: () => onOpen(m.id)
  }, /*#__PURE__*/React.createElement("b", null, m.countryName), /*#__PURE__*/React.createElement("span", {
    style: {
      marginBottom: 8
    }
  }, m.lang, m.projectIds && m.projectIds.length > 1 ? ' · ' + m.projectIds.length + ' прогона в инструменте' : ''), /*#__PURE__*/React.createElement("span", {
    className: 'chip ' + (m.research ? 'chip-go' : 'chip-wait')
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), m.research ? 'исследование готово' : 'исследования ещё нет'))), /*#__PURE__*/React.createElement("button", {
    className: "tile add",
    onClick: () => setAdding(true)
  }, "+ \u0415\u0449\u0451 \u0440\u044B\u043D\u043E\u043A")));
}

// ── Экран 3: рынок с боковым меню модулей ───────────────────────────────────
// Разделы платформы и их части. Порядок и названия — из оболочки,
// собранной вместе с владелицей 12.09.2026 (артефакт «Контент-машина — весь
// путь»). Порядок не произвольный: лендинг — часть воронки, а план строится
// под цель и под то, куда ведут тексты.
//
// У «Исследования» части НАШИ: на той стороне это раздел «что пришло к нам»,
// потому что исследование им приходит готовым. У нас оно тут и делается.
const SECTIONS = [
// Последняя часть — не наш шаг, а СТЫК: какие поля исследования доехали до
// контент-машины, какие пусты, чего не хватает для генерации. Именно здесь
// человек поймёт, почему контент-машина отказалась писать (их просьба).
{
  id: 'research',
  name: 'Исследование',
  parts: [['brief', 'Бриф'], ['niches', 'Ниши'], ['run', 'Прогон'], ['report', 'Отчёт'], ['handoff', 'Что ушло в контент']]
}, {
  id: 'funnel',
  name: 'Воронка',
  parts: [['goal', 'Цель'], ['parts', 'Из чего состоит'], ['page', 'Целевая страница'], ['auto', 'Автомат касаний']]
}, {
  id: 'landing',
  name: 'Лендинг',
  parts: [['tz', 'ТЗ страницы'], ['build', 'Сборка и публикация']]
}, {
  id: 'plan',
  name: 'Контент-план',
  parts: [['places', 'Мои площадки'], ['what', 'Что генерируем'], ['sources', 'Источники тем'], ['plan30', 'План на 30 дней'], ['standards', 'Эталоны'], ['topics', 'Темы'], ['approve', 'Согласование'], ['published', 'Опубликовано']]
}, {
  id: 'analytics',
  name: 'Аналитика',
  parts: [['spend', 'Расход'], ['metrics', 'Метрики']]
}];
const SETTINGS = [['keys', 'Ключи и оплата'], ['brand', 'Профиль бренда'], ['voice', 'Голос'], ['design', 'Оформление'], ['accounts', 'Аккаунты площадок']];
const HELP = [['algo', 'Алгоритм платформы'], ['components', 'Компоненты']];
const ICONS = {
  research: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 11 12 4l8 7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 10v9h12v-9"
  })),
  funnel: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 6h16l-6 7v5l-4 2v-7z"
  })),
  landing: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 19V9l8-5 8 5v10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 19v-6h4v6"
  })),
  plan: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "6",
    width: "16",
    height: "12",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 10h16"
  })),
  analytics: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 8v4l3 2"
  }))
};

// Подписи в строке проекта. Пусто — значит пусто: «нет исследования» честнее
// прочерка, а выдуманного «412 из 1000» здесь нет вовсе.
const ниши = c => {
  const n = c && c.usage && c.usage.niches;
  if (!n) return 'нет исследования';
  const h = Math.abs(n) % 100,
    t = h % 10;
  const сл = h > 10 && h < 20 || t === 0 || t >= 5 ? 'ниш' : t === 1 ? 'ниша' : 'ниши';
  return n + ' ' + сл;
};
const расход = c => {
  const u = c && c.usage;
  if (!u || !u.cost_cents && !u.llm_calls) return 'без расхода';
  if (u.cost_cents) return (u.cost_cents / 100).toFixed(2).replace('.', ',') + ' $ за месяц';
  return u.llm_calls + ' вызовов';
};
const FLAG = c => ({
  RU: '🇷🇺',
  TR: '🇹🇷',
  KZ: '🇰🇿',
  AE: '🇦🇪',
  US: '🇺🇸',
  GB: '🇬🇧'
})[c] || '';
const MARK = n => (n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
function Market({
  client,
  market,
  clients,
  onPick,
  onBack,
  theme,
  setTheme,
  onOut
}) {
  // Раздел и часть внутри него. Список частей меняется вместе с плиткой —
  // это и было решением владелицы: у каждого раздела свои части.
  const [section, setSection] = useState('research');
  const [part, setPart] = useState('brief');
  const [drop, setDrop] = useState(false);
  useEffect(() => {
    if (!drop) return;
    const off = e => {
      if (!e.target.closest('.cm-side-proj')) setDrop(false);
    };
    document.addEventListener('click', off);
    return () => document.removeEventListener('click', off);
  }, [drop]);
  const cur = SECTIONS.find(x => x.id === section) || SECTIONS[0];
  return /*#__PURE__*/React.createElement("div", {
    className: "app"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "side"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cm-drop cm-side-proj"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cm-drop"
  }, /*#__PURE__*/React.createElement("button", {
    className: "cm-proj",
    onClick: e => {
      e.stopPropagation();
      setDrop(!drop);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "cm-mark"
  }, MARK(client.name)), /*#__PURE__*/React.createElement("u", {
    className: "cm-cc"
  }, FLAG(market.country), " ", (market.country || '').toUpperCase()), /*#__PURE__*/React.createElement("b", null, client.domain || client.name), /*#__PURE__*/React.createElement("em", null, ниши(client)), /*#__PURE__*/React.createElement("svg", {
    className: "cm-chev",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7 10l5 5 5-5"
  }))), drop && /*#__PURE__*/React.createElement("div", {
    className: "cm-menu wide"
  }, (clients || []).flatMap(c => (c.markets || []).map(m => /*#__PURE__*/React.createElement("a", {
    key: c.id + m.id,
    className: c.id === client.id && m.id === market.id ? 'on' : undefined,
    onClick: () => {
      setDrop(false);
      onPick(c.id, m.id);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "cm-mark"
  }, MARK(c.name)), /*#__PURE__*/React.createElement("u", {
    className: "cm-cc"
  }, FLAG(m.country), " ", (m.country || '').toUpperCase()), /*#__PURE__*/React.createElement("b", null, c.domain || c.name), /*#__PURE__*/React.createElement("em", null, ниши(c)), /*#__PURE__*/React.createElement("span", null, расход(c))))), /*#__PURE__*/React.createElement("div", {
    className: "cm-sep"
  }), /*#__PURE__*/React.createElement("a", {
    className: "cm-add",
    onClick: () => {
      setDrop(false);
      onBack();
    }
  }, "+ \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442")))), /*#__PURE__*/React.createElement("div", {
    className: "navgrid"
  }, SECTIONS.map(x => /*#__PURE__*/React.createElement("button", {
    key: x.id,
    className: "navtile",
    "aria-current": section === x.id ? 'page' : undefined,
    onClick: () => {
      setSection(x.id);
      setPart(x.parts[0][0]);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, ICONS[x.id]), x.name))), /*#__PURE__*/React.createElement("nav", {
    className: "navlist"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grp"
  }, cur.name), cur.parts.map(([k, n]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: "navrow",
    "aria-current": part === k ? 'page' : undefined,
    onClick: () => setPart(k)
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), n))), /*#__PURE__*/React.createElement("nav", {
    className: "navlist always"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grp"
  }, "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u0430"), SETTINGS.map(([k, n]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: "navrow",
    onClick: () => setPart(k)
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), n)), /*#__PURE__*/React.createElement("div", {
    className: "grp"
  }, "\u0421\u043F\u0440\u0430\u0432\u043A\u0430"), HELP.map(([k, n]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: "navrow",
    onClick: () => setPart(k)
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), n)))), /*#__PURE__*/React.createElement("div", {
    className: "main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement(Slot, {
    section: section,
    part: part,
    client: client,
    market: market
  }))));
}

// Место, куда встанут модули. Оболочка сама ничего не считает и не генерирует —
// она только даёт модулю площадку и говорит, кто вошёл, какой клиент и рынок.

// ─────────────────────────────────────────────────────────────────────────────
// КЛЮЧИ ПРОВАЙДЕРОВ
//
// Режим «свои ключи»: маркетолог вставляет ключ клиента, и вызовы моделей идут
// за его счёт, а не с кредитов платформы. Ключ НЕ проходит через наш сервер —
// браузер кладёт его прямо в хранилище базы вызовом set_provider_key; обратно
// не возвращается никогда, наружу видны только четыре последних знака.
//
// Экран открывается и до применения миграции — тогда честно говорит, чего не
// хватает, вместо пустой страницы с молчаливой ошибкой.
// ─────────────────────────────────────────────────────────────────────────────
const PROVIDERS = [['openai', 'OpenAI — GPT'], ['anthropic', 'Anthropic — Claude'], ['openrouter', 'OpenRouter'], ['google', 'Google — Gemini'], ['tavily', 'Tavily — поиск'], ['telegram', 'Telegram — публикация']];
const PURPOSES = [['', 'для всего'], ['writing', 'тексты'], ['judge', 'проверка'], ['image', 'картинки'], ['video', 'видео'], ['search', 'поиск'], ['publish', 'публикация']];
function Keys({
  client
}) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: '',
    provider: 'openai',
    purpose: '',
    secret: ''
  });
  const {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    getAccessToken
  } = window.CAAuth;
  const зов = useCallback(async (путь, тело) => {
    const t = getAccessToken();
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + путь, {
      method: тело ? 'POST' : 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + t,
        'Content-Type': 'application/json'
      },
      body: тело ? JSON.stringify(тело) : undefined
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) {
      const m = d && (d.message || d.hint) || '';
      // Функции нет — значит миграция ещё не применена. Это не поломка
      // экрана, а недостающий шаг, и сказать надо именно так.
      throw new Error(/does not exist|schema cache/i.test(m) ? 'Хранилище ключей в базе ещё не заведено. Нужно применить миграцию ' + 'schema/002_provider_keys_self_service.sql — её применяет владелица базы, ' + 'права на хранилище секретов есть только у неё. До этого работа идёт на ключах платформы.' : m || 'Не получилось');
    }
    return d;
  }, [SUPABASE_URL, SUPABASE_ANON_KEY, getAccessToken]);
  const обновить = useCallback(() => {
    setErr('');
    зов('provider_keys?select=name,provider,purpose,hint,verified,verified_at' + '&client_id=eq.' + encodeURIComponent(client.id)).then(d => setRows(Array.isArray(d) ? d : [])).catch(e => {
      setRows([]);
      setErr(e.message);
    });
  }, [зов, client.id]);
  useEffect(() => {
    обновить();
  }, [обновить]);
  const добавить = async e => {
    e.preventDefault();
    if (!f.secret.trim() || !f.name.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await зов('rpc/set_provider_key', {
        p_client: client.id,
        p_name: f.name.trim(),
        p_provider: f.provider,
        p_secret: f.secret.trim(),
        p_purpose: f.purpose
      });
      setF({
        ...f,
        name: '',
        secret: ''
      });
      обновить();
    } catch (e2) {
      setErr(e2.message);
    }
    setBusy(false);
  };
  const убрать = async name => {
    setBusy(true);
    setErr('');
    try {
      await зов('rpc/drop_provider_key', {
        p_client: client.id,
        p_name: name
      });
      обновить();
    } catch (e2) {
      setErr(e2.message);
    }
    setBusy(false);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "hdr"
  }, /*#__PURE__*/React.createElement("h1", null, "\u041A\u043B\u044E\u0447\u0438 \u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u044B"), /*#__PURE__*/React.createElement("p", null, "\u0421\u0432\u043E\u0438 \u043A\u043B\u044E\u0447\u0438 \u0434\u043B\u044F \xAB", client.name, "\xBB. \u041F\u043E\u043A\u0430 \u0438\u0445 \u043D\u0435\u0442, \u0440\u0430\u0431\u043E\u0442\u0430 \u0438\u0434\u0451\u0442 \u043D\u0430 \u043A\u043B\u044E\u0447\u0430\u0445 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u044B \u0438 \u0442\u0440\u0430\u0442\u0438\u0442 \u043A\u0440\u0435\u0434\u0438\u0442\u044B.")), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", null, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043A\u043B\u044E\u0447"), /*#__PURE__*/React.createElement("form", {
    onSubmit: добавить
  }, /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435"), /*#__PURE__*/React.createElement("input", {
    value: f.name,
    onChange: e => setF({
      ...f,
      name: e.target.value
    }),
    placeholder: "\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, GPT \u043A\u043B\u0438\u0435\u043D\u0442\u0430",
    required: true
  })), /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "\u041F\u0440\u043E\u0432\u0430\u0439\u0434\u0435\u0440"), /*#__PURE__*/React.createElement("select", {
    value: f.provider,
    onChange: e => setF({
      ...f,
      provider: e.target.value
    })
  }, PROVIDERS.map(([v, n]) => /*#__PURE__*/React.createElement("option", {
    key: v,
    value: v
  }, n)))), /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "\u0414\u043B\u044F \u0447\u0435\u0433\u043E"), /*#__PURE__*/React.createElement("select", {
    value: f.purpose,
    onChange: e => setF({
      ...f,
      purpose: e.target.value
    })
  }, PURPOSES.map(([v, n]) => /*#__PURE__*/React.createElement("option", {
    key: v,
    value: v
  }, n)))), /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "\u041A\u043B\u044E\u0447"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: f.secret,
    autoComplete: "new-password",
    onChange: e => setF({
      ...f,
      secret: e.target.value
    }),
    placeholder: "\u0432\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0441\u044E\u0434\u0430",
    required: true
  })), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, "\u041A\u043B\u044E\u0447 \u0443\u0445\u043E\u0434\u0438\u0442 \u043F\u0440\u044F\u043C\u043E \u0432 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u0431\u0430\u0437\u044B, \u043C\u0438\u043D\u0443\u044F \u043D\u0430\u0448 \u0441\u0435\u0440\u0432\u0435\u0440. \u041E\u0431\u0440\u0430\u0442\u043D\u043E \u043E\u043D \u043D\u0435 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043D\u0438\u043A\u043E\u0433\u0434\u0430 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0435\u0442\u044B\u0440\u0435 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0445 \u0437\u043D\u0430\u043A\u0430."), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    disabled: busy
  }, busy ? 'Сохраняю…' : 'Сохранить ключ')), err && /*#__PURE__*/React.createElement("p", {
    className: "err"
  }, err)), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", null, "\u0417\u0430\u0432\u0435\u0434\u0451\u043D\u043D\u044B\u0435 \u043A\u043B\u044E\u0447\u0438"), rows === null && /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, "\u0421\u043C\u043E\u0442\u0440\u044E\u2026"), rows && !rows.length && /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, "\u041D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E. \u0420\u0430\u0431\u043E\u0442\u0430 \u0438\u0434\u0451\u0442 \u043D\u0430 \u043A\u043B\u044E\u0447\u0430\u0445 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u044B."), rows && rows.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.name,
    className: "krow"
  }, /*#__PURE__*/React.createElement("b", null, r.name), /*#__PURE__*/React.createElement("span", null, (PROVIDERS.find(p => p[0] === r.provider) || [])[1] || r.provider, r.purpose ? ' · ' + ((PURPOSES.find(p => p[0] === r.purpose) || [])[1] || r.purpose) : ''), /*#__PURE__*/React.createElement("span", null, "\u2026", r.hint), /*#__PURE__*/React.createElement("span", null, r.verified ? 'проверен' : 'не проверен'), /*#__PURE__*/React.createElement("button", {
    className: "cm-btn cm-btn-quiet",
    onClick: () => убрать(r.name),
    disabled: busy
  }, "\u0423\u0431\u0440\u0430\u0442\u044C")))));
}

// Площадка раздела. Оболочка сама ничего не считает и не генерирует — она
// только даёт место и говорит, кто вошёл, какой клиент и рынок.
function Slot({
  section,
  part,
  client,
  market
}) {
  if (section === 'research') {
    const q = 'index.html?embed=1&client=' + encodeURIComponent(client.id) + '&market=' + encodeURIComponent(market.id || '') + '&country=' + encodeURIComponent(market.countryName || '') + '&lang=' + encodeURIComponent(market.lang || '') + (part ? '&step=' + encodeURIComponent(part) : '');
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "hdr"
    }, /*#__PURE__*/React.createElement("h1", null, "\u0418\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0446\u0435\u043B\u0435\u0432\u043E\u0439 \u0430\u0443\u0434\u0438\u0442\u043E\u0440\u0438\u0438"), /*#__PURE__*/React.createElement("p", null, client.name, " \xB7 ", market.countryName)), /*#__PURE__*/React.createElement("iframe", {
      className: "modframe",
      title: "\u0418\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0446\u0435\u043B\u0435\u0432\u043E\u0439 \u0430\u0443\u0434\u0438\u0442\u043E\u0440\u0438\u0438",
      src: q
    }));
  }
  if (part === 'keys') return /*#__PURE__*/React.createElement(Keys, {
    client: client
  });
  const sec = SECTIONS.find(x => x.id === section);
  const name = sec && (sec.parts.find(p => p[0] === part) || [])[1] || (sec ? sec.name : '');
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "hdr"
  }, /*#__PURE__*/React.createElement("h1", null, name || (sec ? sec.name : ''))), /*#__PURE__*/React.createElement("div", {
    className: "card empty"
  }, /*#__PURE__*/React.createElement("p", null, "\u042D\u043A\u0440\u0430\u043D \u0435\u0449\u0451 \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D. \u041A\u0430\u0440\u043A\u0430\u0441 \u043D\u0430 \u043C\u0435\u0441\u0442\u0435 \u2014 \u043D\u0430\u0447\u0438\u043D\u043A\u0430 \u043F\u0440\u0438\u0435\u0434\u0435\u0442 \u0438\u0437 \u043A\u043E\u043D\u0442\u0435\u043D\u0442-\u043C\u0430\u0448\u0438\u043D\u044B: \u044D\u0442\u043E \u0435\u0451 \u0441\u0442\u043E\u0440\u043E\u043D\u0430 \u0440\u0430\u0431\u043E\u0442\u044B, \u043D\u0435 \u043D\u0430\u0448\u0430.")));
}

// ─────────────────────────────────────────────────────────────────────────────
// ШАПКА ПЛАТФОРМЫ
//
// Согласована с владелицей 12.09.2026 и собрана вместе с контент-машиной:
// разметка их, стили общие (lib/platform.css из PLATFORM_CSS). Шапка личная,
// а не проектная — знак, приветствие с датой, поиск, «Создать», кредиты,
// поддержка, профиль. Поэтому стоит на КАЖДОМ экране, включая список клиентов:
// раньше человек входил и видел голый список без единого признака платформы.
// ─────────────────────────────────────────────────────────────────────────────
function Top({
  email,
  onOut,
  theme,
  setTheme
}) {
  const [open, setOpen] = useState('');
  // Один список открыт за раз, клик мимо закрывает — правило оболочки.
  useEffect(() => {
    if (!open) return;
    const off = e => {
      if (!e.target.closest('.cm-drop')) setOpen('');
    };
    document.addEventListener('click', off);
    return () => document.removeEventListener('click', off);
  }, [open]);
  const ico = d => ({
    onClick: e => {
      e.stopPropagation();
      setOpen(open === d ? '' : d);
    }
  });
  const now = new Date();
  const день = now.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const час = now.getHours();
  const привет = час < 5 ? 'Доброй ночи' : час < 12 ? 'Доброе утро' : час < 18 ? 'Добрый день' : 'Добрый вечер';
  const имя = (email || '').split('@')[0];
  return /*#__PURE__*/React.createElement("div", {
    className: "cm-top"
  }, /*#__PURE__*/React.createElement("img", {
    className: "cm-logo",
    src: LOGO,
    alt: "bulbul lab"
  }), /*#__PURE__*/React.createElement("div", {
    className: "cm-hello"
  }, /*#__PURE__*/React.createElement("b", null, привет, имя ? ', ' + имя : ''), /*#__PURE__*/React.createElement("i", null, день)), /*#__PURE__*/React.createElement("div", {
    className: "cm-rt"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cm-drop"
  }, /*#__PURE__*/React.createElement("button", _extends({
    className: "cm-ico"
  }, ico('find'), {
    "aria-label": "\u041F\u043E\u0438\u0441\u043A"
  }), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M20 20l-4.5-4.5"
  }))), open === 'find' && /*#__PURE__*/React.createElement("div", {
    className: "cm-menu wide"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cm-find"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "cm-ic",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M20 20l-4.5-4.5"
  })), /*#__PURE__*/React.createElement("input", {
    className: "t",
    placeholder: "\u041A\u043B\u0438\u0435\u043D\u0442\u044B, \u0440\u044B\u043D\u043A\u0438, \u043D\u0438\u0448\u0438"
  })), /*#__PURE__*/React.createElement("p", {
    className: "cm-hint"
  }, "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043A\u043B\u0438\u0435\u043D\u0442\u0430\u043C \u0438 \u0440\u044B\u043D\u043A\u0430\u043C. \u041F\u043E \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u043C\u0443 \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0437\u0430\u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442, \u043A\u043E\u0433\u0434\u0430 \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u043F\u0435\u0440\u0432\u044B\u0439 \u043F\u0440\u043E\u0433\u043E\u043D."))), /*#__PURE__*/React.createElement("div", {
    className: "cm-drop"
  }, /*#__PURE__*/React.createElement("button", _extends({
    className: "cm-ico"
  }, ico('user'), {
    "aria-label": "\u041F\u0440\u043E\u0444\u0438\u043B\u044C"
  }), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8.5",
    r: "3.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 19c1.2-3.2 4-4.8 7-4.8s5.8 1.6 7 4.8"
  }))), open === 'user' && /*#__PURE__*/React.createElement("div", {
    className: "cm-menu"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cm-user"
  }, /*#__PURE__*/React.createElement("b", null, email || 'Вы вошли'), /*#__PURE__*/React.createElement("span", null, "\u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u044B")), /*#__PURE__*/React.createElement("div", {
    className: "cm-sep"
  }), /*#__PURE__*/React.createElement("div", {
    className: "cm-user"
  }, /*#__PURE__*/React.createElement("b", null, "\u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435"), /*#__PURE__*/React.createElement("span", null, "\u0441\u0432\u0435\u0442\u043B\u043E\u0435, \u0442\u0451\u043C\u043D\u043E\u0435 \u0438\u043B\u0438 \u043A\u0430\u043A \u0432 \u0441\u0438\u0441\u0442\u0435\u043C\u0435")), [['light', 'Светлая'], ['dark', 'Тёмная'], ['system', 'Как в системе']].map(([v, l]) => /*#__PURE__*/React.createElement("a", {
    key: v,
    onClick: () => setTheme(v),
    "aria-current": theme === v ? 'true' : undefined
  }, l)), /*#__PURE__*/React.createElement("div", {
    className: "cm-sep"
  }), /*#__PURE__*/React.createElement("a", {
    onClick: onOut
  }, "\u0412\u044B\u0439\u0442\u0438")))));
}

// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [ready, setReady] = useState(false);
  // Почта вошедшего — для приветствия и меню профиля. Берём из токена: свой
  // запрос ради одной строки был бы лишним обращением на каждом открытии.
  const email = (() => {
    try {
      const t = window.CAAuth.getAccessToken && window.CAAuth.getAccessToken();
      if (!t) return '';
      const p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return p.email || '';
    } catch {
      return '';
    }
  })();
  const [inside, setInside] = useState(false);
  const [data, setData] = useState(store.read);
  const [clientId, setClientId] = useState(null);
  const [marketId, setMarketId] = useState(null);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('ca_theme') || 'system';
    } catch {
      return 'system';
    }
  });

  // Тема: 'system' НЕ ставит атрибут — тогда работает prefers-color-scheme.
  useEffect(() => {
    const r = document.documentElement;
    if (theme === 'system') r.removeAttribute('data-theme');else r.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('ca_theme', theme);
    } catch {}
  }, [theme]);

  // Токен Supabase живёт около часа. Refresh-токен переживает перезагрузку, и
  // если он есть — молча продлеваем, чтобы не гонять человека через вход.
  useEffect(() => {
    if (!getRefreshToken()) {
      setReady(true);
      return;
    }
    refreshTokens().then(ok => {
      setInside(ok);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  // Перенос проектов инструмента. Идёт ОДИН раз — пока у оболочки нет ни одного
  // клиента. Дальше она живёт своей жизнью, иначе перенос затирал бы то, что
  // человек здесь уже поправил.
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    if (!inside || data.clients.length) return;
    setImporting(true);
    const local = readLocalProjects();
    // Локальные показываем сразу, не дожидаясь сети: если сеть медленная или
    // база недоступна, человек всё равно видит свои проекты, а не пустоту.
    if (local.length) save(buildShellData(local));
    // Сначала спрашиваем таблицу клиентов — это общий с контент-машиной
    // источник. Есть строки — работаем от них и прогоны инструмента больше не
    // разбираем: клиент, заведённый в базе, главнее собранного из брифов.
    readDbClients().then(cl => {
      if (cl.length) {
        save({
          clients: cl
        });
        setImporting(false);
        return null;
      }
      return readDbProjects().then(db => {
        const all = mergeById(local, db);
        if (all.length) save(buildShellData(all));
        setImporting(false);
      });
    }).catch(() => setImporting(false));
  }, [inside]);
  const save = useCallback(d => {
    setData(d);
    store.write(d);
  }, []);

  // Заводим клиента и рынок В БАЗЕ, а не только в браузере. Показываем сразу,
  // не дожидаясь ответа, — иначе после нажатия экран стоит и непонятно,
  // случилось ли что-то. Пришёл настоящий id — подменяем временный: по нему
  // потом свяжутся исследование и контент-машина, и временный там не годится.
  // Не записалось — говорим об этом вслух: молча оставить строку только в
  // браузере значит пообещать сохранность, которой нет.
  const [saveErr, setSaveErr] = useState('');
  const addClient = useCallback(async c => {
    save({
      ...data,
      clients: [...data.clients, c]
    });
    try {
      const r = await authFetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: c.name,
          domain: c.domain || '',
          one_liner: c.what || ''
        })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.client) throw new Error('нет строки');
      setData(prev => {
        const next = {
          ...prev,
          clients: prev.clients.map(x => x.id === c.id ? {
            ...x,
            id: d.client.id,
            fromDb: true
          } : x)
        };
        store.write(next);
        return next;
      });
      setClientId(id => id === c.id ? d.client.id : id);
    } catch {
      setSaveErr('Клиент пока только в этом браузере — база не ответила.');
    }
  }, [data, save]);
  const addMarket = useCallback(async m => {
    save({
      ...data,
      clients: data.clients.map(c => c.id === clientId ? {
        ...c,
        markets: [...c.markets, m]
      } : c)
    });
    try {
      const r = await authFetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          market: {
            country: m.country || '',
            country_name: m.countryName || '',
            lang: m.lang || ''
          }
        })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.market) throw new Error('нет строки');
      setData(prev => {
        const next = {
          ...prev,
          clients: prev.clients.map(c => c.id === clientId ? {
            ...c,
            markets: c.markets.map(x => x.id === m.id ? {
              ...x,
              id: d.market.id
            } : x)
          } : c)
        };
        store.write(next);
        return next;
      });
    } catch {
      setSaveErr('Рынок пока только в этом браузере — база не ответила.');
    }
  }, [data, clientId, save]);
  const client = data.clients.find(c => c.id === clientId) || null;
  const market = client && client.markets.find(m => m.id === marketId) || null;
  if (!ready) return null;
  if (!inside) return /*#__PURE__*/React.createElement(Login, {
    onIn: () => setInside(true)
  });

  // Шапка платформы стоит на всех экранах. Полосы состояния — под ней:
  // они сообщают о происходящем, а не заменяют оформление, как было раньше.
  const bar = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Top, {
    email: email,
    theme: theme,
    setTheme: setTheme,
    onOut: () => {
      clearTokens();
      setInside(false);
    }
  }), importing && /*#__PURE__*/React.createElement("div", {
    className: "cm-lane"
  }, "\u041F\u0435\u0440\u0435\u043D\u043E\u0448\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u044B \u0438\u0437 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0430\u2026"), saveErr && /*#__PURE__*/React.createElement("div", {
    className: "cm-lane"
  }, saveErr));
  if (market) return /*#__PURE__*/React.createElement(Market, {
    client: client,
    market: market,
    clients: data.clients,
    theme: theme,
    setTheme: setTheme,
    onPick: (c, m) => {
      setClientId(c);
      setMarketId(m);
    },
    onBack: () => {
      setMarketId(null);
      setClientId(null);
    },
    onOut: () => {
      clearTokens();
      setInside(false);
    }
  });
  if (client) return /*#__PURE__*/React.createElement(React.Fragment, null, bar, /*#__PURE__*/React.createElement(Markets, {
    client: client,
    onBack: () => setClientId(null),
    onOpen: setMarketId,
    onAdd: m => {
      addMarket(m);
    }
  }));
  return /*#__PURE__*/React.createElement(React.Fragment, null, bar, /*#__PURE__*/React.createElement(Clients, {
    data: data,
    onOpen: setClientId,
    importing: importing,
    onAdd: c => {
      addClient(c);
    }
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));