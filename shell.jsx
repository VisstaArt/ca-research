const { useState, useEffect, useCallback } = React;
const { signIn, signUp, refreshTokens, getRefreshToken, clearTokens, authFetch } = window.CAAuth;
const { buildShellData } = window.CAMigrate;

// Знак платформы берём из утверждённого отчёта — lib/logo.js собирается из
// app.jsx при каждой сборке. Копия в этом файле устарела и показывала прежний
// знак: платформа и отчёт расходились ровно в том месте, где человек первым
// делом смотрит, туда ли он попал.
const LOGO = (typeof window !== 'undefined' && window.CALogo) || '';

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
// Клиенты и рынки ИЗ БАЗЫ — общие таблицы с контент-машиной. Это главный
// источник: то, что видит здесь владелица, и то, с чем работает контент-машина,
// обязано быть одним и тем же. Сборка клиентов из прогонов инструмента ниже
// остаётся запасным путём — для аккаунта, где таблицы ещё пусты.
const readDbClients = async () => {
  try {
    const r = await authFetch('/api/clients', { headers: { 'Content-Type':'application/json' } });
    if (!r.ok) return [];
    const d = await r.json();
    if (!Array.isArray(d.clients)) return [];
    return d.clients.map(c => ({
      id: c.id, name: c.name || 'Без названия',
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
        projects: [],
      })),
    }));
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
// MODULES/GROUPS убраны 13.09.2026: у платформы теперь разделы и части
// (SECTIONS ниже), собранные вместе с контент-машиной. Два списка
// одного и того же — источник расхождений, а не запас.

// ─────────────────────────────────────────────────────────────────────────────
// Вход и регистрация на одном экране. Регистрация нужна не «для полноты»:
// пройти путь с чистого листа — и есть проверка платформы. Без неё первый
// экран невозможно увидеть глазами нового человека, а мы именно это и проверяем.
function Login({ onIn }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState('in');   // 'in' — вход, 'up' — регистрация
  const go = async e => {
    e.preventDefault();
    setBusy(true); setErr(''); setNote('');
    if (mode === 'up') {
      const r = await signUp(email.trim(), pw).catch(() => ({ ok:false, error:'Сеть недоступна' }));
      setBusy(false);
      if (!r.ok) { setErr(r.error); return; }
      // Подтверждение почты включено — входа ещё нет, и делать вид, что есть,
      // нельзя: человек нажмёт «дальше» и упрётся в пустоту без объяснения.
      if (r.signedIn) onIn(); else setNote('Отправила письмо на ' + email.trim() + '. Подтвердите почту и войдите.');
      return;
    }
    const ok = await signIn(email.trim(), pw).catch(() => false);
    setBusy(false);
    if (ok) onIn(); else setErr('Не подошли почта или пароль.');
  };
  return (
    <div className="login">
      <form className="card" onSubmit={go}>
        <img src={LOGO} alt="bulbullab" />
        <h2>{mode === 'up' ? 'Регистрация' : 'Вход'}</h2>
        <p className="lede">{mode === 'up'
          ? 'Новый аккаунт. Всё, что в нём появится, будет видно только вам.'
          : 'Тот же аккаунт, что и в инструменте исследования.'}</p>
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
          {busy ? (mode === 'up' ? 'Завожу…' : 'Проверяю…') : (mode === 'up' ? 'Завести аккаунт' : 'Войти')}
        </button>
        <button type="button" className="btn" style={{width:'100%',marginTop:8}}
          onClick={()=>{ setMode(mode === 'up' ? 'in' : 'up'); setErr(''); setNote(''); }}>
          {mode === 'up' ? 'У меня уже есть аккаунт' : 'Завести новый аккаунт'}
        </button>
        {err && <p className="err">{err}</p>}
        {note && <p className="lede" style={{marginTop:10}}>{note}</p>}
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
  { id:'research',  name:'Исследование', parts:[
      ['brief','Бриф'], ['niches','Ниши'], ['run','Прогон'], ['report','Отчёт'],
      ['handoff','Что ушло в контент']] },
  { id:'funnel',    name:'Воронка', parts:[
      ['goal','Цель'], ['parts','Из чего состоит'], ['page','Целевая страница'],
      ['auto','Автомат касаний']] },
  { id:'landing',   name:'Лендинг', parts:[
      ['tz','ТЗ страницы'], ['build','Сборка и публикация']] },
  { id:'plan',      name:'Контент-план', parts:[
      ['places','Мои площадки'], ['what','Что генерируем'], ['sources','Источники тем'],
      ['plan30','План на 30 дней'], ['standards','Эталоны'], ['topics','Темы'],
      ['approve','Согласование'], ['published','Опубликовано']] },
  { id:'analytics', name:'Аналитика', parts:[
      ['spend','Расход'], ['metrics','Метрики']] },
];
const SETTINGS = [['keys','Ключи и оплата'], ['brand','Профиль бренда'],
  ['voice','Голос'], ['design','Оформление'], ['accounts','Аккаунты площадок']];
const HELP = [['algo','Алгоритм платформы'], ['components','Компоненты']];

const ICONS = {
  research:<svg viewBox="0 0 24 24"><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/></svg>,
  funnel:<svg viewBox="0 0 24 24"><path d="M4 6h16l-6 7v5l-4 2v-7z"/></svg>,
  landing:<svg viewBox="0 0 24 24"><path d="M4 19V9l8-5 8 5v10"/><path d="M10 19v-6h4v6"/></svg>,
  plan:<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M4 10h16"/></svg>,
  analytics:<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>,
};

// Подписи в строке проекта. Пусто — значит пусто: «нет исследования» честнее
// прочерка, а выдуманного «412 из 1000» здесь нет вовсе.
const ниши = c => {
  const n = c && c.usage && c.usage.niches;
  if (!n) return 'нет исследования';
  const h = Math.abs(n) % 100, t = h % 10;
  const сл = (h > 10 && h < 20) || t === 0 || t >= 5 ? 'ниш' : t === 1 ? 'ниша' : 'ниши';
  return n + ' ' + сл;
};
const расход = c => {
  const u = c && c.usage;
  if (!u || (!u.cost_cents && !u.llm_calls)) return 'без расхода';
  if (u.cost_cents) return (u.cost_cents / 100).toFixed(2).replace('.', ',') + ' $ за месяц';
  return u.llm_calls + ' вызовов';
};
const FLAG = c => ({ RU:'🇷🇺', TR:'🇹🇷', KZ:'🇰🇿', AE:'🇦🇪', US:'🇺🇸', GB:'🇬🇧' })[c] || '';
const MARK = n => (n || '').split(/\s+/).filter(Boolean).slice(0,2).map(w => w[0]).join('').toUpperCase();

function Market({ client, market, clients, onPick, onBack, theme, setTheme, onOut }) {
  // Раздел и часть внутри него. Список частей меняется вместе с плиткой —
  // это и было решением владелицы: у каждого раздела свои части.
  const [section, setSection] = useState('research');
  const [part, setPart] = useState('brief');
  const [drop, setDrop] = useState(false);
  useEffect(() => {
    if (!drop) return;
    const off = e => { if (!e.target.closest('.cm-side-proj')) setDrop(false); };
    document.addEventListener('click', off);
    return () => document.removeEventListener('click', off);
  }, [drop]);
  const cur = SECTIONS.find(x => x.id === section) || SECTIONS[0];
  return (
    <div className="app">
      <aside className="side">
        {/* Проект и рынок ОДНОЙ строкой: по отдельности их переключать незачем,
            работа всегда идёт в паре «бренд + рынок». */}
        <div className="cm-drop cm-side-proj">
          <div className="cm-drop">
            <button className="cm-proj" onClick={e=>{e.stopPropagation(); setDrop(!drop);}}>
              <span className="cm-mark">{MARK(client.name)}</span>
              <u className="cm-cc">{FLAG(market.country)} {(market.country || '').toUpperCase()}</u>
              <b>{client.domain || client.name}</b>
              <em>{ниши(client)}</em>
              <svg className="cm-chev" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>
            </button>
            {drop && (
              <div className="cm-menu wide">
                {(clients || []).flatMap(c => (c.markets || []).map(m => (
                  <a key={c.id + m.id} className={c.id === client.id && m.id === market.id ? 'on' : undefined}
                     onClick={()=>{ setDrop(false); onPick(c.id, m.id); }}>
                    <span className="cm-mark">{MARK(c.name)}</span>
                    <u className="cm-cc">{FLAG(m.country)} {(m.country || '').toUpperCase()}</u>
                    <b>{c.domain || c.name}</b><em>{ниши(c)}</em>
                    <span>{расход(c)}</span>
                  </a>
                )))}
                <div className="cm-sep"></div>
                <a className="cm-add" onClick={()=>{ setDrop(false); onBack(); }}>+ Создать проект</a>
              </div>
            )}
          </div>
        </div>

        <div className="navgrid">
          {SECTIONS.map(x => (
            <button key={x.id} className="navtile"
              aria-current={section === x.id ? 'page' : undefined}
              onClick={()=>{ setSection(x.id); setPart(x.parts[0][0]); }}>
              <span className="ic">{ICONS[x.id]}</span>{x.name}
            </button>
          ))}
        </div>

        <nav className="navlist">
          <div className="grp">{cur.name}</div>
          {cur.parts.map(([k, n]) => (
            <button key={k} className="navrow" aria-current={part === k ? 'page' : undefined}
              onClick={()=>setPart(k)}><span className="dot"></span>{n}</button>
          ))}
        </nav>

        <nav className="navlist always">
          <div className="grp">Настройки проекта</div>
          {SETTINGS.map(([k, n]) => (
            <button key={k} className="navrow" onClick={()=>setPart(k)}>
              <span className="dot"></span>{n}</button>
          ))}
          <div className="grp">Справка</div>
          {HELP.map(([k, n]) => (
            <button key={k} className="navrow" onClick={()=>setPart(k)}>
              <span className="dot"></span>{n}</button>
          ))}
        </nav>
      </aside>
      <div className="main">
        <div className="wrap">
          <Slot section={section} part={part} client={client} market={market} />
        </div>
      </div>
    </div>
  );
}

// Место, куда встанут модули. Оболочка сама ничего не считает и не генерирует —
// она только даёт модулю площадку и говорит, кто вошёл, какой клиент и рынок.
// Площадка раздела. Оболочка сама ничего не считает и не генерирует — она
// только даёт место и говорит, кто вошёл, какой клиент и рынок.
function Slot({ section, part, client, market }) {
  if (section === 'research') {
    const q = 'index.html?embed=1&client=' + encodeURIComponent(client.id)
      + '&market=' + encodeURIComponent(market.id || '')
      + '&country=' + encodeURIComponent(market.countryName || '')
      + '&lang=' + encodeURIComponent(market.lang || '')
      + (part ? '&step=' + encodeURIComponent(part) : '');
    return (
      <>
        <div className="hdr">
          <h1>Исследование целевой аудитории</h1>
          <p>{client.name} · {market.countryName}</p>
        </div>
        {/* Инструмент стоит ВНУТРИ оболочки, а не по ссылке рядом: ссылка
            означала выход из платформы — терялись клиент, рынок и обратный путь. */}
        <iframe className="modframe" title="Исследование целевой аудитории" src={q}></iframe>
      </>
    );
  }
  const sec = SECTIONS.find(x => x.id === section);
  const name = (sec && (sec.parts.find(p => p[0] === part) || [])[1]) || (sec ? sec.name : '');
  return (
    <>
      <div className="hdr"><h1>{name || (sec ? sec.name : '')}</h1></div>
      <div className="card empty">
        <p>Экран ещё не подключён. Каркас на месте — начинка приедет из
          контент-машины: это её сторона работы, не наша.</p>
      </div>
    </>
  );
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
function Top({ email, onOut, theme, setTheme }) {
  const [open, setOpen] = useState('');
  // Один список открыт за раз, клик мимо закрывает — правило оболочки.
  useEffect(() => {
    if (!open) return;
    const off = e => { if (!e.target.closest('.cm-drop')) setOpen(''); };
    document.addEventListener('click', off);
    return () => document.removeEventListener('click', off);
  }, [open]);
  const ico = d => ({ onClick: e => { e.stopPropagation(); setOpen(open === d ? '' : d); } });
  const now = new Date();
  const день = now.toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const час = now.getHours();
  const привет = час < 5 ? 'Доброй ночи' : час < 12 ? 'Доброе утро' : час < 18 ? 'Добрый день' : 'Добрый вечер';
  const имя = (email || '').split('@')[0];
  return (
    <div className="cm-top">
      <img className="cm-logo" src={LOGO} alt="bulbul lab" />
      <div className="cm-hello">
        <b>{привет}{имя ? ', ' + имя : ''}</b>
        <i>{день}</i>
      </div>
      <div className="cm-rt">
        <div className="cm-drop">
          <button className="cm-ico" {...ico('find')} aria-label="Поиск">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>
          </button>
          {open === 'find' && (
            <div className="cm-menu wide">
              <div className="cm-find">
                <svg className="cm-ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>
                <input className="t" placeholder="Клиенты, рынки, ниши" />
              </div>
              <p className="cm-hint">Поиск по клиентам и рынкам. По содержимому
                исследования заработает, когда появится первый прогон.</p>
            </div>
          )}
        </div>
        <div className="cm-drop">
          <button className="cm-ico" {...ico('user')} aria-label="Профиль">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.5"/>
              <path d="M5 19c1.2-3.2 4-4.8 7-4.8s5.8 1.6 7 4.8"/></svg>
          </button>
          {open === 'user' && (
            <div className="cm-menu">
              <div className="cm-user"><b>{email || 'Вы вошли'}</b><span>аккаунт платформы</span></div>
              <div className="cm-sep"></div>
              <div className="cm-user"><b>Оформление</b><span>светлое, тёмное или как в системе</span></div>
              {[['light','Светлая'],['dark','Тёмная'],['system','Как в системе']].map(([v,l]) => (
                <a key={v} onClick={()=>setTheme(v)} aria-current={theme===v ? 'true' : undefined}>{l}</a>
              ))}
              <div className="cm-sep"></div>
              <a onClick={onOut}>Выйти</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
      const p = JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      return p.email || '';
    } catch { return ''; }
  })();
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
    // Сначала спрашиваем таблицу клиентов — это общий с контент-машиной
    // источник. Есть строки — работаем от них и прогоны инструмента больше не
    // разбираем: клиент, заведённый в базе, главнее собранного из брифов.
    readDbClients().then(cl => {
      if (cl.length) { save({ clients: cl }); setImporting(false); return null; }
      return readDbProjects().then(db => {
        const all = mergeById(local, db);
        if (all.length) save(buildShellData(all));
        setImporting(false);
      });
    }).catch(() => setImporting(false));
  }, [inside]);

  const save = useCallback(d => { setData(d); store.write(d); }, []);

  // Заводим клиента и рынок В БАЗЕ, а не только в браузере. Показываем сразу,
  // не дожидаясь ответа, — иначе после нажатия экран стоит и непонятно,
  // случилось ли что-то. Пришёл настоящий id — подменяем временный: по нему
  // потом свяжутся исследование и контент-машина, и временный там не годится.
  // Не записалось — говорим об этом вслух: молча оставить строку только в
  // браузере значит пообещать сохранность, которой нет.
  const [saveErr, setSaveErr] = useState('');
  const addClient = useCallback(async c => {
    save({ ...data, clients: [...data.clients, c] });
    try {
      const r = await authFetch('/api/clients', {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ name: c.name, domain: c.domain || '', one_liner: c.what || '' }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.client) throw new Error('нет строки');
      setData(prev => { const next = { ...prev, clients: prev.clients.map(x =>
        x.id === c.id ? { ...x, id: d.client.id, fromDb: true } : x) };
        store.write(next); return next; });
      setClientId(id => id === c.id ? d.client.id : id);
    } catch { setSaveErr('Клиент пока только в этом браузере — база не ответила.'); }
  }, [data, save]);

  const addMarket = useCallback(async m => {
    save({ ...data, clients: data.clients.map(c =>
      c.id === clientId ? { ...c, markets: [...c.markets, m] } : c) });
    try {
      const r = await authFetch('/api/clients', {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ client_id: clientId, market: {
          country: m.country || '', country_name: m.countryName || '', lang: m.lang || '' } }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.market) throw new Error('нет строки');
      setData(prev => { const next = { ...prev, clients: prev.clients.map(c =>
        c.id === clientId ? { ...c, markets: c.markets.map(x =>
          x.id === m.id ? { ...x, id: d.market.id } : x) } : c) };
        store.write(next); return next; });
    } catch { setSaveErr('Рынок пока только в этом браузере — база не ответила.'); }
  }, [data, clientId, save]);
  const client = data.clients.find(c => c.id === clientId) || null;
  const market = client && client.markets.find(m => m.id === marketId) || null;

  if (!ready) return null;
  if (!inside) return <Login onIn={()=>setInside(true)} />;

  // Шапка платформы стоит на всех экранах. Полосы состояния — под ней:
  // они сообщают о происходящем, а не заменяют оформление, как было раньше.
  const bar = (
    <>
      <Top email={email} theme={theme} setTheme={setTheme}
           onOut={()=>{ clearTokens(); setInside(false); }} />
      {importing && <div className="cm-lane">Переношу проекты из инструмента…</div>}
      {saveErr && <div className="cm-lane">{saveErr}</div>}
    </>
  );


  if (market) return (
    <Market client={client} market={market} clients={data.clients}
      theme={theme} setTheme={setTheme}
      onPick={(c, m)=>{ setClientId(c); setMarketId(m); }}
      onBack={()=>{ setMarketId(null); setClientId(null); }}
      onOut={()=>{ clearTokens(); setInside(false); }} />
  );
  if (client) return (
    <>{bar}<Markets client={client} onBack={()=>setClientId(null)} onOpen={setMarketId}
      onAdd={m => { addMarket(m); }} /></>
  );
  return (
    <>{bar}<Clients data={data} onOpen={setClientId} importing={importing}
      onAdd={c => { addClient(c); }} /></>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
