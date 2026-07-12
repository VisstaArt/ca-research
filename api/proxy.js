export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Защита доступа: если на Vercel задан APP_PASSWORD, запросы без него отклоняются.
  // Пока переменная не задана — работаем в открытом режиме (как раньше).
  const appPassword = process.env.APP_PASSWORD;
  if (appPassword) {
    const key = req.headers['x-app-key'];
    if (key !== appPassword) {
      return res.status(401).json({ error: { message: 'Unauthorized', code: 'bad_app_key' } });
    }
  }

  // Лёгкая проверка пароля с экрана входа — без обращения к OpenAI
  if (req.body && req.body.ping) {
    return res.status(200).json({ ok: true, locked: Boolean(appPassword) });
  }

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
