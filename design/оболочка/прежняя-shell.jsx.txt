// Экраны «Клиенты» и «Рынки» удалены 13.09.2026: они были моей выдумкой.
// В согласованной оболочке проект переключают выпадающим списком В МЕНЮ,
// а отдельная страница со списком означала вход в платформу мимо самой
// платформы — без меню, без разделов, без единого её признака.
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

const plural = (n,a,b,c) => {
  const d = n % 100, e = n % 10;
  if (d > 10 && d < 20) return c;
  if (e === 1) return a;
  if (e >= 2 && e <= 4) return b;
  return c;
};

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
      ['report','Отчёт'], ['brief','Бриф'], ['niches','Ниши'], ['run','Прогон'],
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

function Platform({ client, market, clients, bar, onPick, onAddClient, onAddMarket, theme, setTheme, onOut }) {
  // Раздел и часть внутри него. Список частей меняется вместе с плиткой —
  // это и было решением владелицы: у каждого раздела свои части.
  const [section, setSection] = useState('research');
  // Открываем на отчёте: это результат, ради которого сюда заходят.
  const [part, setPart] = useState('report');
  const [drop, setDrop] = useState(false);
  useEffect(() => {
    if (!drop) return;
    const off = e => { if (!e.target.closest('.cm-side-proj')) setDrop(false); };
    document.addEventListener('click', off);
    return () => document.removeEventListener('click', off);
  }, [drop]);
  const cur = SECTIONS.find(x => x.id === section) || SECTIONS[0];
  const пусто = !client;
  return (
    <>
    {bar}
    <div className="app">
      <aside className="side">
        {/* Проект и рынок ОДНОЙ строкой: по отдельности их переключать незачем,
            работа всегда идёт в паре «бренд + рынок». Плашка перламутровая —
            это представление, как шапка отчёта; под данными поверхность ровная. */}
        <div className="cm-drop cm-side-proj nacre">
          <div className="cm-drop">
            <button className="cm-proj" onClick={e=>{e.stopPropagation(); setDrop(!drop);}}>
              <span className="cm-mark">{пусто ? '+' : MARK(client.name)}</span>
              {!пусто && market &&
                <u className="cm-cc">{FLAG(market.country)} {(market.country || '').toUpperCase()}</u>}
              <b>{пусто ? 'Нет проектов' : (client.domain || client.name)}</b>
              <em>{пусто ? 'заведите первый' : ниши(client)}</em>
              <svg className="cm-chev" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>
            </button>
            {drop && (
              <div className="cm-menu wide">
                {(clients || []).flatMap(c => (c.markets || []).map(m => (
                  <a key={c.id + m.id}
                     className={client && market && c.id === client.id && m.id === market.id ? 'on' : undefined}
                     onClick={()=>{ setDrop(false); onPick(c.id, m.id); }}>
                    <span className="cm-mark">{MARK(c.name)}</span>
                    <u className="cm-cc">{FLAG(m.country)} {(m.country || '').toUpperCase()}</u>
                    <b>{c.domain || c.name}</b><em>{ниши(c)}</em>
                    <span>{расход(c)}</span>
                  </a>
                )))}
                <div className="cm-sep"></div>
                <a className="cm-add" onClick={()=>{ setDrop(false); setPart('new'); }}>
                  + Создать проект</a>
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
          <Slot section={section} part={part} client={client} market={market}
            onAddClient={onAddClient} onAddMarket={onAddMarket} />
        </div>
      </div>
    </div>
    </>
  );
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
const PROVIDERS = [
  ['openai', 'OpenAI — GPT'], ['anthropic', 'Anthropic — Claude'],
  ['openrouter', 'OpenRouter'], ['google', 'Google — Gemini'],
  ['tavily', 'Tavily — поиск'], ['telegram', 'Telegram — публикация'],
];
const PURPOSES = [
  ['', 'для всего'], ['writing', 'тексты'], ['judge', 'проверка'],
  ['image', 'картинки'], ['video', 'видео'], ['search', 'поиск'], ['publish', 'публикация'],
];

function Keys({ client }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name:'', provider:'openai', purpose:'', secret:'' });
  const { SUPABASE_URL, SUPABASE_ANON_KEY, getAccessToken } = window.CAAuth;

  const зов = useCallback(async (путь, тело) => {
    const t = getAccessToken();
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + путь, {
      method: тело ? 'POST' : 'GET',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + t,
                 'Content-Type': 'application/json' },
      body: тело ? JSON.stringify(тело) : undefined,
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) {
      const m = (d && (d.message || d.hint)) || '';
      // Функции нет — значит миграция ещё не применена. Это не поломка
      // экрана, а недостающий шаг, и сказать надо именно так.
      throw new Error(/does not exist|schema cache/i.test(m)
        ? 'Хранилище ключей в базе ещё не заведено. Нужно применить миграцию '
          + 'schema/002_provider_keys_self_service.sql — её применяет владелица базы, '
          + 'права на хранилище секретов есть только у неё. До этого работа идёт на ключах платформы.'
        : (m || 'Не получилось'));
    }
    return d;
  }, [SUPABASE_URL, SUPABASE_ANON_KEY, getAccessToken]);

  const обновить = useCallback(() => {
    setErr('');
    зов('provider_keys?select=name,provider,purpose,hint,verified,verified_at'
        + '&client_id=eq.' + encodeURIComponent(client.id))
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(e => { setRows([]); setErr(e.message); });
  }, [зов, client.id]);
  useEffect(() => { обновить(); }, [обновить]);

  const добавить = async e => {
    e.preventDefault();
    if (!f.secret.trim() || !f.name.trim()) return;
    setBusy(true); setErr('');
    try {
      await зов('rpc/set_provider_key', { p_client: client.id, p_name: f.name.trim(),
        p_provider: f.provider, p_secret: f.secret.trim(), p_purpose: f.purpose });
      setF({ ...f, name:'', secret:'' });
      обновить();
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };

  const убрать = async name => {
    setBusy(true); setErr('');
    try { await зов('rpc/drop_provider_key', { p_client: client.id, p_name: name }); обновить(); }
    catch (e2) { setErr(e2.message); }
    setBusy(false);
  };

  return (
    <>
      <div className="hdr">
        <h1>Ключи и доступы</h1>
        <p>Свои ключи для «{client.name}». Пока их нет, работа идёт на ключах
          платформы и тратит кредиты.</p>
      </div>

      <div className="card">
        <h2>Добавить ключ</h2>
        <form onSubmit={добавить}>
          <label><span className="lab">Название</span>
            <input value={f.name} onChange={e=>setF({...f, name:e.target.value})}
              placeholder="например, GPT клиента" required /></label>
          <label><span className="lab">Провайдер</span>
            <select value={f.provider} onChange={e=>setF({...f, provider:e.target.value})}>
              {PROVIDERS.map(([v,n]) => <option key={v} value={v}>{n}</option>)}
            </select></label>
          <label><span className="lab">Для чего</span>
            <select value={f.purpose} onChange={e=>setF({...f, purpose:e.target.value})}>
              {PURPOSES.map(([v,n]) => <option key={v} value={v}>{n}</option>)}
            </select></label>
          <label><span className="lab">Ключ</span>
            <input type="password" value={f.secret} autoComplete="new-password"
              onChange={e=>setF({...f, secret:e.target.value})}
              placeholder="вставьте сюда" required /></label>
          <p className="lede">Ключ уходит прямо в хранилище базы, минуя наш сервер.
            Обратно он не показывается никогда — только четыре последних знака.</p>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Сохраняю…' : 'Сохранить ключ'}</button>
        </form>
        {err && <p className="err">{err}</p>}
      </div>

      <div className="card">
        <h2>Заведённые ключи</h2>
        {rows === null && <p className="lede">Смотрю…</p>}
        {rows && !rows.length && <p className="lede">Ни одного. Работа идёт на ключах платформы.</p>}
        {rows && rows.map(r => (
          <div key={r.name} className="krow">
            <b>{r.name}</b>
            <span>{(PROVIDERS.find(p=>p[0]===r.provider)||[])[1] || r.provider}
              {r.purpose ? ' · ' + ((PURPOSES.find(p=>p[0]===r.purpose)||[])[1] || r.purpose) : ''}</span>
            <span>…{r.hint}</span>
            <span>{r.verified ? 'проверен' : 'не проверен'}</span>
            <button className="cm-btn cm-btn-quiet" onClick={()=>убрать(r.name)} disabled={busy}>Убрать</button>
          </div>
        ))}
      </div>
    </>
  );
}

// Заведение проекта — на месте работы, а не отдельной страницей: пока проекта
// нет, платформа всё равно ничего показать не может, и уводить человека на
// другой экран незачем.
function NewProject({ client, onAddClient, onAddMarket }) {
  const [f, setF] = useState({ name:'', domain:'', what:'' });
  const СТРАНЫ = [['RU','Россия','ru'], ['TR','Турция','tr'], ['KZ','Казахстан','kk'],
    ['AE','ОАЭ','ar'], ['US','США','en'], ['','Не указана','ru']];
  const [m, setM] = useState({ country:'RU', countryName:'Россия', lang:'ru' });
  if (!client) return (
    <>
      <div className="hdr">
        <h1>Новый проект</h1>
        <p>Проект — это бренд, для которого работает платформа. Рынок добавим следом:
          в другой стране и ниши, и конкуренты, и слова другие.</p>
      </div>
      <div className="card nacre">
        <form onSubmit={e=>{ e.preventDefault(); if (!f.name.trim()) return;
          onAddClient({ id: uid(), name: f.name.trim(), domain: f.domain.trim(),
            what: f.what.trim(), markets: [] }); }}>
          <label><span className="lab">Название</span>
            <input value={f.name} onChange={e=>setF({...f, name:e.target.value})}
              placeholder="например, Ловец Лидов" required /></label>
          <label><span className="lab">Сайт</span>
            <input value={f.domain} onChange={e=>setF({...f, domain:e.target.value})}
              placeholder="ловец-лидов.рф" /></label>
          <label><span className="lab">Чем занимается</span>
            <input value={f.what} onChange={e=>setF({...f, what:e.target.value})}
              placeholder="одной строкой" /></label>
          <button className="btn btn-primary">Завести проект</button>
        </form>
      </div>
    </>
  );
  return (
    <>
      <div className="hdr">
        <h1>Рынок для «{client.name}»</h1>
        <p>Рынок — это страна и язык вместе. Исследование делается для него.</p>
      </div>
      <div className="card nacre">
        <form onSubmit={e=>{ e.preventDefault();
          onAddMarket(client.id, { id: uid(), country:m.country,
            countryName:m.countryName, lang:m.lang, projects: [] }); }}>
          <label><span className="lab">Страна</span>
            <select value={m.country} onChange={e=>{
              const c = СТРАНЫ.find(x => x[0] === e.target.value) || СТРАНЫ[0];
              setM({ country:c[0], countryName:c[1], lang:c[2] }); }}>
              {СТРАНЫ.map(([c,n2]) => <option key={c || 'none'} value={c}>{n2}</option>)}
            </select></label>
          <label><span className="lab">Язык исследования</span>
            <input value={m.lang} onChange={e=>setM({...m, lang:e.target.value})} /></label>
          <button className="btn btn-primary">Добавить рынок</button>
        </form>
      </div>
    </>
  );
}

// Площадка раздела. Оболочка сама ничего не считает и не генерирует — она
// только даёт место и говорит, кто вошёл, какой клиент и рынок.
function Slot({ section, part, client, market, onAddClient, onAddMarket }) {
  // Работать не с чем — показываем следующий шаг, а не пустоту. Это первое,
  // что видит человек после регистрации, и «ничего нет» здесь неприемлемо.
  if (!client || !market || part === 'new')
    return <NewProject client={part === 'new' ? null : client}
      onAddClient={onAddClient} onAddMarket={onAddMarket} />;
  if (section === 'research') {
    // «Отчёт» — это ГОТОВАЯ работа: все модули с графиками, картами и
    // выводами, ровно то, что выгружается файлом. Она уже собрана, и
    // показывать вместо неё рабочий экран инструмента было ошибкой.
    const общее = 'client=' + encodeURIComponent(client.id)
      + '&market=' + encodeURIComponent(market.id || '')
      + '&country=' + encodeURIComponent(market.countryName || '')
      + '&lang=' + encodeURIComponent(market.lang || '');
    const отчёт = part === 'report' || !part;
    const q = 'index.html?embed=1&' + общее + (отчёт ? '&view=report' : '&step=' + encodeURIComponent(part));
    return (
      <>
        {!отчёт && (
          <div className="hdr">
            <h1>Исследование целевой аудитории</h1>
            <p>{client.name} · {market.countryName}</p>
          </div>
        )}
        <iframe className="modframe" title="Исследование целевой аудитории" src={q}></iframe>
      </>
    );
  }
  if (part === 'keys') return <Keys client={client} />;
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
function Top({ email, usage, clients, onOut }) {
  const [open, setOpen] = useState('');
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
  const центы = (clients || []).reduce((a, c) => a + ((c.usage && c.usage.cost_cents) || 0), 0);
  const деньги = центы ? (центы / 100).toFixed(2).replace('.', ',') + ' $' : '0 $';
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
                <input className="t" placeholder="Проекты, рынки, ниши" />
              </div>
              <p className="cm-hint">Ищет по проектам и рынкам. По содержимому
                исследования заработает после первого прогона.</p>
            </div>
          )}
        </div>

        <div className="cm-drop">
          <button className="cm-btn cm-btn-pri cm-new" {...ico('new')}>Создать</button>
          {open === 'new' && (
            <div className="cm-menu">
              <div className="cm-user"><b>Что создаём</b><span>пока доступно то, что умеет исследование</span></div>
              <a onClick={()=>{ setOpen(''); location.hash = '#new-project'; }}>Проект<span>бренд и рынок</span></a>
              <a onClick={()=>setOpen('')}>Рынок в этом проекте<span>страна и язык</span></a>
              <div className="cm-sep"></div>
              <a onClick={()=>setOpen('')}>Прогон исследования<span>платный</span></a>
            </div>
          )}
        </div>

        <div className="cm-drop">
          <button className="cm-money" {...ico('money')}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/>
              <path d="M12 8v8"/><path d="M14.2 9.8c-.4-.6-1.2-1-2.2-1-1.2 0-2.2.7-2.2 1.6 0 2.2 4.4 1 4.4 3.2 0 .9-1 1.6-2.2 1.6-1 0-1.8-.4-2.2-1"/></svg>
            <b>{деньги}</b>
          </button>
          {open === 'money' && (
            <div className="cm-menu wide">
              {/* Знаменателя нет: тариф не назначен, и «412 из 1000» в эталоне —
                  заглушка. Показываем потраченное, оно настоящее. */}
              <div className="cm-user"><b>Расход за месяц</b><span>по всем проектам, из общего счётчика</span></div>
              {(clients || []).map(c => (
                <a key={c.id}><span className="cm-mark">{MARK(c.name)}</span>
                  <b>{c.domain || c.name}</b>
                  <span>{((c.usage && c.usage.cost_cents) || 0) / 100} $</span></a>
              ))}
              {!(clients || []).length && <a><span>Пока ни одного проекта</span></a>}
            </div>
          )}
        </div>

        <div className="cm-drop">
          <button className="cm-ico" {...ico('help')} title="Поддержка">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/>
              <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.8.3-1.2.9-1.2 1.7v.4"/>
              <path d="M12 17.2v.1"/></svg>
          </button>
          {open === 'help' && (
            <div className="cm-menu">
              <div className="cm-user"><b>Поддержка</b><span>сначала ответы, потом человек</span></div>
              <a>Алгоритм платформы</a>
              <a>Как устроено исследование</a>
              <a>Написать нам</a>
            </div>
          )}
        </div>

        <div className="cm-drop">
          <button className="cm-ico" {...ico('bell')} aria-label="Уведомления">
            <svg viewBox="0 0 24 24"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/>
              <path d="M10 19a2 2 0 0 0 4 0"/></svg>
          </button>
          {open === 'bell' && (
            <div className="cm-menu wide">
              <div className="cm-user"><b>Уведомления</b><span>работа идёт в фоне, минутами</span></div>
              <a><span>Пока ничего не происходило</span></a>
            </div>
          )}
        </div>

        <div className="cm-drop">
          <button className="cm-ava" {...ico('me')} aria-haspopup="true">
            {MARK(имя || 'Вы')}
          </button>
          {open === 'me' && (
            <div className="cm-menu">
              <div className="cm-user"><b>{имя || 'Вы'}</b><span>{email}</span></div>
              <a>Все проекты<span>{(clients || []).length}</span></a>
              <a>Расход<span>{деньги} за месяц</span></a>
              <a>Тариф<span>не назначен</span></a>
              <a>Доступы<span>1 человек</span></a>
              <a>Язык интерфейса<span>Русский</span></a>
              <a>Поддержка</a>
              <div className="cm-sep"></div>
              <a onClick={onOut}>Выйти</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
      <Top email={email} clients={data.clients}
           onOut={()=>{ clearTokens(); setInside(false); }} />
      {importing && <div className="cm-lane">Переношу проекты из инструмента…</div>}
      {saveErr && <div className="cm-lane">{saveErr}</div>}
    </>
  );


  // Отдельного экрана со списком клиентов больше нет: после входа сразу
  // платформа — меню слева, работа справа. Проект переключают выпадающим
  // списком в меню, как в согласованной оболочке. Нет проектов — на месте
  // работы приглашение завести первый, а не пустая страница.
  const первый = data.clients[0] || null;
  const текКлиент = client || первый;
  const текРынок = (client ? market : null)
    || (текКлиент && текКлиент === первый ? (текКлиент.markets || [])[0] || null : null);
  return (
    <Platform client={текКлиент} market={текРынок} clients={data.clients} bar={bar}
      theme={theme} setTheme={setTheme}
      onPick={(c, m)=>{ setClientId(c); setMarketId(m); }}
      onAddClient={addClient}
      onAddMarket={(cid, m)=>{ setClientId(cid); addMarket(m); }}
      onOut={()=>{ clearTokens(); setInside(false); }} />
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
