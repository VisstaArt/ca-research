// Вход и авторизованные запросы — общее для инструмента исследования и оболочки.
//
// Вынесено из index.html 07.09.2026 по той же причине, по которой раньше вынесен
// контракт: оболочка и нынешний инструмент обязаны входить ОДИНАКОВО. Две копии
// одного кода расходятся молча — ровно так же молча, как расходились названия
// блоков в pickTable, и узнают об этом на живом человеке, который не смог войти.
//
// Здесь НЕТ React, DOM и JSX — только сеть и localStorage. Подключается обычным
// <script> перед Babel-скриптом, поэтому сборка по-прежнему не нужна. При
// переезде на Next.js обёртка IIFE снизу меняется на export — больше ничего.
(function (root) {
  // Заменяет общий APP_PASSWORD: аккаунты вместо одного пароля на всех, RLS на
  // стороне базы вместо фильтрации в коде (см. api/_auth.js). anon key ПУБЛИЧНЫЙ
  // по определению (в отличие от service_role) — не секрет, нормально видеть
  // его в клиентском коде, как и PROXY воркера ниже.
  const SUPABASE_URL = 'https://akfyaavisigavvzjmadn.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ugKFALTIZeEaR7idC19cdA_yfJ0RAq0'; // Publishable key — новое название anon/public в Supabase, публичный, не секрет

  const AT_KEY = 'ca_access_token', RT_KEY = 'ca_refresh_token';
  const getAccessToken = () => { try { return localStorage.getItem(AT_KEY)||''; } catch { return ''; } };
  const getRefreshToken = () => { try { return localStorage.getItem(RT_KEY)||''; } catch { return ''; } };
  const setTokens = (access, refresh) => { try { localStorage.setItem(AT_KEY, access||''); localStorage.setItem(RT_KEY, refresh||''); } catch {} };
  const clearTokens = () => { try { localStorage.removeItem(AT_KEY); localStorage.removeItem(RT_KEY); } catch {} };

  async function signIn(email, password) {
    try {
      const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST', headers: { 'Content-Type':'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const d = await res.json();
      if (!d.access_token) return false;
      setTokens(d.access_token, d.refresh_token);
      return true;
    } catch { return false; }
  }
  async function refreshTokens() {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
      const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: { 'Content-Type':'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) return false;
      const d = await res.json();
      if (!d.access_token) return false;
      setTokens(d.access_token, d.refresh_token);
      return true;
    } catch { return false; }
  }
  // Обёртка над fetch для всех вызовов api/*.js: добавляет Authorization, при 401
  // один раз пробует освежить токен и повторить запрос — access_token у Supabase
  // живёт ~час, без этого пользователя выкидывало бы на логин каждый час.
  async function authFetch(url, opts) {
    const o = opts || {};
    const withAuth = h => ({ ...(h||{}), Authorization: 'Bearer ' + getAccessToken() });
    const attempt = async () => {
      let res = await fetch(url, { ...o, headers: withAuth(o.headers) });
      if (res.status === 401) {
        if (await refreshTokens()) res = await fetch(url, { ...o, headers: withAuth(o.headers) });
      }
      return res;
    };
    // Ретраим ДВА вида временных сбоев, каждый уже стоил владелице оплаченного прогона:
    // 1. Сетевой обрыв (fetch бросает исключение) — связь до Vercel рвётся
    //    периодически (ERR_CONNECTION_CLOSED 25.08, «Failed to fetch» 27.08: сервер
    //    ответил 200, ответ до браузера не дошёл, весь M7 встал).
    // 2. 429 (лимит частоты у OpenAI) и 5xx — 26.08 модуль M3 сохранился с
    //    содержимым «Error: API 429», то есть не сгенерировался вообще, а прогон
    //    поехал дальше как ни в чём не бывало.
    // Остальные статусы (400/401/403…) возвращаем как есть — это не «повтори
    // позже», а осмысленный ответ, его разбирает вызывающий код.
    const retryableStatus = s => s === 429 || (s >= 500 && s < 600);
    // Пауза дольше, чем при сетевом сбое: лимит частоты за 1.5 с не рассасывается.
    // Retry-After от сервера уважаем, если он есть (в секундах), но не больше 20 с.
    const waitFor = (res, i) => {
      const ra = res && res.headers && Number(res.headers.get('retry-after'));
      const fromHeader = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 20000) : 0;
      return Math.max(fromHeader, 3000 * (i + 1));
    };
    let lastErr, lastRes;
    for (let i = 0; i < 3; i++) {
      try {
        lastRes = await attempt();
        lastErr = null;
        if (retryableStatus(lastRes.status) && i < 2) {
          await new Promise(r => setTimeout(r, waitFor(lastRes, i)));
          continue;
        }
        return lastRes;
      } catch (e) {
        lastErr = e;
        if (i < 2) await new Promise(r => setTimeout(r, 1500 * (i + 1)));
      }
    }
    // Сюда попадаем, только если исчерпали попытки. Повторный вызов НЕ делаем —
    // это лишние деньги: отдаём последний реальный ответ, а если его не было
    // вообще (все попытки — сетевой обрыв), пробрасываем исключение.
    if (lastRes) return lastRes;
    throw lastErr;
  }

  root.CAAuth = {
    SUPABASE_URL: SUPABASE_URL, SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    getAccessToken: getAccessToken, getRefreshToken: getRefreshToken,
    setTokens: setTokens, clearTokens: clearTokens,
    signIn: signIn, refreshTokens: refreshTokens, authFetch: authFetch,
  };
})(typeof window !== 'undefined' ? window : globalThis);
