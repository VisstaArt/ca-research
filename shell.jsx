const { useState, useEffect, useCallback } = React;
const { signIn, refreshTokens, getRefreshToken, clearTokens, authFetch } = window.CAAuth;
const { buildShellData } = window.CAMigrate;

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
function Market({ client, market, onBack, theme, setTheme, pal, setPal, onOut }) {
  const [tab, setTab] = useState('research');
  const done = !!market.research;
  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <b>{client.name}</b>
          <span>{market.countryName} · {market.lang}</span>
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
          {[['tiffany','Тиффани'],['coconut','Кокос']].map(([v,l]) => (
            <button key={v} className="tbtn" aria-pressed={pal === v}
                    onClick={()=>setPal(v)}>{l}</button>
          ))}
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
  // ВРЕМЕННО, пока владелица выбирает палитру. После выбора победившая
  // переезжает в :root, а это состояние и кнопки удаляются.
  const [pal, setPal] = useState(() => {
    try { return localStorage.getItem('ca_pal') || 'tiffany'; } catch { return 'tiffany'; }
  });
  useEffect(() => {
    const r = document.documentElement;
    if (pal === 'tiffany') r.removeAttribute('data-pal');
    else r.setAttribute('data-pal', pal);
    try { localStorage.setItem('ca_pal', pal); } catch {}
  }, [pal]);

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
      {[['tiffany','Тиффани'],['coconut','Кокос']].map(([v,l]) => (
        <button key={v} className="tbtn" aria-pressed={pal === v}
                onClick={()=>setPal(v)}>{l}</button>
      ))}
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
      pal={pal} setPal={setPal}
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
