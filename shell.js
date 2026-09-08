// СОБРАНО АВТОМАТИЧЕСКИ из shell.jsx — не править руками.
// Правки вносить в shell.jsx, затем: osascript -l JavaScript tools/build.js
// отпечаток-исходника: a233d1e1a5953bc5
const {
  useState,
  useEffect,
  useCallback
} = React;
const {
  signIn,
  refreshTokens,
  getRefreshToken,
  clearTokens,
  authFetch
} = window.CAAuth;
const {
  buildShellData
} = window.CAMigrate;

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
const MODULES = [{
  id: 'research',
  group: 'Начало проекта',
  name: 'Исследование ЦА',
  always: true
}, {
  id: 'content',
  group: 'Работа',
  name: 'Контент-план'
}, {
  id: 'inbox',
  group: 'Работа',
  name: 'Контент',
  count: 0
}, {
  id: 'landing',
  group: 'Работа',
  name: 'Лендинг'
}, {
  id: 'brand',
  group: 'Настройки',
  name: 'Бренд'
}, {
  id: 'voice',
  group: 'Настройки',
  name: 'Голос'
}, {
  id: 'channels',
  group: 'Настройки',
  name: 'Площадки'
}];
const GROUPS = ['Начало проекта', 'Настройки', 'Работа'];

// ─────────────────────────────────────────────────────────────────────────────
function Login({
  onIn
}) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async e => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const ok = await signIn(email.trim(), pw).catch(() => false);
    setBusy(false);
    if (ok) onIn();else setErr('Не подошли почта или пароль.');
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "login"
  }, /*#__PURE__*/React.createElement("form", {
    className: "card",
    onSubmit: go
  }, /*#__PURE__*/React.createElement("h2", null, "\u0412\u0445\u043E\u0434"), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, "\u0422\u043E\u0442 \u0436\u0435 \u0430\u043A\u043A\u0430\u0443\u043D\u0442, \u0447\u0442\u043E \u0438 \u0432 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0435 \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u044F."), /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("span", {
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
  }, busy ? 'Проверяю…' : 'Войти'), err && /*#__PURE__*/React.createElement("p", {
    className: "err"
  }, err)));
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
  }, /*#__PURE__*/React.createElement("b", null, "\u042F\u0437\u044B\u043A \u043C\u0435\u043D\u044F\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F"), /*#__PURE__*/React.createElement("span", null, "\u041E\u0442\u0437\u044B\u0432\u044B, \u0446\u0438\u0442\u0430\u0442\u044B \u0438 \u0444\u043E\u0440\u043C\u0443\u043B\u0438\u0440\u043E\u0432\u043A\u0438 \u0441\u043E\u0431\u0438\u0440\u0430\u044E\u0442\u0441\u044F \u043D\u0430 \u044F\u0437\u044B\u043A\u0435 \u0430\u0443\u0434\u0438\u0442\u043E\u0440\u0438\u0438. \u0414\u0440\u0443\u0433\u043E\u0439 \u044F\u0437\u044B\u043A \u2014 \u044D\u0442\u043E \u0434\u0440\u0443\u0433\u043E\u0439 \u0440\u044B\u043D\u043E\u043A \u0438 \u0434\u0440\u0443\u0433\u043E\u0435 \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435, \u0437\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u0434\u0435\u043D\u044C\u0433\u0438. \u0421\u0442\u0440\u0430\u043D\u0443 \u0438 \u044F\u0437\u044B\u043A \u043F\u043E\u0441\u043B\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u0440\u044B\u043D\u043A\u0430 \u043D\u0435 \u043F\u043E\u043C\u0435\u043D\u044F\u0442\u044C.")), /*#__PURE__*/React.createElement("div", {
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
  }, m.research ? 'исследование готово' : 'исследования ещё нет'))), /*#__PURE__*/React.createElement("button", {
    className: "tile add",
    onClick: () => setAdding(true)
  }, "+ \u0415\u0449\u0451 \u0440\u044B\u043D\u043E\u043A")));
}

// ── Экран 3: рынок с боковым меню модулей ───────────────────────────────────
function Market({
  client,
  market,
  onBack,
  theme,
  setTheme,
  onOut
}) {
  const [tab, setTab] = useState('research');
  const done = !!market.research;
  return /*#__PURE__*/React.createElement("div", {
    className: "app"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "side"
  }, /*#__PURE__*/React.createElement("div", {
    className: "brand"
  }, /*#__PURE__*/React.createElement("b", null, client.name), /*#__PURE__*/React.createElement("span", null, market.countryName, " \xB7 ", market.lang), /*#__PURE__*/React.createElement("button", {
    className: "back",
    onClick: onBack
  }, "\u2190 \u0412\u0441\u0435 \u0440\u044B\u043D\u043A\u0438")), /*#__PURE__*/React.createElement("nav", {
    className: "mods",
    "aria-label": "\u041C\u043E\u0434\u0443\u043B\u0438"
  }, GROUPS.map(g => {
    const items = MODULES.filter(m => m.group === g);
    if (!items.length) return null;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: g
    }, /*#__PURE__*/React.createElement("div", {
      className: "grp"
    }, g), items.map(m => {
      const open = m.always || done;
      return /*#__PURE__*/React.createElement("button", {
        key: m.id,
        className: "mod",
        disabled: !open,
        "aria-current": tab === m.id ? 'page' : undefined,
        onClick: () => open && setTab(m.id)
      }, m.name, !open && /*#__PURE__*/React.createElement("span", {
        className: "lock"
      }, "\u043D\u0443\u0436\u043D\u043E \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435"));
    }));
  })), /*#__PURE__*/React.createElement("div", {
    className: "foot"
  }, [['light', 'Светлая'], ['dark', 'Тёмная'], ['system', 'Как в системе']].map(([v, l]) => /*#__PURE__*/React.createElement("button", {
    key: v,
    className: "tbtn",
    "aria-pressed": theme === v,
    onClick: () => setTheme(v)
  }, l)), /*#__PURE__*/React.createElement("button", {
    className: "tbtn",
    onClick: onOut
  }, "\u0412\u044B\u0439\u0442\u0438"))), /*#__PURE__*/React.createElement("div", {
    className: "main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement(Slot, {
    tab: tab,
    done: done
  }))));
}

// Место, куда встанут модули. Оболочка сама ничего не считает и не генерирует —
// она только даёт модулю площадку и говорит, кто вошёл, какой клиент и рынок.
function Slot({
  tab,
  done
}) {
  const mod = MODULES.find(m => m.id === tab);
  if (tab === 'research') return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "hdr"
  }, /*#__PURE__*/React.createElement("h1", null, "\u0418\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0426\u0410"), /*#__PURE__*/React.createElement("p", null, "\u041F\u0435\u0440\u0432\u044B\u0439 \u043C\u043E\u0434\u0443\u043B\u044C: \u043E\u043D \u043D\u0438 \u043E\u0442 \u0447\u0435\u0433\u043E \u043D\u0435 \u0437\u0430\u0432\u0438\u0441\u0438\u0442 \u0438 \u043E\u0442\u043A\u0440\u044B\u0442 \u0432\u0441\u0435\u0433\u0434\u0430.")), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", null, "\u0421\u044E\u0434\u0430 \u0432\u0441\u0442\u0430\u043D\u0435\u0442 \u043D\u044B\u043D\u0435\u0448\u043D\u0438\u0439 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442"), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, "\u0411\u0440\u0438\u0444, \u043A\u0430\u0440\u0442\u0430 \u043D\u0438\u0448, \u043F\u0440\u043E\u0433\u043E\u043D \u043C\u043E\u0434\u0443\u043B\u0435\u0439 \u0438 \u0441\u0432\u043E\u0434\u043D\u044B\u0439 \u043E\u0442\u0447\u0451\u0442 \u2014 \u0442\u043E, \u0447\u0442\u043E \u0441\u0435\u0439\u0447\u0430\u0441 \u0436\u0438\u0432\u0451\u0442 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435\u0439."), /*#__PURE__*/React.createElement("a", {
    className: "btn",
    href: "index.html"
  }, "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0435\u0433\u043E \u043A\u0430\u043A \u0435\u0441\u0442\u044C \u2192")), !done && /*#__PURE__*/React.createElement("div", {
    className: "warn"
  }, /*#__PURE__*/React.createElement("b", null, "\u041F\u043E\u043A\u0430 \u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u043E"), /*#__PURE__*/React.createElement("span", null, "\u041E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u043C\u043E\u0434\u0443\u043B\u0438 \u0436\u0434\u0443\u0442 \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u044F: \u0431\u0435\u0437 \u043D\u0435\u0433\u043E \u0438\u043C \u043D\u0435\u043E\u0442\u043A\u0443\u0434\u0430 \u0432\u0437\u044F\u0442\u044C \u043D\u0438 \u0431\u043E\u043B\u0435\u0439 \u0430\u0443\u0434\u0438\u0442\u043E\u0440\u0438\u0438, \u043D\u0438 \u0435\u0451 \u044F\u0437\u044B\u043A\u0430.")));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "hdr"
  }, /*#__PURE__*/React.createElement("h1", null, mod ? mod.name : '')), /*#__PURE__*/React.createElement("div", {
    className: "card empty"
  }, /*#__PURE__*/React.createElement("p", null, "\u041C\u043E\u0434\u0443\u043B\u044C \u0435\u0449\u0451 \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D. \u041A\u0430\u0440\u043A\u0430\u0441 \u043D\u0430 \u043C\u0435\u0441\u0442\u0435 \u2014 \u043D\u0430\u0447\u0438\u043D\u043A\u0430 \u043F\u0440\u0438\u0435\u0434\u0435\u0442 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u043C \u0448\u0430\u0433\u043E\u043C.")));
}

// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [ready, setReady] = useState(false);
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
    readDbProjects().then(db => {
      const all = mergeById(local, db);
      if (all.length) save(buildShellData(all));
      setImporting(false);
    }).catch(() => setImporting(false));
  }, [inside]);
  const save = useCallback(d => {
    setData(d);
    store.write(d);
  }, []);
  const client = data.clients.find(c => c.id === clientId) || null;
  const market = client && client.markets.find(m => m.id === marketId) || null;
  if (!ready) return null;
  if (!inside) return /*#__PURE__*/React.createElement(Login, {
    onIn: () => setInside(true)
  });
  const bar = /*#__PURE__*/React.createElement(React.Fragment, null, importing && /*#__PURE__*/React.createElement("div", {
    className: "top",
    style: {
      justifyContent: 'center',
      color: 'var(--ink-3)',
      fontSize: 12.5
    }
  }, "\u041F\u0435\u0440\u0435\u043D\u043E\u0448\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u044B \u0438\u0437 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0430\u2026"), /*#__PURE__*/React.createElement("div", {
    className: "top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sp"
  }), [['light', 'Светлая'], ['dark', 'Тёмная'], ['system', 'Как в системе']].map(([v, l]) => /*#__PURE__*/React.createElement("button", {
    key: v,
    className: "tbtn",
    "aria-pressed": theme === v,
    onClick: () => setTheme(v)
  }, l)), /*#__PURE__*/React.createElement("button", {
    className: "tbtn",
    onClick: () => {
      clearTokens();
      setInside(false);
    }
  }, "\u0412\u044B\u0439\u0442\u0438")));
  if (market) return /*#__PURE__*/React.createElement(Market, {
    client: client,
    market: market,
    theme: theme,
    setTheme: setTheme,
    onBack: () => setMarketId(null),
    onOut: () => {
      clearTokens();
      setInside(false);
    }
  });
  if (client) return /*#__PURE__*/React.createElement(React.Fragment, null, bar, /*#__PURE__*/React.createElement(Markets, {
    client: client,
    onBack: () => setClientId(null),
    onOpen: setMarketId,
    onAdd: m => save({
      ...data,
      clients: data.clients.map(c => c.id === clientId ? {
        ...c,
        markets: [...c.markets, m]
      } : c)
    })
  }));
  return /*#__PURE__*/React.createElement(React.Fragment, null, bar, /*#__PURE__*/React.createElement(Clients, {
    data: data,
    onOpen: setClientId,
    importing: importing,
    onAdd: c => save({
      ...data,
      clients: [...data.clients, c]
    })
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));