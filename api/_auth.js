// Общий хелпер авторизации для всех api/*.js (Б1+Б2+Б3, план от 24.08.2026).
// Имя начинается с "_" — Vercel не публикует такие файлы как отдельный route,
// стандартный приём делиться кодом между serverless-функциями без
// package.json/сборки (тот же ноль-зависимостей стиль, что у всего проекта).
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
