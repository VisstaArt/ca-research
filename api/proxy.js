export const config = { api: { bodyParser: true } };

// Б1+Б2+Б3 (24.08.2026): общий APP_PASSWORD заменён на вход через Supabase
// Auth — вход/проверку пароля с экрана логина теперь делает index.html
// напрямую через Auth REST API (см. index.html: signIn), эта функция больше
// не участвует в проверке пароля (старый ping-путь убран как мёртвый код).
import { requireUser, setCorsHeaders } from './_auth.js';
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
    if (client_id) {
      try {
        const r = await fetch(auth.pgBase + 'rpc/provider_key_for', {
          method: 'POST', headers: auth.pgHeaders,
          body: JSON.stringify({ p_client: client_id, p_provider: 'openai', p_purpose: 'writing' }),
        });
        if (r.ok) {
          const d = await r.json().catch(() => null);
          const свой = typeof d === 'string' ? d : (d && d.provider_key_for);
          if (свой && String(свой).trim()) key = String(свой).trim();
        }
      } catch { /* остаёмся на своём ключе */ }
    }

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
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
