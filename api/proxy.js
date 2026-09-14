export const config = { api: { bodyParser: true } };

// Б1+Б2+Б3 (24.08.2026): общий APP_PASSWORD заменён на вход через Supabase
// Auth — вход/проверку пароля с экрана логина теперь делает index.html
// напрямую через Auth REST API (см. index.html: signIn), эта функция больше
// не участвует в проверке пароля (старый ping-путь убран как мёртвый код).
import { requireUser, setCorsHeaders, ownKeysMode } from './_auth.js';
export default async function handler(req, res) {
  setCorsHeaders(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const { client_id, ...rest } = req.body || {};
    const body = { ...rest, stream: false };

    // Ключ клиента, если он заведён. Режим «свои ключи»: вызовы идут за счёт
    // клиента, кредиты платформы не тратятся (решение владелицы 13.09.2026).
    // Спрашиваем базу ОТ ИМЕНИ ПОЛЬЗОВАТЕЛЯ: функция сама проверит, что клиент
    // его, и вернёт секрет только владельцу. Нет ключа, нет функции (миграция
    // не применена), нет ответа — работаем на своём: прогон важнее экономии,
    // и молча падать из-за незаведённого ключа нельзя.
    let key = process.env.OPENAI_API_KEY;
    let провайдер = 'openai';
    // Ключ клиента берём ТОЛЬКО на тарифе «Разработчик». На подписке работа
    // идёт на ключах платформы — так написано в интерфейсе, и так теперь на
    // самом деле.
    if (client_id && await ownKeysMode(auth, client_id)) {
      // Сначала ключ OpenAI, нет — OpenRouter: владелица заводит «одну
      // платформу с разными нейронками», и её ключ может быть от OpenRouter.
      for (const п of ['openai', 'openrouter']) {
        try {
          const r = await fetch(auth.pgBase + 'rpc/provider_key_for', {
            method: 'POST', headers: auth.pgHeaders,
            body: JSON.stringify({ p_client: client_id, p_provider: п, p_purpose: 'writing' }),
          });
          if (r.ok) {
            const d = await r.json().catch(() => null);
            const свой = typeof d === 'string' ? d : (d && d.provider_key_for);
            if (свой && String(свой).trim()) { key = String(свой).trim(); провайдер = п; break; }
          }
        } catch { /* пробуем следующего / остаёмся на своём ключе */ }
      }
    }

    // Маршрутизация по ФАКТИЧЕСКОМУ ключу, не только по строке в базе:
    // первый живой ключ владелицы был OpenRouter (sk-or-v1…), сохранённый
    // под провайдером openai, — уходил на api.openai.com и молча ловил 401.
    // Ключ OpenRouter узнаваем по префиксу, шлём его туда, где он работает.
    if (/^sk-or-/i.test(key)) провайдер = 'openrouter';
    if (провайдер === 'openrouter' && body.model && body.model.indexOf('/') < 0) {
      // У OpenRouter имена моделей с вендором: gpt-4.1 → openai/gpt-4.1
      body.model = 'openai/' + body.model;
    }
    const адрес = провайдер === 'openrouter'
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const r = await fetch(адрес, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
