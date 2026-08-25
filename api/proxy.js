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
    const body = { ...req.body, stream: false };
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
