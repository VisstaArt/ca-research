const { useState, useEffect, useCallback } = React;
const { signIn, refreshTokens, getRefreshToken, clearTokens, authFetch } = window.CAAuth;
const { buildShellData } = window.CAMigrate;

// Логотип платформы. Встроен строкой, а не файлом: страница должна открываться
// одним запросом, без ожидания картинки, и работать при выключенной сети.
const LOGO = 'data:image/png;base64,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';

// ─────────────────────────────────────────────────────────────────────────────
// ХРАНИЛИЩЕ
//
// Пока localStorage. Таблиц clients/markets в базе ещё нет — их создание это
// SQL, который запускает владелица, и отдельный шаг. Здесь нарочно ОДИН слой
// со своими именами: когда таблицы появятся, меняется только он, а экраны
// ниже не трогаются вообще.
// ─────────────────────────────────────────────────────────────────────────────
const KEY = 'ca_shell_v1';
const OLD_KEY = 'ca_v6';   // проекты нынешнего инструмента, ТОЛЬКО ЧИТАЕМ
const store = {
  read()  { try { return JSON.parse(localStorage.getItem(KEY) || '{"clients":[]}'); }
            catch { return { clients: [] }; } },
  write(d){ try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} },
};

// Проекты инструмента берём ИЗ ДВУХ мест и объединяем по id.
//
// В браузере (ca_v6) они появляются мгновенно и работают без сети. В базе они
// полные и не привязаны к одной машине: если владелица откроет оболочку с
// другого компьютера, localStorage там пуст, и без базы она снова увидела бы
// пустоту. Старый ключ только читаем и никогда не переписываем — инструмент
// работает и должен продолжать работать, что бы ни делала оболочка.
const readLocalProjects = () => {
  try { const l = JSON.parse(localStorage.getItem(OLD_KEY) || '[]');
        return Array.isArray(l) ? l : []; } catch { return []; }
};
const readDbProjects = async () => {
  try {
    const r = await authFetch('/api/projects', { headers: { 'Content-Type':'application/json' } });
    if (!r.ok) return [];
    const d = await r.json();
    if (!Array.isArray(d.projects)) return [];
    return d.projects.map(row => ({ id: row.id, brief: row.brief || {},
      lang: row.lang || 'Russian', results: row.results || [] }));
  } catch { return []; }
};
const mergeById = (a, b) => {
  const out = [], seen = {};
  for (const r of [...a, ...b]) {
    if (!r || !r.id || seen[r.id]) continue;
    seen[r.id] = 1; out.push(r);
  }
  return out;
};
const uid = () => Math.random().toString(36).slice(2, 10);

// Список стран и языков — короткий и честный: то, с чем реально работаем.
// Расширяется по мере надобности, а не «на всякий случай».
const COUNTRIES = [
  { code:'RU', name:'Россия',  langs:['Русский'] },
  { code:'TR', name:'Турция',  langs:['Турецкий','Русский','Английский'] },
  { code:'AE', name:'ОАЭ',     langs:['Английский','Арабский','Русский'] },
  { code:'KZ', name:'Казахстан', langs:['Русский','Казахский'] },
  { code:'US', name:'США',     langs:['Английский'] },
  { code:'DE', name:'Германия', langs:['Немецкий','Английский'] },
];

// Оболочка знает СПИСОК МОДУЛЕЙ, но не знает, что у исследования внутри M1…M7.
// Это требование свода: внутренняя структура меняется (M5 уже выведен из
// автоцепочки), и если состав M-модулей протечёт сюда, каждое такое изменение
// станет правкой общего кода.
const MODULES = [
  { id:'research', group:'Начало проекта', name:'Исследование ЦА', always:true },
  { id:'content',  group:'Работа', name:'Контент-план' },
  { id:'inbox',    group:'Работа', name:'Контент', count:0 },
  { id:'landing',  group:'Работа', name:'Лендинг' },
  { id:'brand',    group:'Настройки', name:'Бренд' },
  { id:'voice',    group:'Настройки', name:'Голос' },
  { id:'channels', group:'Настройки', name:'Площадки' },
];
const GROUPS = ['Начало проекта','Настройки','Работа'];

// ─────────────────────────────────────────────────────────────────────────────
function Login({ onIn }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async e => {
    e.preventDefault();
    setBusy(true); setErr('');
    const ok = await signIn(email.trim(), pw).catch(() => false);
    setBusy(false);
    if (ok) onIn(); else setErr('Не подошли почта или пароль.');
  };
  return (
    <div className="login">
      <form className="card" onSubmit={go}>
        <img src={LOGO} alt="bulbullab" />
        <h2>Вход</h2>
        <p className="lede">Тот же аккаунт, что и в инструменте исследования.</p>
        <label>
          <span className="lab">Почта</span>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                 autoComplete="username" required />
        </label>
        <label>
          <span className="lab">Пароль</span>
          <input type="password" value={pw} onChange={e=>setPw(e.target.value)}
                 autoComplete="current-password" required />
        </label>
        <button className="btn btn-primary" style={{width:'100%'}} disabled={busy}>
          {busy ? 'Проверяю…' : 'Войти'}
        </button>
        {err && <p className="err">{err}</p>}
      </form>
    </div>
  );
}

// ── Экран 1: клиенты ────────────────────────────────────────────────────────
function Clients({ data, onOpen, onAdd, importing }) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name:'', domain:'', what:'' });
  const save = e => {
    e.preventDefault();
    onAdd({ id: uid(), ...f, markets: [] });
    setF({ name:'', domain:'', what:'' }); setAdding(false);
  };
  if (adding) return (
    <div className="wrap" style={{maxWidth:620}}>
      <div className="hdr">
        <h1>Новый клиент</h1>
        <p>Бренд целиком: он общий для всех стран, в которых вы работаете.</p>
      </div>
      <form className="card" onSubmit={save}>
        <label>
          <span className="lab">Название бренда</span>
          <input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required autoFocus />
        </label>
        <label>
          <span className="lab">Сайт</span>
          <input value={f.domain} onChange={e=>setF({...f,domain:e.target.value})}
                 placeholder="example.com" />
        </label>
        <label>
          <span className="lab">Суть продукта</span>
          <input value={f.what} onChange={e=>setF({...f,what:e.target.value})}
                 placeholder="Что вы продаёте и кому" />
          <span className="hint">Одной строкой. Подробности спросит исследование.</span>
        </label>
        <div className="row">
          <button className="btn btn-primary" disabled={!f.name.trim()}>Создать</button>
          <button type="button" className="btn" onClick={()=>setAdding(false)}>Отмена</button>
        </div>
      </form>
    </div>
  );
  return (
    <div className="wrap">
      <div className="hdr">
        <h1>Клиенты</h1>
        <p>Бренд — верхний уровень. Внутри него страны, в которых вы работаете.</p>
      </div>
      {data.clients.length === 0 ? (
        <div className="card empty">
          {importing ? (
            <p>Ищу ваши проекты в инструменте и в базе…</p>
          ) : (
            <p>Здесь пока пусто. Начните с бренда — названия, сайта и одной строки
               о том, что он продаёт.</p>
          )}
          <button className="btn btn-primary" onClick={()=>setAdding(true)}>Создать клиента</button>
        </div>
      ) : (
        <div className="tiles">
          {data.clients.map(c => (
            <button key={c.id} className="tile" onClick={()=>onOpen(c.id)}>
              <b>{c.name}</b>
              <span>{c.fromOld ? 'из инструмента · ' : ''}{c.domain || 'без сайта'} · {c.markets.length
                ? c.markets.length + ' ' + plural(c.markets.length,'рынок','рынка','рынков')
                : 'рынков нет'}</span>
            </button>
          ))}
          <button className="tile add" onClick={()=>setAdding(true)}>+ Ещё клиент</button>
        </div>
      )}
    </div>
  );
}
const plural = (n,a,b,c) => {
  const d = n % 100, e = n % 10;
  if (d > 10 && d < 20) return c;
  if (e === 1) return a;
  if (e >= 2 && e <= 4) return b;
  return c;
};

// ── Экран 2: рынки клиента ──────────────────────────────────────────────────
function Markets({ client, onOpen, onAdd, onBack }) {
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
    onAdd({ id: uid(), country, countryName: c.name, lang, research: null });
    setAdding(false);
  };
  if (adding) return (
    <div className="wrap" style={{maxWidth:620}}>
      <div className="hdr">
        <h1>Новый рынок</h1>
        <p>Рынок — это страна и язык вместе. Исследование делается для него.</p>
      </div>
      <form className="card" onSubmit={save}>
        <label>
          <span className="lab">Страна</span>
          <select value={country} onChange={e=>pickCountry(e.target.value)}>
            {COUNTRIES.map(x => <option key={x.code} value={x.code}>{x.name}</option>)}
          </select>
        </label>
        <label>
          <span className="lab">Язык аудитории</span>
          <select value={lang} onChange={e=>setLang(e.target.value)}>
            {c.langs.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <span className="hint">Страна не отвечает на этот вопрос за вас: в ОАЭ
            покупают и по-английски, и по-арабски, а в Турции есть русскоязычная
            аудитория.</span>
        </label>
        {/* Требование свода: необратимость языка человек обязан увидеть В МОМЕНТ
            выбора, а не в документации. Иначе он узнает об этом, когда
            исследование уже оплачено, и это будет наша вина, а не его
            невнимательность. */}
        <div className="warn">
          <span className="rule"></span>
          <span><b>Язык менять нельзя</b>
            Отзывы, цитаты и формулировки собираются на языке аудитории.
            Другой язык — это другой рынок и другое исследование, за отдельные
            деньги. Страну и язык после создания рынка не поменять.</span>
        </div>
        <div className="row">
          <button className="btn btn-primary">Создать рынок</button>
          <button type="button" className="btn" onClick={()=>setAdding(false)}>Отмена</button>
        </div>
      </form>
    </div>
  );
  return (
    <div className="wrap">
      <div className="hdr">
        <h1>{client.name}</h1>
        <p>{client.what || 'Суть продукта не заполнена'}</p>
      </div>
      <button className="btn" style={{marginBottom:20}} onClick={onBack}>← Все клиенты</button>
      {client.markets.length === 0 ? (
        <div className="card empty">
          <p>У бренда пока нет ни одного рынка. Рынок — это страна и язык:
             с него начинается исследование.</p>
          <button className="btn btn-primary" onClick={()=>setAdding(true)}>Добавить рынок</button>
        </div>
      ) : (
        <div className="tiles">
          {client.markets.map(m => (
            <button key={m.id} className="tile" onClick={()=>onOpen(m.id)}>
              <b>{m.countryName}</b>
              <span style={{marginBottom:8}}>{m.lang}
                {m.projectIds && m.projectIds.length > 1
                  ? ' · ' + m.projectIds.length + ' прогона в инструменте' : ''}</span>
              <span className={'chip ' + (m.research ? 'chip-go' : 'chip-wait')}>
                <span className="dot"></span>
                {m.research ? 'исследование готово' : 'исследования ещё нет'}
              </span>
            </button>
          ))}
          <button className="tile add" onClick={()=>setAdding(true)}>+ Ещё рынок</button>
        </div>
      )}
    </div>
  );
}

// ── Экран 3: рынок с боковым меню модулей ───────────────────────────────────
function Market({ client, market, onBack, theme, setTheme, onOut }) {
  const [tab, setTab] = useState('research');
  const done = !!market.research;
  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <img src={LOGO} alt="bulbullab" />
        </div>
        {/* Клиент и рынок — контекст под знаком платформы: сначала «где я
            вообще», потом «с кем и по какой стране работаю». */}
        <div className="client">
          <b>{client.name}</b>
          <i>{market.countryName} · {market.lang}</i>
          <button className="back" onClick={onBack}>← Все рынки</button>
        </div>
        <nav className="mods" aria-label="Модули">
          {GROUPS.map(g => {
            const items = MODULES.filter(m => m.group === g);
            if (!items.length) return null;
            return (
              <React.Fragment key={g}>
                <div className="grp">{g}</div>
                {items.map(m => {
                  const open = m.always || done;
                  return (
                    <button key={m.id} className="mod" disabled={!open}
                      aria-current={tab === m.id ? 'page' : undefined}
                      onClick={()=>open && setTab(m.id)}>
                      {m.name}
                      {!open && <span className="lock">нужно исследование</span>}
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </nav>
        <div className="foot">
          {[['light','Светлая'],['dark','Тёмная'],['system','Как в системе']].map(([v,l]) => (
            <button key={v} className="tbtn" aria-pressed={theme === v}
                    onClick={()=>setTheme(v)}>{l}</button>
          ))}
          <button className="tbtn" onClick={onOut}>Выйти</button>
        </div>
      </aside>
      <div className="main">
        <div className="wrap">
          <Slot tab={tab} done={done} />
        </div>
      </div>
    </div>
  );
}

// Место, куда встанут модули. Оболочка сама ничего не считает и не генерирует —
// она только даёт модулю площадку и говорит, кто вошёл, какой клиент и рынок.
function Slot({ tab, done }) {
  const mod = MODULES.find(m => m.id === tab);
  if (tab === 'research') return (
    <>
      <div className="hdr">
        <h1>Исследование ЦА</h1>
        <p>Первый модуль: он ни от чего не зависит и открыт всегда.</p>
      </div>
      <div className="card">
        <h2>Сюда встанет нынешний инструмент</h2>
        <p className="lede">Бриф, карта ниш, прогон модулей и сводный отчёт —
          то, что сейчас живёт отдельной страницей.</p>
        <a className="btn" href="index.html">Открыть его как есть →</a>
      </div>
      {!done && (
        <div className="warn">
          <span className="rule"></span>
          <span><b>Пока не пройдено</b>
            Остальные модули ждут исследования: без него им неоткуда взять
            ни болей аудитории, ни её языка.</span>
        </div>
      )}
    </>
  );
  return (
    <>
      <div className="hdr"><h1>{mod ? mod.name : ''}</h1></div>
      <div className="card empty">
        <p>Модуль ещё не подключён. Каркас на месте — начинка приедет следующим шагом.</p>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [ready, setReady] = useState(false);
  const [inside, setInside] = useState(false);
  const [data, setData] = useState(store.read);
  const [clientId, setClientId] = useState(null);
  const [marketId, setMarketId] = useState(null);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('ca_theme') || 'system'; } catch { return 'system'; }
  });

  // Тема: 'system' НЕ ставит атрибут — тогда работает prefers-color-scheme.
  useEffect(() => {
    const r = document.documentElement;
    if (theme === 'system') r.removeAttribute('data-theme');
    else r.setAttribute('data-theme', theme);
    try { localStorage.setItem('ca_theme', theme); } catch {}
  }, [theme]);

  // Токен Supabase живёт около часа. Refresh-токен переживает перезагрузку, и
  // если он есть — молча продлеваем, чтобы не гонять человека через вход.
  useEffect(() => {
    if (!getRefreshToken()) { setReady(true); return; }
    refreshTokens().then(ok => { setInside(ok); setReady(true); })
                   .catch(() => setReady(true));
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

  const save = useCallback(d => { setData(d); store.write(d); }, []);
  const client = data.clients.find(c => c.id === clientId) || null;
  const market = client && client.markets.find(m => m.id === marketId) || null;

  if (!ready) return null;
  if (!inside) return <Login onIn={()=>setInside(true)} />;

  const bar = (
    <>
    {importing && <div className="top" style={{justifyContent:'center',color:'var(--ink-3)',fontSize:12.5}}>
      Переношу проекты из инструмента…
    </div>}
    <div className="top">
      <div className="sp"></div>
      {[['light','Светлая'],['dark','Тёмная'],['system','Как в системе']].map(([v,l]) => (
        <button key={v} className="tbtn" aria-pressed={theme === v}
                onClick={()=>setTheme(v)}>{l}</button>
      ))}
      <button className="tbtn" onClick={()=>{ clearTokens(); setInside(false); }}>Выйти</button>
    </div>
    </>
  );

  if (market) return (
    <Market client={client} market={market} theme={theme} setTheme={setTheme}
      onBack={()=>setMarketId(null)}
      onOut={()=>{ clearTokens(); setInside(false); }} />
  );
  if (client) return (
    <>{bar}<Markets client={client} onBack={()=>setClientId(null)} onOpen={setMarketId}
      onAdd={m => save({ ...data, clients: data.clients.map(c =>
        c.id === clientId ? { ...c, markets: [...c.markets, m] } : c) })} /></>
  );
  return (
    <>{bar}<Clients data={data} onOpen={setClientId} importing={importing}
      onAdd={c => save({ ...data, clients: [...data.clients, c] })} /></>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
