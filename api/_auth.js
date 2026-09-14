// Общий хелпер авторизации для всех api/*.js (Б1+Б2+Б3, план от 24.08.2026).
// Имя начинается с "_" — Vercel не публикует такие файлы как отдельный route,
// стандартный приём делиться кодом между serverless-функциями без
// package.json/сборки (тот же ноль-зависимостей стиль, что у всего проекта).

// Б4 (25.08.2026): раньше 'Access-Control-Allow-Origin: *' на всех эндпоинтах —
// любой сторонний сайт мог дёргать API. CORS — это только браузерное
// ограничение (curl/серверные вызовы им не подчиняются), но именно оно не
// даёт чужому сайту от лица зашедшего пользователя тихо дёргать наш API из
// его же браузера. Один известный источник — сама владелица заходит по
// постоянному адресу (STATE.md: «заходить ВСЕГДА по ...vercel.app», не по
// одноразовым URL превью-деплоев).
export const ALLOWED_ORIGIN = 'https://ca-research-git-main-art-vissta-s-projects.vercel.app';
export function setCorsHeaders(res, methods) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
//
// Раньше: общий APP_PASSWORD + SUPABASE_SERVICE_ROLE_KEY (ключ, который
// ОБХОДИТ RLS по определению — фильтрация "чья это строка" была только на
// совести кода каждой функции, что и привело к Б2: GET без фильтра по
// владельцу отдавал вообще все исследования всем).
//
// Теперь: клиент шлёт JWT пользователя (получен через Supabase Auth при
// входе), эта функция его проверяет и возвращает заголовки для PostgREST
// ОТ ИМЕНИ ЭТОГО ПОЛЬЗОВАТЕЛЯ (anon key + его токен, не service_role) —
// Row Level Security на стороне Postgres сам не отдаст чужие строки,
// независимо от того, что (не)дописали в коде конкретного эндпоинта.
export async function requireUser(req, res) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ error: { message: 'Unauthorized', code: 'no_token' } });
    return null;
  }
  const SB_URL = process.env.SUPABASE_URL;
  const ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SB_URL || !ANON_KEY) {
    res.status(503).json({ error: { message: 'Auth is not configured', code: 'auth_unconfigured' } });
    return null;
  }
  const base = SB_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  // GoTrue сам проверяет подпись/срок действия токена — не дублируем эту логику здесь.
  let r;
  try {
    r = await fetch(base + '/auth/v1/user', { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + token } });
  } catch (e) {
    res.status(503).json({ error: { message: 'Auth service unreachable', code: 'auth_unreachable' } });
    return null;
  }
  if (!r.ok) {
    res.status(401).json({ error: { message: 'Invalid or expired token', code: 'bad_token' } });
    return null;
  }
  const user = await r.json();
  return {
    userId: user.id,
    pgHeaders: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: 'Bearer ' + token },
    pgBase: base + '/rest/v1/',
  };
}

// Тариф клиента решает, ЧЕЙ ключ идёт в дело. До 14.09 он переключал только
// то, что видно в интерфейсе: поля ключей прятались, а сервер всё равно брал
// клиентский ключ — вернуть расход на платформу было нечем. Владелице это
// нужно для сравнения моделей: прогоны на её счёт, потом обратно на клиента.
export async function ownKeysMode(auth, clientId) {
  if (!clientId) return false;
  try {
    const r = await fetch(auth.pgBase + 'clients?select=billing_mode&id=eq.'
      + encodeURIComponent(clientId), { headers: auth.pgHeaders });
    if (!r.ok) return false;
    const d = await r.json().catch(() => null);
    return Array.isArray(d) && d[0] && d[0].billing_mode === 'own_keys';
  } catch { return false; }   // не знаем — работаем на своём ключе
}
