export const config = { api: { bodyParser: true } };

// Реальный веб-поиск через Tavily.
// Возвращает сырые выдержки с URL — их кладём в промпт модуля,
// модель работает ТОЛЬКО с переданным материалом (антигаллюцинационный пайплайн).
// Б1+Б2+Б3 (24.08.2026): общий APP_PASSWORD заменён на проверку JWT пользователя
// (Supabase Auth) — без него платный Tavily-поиск был бы доступен всем.
import { requireUser, setCorsHeaders, ownKeysMode } from './_auth.js';
export default async function handler(req, res) {
  setCorsHeaders(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireUser(req, res);
  if (!auth) return;

  const { query, client_id, max_results, depth, days, include_domains, exclude_domains, include_raw_content } = req.body || {};
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: { message: 'query is required', code: 'bad_request' } });
  }

  // Поисковый ключ клиента, если заведён, — тот же порядок, что у OpenAI в
  // proxy.js: спрашиваем базу ОТ ИМЕНИ ПОЛЬЗОВАТЕЛЯ (функция вернёт секрет
  // только владельцу клиента), нет ключа/функции/ответа — работаем на ключе
  // платформы: поиск важнее экономии, молча падать нельзя.
  const ключи = [];
  let причина = '';          // почему ключ клиента не пошёл в дело
  let своиКлючи = 0;         // сколько ключей клиента удалось прочитать
  // Тот же порядок, что у пишущей модели: поисковый ключ клиента идёт в дело
  // только на тарифе «Разработчик».
  if (client_id && await ownKeysMode(auth, client_id)) {
    // Сначала список всех ключей поиска этого клиента, если база умеет его
    // отдавать. Умеет не всегда: функция появилась позже — тогда работаем
    // по-старому, с одним ключом.
    try {
      const r = await fetch(auth.pgBase + 'rpc/provider_keys_for', {
        method: 'POST', headers: auth.pgHeaders,
        body: JSON.stringify({ p_client: client_id, p_provider: 'tavily', p_purpose: 'search' }),
      });
      if (r.ok) {
        const d = await r.json().catch(() => null);
        const список = Array.isArray(d) ? d : (d && d.provider_keys_for) || [];
        for (const к of список) {
          const з = typeof к === 'string' ? к : (к && (к.secret || к.key));
          if (з && String(з).trim()) { ключи.push(String(з).trim()); своиКлючи++; }
        }
      } else {
        const т = await r.text().catch(() => '');
        причина = 'база не отдала список ключей (' + r.status + ') ' + т.slice(0, 120);
      }
    } catch (e) { причина = 'список ключей недоступен: ' + (e && e.message || e); }
    if (!ключи.length) {
      try {
        const r = await fetch(auth.pgBase + 'rpc/provider_key_for', {
          method: 'POST', headers: auth.pgHeaders,
          body: JSON.stringify({ p_client: client_id, p_provider: 'tavily', p_purpose: 'search' }),
        });
        if (r.ok) {
          const d = await r.json().catch(() => null);
          const свой = typeof d === 'string' ? d : (d && d.provider_key_for);
          if (свой && String(свой).trim()) { ключи.push(String(свой).trim()); своиКлючи++; }
        } else {
          const т = await r.text().catch(() => '');
          причина = причина || ('база не отдала ключ клиента (' + r.status + ') ' + т.slice(0, 120));
        }
      } catch (e) { причина = причина || ('ключ клиента недоступен: ' + (e && e.message || e)); }
    }
  }
  // Ключи платформы — последними: сперва клиентские, если они есть. Их тоже
  // может быть несколько (TAVILY_API_KEY, TAVILY_API_KEY_2 … _5): бесплатная
  // тысяча кончается за день отладки, и владелица заводит запасные аккаунты.
  for (const имя of ['TAVILY_API_KEY', 'TAVILY_API_KEY_2', 'TAVILY_API_KEY_3',
                     'TAVILY_API_KEY_4', 'TAVILY_API_KEY_5']) {
    const з = process.env[имя];
    if (з && String(з).trim()) ключи.push(String(з).trim());
  }
  if (!ключи.length) {
    return res.status(503).json({ error: { message: 'Search is not configured (TAVILY_API_KEY missing)', code: 'search_unconfigured' } });
  }

  // Кончились кредиты на одном ключе — молча берём следующий. Провайдер
  // отвечает на это 432 (кредиты) или 401/403 (ключ отозван); прочие ошибки
  // повторять другим ключом бессмысленно — они не про ключ.
  const исчерпан = код => код === 432 || код === 402 || код === 401
    || код === 403 || код === 429;
  let ответ = null, данные = null, последнийКод = 0;
  for (const key of ключи) {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        query,
        search_depth: depth === 'advanced' ? 'advanced' : 'basic',
        max_results: Math.min(Number(max_results) || 8, 20),
        ...(days ? { days: Number(days) } : {}),
        ...(Array.isArray(include_domains) && include_domains.length ? { include_domains } : {}),
        ...(Array.isArray(exclude_domains) && exclude_domains.length ? { exclude_domains } : {}),
        include_answer: false,
        // raw_content — полный текст страницы (много цитат), а не короткий сниппет.
        // Включаем точечно для VoC: без него модель видит 1–2 фразы и «мусолит» их.
        include_raw_content: include_raw_content === true,
      }),
    });
    const data = await r.json().catch(() => null);
    if (r.ok) { ответ = r; данные = data; break; }
    последнийКод = r.status;
    if (!исчерпан(r.status)) {
      return res.status(r.status).json({ error: { message: data?.detail || 'Tavily error' } });
    }
    // иначе идём к следующему ключу
  }
  if (!ответ) {
    return res.status(последнийКод || 502).json({ error: {
      message: 'Поиск не отработал: у всех заведённых ключей кончились кредиты или они отозваны. '
        + 'Заведите ещё один ключ поиска или пополните текущий.',
      code: 'search_keys_exhausted' } });
  }

  try {
    const data = данные || {};
    // Приводим к компактному виду для промптов: только то, что нужно модели
    const results = (data.results || []).map(x => ({
      title: x.title,
      url: x.url,
      content: x.content,
      raw_content: x.raw_content || null,
      score: x.score,
      published_date: x.published_date || null,
    }));
    res.status(200).json({ query, results,
      // Чей ключ реально сработал. Без этого экран может говорить «на ключе
      // клиента», пока платит платформа.
      чейКлюч: своиКлючи ? 'клиента' : 'платформы',
      почему: своиКлючи ? '' : (причина || (client_id ? 'ключ клиента не заведён' : '')) });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
}
